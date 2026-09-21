const std = @import("std");

const OrtwSession = opaque {};
const TensorType = enum(c_int) { float = 1, uint8 = 2, int64 = 7 };
const TensorInput = extern struct { name: [*:0]const u8, data: ?*const anyopaque, data_bytes: usize, shape: [*]const i64, shape_len: usize, type: TensorType };
pub const TensorOutput = extern struct { data: ?*anyopaque, data_bytes: usize, shape: ?[*]i64, shape_len: usize, type: TensorType };

extern fn ortw_session_create(path: [*:0]const u8, threads: c_int, result: *?*OrtwSession) c_int;
extern fn ortw_session_destroy(session: *OrtwSession) void;
extern fn ortw_session_run(session: *OrtwSession, inputs: [*]const TensorInput, input_count: usize, output_names: [*]const [*:0]const u8, output_count: usize, outputs: [*]TensorOutput) c_int;
extern fn ortw_tensor_output_free(output: *TensorOutput) void;
extern fn ortw_last_error() ?[*:0]const u8;

// Speech frontend: raw 16 kHz mono waveform straight into the graph.
// Same contract as sherpa-onnx / onnx-asr omnilingual-ctc:
// input "x" float32 [batch, num_samples], output "logits" float32 [batch, frames, vocab].
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

    pub fn deinit(self: *Model) void {
        ortw_session_destroy(self.session);
    }

    pub fn run(self: *Model, waveform: []const f32) !TensorOutput {
        const shape = [_]i64{ 1, @intCast(waveform.len) };
        const names = [_][*:0]const u8{"x"};
        const inputs = [_]TensorInput{
            .{ .name = names[0], .data = @ptrCast(waveform.ptr), .data_bytes = waveform.len * @sizeOf(f32), .shape = &shape, .shape_len = shape.len, .type = .float },
        };
        const output_names = [_][*:0]const u8{"logits"};
        var out = [_]TensorOutput{std.mem.zeroes(TensorOutput)};
        if (ortw_session_run(self.session, &inputs, inputs.len, &output_names, out.len, &out) != 0) return error.OnnxRunFailed;
        return out[0];
    }
};

pub fn freeOutput(out: *TensorOutput) void {
    ortw_tensor_output_free(out);
}

pub fn lastError() []const u8 {
    return if (ortw_last_error()) |message| std.mem.span(message) else "unknown ONNX error";
}
