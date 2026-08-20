const std = @import("std");

pub fn build(b: *std.Build) void {
    // No target remapping here: a processor passes its already-resolved target
    // down, and this package must hand transport the very same option so the
    // build graph reuses one transport module rather than building a second,
    // type-incompatible copy of it.
    const target = b.standardTargetOptions(.{});
    const optimize = b.option(std.builtin.OptimizeMode, "optimize", "Prioritize performance, safety, or binary size") orelse .ReleaseFast;
    const transport_dep = b.dependency("transport", .{ .target = target, .optimize = optimize });

    const module = b.addModule("processor", .{
        .root_source_file = b.path("src/root.zig"),
        .target = target,
        .optimize = optimize,
    });
    module.addImport("transport", transport_dep.module("transport"));
    module.link_libc = true;

    const tests = b.addTest(.{ .name = "processor-tests", .root_module = module });
    const run_tests = b.addRunArtifact(tests);
    const test_step = b.step("test", "Run processor interface tests");
    test_step.dependOn(&run_tests.step);
}
