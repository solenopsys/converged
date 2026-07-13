const std = @import("std");
const Hub = @import("hub.zig").Hub;
const TaskState = @import("hub.zig").TaskState;
const Plugin = @import("plugin.zig").Plugin;
const Policy = @import("qjs_policy.zig").Policy;
const CuraEnginePlugin = @import("plugins/curaengine.zig").CuraEnginePlugin;
const OpenCamLibPlugin = @import("plugins/opencamlib.zig").OpenCamLibPlugin;

const default_policy = @embedFile("default_policy.js");

const FakePlugin = struct {
    starts: usize = 0,
    stops: usize = 0,

    fn plugin(self: *FakePlugin) Plugin {
        return .{
            .name = "fake",
            .ctx = self,
            .start_fn = start,
            .stop_fn = stop,
            .execute_fn = execute,
        };
    }

    fn start(ctx: *anyopaque) !void {
        const self: *FakePlugin = @ptrCast(@alignCast(ctx));
        self.starts += 1;
    }

    fn stop(ctx: *anyopaque) void {
        const self: *FakePlugin = @ptrCast(@alignCast(ctx));
        self.stops += 1;
    }

    fn execute(ctx: *anyopaque, allocator: std.mem.Allocator, task: []const u8) ![]u8 {
        _ = ctx;
        return std.fmt.allocPrint(allocator, "processed:{s}", .{task});
    }
};

test "hub dispatches a Zig plugin worker and unloads it after idle" {
    const allocator = std.testing.allocator;
    var fake = FakePlugin{};
    var policy = try Policy.init(allocator, default_policy, null);
    errdefer policy.deinit();
    var hub = try Hub.init(allocator, policy, &.{fake.plugin()}, 0);
    defer hub.deinit();

    const id = try hub.submit("fake", "{\"kind\":\"unit\"}");
    try hub.tick();

    var completed = false;
    for (0..10_000) |_| {
        try hub.tick();
        if (hub.getTask(id)) |task| {
            if (task.state == .completed) {
                try std.testing.expectEqualStrings("processed:{\"kind\":\"unit\"}", task.result.?);
                completed = true;
                break;
            }
            try std.testing.expect(task.state != .failed);
        }
        std.Thread.yield() catch {};
    }
    try std.testing.expect(completed);
    try hub.tick();
    try std.testing.expectEqual(@as(usize, 1), fake.starts);
    try std.testing.expectEqual(@as(usize, 1), fake.stops);
}

test "QuickJS policy evaluates the default task action" {
    const allocator = std.testing.allocator;
    var policy = try Policy.init(allocator, default_policy, "zig-out/lib/libqjs.so");
    defer policy.deinit();
    try std.testing.expectEqual(.start, try policy.decideTask(7, "curaengine", "{}"));
    try std.testing.expectEqual(.unload, try policy.decideIdle("curaengine", 30_000));
}

test "unknown plugin is rejected before it reaches a worker" {
    const allocator = std.testing.allocator;
    var fake = FakePlugin{};
    var policy = try Policy.init(allocator, default_policy, null);
    errdefer policy.deinit();
    var hub = try Hub.init(allocator, policy, &.{fake.plugin()}, 0);
    defer hub.deinit();
    try std.testing.expectError(error.PluginNotFound, hub.submit("not-present", "{}"));
    try std.testing.expectEqual(@as(?TaskState, null), if (hub.getTask(1)) |task| task.state else null);
}

test "OpenCAMLib executes through the hub dynamic-library adapter" {
    const allocator = std.testing.allocator;
    var opencamlib = try OpenCamLibPlugin.init(
        allocator,
        "../wrapers/opencamlib/zig-out/lib/libopencamlib.so",
    );
    defer opencamlib.deinit();
    var policy = try Policy.init(allocator, default_policy, null);
    errdefer policy.deinit();
    var hub = try Hub.init(allocator, policy, &.{opencamlib.plugin()}, 0);
    defer hub.deinit();

    const id = try hub.submit("opencamlib",
        "{\"stlPath\":\"../wrapers/opencamlib/vendor/opencamlib/stl/demo.stl\",\"toolDiameter\":3.175,\"stepover\":2,\"sampling\":1}",
    );
    try hub.tick();
    for (0..100_000) |_| {
        try hub.tick();
        if (hub.getTask(id)) |task| switch (task.state) {
            .completed => {
                try std.testing.expect(std.mem.indexOf(u8, task.result.?, "\"triangles\":") != null);
                return;
            },
            .failed => return error.OpenCamLibTaskFailed,
            else => {},
        };
        std.Thread.yield() catch {};
    }
    return error.OpenCamLibTaskTimedOut;
}

test "CuraEngine wrapper loads through the hub adapter before task validation" {
    const allocator = std.testing.allocator;
    var cura = try CuraEnginePlugin.init(
        allocator,
        "../wrapers/curaengine/zig-out/lib/libcuraengine.so",
    );
    defer cura.deinit();
    var policy = try Policy.init(allocator, default_policy, null);
    errdefer policy.deinit();
    var hub = try Hub.init(allocator, policy, &.{cura.plugin()}, 0);
    defer hub.deinit();

    const id = try hub.submit("curaengine", "{}");
    try hub.tick();
    for (0..10_000) |_| {
        try hub.tick();
        if (hub.getTask(id)) |task| switch (task.state) {
            .failed => {
                try std.testing.expectEqualStrings("StlPathRequired", task.error_text.?);
                return;
            },
            .completed => return error.CuraEngineUnexpectedSuccess,
            else => {},
        };
        std.Thread.yield() catch {};
    }
    return error.CuraEngineLoadTimedOut;
}
