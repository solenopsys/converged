const std = @import("std");
const Tokenizer = @import("tokenizer.zig").Tokenizer;

const max_request_bytes = 2 * 1024 * 1024;
const max_tokens = 512;
const start_token: i64 = 179934;
const pad_token: i64 = 179935;
const return_token: i64 = 179938;

const OrtwSession = opaque {};
const TensorType = enum(c_int) { float = 1, int64 = 7 };
const TensorInput = extern struct {
    name: [*:0]const u8,
    data: ?*const anyopaque,
    data_bytes: usize,
    shape: [*]const i64,
    shape_len: usize,
    type: TensorType,
};
const TensorOutput = extern struct {
    data: ?*anyopaque,
    data_bytes: usize,
    shape: ?[*]i64,
    shape_len: usize,
    type: TensorType,
};

extern fn ortw_session_create(model_path: [*:0]const u8, intra_op_threads: c_int, out: *?*OrtwSession) c_int;
extern fn ortw_session_destroy(session: *OrtwSession) void;
extern fn ortw_session_run(session: *OrtwSession, inputs: [*]const TensorInput, input_count: usize, output_names: [*]const [*:0]const u8, output_count: usize, outputs: [*]TensorOutput) c_int;
extern fn ortw_tensor_output_free(output: *TensorOutput) void;
extern fn ortw_last_error() ?[*:0]const u8;

const Entry = struct {
    id: []u8,
    solution: []u8,
    vector: []f32,
};

const Index = struct {
    allocator: std.mem.Allocator,
    entries: std.ArrayList(Entry) = .empty,
    commands: usize = 0,

    fn deinit(self: *Index) void {
        self.clear();
        self.entries.deinit(self.allocator);
    }

    fn clear(self: *Index) void {
        for (self.entries.items) |entry| {
            self.allocator.free(entry.id);
            self.allocator.free(entry.solution);
            self.allocator.free(entry.vector);
        }
        self.entries.clearRetainingCapacity();
        self.commands = 0;
    }
};

const Model = struct {
    allocator: std.mem.Allocator,
    session: *OrtwSession,
    tokenizer: *const Tokenizer,

    fn init(allocator: std.mem.Allocator, path: []const u8, tokenizer: *const Tokenizer) !Model {
        const path_z = try allocator.dupeZ(u8, path);
        defer allocator.free(path_z);
        var session: ?*OrtwSession = null;
        if (ortw_session_create(path_z.ptr, 0, &session) != 0) {
            logOrtError();
            return error.OnnxSessionCreateFailed;
        }
        return .{ .allocator = allocator, .session = session.?, .tokenizer = tokenizer };
    }

    fn deinit(self: *Model) void {
        ortw_session_destroy(self.session);
    }

    fn encode(self: *Model, texts: []const []const u8) ![]f32 {
        if (texts.len == 0) return try self.allocator.alloc(f32, 0);
        var sequences = try self.allocator.alloc([]i64, texts.len);
        var sequence_count: usize = 0;
        defer {
            for (sequences[0..sequence_count]) |sequence| self.allocator.free(sequence);
            self.allocator.free(sequences);
        }
        var width: usize = 2;
        for (texts, 0..) |text, i| {
            sequences[i] = self.tokenizer.encode(self.allocator, text, max_tokens) catch |err| {
                std.log.err("tokenize failed for {s}: {s}", .{ text, @errorName(err) });
                return err;
            };
            sequence_count += 1;
            width = @max(width, sequences[i].len);
        }
        const ids = try self.allocator.alloc(i64, texts.len * width);
        defer self.allocator.free(ids);
        const masks = try self.allocator.alloc(i64, texts.len * width);
        defer self.allocator.free(masks);
        @memset(ids, pad_token);
        @memset(masks, 0);
        for (sequences, 0..) |sequence, row| {
            @memcpy(ids[row * width ..][0..sequence.len], sequence);
            @memset(masks[row * width ..][0..sequence.len], 1);
        }

        const shape = [_]i64{ @intCast(texts.len), @intCast(width) };
        const input_names = [_][*:0]const u8{ "input_ids", "attention_mask" };
        const inputs = [_]TensorInput{
            .{ .name = input_names[0], .data = @ptrCast(ids.ptr), .data_bytes = ids.len * @sizeOf(i64), .shape = &shape, .shape_len = shape.len, .type = .int64 },
            .{ .name = input_names[1], .data = @ptrCast(masks.ptr), .data_bytes = masks.len * @sizeOf(i64), .shape = &shape, .shape_len = shape.len, .type = .int64 },
        };
        const output_names = [_][*:0]const u8{"last_hidden"};
        var outputs = [_]TensorOutput{std.mem.zeroes(TensorOutput)};
        if (ortw_session_run(self.session, &inputs, inputs.len, &output_names, output_names.len, &outputs) != 0) {
            logOrtError();
            return error.OnnxRunFailed;
        }
        defer ortw_tensor_output_free(&outputs[0]);
        if (outputs[0].type != .float or outputs[0].data == null or outputs[0].shape == null or outputs[0].shape_len != 3) return error.InvalidOnnxOutput;
        const out_shape = outputs[0].shape.?;
        const batch: usize = @intCast(out_shape[0]);
        const hidden: usize = @intCast(out_shape[2]);
        if (batch != texts.len or hidden == 0) return error.InvalidOnnxOutput;
        const source: [*]const f32 = @ptrCast(@alignCast(outputs[0].data.?));
        var vectors = try self.allocator.alloc(f32, batch * hidden);
        for (0..batch) |row| {
            const vector = vectors[row * hidden ..][0..hidden];
            @memcpy(vector, source[row * width * hidden ..][0..hidden]);
            normalize(vector);
        }
        return vectors;
    }
};

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
    var index = Index{ .allocator = allocator };
    defer index.deinit();
    _ = model.encode(&.{"warmup"}) catch |err| std.log.warn("warmup failed: {s}", .{@errorName(err)});
    try serve(allocator, &model, &index, host, port);
}

fn serve(allocator: std.mem.Allocator, model: *Model, index: *Index, host: []const u8, port: u16) !void {
    const io = std.Options.debug_io;
    const address = try std.Io.net.IpAddress.parse(host, port);
    var listener = try address.listen(io, .{ .reuse_address = true });
    defer listener.deinit(io);
    std.log.info("CASE listening on http://{s}:{d}", .{ host, port });
    while (true) {
        var stream = try listener.accept(io);
        defer stream.close(io);
        handleConnection(allocator, model, index, stream) catch |err| std.log.warn("request failed: {s}", .{@errorName(err)});
    }
}

fn handleConnection(allocator: std.mem.Allocator, model: *Model, index: *Index, stream: std.Io.net.Stream) !void {
    const io = std.Options.debug_io;
    var input: [64 * 1024]u8 = undefined;
    var output: [16 * 1024]u8 = undefined;
    var reader = stream.reader(io, &input);
    var writer = stream.writer(io, &output);
    var server = std.http.Server.init(&reader.interface, &writer.interface);
    var request = try server.receiveHead();
    const path = request.head.target[0 .. std.mem.indexOfScalar(u8, request.head.target, '?') orelse request.head.target.len];
    if (request.head.method == .GET and std.mem.eql(u8, path, "/healthz")) return respond(&request, "{\"ok\":true}", .ok);
    if (request.head.method == .GET and std.mem.eql(u8, path, "/stats")) {
        const reply = try std.fmt.allocPrint(allocator, "{{\"rss_mb\":{d},\"vectors\":{d},\"commands\":{d},\"th_execute\":0.9,\"th_unknown\":0.83,\"margin\":0.05}}", .{ rssMb(), index.entries.items.len, index.commands });
        defer allocator.free(reply);
        return respond(&request, reply, .ok);
    }
    if (request.head.method != .POST or (!std.mem.eql(u8, path, "/commands") and !std.mem.eql(u8, path, "/route"))) return respond(&request, "{\"error\":\"not found\"}", .not_found);
    var body_buffer: [64 * 1024]u8 = undefined;
    const body = request.readerExpectNone(&body_buffer).allocRemaining(allocator, .limited(max_request_bytes)) catch return respond(&request, "{\"error\":\"payload rejected\"}", .payload_too_large);
    defer allocator.free(body);
    if (std.mem.eql(u8, path, "/commands")) return handleCommands(allocator, model, index, &request, body);
    return handleRoute(allocator, model, index, &request, body);
}

fn handleCommands(allocator: std.mem.Allocator, model: *Model, index: *Index, request: *std.http.Server.Request, body: []const u8) !void {
    var doc = std.json.parseFromSlice(std.json.Value, allocator, body, .{}) catch return respond(request, "{\"error\":\"bad json\"}", .bad_request);
    defer doc.deinit();
    const object = switch (doc.value) {
        .object => |value| value,
        else => return respond(request, "{\"error\":\"bad json\"}", .bad_request),
    };
    const commands = switch (object.get("commands") orelse return respond(request, "{\"error\":\"commands required\"}", .bad_request)) {
        .array => |value| value.items,
        else => return respond(request, "{\"error\":\"commands must be array\"}", .bad_request),
    };
    const Meta = struct { id: []const u8, solution: []const u8 };
    var texts: std.ArrayList([]const u8) = .empty;
    defer texts.deinit(allocator);
    var meta: std.ArrayList(Meta) = .empty;
    defer meta.deinit(allocator);
    for (commands) |command| {
        const item = switch (command) {
            .object => |value| value,
            else => return respond(request, "{\"error\":\"invalid command\"}", .bad_request),
        };
        const id = stringField(item, "id") orelse return respond(request, "{\"error\":\"command id required\"}", .bad_request);
        const solution = stringField(item, "solution") orelse "";
        const examples = switch (item.get("examples") orelse return respond(request, "{\"error\":\"examples required\"}", .bad_request)) {
            .array => |value| value.items,
            else => return respond(request, "{\"error\":\"examples must be array\"}", .bad_request),
        };
        for (examples) |example| {
            const text = switch (example) {
                .string => |value| value,
                else => return respond(request, "{\"error\":\"example must be string\"}", .bad_request),
            };
            try texts.append(allocator, text);
            try meta.append(allocator, .{ .id = id, .solution = solution });
        }
    }
    const vectors = model.encode(texts.items) catch return respond(request, "{\"error\":\"model failed\"}", .internal_server_error);
    index.clear();
    if (meta.items.len > 0) {
        const dim = vectors.len / meta.items.len;
        for (meta.items, 0..) |item, i| try index.entries.append(allocator, .{ .id = try allocator.dupe(u8, item.id), .solution = try allocator.dupe(u8, item.solution), .vector = try allocator.dupe(f32, vectors[i * dim ..][0..dim]) });
    }
    allocator.free(vectors);
    index.commands = commands.len;
    const reply = try std.fmt.allocPrint(allocator, "{{\"commands\":{d},\"vectors\":{d},\"enc_ms\":0.0,\"rss_mb\":{d}}}", .{ commands.len, index.entries.items.len, rssMb() });
    defer allocator.free(reply);
    try respond(request, reply, .ok);
}

fn handleRoute(allocator: std.mem.Allocator, model: *Model, index: *Index, request: *std.http.Server.Request, body: []const u8) !void {
    var doc = std.json.parseFromSlice(std.json.Value, allocator, body, .{}) catch return respond(request, "{\"error\":\"bad json\"}", .bad_request);
    defer doc.deinit();
    const object = switch (doc.value) {
        .object => |value| value,
        else => return respond(request, "{\"error\":\"bad json\"}", .bad_request),
    };
    const text = stringField(object, "text") orelse return respond(request, "{\"error\":\"empty text\"}", .bad_request);
    if (text.len == 0) return respond(request, "{\"error\":\"empty text\"}", .bad_request);
    const scope = stringField(object, "solution");
    const vector = model.encode(&.{text}) catch return respond(request, "{\"error\":\"model failed\"}", .internal_server_error);
    defer allocator.free(vector);
    var top: ?*const Entry = null;
    var score: f32 = -1;
    var runner_up: f32 = -1;
    for (index.entries.items) |*entry| {
        if (scope) |value| if (!std.mem.eql(u8, value, entry.solution)) continue;
        const candidate = dot(vector, entry.vector);
        if (candidate > score) {
            runner_up = score;
            score = candidate;
            top = entry;
        } else if (candidate > runner_up) runner_up = candidate;
    }
    if (top == null) return respond(request, "{\"decision\":\"UNKNOWN\",\"command\":null,\"score\":0.0,\"alternatives\":[]}", .ok);
    const decision: []const u8 = if (score > 0.90 and score - runner_up >= 0.05) "EXECUTE" else if (score < 0.83) "UNKNOWN" else "AMBIGUOUS";
    const command = try std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = top.?.id }, .{});
    defer allocator.free(command);
    const reply = try std.fmt.allocPrint(allocator, "{{\"decision\":\"{s}\",\"command\":{s},\"score\":{d:.4},\"alternatives\":[],\"enc_ms\":0.0,\"match_ms\":0.0,\"rss_mb\":{d}}}", .{ decision, command, score, rssMb() });
    defer allocator.free(reply);
    try respond(request, reply, .ok);
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
fn normalize(vector: []f32) void {
    var sum: f32 = 0;
    for (vector) |value| sum += value * value;
    if (sum == 0) return;
    const scale = 1 / @sqrt(sum);
    for (vector) |*value| value.* *= scale;
}
fn dot(a: []const f32, b: []const f32) f32 {
    var value: f32 = 0;
    for (a, b) |left, right| value += left * right;
    return value;
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
fn logOrtError() void {
    if (ortw_last_error()) |message| std.log.err("onnxruntime: {s}", .{std.mem.span(message)});
}
