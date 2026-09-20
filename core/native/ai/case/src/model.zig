const std = @import("std");
const Tokenizer = @import("tokenizer.zig").Tokenizer;

pub const max_tokens = 512;
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

pub const Model = struct {
    allocator: std.mem.Allocator,
    session: *OrtwSession,
    tokenizer: *const Tokenizer,

    pub fn init(allocator: std.mem.Allocator, path: []const u8, tokenizer: *const Tokenizer) !Model {
        const path_z = try allocator.dupeZ(u8, path);
        defer allocator.free(path_z);
        var session: ?*OrtwSession = null;
        if (ortw_session_create(path_z.ptr, 0, &session) != 0) {
            logOrtError();
            return error.OnnxSessionCreateFailed;
        }
        return .{ .allocator = allocator, .session = session.?, .tokenizer = tokenizer };
    }

    pub fn deinit(self: *Model) void {
        ortw_session_destroy(self.session);
    }

    pub fn encode(self: *Model, texts: []const []const u8) ![]f32 {
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

fn normalize(vector: []f32) void {
    var sum: f32 = 0;
    for (vector) |value| sum += value * value;
    if (sum == 0) return;
    const scale = 1 / @sqrt(sum);
    for (vector) |*value| value.* *= scale;
}

fn logOrtError() void {
    if (ortw_last_error()) |message| std.log.err("onnxruntime: {s}", .{std.mem.span(message)});
}
