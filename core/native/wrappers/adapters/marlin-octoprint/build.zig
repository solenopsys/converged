const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const native_musl = b.resolveTargetQuery(.{ .cpu_arch = .x86_64, .os_tag = .linux, .abi = .musl });
    const optimize = b.option(std.builtin.OptimizeMode, "optimize", "Prioritize performance, safety, or binary size") orelse .fast;

    const lib = b.addLibrary(.{
        .name = "marlin_octoprint_adapter",
        .linkage = .dynamic,
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });

    const c_headers = b.addTranslateC(.{
        .root_source_file = b.path("src/c_imports.h"),
        .target = target,
        .optimize = optimize,
    });
    lib.root_module.addImport("c", c_headers.createModule());
    lib.root_module.link_libc = true;
    b.installArtifact(lib);
    b.installFile("include/marlin_octoprint_adapter.h", "include/marlin_octoprint_adapter.h");

    const tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = if (target.query.isNative()) native_musl else target,
            .optimize = optimize,
        }),
    });
    const test_target = if (target.query.isNative()) native_musl else target;
    const test_c_headers = b.addTranslateC(.{
        .root_source_file = b.path("src/c_imports.h"),
        .target = test_target,
        .optimize = optimize,
    });
    tests.root_module.addImport("c", test_c_headers.createModule());
    tests.root_module.link_libc = true;

    const run_tests = b.addRunArtifact(tests);
    const test_step = b.step("test", "Run marlin adapter tests");
    test_step.dependOn(&run_tests.step);
}
