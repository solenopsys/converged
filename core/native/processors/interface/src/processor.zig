const std = @import("std");

/// A sink for progress events during a single `execute`. Each event is one
/// UTF-8 JSON object (the processor owns its shape). The server wires this to
/// the transport's server-stream so a caller sees progress as messages arrive;
/// a unary caller gets null and the processor runs without emitting.
/// Emitting is best-effort: a processor must not fail its work because a
/// progress send failed (the transport may be gone), so callers `emit(...) catch {}`.
pub const Progress = struct {
    ctx: *anyopaque,
    emit_fn: *const fn (ctx: *anyopaque, event_json: []const u8) anyerror!void,

    pub fn emit(self: Progress, event_json: []const u8) !void {
        return self.emit_fn(self.ctx, event_json);
    }
};

/// The whole contract between a processor binary and the shared server loop.
/// Task and result are UTF-8 JSON, so the schema stays inside the processor
/// and the loop never learns anything about slicers or CAM.
///
/// `start` must be idempotent: the server calls it before every request and a
/// processor that already holds its native library returns immediately.
/// `stop` exists for symmetry — a wrapper carrying C++ static state keeps its
/// image mapped until process exit rather than risking `dlclose`.
pub const Processor = struct {
    name: []const u8,
    ctx: *anyopaque,
    start_fn: *const fn (ctx: *anyopaque) anyerror!void,
    stop_fn: *const fn (ctx: *anyopaque) void,
    execute_fn: *const fn (
        ctx: *anyopaque,
        allocator: std.mem.Allocator,
        task_json: []const u8,
        progress: ?Progress,
    ) anyerror![]u8,

    pub fn start(self: Processor) !void {
        try self.start_fn(self.ctx);
    }

    pub fn stop(self: Processor) void {
        self.stop_fn(self.ctx);
    }

    pub fn execute(self: Processor, allocator: std.mem.Allocator, task_json: []const u8, progress: ?Progress) ![]u8 {
        return self.execute_fn(self.ctx, allocator, task_json, progress);
    }
};
