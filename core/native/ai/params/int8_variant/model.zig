const std = @import("std");
const gliner = @import("gliner.zig");

const OrtwSession = opaque {};
const TensorType = enum(c_int) { float = 1, int64 = 7 };
const TensorInput = extern struct { name: [*:0]const u8, data: ?*const anyopaque, data_bytes: usize, shape: [*]const i64, shape_len: usize, type: TensorType };
pub const TensorOutput = extern struct { data: ?*anyopaque, data_bytes: usize, shape: ?[*]i64, shape_len: usize, type: TensorType };

extern fn ortw_session_create(path: [*:0]const u8, threads: c_int, result: *?*OrtwSession) c_int;
extern fn ortw_session_destroy(session: *OrtwSession) void;
extern fn ortw_session_run(session: *OrtwSession, inputs: [*]const TensorInput, input_count: usize, output_names: [*]const [*:0]const u8, output_count: usize, outputs: [*]TensorOutput) c_int;
extern fn ortw_tensor_output_free(output: *TensorOutput) void;
extern fn ortw_last_error() ?[*:0]const u8;

pub const Model = struct {
    allocator: std.mem.Allocator,
    session: *OrtwSession,

    pub fn init(allocator: std.mem.Allocator, path: []const u8) !Model {
        const path_z = try allocator.dupeZ(u8, path);
        defer allocator.free(path_z);
        var session: ?*OrtwSession = null;
        if (ortw_session_create(path_z.ptr, 0, &session) != 0) return error.OnnxSessionCreateFailed;
        return .{ .allocator = allocator, .session = session.? };
    }

    pub fn deinit(self: *Model) void { ortw_session_destroy(self.session); }

    pub fn run(self: *Model, input: *const gliner.Packed) !TensorOutput {
        const input_shape = [_]i64{ 1, @intCast(input.ids.len) };
        const scalar_shape = [_]i64{ 1 };
        const label_shape = [_]i64{ 1, @intCast(input.label_positions.len) };
        const names = [_][*:0]const u8{ "input_ids", "attention_mask", "words_mask", "text_lengths", "task_type", "label_positions", "label_mask" };
        const attention = try self.allocator.alloc(i64, input.ids.len);
        defer self.allocator.free(attention);
        @memset(attention, 1);
        const text_length = [_]i64{input.text_length};
        const task_type = [_]i64{input.task_type};
        const inputs = [_]TensorInput{
            tensor(names[0], input.ids, &input_shape), tensor(names[1], attention, &input_shape),
            tensor(names[2], input.words_mask, &input_shape), tensor(names[3], &text_length, &scalar_shape),
            tensor(names[4], &task_type, &scalar_shape), tensor(names[5], input.label_positions, &label_shape),
            tensor(names[6], input.label_mask, &label_shape),
        };
        const output_names = [_][*:0]const u8{"logits"};
        var output = std.mem.zeroes(TensorOutput);
        if (ortw_session_run(self.session, &inputs, inputs.len, &output_names, 1, @ptrCast(&output)) != 0) return error.OnnxRunFailed;
        if (output.type != .float or output.data == null or output.shape == null or output.shape_len != 4) {
            ortw_tensor_output_free(&output);
            return error.InvalidOnnxOutput;
        }
        return output;
    }
};

pub fn freeOutput(output: *TensorOutput) void { ortw_tensor_output_free(output); }
pub fn lastError() []const u8 { return if (ortw_last_error()) |message| std.mem.span(message) else "unknown ONNX error"; }

fn tensor(name: [*:0]const u8, values: []const i64, shape: []const i64) TensorInput {
    return .{ .name = name, .data = @ptrCast(values.ptr), .data_bytes = values.len * @sizeOf(i64), .shape = shape.ptr, .shape_len = shape.len, .type = .int64 };
}
