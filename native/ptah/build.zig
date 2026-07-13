const std = @import("std");

const qjs_wrapper_dir = "../wrapers/qjs";

fn addQjsBuild(b: *std.Build, optimize: std.builtin.OptimizeMode) *std.Build.Step.Run {
    const command = b.addSystemCommand(&.{
        b.graph.zig_exe,
        "build",
        b.fmt("-Doptimize={s}", .{@tagName(optimize)}),
        "--prefix",
        "../../ptah/.zig-cache/qjs",
    });
    command.setCwd(b.path(qjs_wrapper_dir));
    command.setName("build QuickJS wrapper");
    return command;
}

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const exe = b.addExecutable(.{
        .name = "ptah",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    exe.root_module.link_libc = true;
    exe.root_module.strip = optimize != .Debug;
    b.installArtifact(exe);

    // ptah opens QuickJS with DynLib. Build and install the wrapper beside the
    // executable so a deployment is a single bin/lib directory.
    const qjs_build = addQjsBuild(b, optimize);
    const qjs_install = b.addInstallFileWithDir(
        .{ .cwd_relative = ".zig-cache/qjs/lib/libqjs.so" },
        .lib,
        "libqjs.so",
    );
    qjs_install.step.dependOn(&qjs_build.step);
    b.getInstallStep().dependOn(&qjs_install.step);

    const tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/tests.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    tests.root_module.link_libc = true;
    tests.root_module.strip = optimize != .Debug;
    const run_tests = b.addRunArtifact(tests);
    run_tests.step.dependOn(&qjs_install.step);
    const test_step = b.step("test", "Run ptah hub and policy tests");
    test_step.dependOn(&run_tests.step);
}
