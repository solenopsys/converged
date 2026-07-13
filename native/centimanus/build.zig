const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const native_gnu = b.resolveTargetQuery(.{ .cpu_arch = .x86_64, .os_tag = .linux, .abi = .gnu });
    const runtime_target = if (target.query.isNative()) native_gnu else target;
    const optimize = b.standardOptimizeOption(.{});

    const exe = b.addExecutable(.{
        .name = "centimanus",
        .use_lld = false,
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = runtime_target,
            .optimize = optimize,
        }),
    });

    exe.root_module.link_libc = true;
    b.installArtifact(exe);

    const run_cmd = b.addRunArtifact(exe);
    if (b.args) |args| run_cmd.addArgs(args);

    const run_step = b.step("run", "Run centimanus");
    run_step.dependOn(&run_cmd.step);

    const unit_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = runtime_target,
            .optimize = optimize,
        }),
    });

    unit_tests.root_module.link_libc = true;

    const run_unit_tests = b.addRunArtifact(unit_tests);
    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_unit_tests.step);

    const store_test_step = b.step("test-store", "Store tests require a live Valkey + service API environment");
    store_test_step.dependOn(&run_unit_tests.step);
}
