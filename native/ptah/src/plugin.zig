const std = @import("std");

/// Stable in-process contract between the hub and built-in Zig plugins.
/// The task and result are UTF-8 JSON. Plugin-specific schemas stay inside the
/// plugin module, keeping the hub independent from slicer and CAM details.
pub const Plugin = struct {
    name: []const u8,
    ctx: *anyopaque,
    start_fn: *const fn (ctx: *anyopaque) anyerror!void,
    stop_fn: *const fn (ctx: *anyopaque) void,
    execute_fn: *const fn (
        ctx: *anyopaque,
        allocator: std.mem.Allocator,
        task_json: []const u8,
    ) anyerror![]u8,

    pub fn start(self: Plugin) !void {
        try self.start_fn(self.ctx);
    }

    pub fn stop(self: Plugin) void {
        self.stop_fn(self.ctx);
    }

    pub fn execute(self: Plugin, allocator: std.mem.Allocator, task_json: []const u8) ![]u8 {
        return self.execute_fn(self.ctx, allocator, task_json);
    }
};
