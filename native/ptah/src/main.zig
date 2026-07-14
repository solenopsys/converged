const std = @import("std");
const fujin_client = @import("fujin-client");
const Hub = @import("hub.zig").Hub;
const Policy = @import("qjs_policy.zig").Policy;
const CuraEnginePlugin = @import("plugins/curaengine.zig").CuraEnginePlugin;
const OpenCamLibPlugin = @import("plugins/opencamlib.zig").OpenCamLibPlugin;

const default_policy = @embedFile("default_policy.js");

/// There is intentionally no server or external API yet. This executable only
/// validates and assembles the native hub. The future transport owns the loop:
/// submit task -> hub.tick() -> inspect task state.
pub fn main(init: std.process.Init) !void {
    const allocator = init.gpa;
    const args = try std.process.Args.toSlice(init.minimal.args, init.arena.allocator());
    const qjs_path = if (args.len > 1) args[1] else "zig-out/lib/libqjs.so";
    const cura_path = if (args.len > 2) args[2] else "../wrapers/curaengine/zig-out/lib/libcuraengine.so";
    const opencamlib_path = if (args.len > 3) args[3] else "../wrapers/opencamlib/zig-out/lib/libopencamlib.so";

    var cura = try CuraEnginePlugin.init(allocator, cura_path);
    defer cura.deinit();
    var opencamlib = try OpenCamLibPlugin.init(allocator, opencamlib_path);
    defer opencamlib.deinit();

    var policy = try Policy.init(allocator, default_policy, qjs_path);
    errdefer policy.deinit();
    var hub = try Hub.init(allocator, policy, &.{ cura.plugin(), opencamlib.plugin() }, 30_000);
    defer hub.deinit();

    var fujin_config = try fujin_client.Config.init(allocator, init.environ_map, "PTAH", "ptah");
    defer fujin_config.deinit();
    var fujin = try fujin_client.Client.init(&fujin_config);
    defer fujin.deinit();
    try fujin.sendReady("ptah");

    std.debug.print(
        "ptah ready: plugins=curaengine,opencamlib idle-unload=30000ms qjs={s}\n",
        .{qjs_path},
    );
    try hub.tick();

    if (std.mem.eql(u8, init.environ_map.get("PTAH_FUJIN_LISTEN") orelse "off", "on")) {
        fujin.listen("ptah");
    }
}
