const std = @import("std");

pub fn build(b: *std.Build) void {
    const target   = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const lib = b.addLibrary(.{
        .name     = "transport",
        .linkage  = .dynamic,
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/lib.zig"),
            .target   = target,
            .optimize = optimize,
        }),
    });

    // ── Cap'n Proto C++ generated code ──────────────────────────────────────

    const cpp_flags = &[_][]const u8{
        "-std=c++17",
        "-fPIC",
        "-fvisibility=hidden",
        "-O2",
        "-Wno-unused-parameter",
    };

    // Generated from schema/wire.capnp via generate.sh
    lib.addCSourceFile(.{
        .file  = b.path("src/generated/wire.capnp.c++"),
        .flags = cpp_flags,
    });

    // C++ wrapper exposing extern "C" API
    lib.addCSourceFile(.{
        .file  = b.path("src/capnp_wrap.cpp"),
        .flags = cpp_flags,
    });

    lib.addIncludePath(b.path("include"));
    lib.addIncludePath(b.path("src/generated"));

    // System capnproto headers (installed via pacman: capnproto)
    lib.addSystemIncludePath(.{ .cwd_relative = "/usr/include" });

    // Link capnproto + kj runtime + C++ stdlib
    lib.linkSystemLibrary("capnp");
    lib.linkSystemLibrary("kj");
    lib.linkLibCpp();
    lib.linkLibC();

    b.installArtifact(lib);

    // ── Tests ────────────────────────────────────────────────────────────────

    const unit_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/lib.zig"),
            .target   = target,
            .optimize = optimize,
        }),
    });

    unit_tests.addIncludePath(b.path("include"));
    unit_tests.addSystemIncludePath(.{ .cwd_relative = "/usr/include" });
    unit_tests.linkSystemLibrary("capnp");
    unit_tests.linkSystemLibrary("kj");
    unit_tests.linkLibCpp();
    unit_tests.linkLibC();

    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&b.addRunArtifact(unit_tests).step);
}
