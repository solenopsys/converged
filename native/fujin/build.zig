const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    const host = b.graph.host.result;
    const runtime_target = if (target.query.isNative()) b.resolveTargetQuery(.{
        .cpu_arch = host.cpu.arch,
        .os_tag = .linux,
        .abi = .gnu,
        .glibc_version = host.os.version_range.linux.glibc,
    }) else target;

    const exe = b.addExecutable(.{
        .name = "fujin",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = runtime_target,
            .optimize = optimize,
        }),
    });
    exe.root_module.link_libc = true;
    exe.root_module.strip = optimize != .Debug;
    b.installArtifact(exe);

    const run = b.addRunArtifact(exe);
    if (b.args) |args| run.addArgs(args);
    const run_step = b.step("run", "Run fujin message hub");
    run_step.dependOn(&run.step);

    const tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/hub.zig"),
            .target = runtime_target,
            .optimize = optimize,
        }),
    });
    tests.root_module.link_libc = true;
    const test_run = b.addRunArtifact(tests);
    const test_step = b.step("test", "Run fujin hub tests");
    test_step.dependOn(&test_run.step);

    const fmt = b.addFmt(.{ .check = true, .paths = &.{ "build.zig", "src" } });
    const fmt_step = b.step("fmt", "Check formatting");
    fmt_step.dependOn(&fmt.step);
}
