const std = @import("std");

const OrtwSession = opaque {};
const TensorType = enum(c_int) { float = 1, uint8 = 2, int64 = 7 };
const TensorInput = extern struct { name: [*:0]const u8, data: ?*const anyopaque, data_bytes: usize, shape: [*]const i64, shape_len: usize, type: TensorType };
var empty_i64: i64 = 0;
var empty_f32: f32 = 0;
pub const TensorOutput = extern struct { data: ?*anyopaque, data_bytes: usize, shape: ?[*]i64, shape_len: usize, type: TensorType };

extern fn ortw_session_create(path: [*:0]const u8, threads: c_int, result: *?*OrtwSession) c_int;
extern fn ortw_session_destroy(session: *OrtwSession) void;
extern fn ortw_session_run(session: *OrtwSession, inputs: [*]const TensorInput, input_count: usize, output_names: [*]const [*:0]const u8, output_count: usize, outputs: [*]TensorOutput) c_int;
extern fn ortw_tensor_output_free(output: *TensorOutput) void;
extern fn ortw_last_error() ?[*:0]const u8;

pub const Packed = struct {
    ids: []const i64,
    words: []const i64,
    queries: []const i64,
    classes: []const i64,
};

pub const Outputs = struct {
    pair_indices: TensorOutput,
    pair_logits: TensorOutput,
    pair_valid: TensorOutput,
    cls_logits: TensorOutput,

    pub fn deinit(self: *Outputs) void {
        ortw_tensor_output_free(&self.pair_indices);
        ortw_tensor_output_free(&self.pair_logits);
        ortw_tensor_output_free(&self.pair_valid);
        ortw_tensor_output_free(&self.cls_logits);
    }
};

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

    pub fn run(self: *Model, input: Packed) !Outputs {
        const ones_i64 = try self.allocator.alloc(i64, input.ids.len); defer self.allocator.free(ones_i64); @memset(ones_i64, 1);
        const word_mask = try self.allocator.alloc(f32, input.words.len); defer self.allocator.free(word_mask); @memset(word_mask, 1);
        const query_mask = try self.allocator.alloc(f32, input.queries.len); defer self.allocator.free(query_mask); @memset(query_mask, 1);
        const class_mask = try self.allocator.alloc(f32, input.classes.len); defer self.allocator.free(class_mask); @memset(class_mask, 1);
        const empty_i64_values = [_]i64{}; const empty_f32_values = [_]f32{};
        const token_shape = [_]i64{ 1, @intCast(input.ids.len) };
        const word_shape = [_]i64{ 1, @intCast(input.words.len) };
        const query_shape = [_]i64{ 1, @intCast(input.queries.len) };
        const class_shape = [_]i64{ 1, @intCast(input.classes.len) };
        const empty_shape = [_]i64{ 1, 0 };
        const names = [_][*:0]const u8{ "input_ids", "attention_mask", "text_word_indices", "text_word_mask", "query_marker_indices", "query_marker_mask", "cls_marker_indices", "cls_marker_mask", "rel_marker_indices", "rel_marker_mask" };
        const inputs = [_]TensorInput{
            tensorI64(names[0], input.ids, &token_shape), tensorI64(names[1], ones_i64, &token_shape),
            tensorI64(names[2], input.words, &word_shape), tensorF32(names[3], word_mask, &word_shape),
            tensorI64(names[4], input.queries, &query_shape), tensorF32(names[5], query_mask, &query_shape),
            tensorI64(names[6], input.classes, &class_shape), tensorF32(names[7], class_mask, &class_shape),
            tensorI64(names[8], &empty_i64_values, &empty_shape), tensorF32(names[9], &empty_f32_values, &empty_shape),
        };
        const output_names = [_][*:0]const u8{ "pair_indices", "pair_logits", "pair_valid", "cls_logits" };
        var out = [_]TensorOutput{std.mem.zeroes(TensorOutput)} ** 4;
        if (ortw_session_run(self.session, &inputs, inputs.len, &output_names, out.len, &out) != 0) return error.OnnxRunFailed;
        return .{ .pair_indices = out[0], .pair_logits = out[1], .pair_valid = out[2], .cls_logits = out[3] };
    }
};

fn tensorI64(name: [*:0]const u8, values: []const i64, shape: []const i64) TensorInput { const data: *const anyopaque = if (values.len == 0) @ptrCast(&empty_i64) else @ptrCast(values.ptr); return .{ .name = name, .data = data, .data_bytes = values.len * @sizeOf(i64), .shape = shape.ptr, .shape_len = shape.len, .type = .int64 }; }
fn tensorF32(name: [*:0]const u8, values: []const f32, shape: []const i64) TensorInput { const data: *const anyopaque = if (values.len == 0) @ptrCast(&empty_f32) else @ptrCast(values.ptr); return .{ .name = name, .data = data, .data_bytes = values.len * @sizeOf(f32), .shape = shape.ptr, .shape_len = shape.len, .type = .float }; }

pub fn lastError() []const u8 { return if (ortw_last_error()) |message| std.mem.span(message) else "unknown ONNX error"; }
