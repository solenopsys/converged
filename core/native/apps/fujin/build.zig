const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.option(std.builtin.OptimizeMode, "optimize", "Prioritize performance, safety, or binary size") orelse .ReleaseFast;
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
    const transport_dep = b.dependency("transport", .{ .target = runtime_target, .optimize = optimize });
    exe.root_module.addImport("transport", transport_dep.module("transport"));
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

    const registry_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/registry.zig"),
            .target = runtime_target,
            .optimize = optimize,
        }),
    });
    registry_tests.root_module.link_libc = true;
    const registry_test_run = b.addRunArtifact(registry_tests);
    test_step.dependOn(&registry_test_run.step);

    const journal_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/messages.zig"),
            .target = runtime_target,
            .optimize = optimize,
        }),
    });
    journal_tests.root_module.link_libc = true;
    test_step.dependOn(&b.addRunArtifact(journal_tests).step);

    const websocket_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/websocket.zig"),
            .target = runtime_target,
            .optimize = optimize,
        }),
    });
    websocket_tests.root_module.link_libc = true;
    websocket_tests.root_module.addImport("transport", transport_dep.module("transport"));
    test_step.dependOn(&b.addRunArtifact(websocket_tests).step);

    const main_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = runtime_target,
            .optimize = optimize,
        }),
    });
    main_tests.root_module.addImport("transport", transport_dep.module("transport"));
    main_tests.root_module.link_libc = true;
    test_step.dependOn(&b.addRunArtifact(main_tests).step);

    const fmt = b.addFmt(.{ .check = true, .paths = &.{ "build.zig", "src" } });
    const fmt_step = b.step("fmt", "Check formatting");
    fmt_step.dependOn(&fmt.step);
}
