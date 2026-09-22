const std = @import("std");
const model_file = @import("model.zig");
const Model = model_file.Model;
const Tokenizer = @import("tokenizer.zig").Tokenizer;
const gliner = @import("gliner.zig");

const max_request_bytes = 2 * 1024 * 1024;
const threshold: f32 = 0.70;
const Choice = struct { code: []const u8, surface: []const u8 };
const Field = struct { name: []const u8, type_name: []const u8, choices: []Choice, entity: ?[]const u8 };

pub fn main() !void {
    var state = std.heap.DebugAllocator(.{}){}; defer _ = state.deinit();
    const allocator = state.allocator();
    var tokenizer = try Tokenizer.init(allocator, env("PARAMS_TOKENIZER") orelse "models/params/tokenizer.json"); defer tokenizer.deinit();
    var model = try Model.init(allocator, env("PARAMS_MODEL") orelse "models/params/model.onnx"); defer model.deinit();
    try serve(allocator, &model, &tokenizer, env("PARAMS_HOST") orelse "0.0.0.0", port(env("PARAMS_PORT") orelse "8000"));
}

fn serve(allocator: std.mem.Allocator, model: *Model, tokenizer: *Tokenizer, host: []const u8, listen_port: u16) !void {
    const io = std.Options.debug_io;
    var listener = try (try std.Io.net.IpAddress.parse(host, listen_port)).listen(io, .{ .reuse_address = true }); defer listener.deinit(io);
    std.log.info("PARAMS listening on http://{s}:{d}", .{ host, listen_port });
    while (true) { var stream = try listener.accept(io); defer stream.close(io); handle(allocator, model, tokenizer, stream) catch |err| std.log.warn("request failed: {s}", .{@errorName(err)}); }
}

fn handle(allocator: std.mem.Allocator, model: *Model, tokenizer: *Tokenizer, stream: std.Io.net.Stream) !void {
    const io = std.Options.debug_io;
    var input: [64 * 1024]u8 = undefined; var output: [16 * 1024]u8 = undefined;
    var reader = stream.reader(io, &input); var writer = stream.writer(io, &output);
    var server = std.http.Server.init(&reader.interface, &writer.interface); var request = try server.receiveHead();
    const path = request.head.target[0 .. std.mem.indexOfScalar(u8, request.head.target, '?') orelse request.head.target.len];
    if (request.head.method == .GET and std.mem.eql(u8, path, "/healthz")) return respond(&request, "{\"ok\":true}", .ok);
    if (request.head.method != .POST or !std.mem.eql(u8, path, "/params")) return respond(&request, "{\"error\":\"not found\"}", .not_found);
    var body_buffer: [64 * 1024]u8 = undefined;
    const body = request.readerExpectNone(&body_buffer).allocRemaining(allocator, .limited(max_request_bytes)) catch return respond(&request, "{\"error\":\"payload rejected\"}", .payload_too_large); defer allocator.free(body);
    var doc = std.json.parseFromSlice(std.json.Value, allocator, body, .{}) catch return respond(&request, "{\"error\":\"bad json\"}", .bad_request); defer doc.deinit();
    const root = switch (doc.value) { .object => |value| value, else => return respond(&request, "{\"error\":\"request must be object\"}", .bad_request) };
    const query = str(root, "query") orelse str(root, "text") orelse return respond(&request, "{\"error\":\"query required\"}", .bad_request);
    const format = switch (root.get("format") orelse return respond(&request, "{\"error\":\"format required\"}", .bad_request)) { .object => |value| value, else => return respond(&request, "{\"error\":\"format must be object\"}", .bad_request) };
    const variants = switch (root.get("variants") orelse std.json.Value{ .object = .empty }) { .object => |value| value, else => return respond(&request, "{\"error\":\"variants must be object\"}", .bad_request) };
    const fields = fieldsFromJson(allocator, format, variants) catch return respond(&request, "{\"error\":\"invalid format\"}", .bad_request); defer freeFields(allocator, fields);
    const reply = extract(allocator, model, tokenizer, query, fields) catch |err| { std.log.warn("model failed: {s}: {s}", .{ @errorName(err), model_file.lastError() }); return respond(&request, "{\"error\":\"model failed\"}", .internal_server_error); }; defer allocator.free(reply);
    return respond(&request, reply, .ok);
}

fn fieldsFromJson(allocator: std.mem.Allocator, format: std.json.ObjectMap, variants: std.json.ObjectMap) ![]Field {
    var fields: std.ArrayList(Field) = .empty; errdefer freeFields(allocator, fields.items);
    var it = format.iterator(); while (it.next()) |item| {
        const type_name = switch (item.value_ptr.*) { .object => |value| str(value, "type") orelse "string", else => "string" };
        var choices: std.ArrayList(Choice) = .empty;
        if (variants.get(item.key_ptr.*)) |values| switch (values) { .array => |array| for (array.items) |value| switch (value) { .string => |code| try choices.append(allocator, .{ .code = try allocator.dupe(u8, code), .surface = try labelSurface(allocator, item.key_ptr.*, code) }), else => return error.InvalidVariants }, else => return error.InvalidVariants };
        const entity = if (choices.items.len == 0) try entityLabel(allocator, item.key_ptr.*) else null;
        try fields.append(allocator, .{ .name = try allocator.dupe(u8, item.key_ptr.*), .type_name = try allocator.dupe(u8, type_name), .choices = try choices.toOwnedSlice(allocator), .entity = entity });
    }
    return fields.toOwnedSlice(allocator);
}

fn freeFields(allocator: std.mem.Allocator, fields: []Field) void { for (fields) |field| { allocator.free(field.name); allocator.free(field.type_name); if (field.entity) |value| allocator.free(value); for (field.choices) |choice| { allocator.free(choice.code); allocator.free(choice.surface); } allocator.free(field.choices); } allocator.free(fields); }
fn labelSurface(allocator: std.mem.Allocator, name: []const u8, code: []const u8) ![]u8 { if (std.mem.eql(u8, name, "time_range")) { if (std.mem.eql(u8, code, "last_hour")) return allocator.dupe(u8, "the last hour"); if (std.mem.eql(u8, code, "last_7_days")) return allocator.dupe(u8, "the last week"); if (std.mem.eql(u8, code, "last_30_days")) return allocator.dupe(u8, "the last month"); } return allocator.dupe(u8, code); }
fn entityLabel(allocator: std.mem.Allocator, name: []const u8) ![]u8 {
    if (std.mem.eql(u8, name, "city_id")) return allocator.dupe(u8, "city id");
    if (std.mem.eql(u8, name, "date_from")) return allocator.dupe(u8, "start date");
    if (std.mem.eql(u8, name, "date_to")) return allocator.dupe(u8, "end date");
    const label = try allocator.dupe(u8, name);
    for (label) |*byte| { if (byte.* == '_') byte.* = ' '; }
    return label;
}

fn extract(allocator: std.mem.Allocator, model: *Model, tokenizer: *Tokenizer, query: []const u8, fields: []const Field) ![]u8 {
    const text = if (query.len > 0 and (query[query.len - 1] == '.' or query[query.len - 1] == '!' or query[query.len - 1] == '?')) try allocator.dupe(u8, query) else try std.fmt.allocPrint(allocator, "{s}.", .{query}); defer allocator.free(text);
    var json: std.ArrayList(u8) = .empty; errdefer json.deinit(allocator); try json.append(allocator, '{'); var first = true;
    var entity_labels: std.ArrayList([]const u8) = .empty; defer entity_labels.deinit(allocator);
    for (fields) |field| if (field.entity) |entity| try entity_labels.append(allocator, entity);
    if (entity_labels.items.len > 0) {
        var input_pack = try gliner.pack(allocator, tokenizer, text, entity_labels.items, "[E]", "entities", 0); defer input_pack.deinit(allocator);
        var output = try model.run(&input_pack); defer model_file.freeOutput(&output);
        var entity_index: usize = 0;
        for (fields) |field| if (field.entity != null) {
            if (findEntity(query, field, entity_index, &input_pack, &output)) |value| try jsonField(allocator, &json, &first, field.name, value, std.mem.eql(u8, field.type_name, "integer"));
            entity_index += 1;
        };
    }
    for (fields) |field| if (field.entity == null) {
        const labels = try allocator.alloc([]const u8, field.choices.len); defer allocator.free(labels);
        for (field.choices, 0..) |choice, i| labels[i] = choice.surface;
        var input_pack = try gliner.pack(allocator, tokenizer, text, labels, "[L]", field.name, 1); defer input_pack.deinit(allocator);
        var output = try model.run(&input_pack); defer model_file.freeOutput(&output);
        if (findClass(field, &input_pack, &output)) |value| try jsonField(allocator, &json, &first, field.name, value, false);
    };
    try json.append(allocator, '}'); return json.toOwnedSlice(allocator);
}

fn findClass(field: Field, input_pack: *const gliner.Packed, output: *const model_file.TensorOutput) ?[]const u8 {
    const shape = output.shape orelse return null; const sequence: usize = @intCast(shape[1]); const width: usize = @intCast(shape[2]); const labels: usize = @intCast(shape[3]);
    if (sequence != input_pack.words_mask.len or width == 0 or labels != field.choices.len) return null;
    const position = firstWordPosition(input_pack.words_mask, 0) orelse return null; const logits: [*]const f32 = @ptrCast(@alignCast(output.data orelse return null));
    var best = threshold; var picked: ?usize = null;
    for (field.choices, 0..) |_, index| { const score = sigmoid(logits[position * width * labels + index]); if (score > best) { best = score; picked = index; } }
    return if (picked) |index| field.choices[index].code else null;
}

fn findEntity(query: []const u8, field: Field, label_index: usize, input_pack: *const gliner.Packed, output: *const model_file.TensorOutput) ?[]const u8 {
    const shape = output.shape orelse return null; const sequence: usize = @intCast(shape[1]); const max_width: usize = @intCast(shape[2]); const labels: usize = @intCast(shape[3]);
    if (sequence != input_pack.words_mask.len or label_index >= labels) return null;
    const logits: [*]const f32 = @ptrCast(@alignCast(output.data orelse return null)); var best = threshold; var result: ?[]const u8 = null;
    for (0..input_pack.starts.len) |start_word| {
        const position = firstWordPosition(input_pack.words_mask, start_word) orelse continue;
        for (0..max_width) |span_width| {
            const end_word = start_word + span_width; if (end_word >= input_pack.ends.len) continue;
            const score = sigmoid(logits[position * max_width * labels + span_width * labels + label_index]); if (score <= best) continue;
            const char_start = input_pack.starts[start_word]; const char_end = @min(input_pack.ends[end_word], query.len); if (char_start >= char_end) continue;
            const value = query[char_start..char_end]; if (std.mem.eql(u8, field.type_name, "integer") and !hasDigit(value)) continue; if ((std.mem.eql(u8, field.name, "date_from") or std.mem.eql(u8, field.name, "date_to")) and !isDate(value)) continue;
            best = score; result = value;
        }
    }
    return result;
}

fn firstWordPosition(mask: []const i64, word_index: usize) ?usize { var found: usize = 0; for (mask, 0..) |value, position| if (value != 0) { if (found == word_index) return position; found += 1; }; return null; }
fn jsonField(allocator: std.mem.Allocator, json: *std.ArrayList(u8), first: *bool, name: []const u8, value: []const u8, integer: bool) !void { if (!first.*) try json.append(allocator, ','); first.* = false; const key = try std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = name }, .{}); defer allocator.free(key); try json.appendSlice(allocator, key); try json.append(allocator, ':'); if (integer) { for (value) |byte| if (byte >= '0' and byte <= '9') try json.append(allocator, byte); } else { const encoded = try std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = value }, .{}); defer allocator.free(encoded); try json.appendSlice(allocator, encoded); } }
fn hasDigit(text: []const u8) bool { for (text) |byte| if (byte >= '0' and byte <= '9') return true; return false; }
fn isDate(text: []const u8) bool { if (text.len != 10 or text[4] != '-' or text[7] != '-') return false; for (text, 0..) |byte, index| if (index != 4 and index != 7 and (byte < '0' or byte > '9')) return false; return true; }
fn sigmoid(value: f32) f32 { return if (value >= 0) 1 / (1 + @exp(-value)) else blk: { const x = @exp(value); break :blk x / (1 + x); }; }
fn respond(request: *std.http.Server.Request, body: []const u8, status: std.http.Status) !void { try request.respond(body, .{ .status = status, .keep_alive = false, .extra_headers = &.{.{ .name = "content-type", .value = "application/json; charset=utf-8" }} }); }
fn str(object: std.json.ObjectMap, name: []const u8) ?[]const u8 { return switch (object.get(name) orelse return null) { .string => |value| value, else => null }; }
fn port(value: []const u8) u16 { return std.fmt.parseInt(u16, value, 10) catch 8000; }
fn env(name: [*:0]const u8) ?[]const u8 { const value = std.c.getenv(name) orelse return null; return std.mem.span(value); }
