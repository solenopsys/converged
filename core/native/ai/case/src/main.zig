const std = @import("std");
const Model = @import("model.zig").Model;
const context = @import("context.zig");
const router = @import("router.zig");
const Tokenizer = @import("tokenizer.zig").Tokenizer;

const max_request_bytes = 2 * 1024 * 1024;

pub fn main() !void {
    var gpa_state = std.heap.DebugAllocator(.{}){};
    defer _ = gpa_state.deinit();
    const allocator = gpa_state.allocator();
    const model_path = env("CASE_MODEL") orelse "granite97.onnx";
    const tokenizer_path = env("CASE_TOKENIZER") orelse "tokenizer.json";
    const host = env("CASE_HOST") orelse "0.0.0.0";
    const port = parsePort(env("CASE_PORT") orelse "8000");
    var tokenizer = try Tokenizer.init(allocator, tokenizer_path);
    defer tokenizer.deinit();
    var model = try Model.init(allocator, model_path, &tokenizer);
    defer model.deinit();
    var contexts = context.Contexts{ .allocator = allocator };
    defer contexts.deinit();
    _ = model.encode(&.{"warmup"}) catch |err| std.log.warn("warmup failed: {s}", .{@errorName(err)});
    try serve(allocator, &model, &contexts, host, port);
}

fn serve(allocator: std.mem.Allocator, model: *Model, contexts: *context.Contexts, host: []const u8, port: u16) !void {
    const io = std.Options.debug_io;
    const address = try std.Io.net.IpAddress.parse(host, port);
    var listener = try address.listen(io, .{ .reuse_address = true });
    defer listener.deinit(io);
    std.log.info("CASE listening on http://{s}:{d}", .{ host, port });
    while (true) {
        var stream = try listener.accept(io);
        defer stream.close(io);
        handleConnection(allocator, model, contexts, stream) catch |err| std.log.warn("request failed: {s}", .{@errorName(err)});
    }
}

fn handleConnection(allocator: std.mem.Allocator, model: *Model, contexts: *context.Contexts, stream: std.Io.net.Stream) !void {
    const io = std.Options.debug_io;
    var input: [64 * 1024]u8 = undefined;
    var output: [16 * 1024]u8 = undefined;
    var reader = stream.reader(io, &input);
    var writer = stream.writer(io, &output);
    var server = std.http.Server.init(&reader.interface, &writer.interface);
    var request = try server.receiveHead();
    const path = request.head.target[0 .. std.mem.indexOfScalar(u8, request.head.target, '?') orelse request.head.target.len];
    if (request.head.method == .GET and std.mem.eql(u8, path, "/healthz")) return respond(&request, "{\"ok\":true}", .ok);
    if (request.head.method == .GET and std.mem.eql(u8, path, "/stats")) return handleStats(allocator, contexts, &request);
    if (request.head.method != .POST or (!std.mem.eql(u8, path, "/contexts") and !std.mem.eql(u8, path, "/route"))) return respond(&request, "{\"error\":\"not found\"}", .not_found);
    var body_buffer: [64 * 1024]u8 = undefined;
    const body = request.readerExpectNone(&body_buffer).allocRemaining(allocator, .limited(max_request_bytes)) catch return respond(&request, "{\"error\":\"payload rejected\"}", .payload_too_large);
    defer allocator.free(body);
    if (std.mem.eql(u8, path, "/contexts")) return handleContext(allocator, model, contexts, &request, body);
    return handleRoute(allocator, model, contexts, &request, body);
}

fn handleStats(allocator: std.mem.Allocator, contexts: *context.Contexts, request: *std.http.Server.Request) !void {
    var vectors: usize = 0;
    var commands: usize = 0;
    var iterator = contexts.items.valueIterator();
    while (iterator.next()) |index| {
        vectors += index.*.entries.items.len;
        commands += index.*.commands;
    }
        const reply = try std.fmt.allocPrint(allocator, "{{\"rss_mb\":{d},\"contexts\":{d},\"vectors\":{d},\"commands\":{d},\"th_execute\":{d:.2},\"th_unknown\":{d:.2},\"margin\":{d:.3}}}", .{ rssMb(), contexts.items.count(), vectors, commands, router.legacy_execute_threshold, router.unknown_threshold, router.legacy_command_margin });
    defer allocator.free(reply);
    return respond(request, reply, .ok);
}

fn handleContext(allocator: std.mem.Allocator, model: *Model, contexts: *context.Contexts, request: *std.http.Server.Request, body: []const u8) !void {
    var doc = std.json.parseFromSlice(std.json.Value, allocator, body, .{}) catch return respond(request, "{\"error\":\"bad json\"}", .bad_request);
    defer doc.deinit();
    const object = switch (doc.value) {
        .object => |value| value,
        else => return respond(request, "{\"error\":\"bad json\"}", .bad_request),
    };
    const key = stringField(object, "key") orelse return respond(request, "{\"error\":\"context key required\"}", .bad_request);
    if (key.len == 0) return respond(request, "{\"error\":\"context key required\"}", .bad_request);
    if (contexts.items.get(key) != null) return respond(request, "{\"error\":\"context key already exists\"}", .conflict);
    const sections = switch (object.get("sections") orelse return respond(request, "{\"error\":\"sections required\"}", .bad_request)) {
        .array => |value| value.items,
        else => return respond(request, "{\"error\":\"sections must be array\"}", .bad_request),
    };

    const Meta = struct { section: []const u8, id: []const u8, language: []const u8 };
    var texts: std.ArrayList([]const u8) = .empty;
    defer texts.deinit(allocator);
    var meta: std.ArrayList(Meta) = .empty;
    defer meta.deinit(allocator);
    var command_count: usize = 0;
    for (sections) |section| {
        const section_object = switch (section) {
            .object => |value| value,
            else => return respond(request, "{\"error\":\"invalid section\"}", .bad_request),
        };
        const section_id = stringField(section_object, "id") orelse return respond(request, "{\"error\":\"section id required\"}", .bad_request);
        const commands = switch (section_object.get("commands") orelse return respond(request, "{\"error\":\"section commands required\"}", .bad_request)) {
            .array => |value| value.items,
            else => return respond(request, "{\"error\":\"section commands must be array\"}", .bad_request),
        };
        for (commands) |command| {
            const command_object = switch (command) {
                .object => |value| value,
                else => return respond(request, "{\"error\":\"invalid command\"}", .bad_request),
            };
            const command_id = stringField(command_object, "id") orelse return respond(request, "{\"error\":\"command id required\"}", .bad_request);
            const examples = switch (command_object.get("examples") orelse return respond(request, "{\"error\":\"examples required\"}", .bad_request)) {
                .object => |value| value,
                else => return respond(request, "{\"error\":\"examples must be language object\"}", .bad_request),
            };
            var language_iterator = examples.iterator();
            while (language_iterator.next()) |language_entry| {
                const language = language_entry.key_ptr.*;
                const phrases = switch (language_entry.value_ptr.*) {
                    .array => |value| value.items,
                    else => return respond(request, "{\"error\":\"language examples must be array\"}", .bad_request),
                };
                for (phrases) |example| {
                    const text = switch (example) {
                        .string => |value| value,
                        else => return respond(request, "{\"error\":\"example must be string\"}", .bad_request),
                    };
                    try texts.append(allocator, text);
                    try meta.append(allocator, .{ .section = section_id, .id = command_id, .language = language });
                }
            }
            command_count += 1;
        }
    }
    var index = try allocator.create(context.Index);
    index.* = .{ .allocator = allocator };
    errdefer {
        index.deinit();
        allocator.destroy(index);
    }
    const vectors = model.encode(texts.items) catch return respond(request, "{\"error\":\"model failed\"}", .internal_server_error);
    defer allocator.free(vectors);
    if (meta.items.len > 0) {
        const dim = vectors.len / meta.items.len;
        for (meta.items, 0..) |item, i| try index.entries.append(allocator, .{ .section = try allocator.dupe(u8, item.section), .id = try allocator.dupe(u8, item.id), .language = try allocator.dupe(u8, item.language), .vector = try allocator.dupe(f32, vectors[i * dim ..][0..dim]) });
    }
    index.commands = command_count;
    const owned_key = try allocator.dupe(u8, key);
    try contexts.items.put(allocator, owned_key, index);
    const reply = try std.fmt.allocPrint(allocator, "{{\"key\":{f},\"sections\":{d},\"commands\":{d},\"vectors\":{d},\"enc_ms\":0.0,\"rss_mb\":{d}}}", .{ std.json.fmt(key, .{}), sections.len, command_count, index.entries.items.len, rssMb() });
    defer allocator.free(reply);
    return respond(request, reply, .ok);
}

fn handleRoute(allocator: std.mem.Allocator, model: *Model, contexts: *context.Contexts, request: *std.http.Server.Request, body: []const u8) !void {
    var doc = std.json.parseFromSlice(std.json.Value, allocator, body, .{}) catch return respond(request, "{\"error\":\"bad json\"}", .bad_request);
    defer doc.deinit();
    const object = switch (doc.value) {
        .object => |value| value,
        else => return respond(request, "{\"error\":\"bad json\"}", .bad_request),
    };
    const context_key = stringField(object, "context") orelse return respond(request, "{\"error\":\"context required\"}", .bad_request);
    const index = contexts.items.get(context_key) orelse return respond(request, "{\"error\":\"context not found\"}", .not_found);
    const text = stringField(object, "text") orelse return respond(request, "{\"error\":\"empty text\"}", .bad_request);
    if (text.len == 0) return respond(request, "{\"error\":\"empty text\"}", .bad_request);
    const language = stringField(object, "language") orelse router.detectLanguage(text);
    const vector = model.encode(&.{text}) catch return respond(request, "{\"error\":\"model failed\"}", .internal_server_error);
    defer allocator.free(vector);
    const result = router.route(allocator, index, language, vector) catch return respond(request, "{\"error\":\"routing failed\"}", .internal_server_error);
    return routeResponse(allocator, request, result);
}

fn routeResponse(allocator: std.mem.Allocator, request: *std.http.Server.Request, result: router.RouteResult) !void {
    const language_json = try jsonString(allocator, result.language);
    defer allocator.free(language_json);
    const section_json = if (result.section) |value| try jsonString(allocator, value) else try allocator.dupe(u8, "null");
    defer allocator.free(section_json);
    const command_json = if (result.command) |value| try jsonString(allocator, value) else try allocator.dupe(u8, "null");
    defer allocator.free(command_json);
    const surface_weight = try optionalFloat(allocator, result.surface_weight);
    defer allocator.free(surface_weight);
    const surface_log_gap = try optionalFloat(allocator, result.surface_log_gap);
    defer allocator.free(surface_log_gap);
    const reply = try std.fmt.allocPrint(allocator, "{{\"decision\":\"{s}\",\"reason\":\"{s}\",\"language\":{s},\"section\":{s},\"command\":{s},\"score\":{d:.4},\"surface_weight\":{s},\"surface_log_gap\":{s},\"rss_mb\":{d}}}", .{ result.decision, result.reason, language_json, section_json, command_json, result.score, surface_weight, surface_log_gap, rssMb() });
    defer allocator.free(reply);
    return respond(request, reply, .ok);
}

fn jsonString(allocator: std.mem.Allocator, value: []const u8) ![]u8 {
    return std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = value }, .{});
}

fn optionalFloat(allocator: std.mem.Allocator, value: ?f32) ![]u8 {
    return if (value) |number| try std.fmt.allocPrint(allocator, "{d:.4}", .{number}) else try allocator.dupe(u8, "null");
}

fn respond(request: *std.http.Server.Request, body: []const u8, status: std.http.Status) !void {
    try request.respond(body, .{ .status = status, .keep_alive = false, .extra_headers = &.{.{ .name = "content-type", .value = "application/json; charset=utf-8" }} });
}

fn stringField(object: std.json.ObjectMap, name: []const u8) ?[]const u8 {
    return switch (object.get(name) orelse return null) {
        .string => |value| value,
        else => null,
    };
}

fn parsePort(text: []const u8) u16 {
    return std.fmt.parseInt(u16, text, 10) catch 8000;
}

fn env(name: [*:0]const u8) ?[]const u8 {
    const value = std.c.getenv(name) orelse return null;
    return std.mem.span(value);
}

fn rssMb() u64 {
    const bytes = std.Io.Dir.cwd().readFileAlloc(std.Options.debug_io, "/proc/self/status", std.heap.page_allocator, .limited(128 * 1024)) catch return 0;
    defer std.heap.page_allocator.free(bytes);
    const marker = "VmRSS:";
    const at = std.mem.indexOf(u8, bytes, marker) orelse return 0;
    var tokens = std.mem.tokenizeAny(u8, bytes[at + marker.len ..], " \t\n");
    return std.fmt.parseInt(u64, tokens.next() orelse return 0, 10) catch 0;
}
