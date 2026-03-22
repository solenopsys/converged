const std = @import("std");
const build_utils = @import("build_utils.zig");

const TargetParts = struct {
    arch: []const u8,
    libc: []const u8,
};

fn getCmakeBuildType(optimize: std.builtin.OptimizeMode) []const u8 {
    return switch (optimize) {
        .Debug => "Debug",
        .ReleaseSafe => "RelWithDebInfo",
        .ReleaseFast => "Release",
        .ReleaseSmall => "MinSizeRel",
    };
}

fn getTargetParts(target: std.Build.ResolvedTarget) TargetParts {
    if (target.result.os.tag != .linux) {
        std.debug.panic("ryugraph wrapper supports linux targets only, got {s}", .{
            @tagName(target.result.os.tag),
        });
    }

    const arch = switch (target.result.cpu.arch) {
        .x86_64 => "x86_64",
        .aarch64 => "aarch64",
        else => std.debug.panic("unsupported cpu arch for ryugraph: {s}", .{
            @tagName(target.result.cpu.arch),
        }),
    };

    const libc = switch (target.result.abi) {
        .gnu, .gnueabi, .gnueabihf => "gnu",
        .musl, .musleabi, .musleabihf => "musl",
        else => std.debug.panic("unsupported abi for ryugraph: {s}", .{
            @tagName(target.result.abi),
        }),
    };

    return .{
        .arch = arch,
        .libc = libc,
    };
}

fn addRyuSharedBuild(
    b: *std.Build,
    target: std.Build.ResolvedTarget,
    optimize: std.builtin.OptimizeMode,
    lib_name: []const u8,
) *std.Build.Step.InstallFile {
    const target_str = build_utils.getTargetString(target);
    const cmake_build_type = getCmakeBuildType(optimize);
    const target_parts = getTargetParts(target);
    const target_triple = b.fmt("{s}-linux-{s}", .{ target_parts.arch, target_parts.libc });
    const cmake_build_dir = b.fmt(".zig-cache/ryugraph/{s}/{s}", .{ target_str, cmake_build_type });

    const configure = b.addSystemCommand(&[_][]const u8{
        "cmake",
        "-S",
        "vendor/ryugraph",
        "-B",
        cmake_build_dir,
        "-G",
        "Ninja",
        b.fmt("-DCMAKE_BUILD_TYPE={s}", .{cmake_build_type}),
        "-DCMAKE_SYSTEM_NAME=Linux",
        b.fmt("-DCMAKE_SYSTEM_PROCESSOR={s}", .{target_parts.arch}),
        "-DCMAKE_TRY_COMPILE_TARGET_TYPE=STATIC_LIBRARY",
        "-DCMAKE_C_COMPILER=zig",
        "-DCMAKE_C_COMPILER_ARG1=cc",
        "-DCMAKE_CXX_COMPILER=zig",
        "-DCMAKE_CXX_COMPILER_ARG1=c++",
        b.fmt("-DCMAKE_C_COMPILER_TARGET={s}", .{target_triple}),
        b.fmt("-DCMAKE_CXX_COMPILER_TARGET={s}", .{target_triple}),
        "-DCMAKE_C_FLAGS=-Wno-error=date-time -DROARING_DISABLE_AVX=1 -DCROARING_COMPILER_SUPPORTS_AVX512=0 -DSIMSIMD_TARGET_HASWELL=0 -DSIMSIMD_TARGET_SKYLAKE=0 -DSIMSIMD_TARGET_ICE=0 -DSIMSIMD_TARGET_GENOA=0 -DSIMSIMD_TARGET_SAPPHIRE=0 -DSIMSIMD_TARGET_TURIN=0",
        "-DCMAKE_CXX_FLAGS=-Wno-error=date-time -DROARING_DISABLE_AVX=1 -DCROARING_COMPILER_SUPPORTS_AVX512=0 -DSIMSIMD_TARGET_HASWELL=0 -DSIMSIMD_TARGET_SKYLAKE=0 -DSIMSIMD_TARGET_ICE=0 -DSIMSIMD_TARGET_GENOA=0 -DSIMSIMD_TARGET_SAPPHIRE=0 -DSIMSIMD_TARGET_TURIN=0",
        "-DCMAKE_SHARED_LINKER_FLAGS=-Wl,-s",
        "-DAUTO_UPDATE_GRAMMAR=OFF",
        "-DBUILD_PYTHON=OFF",
        "-DBUILD_JAVA=OFF",
        "-DBUILD_NODEJS=OFF",
        "-DBUILD_BENCHMARK=OFF",
        "-DBUILD_EXAMPLES=OFF",
        "-DBUILD_TESTS=OFF",
        "-DBUILD_EXTENSION_TESTS=OFF",
        "-DBUILD_SHELL=OFF",
        "-DBUILD_SINGLE_FILE_HEADER=OFF",
        "-DBUILD_EXTENSIONS=",
    });
    configure.setName(b.fmt("configure ryugraph ({s})", .{target_str}));

    const build_cmd = b.addSystemCommand(&[_][]const u8{
        "cmake",
        "--build",
        cmake_build_dir,
        "--config",
        cmake_build_type,
        "--target",
        "ryu_shared",
        "--parallel",
    });
    build_cmd.setName(b.fmt("build ryu_shared ({s})", .{target_str}));
    build_cmd.step.dependOn(&configure.step);

    const built_library = b.fmt("{s}/src/libryu.so", .{cmake_build_dir});
    const installed_library_name = b.fmt("lib{s}.so", .{lib_name});
    const install_lib = b.addInstallFileWithDir(
        .{ .cwd_relative = built_library },
        .lib,
        installed_library_name,
    );
    install_lib.step.dependOn(&build_cmd.step);

    return install_lib;
}

fn buildForTarget(
    b: *std.Build,
    target: std.Build.ResolvedTarget,
    optimize: std.builtin.OptimizeMode,
    artifacts_dir: []const u8,
    hashes: *std.StringHashMap([]const u8),
    json_step: *build_utils.WriteJsonStep,
) void {
    const target_str = build_utils.getTargetString(target);
    const lib_name = build_utils.getLibName(std.heap.page_allocator, "ryugraph", target_str);
    const install_lib = addRyuSharedBuild(b, target, optimize, lib_name);

    const hash_step = build_utils.HashAndMoveStep.create(
        b,
        lib_name,
        target_str,
        artifacts_dir,
        hashes,
    );
    hash_step.step.dependOn(&install_lib.step);

    json_step.step.dependOn(&hash_step.step);
}

pub fn build(b: *std.Build) void {
    const optimize = b.standardOptimizeOption(.{});
    const artifacts_dir = "../../artifacts/libs";
    const json_path = "current.json";

    const build_all = b.option(bool, "all", "Build for all supported targets") orelse false;

    if (build_all) {
        const hashes = build_utils.createHashMap(b);
        const json_step = build_utils.WriteJsonStep.create(b, hashes, json_path);

        for (build_utils.supported_targets) |query| {
            const target = b.resolveTargetQuery(query);
            buildForTarget(b, target, optimize, artifacts_dir, hashes, json_step);
        }

        b.default_step.dependOn(&json_step.step);
    } else {
        const target = b.standardTargetOptions(.{});
        const install_lib = addRyuSharedBuild(b, target, optimize, "ryugraph");
        const install_header = b.addInstallHeaderFile(
            b.path("vendor/ryugraph/src/include/c_api/ryu.h"),
            "ryugraph/ryu.h",
        );

        b.getInstallStep().dependOn(&install_lib.step);
        b.getInstallStep().dependOn(&install_header.step);
    }
}
