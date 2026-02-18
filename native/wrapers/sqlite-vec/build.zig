const std = @import("std");
const build_utils = @import("build_utils.zig");

fn addSqliteVecLib(b: *std.Build, target: std.Build.ResolvedTarget, optimize: std.builtin.OptimizeMode, name: []const u8) *std.Build.Step.Compile {
    const lib = b.addLibrary(.{
        .name = name,
        .linkage = .dynamic,
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });

    lib.linkLibC();

    const cpu_arch = target.result.cpu.arch;
    const abi = target.result.abi;
    const is_musl = (abi == .musl or abi == .musleabi or abi == .musleabihf);

    const base_flags = [_][]const u8{
        "-O3",
        "-fPIC",
        "-DSQLITE_VEC_OMIT_FS",
    };
    const musl_compat_flags = [_][]const u8{
        "-Du_int8_t=uint8_t",
        "-Du_int16_t=uint16_t",
        "-Du_int64_t=uint64_t",
    };

    const aarch64_simd_flags = [_][]const u8{"-DSQLITE_VEC_ENABLE_NEON"};

    const flags: []const []const u8 = if (cpu_arch == .x86_64 and is_musl)
        &(base_flags ++ musl_compat_flags)
    else if (cpu_arch == .x86_64)
        &base_flags
    else if (cpu_arch == .aarch64 and is_musl)
        &(base_flags ++ musl_compat_flags ++ aarch64_simd_flags)
    else if (cpu_arch == .aarch64)
        &(base_flags ++ aarch64_simd_flags)
    else if (is_musl)
        &(base_flags ++ musl_compat_flags)
    else
        &base_flags;

    lib.addCSourceFile(.{
        .file = b.path("vendor/sqlite-vec/sqlite-vec.c"),
        .flags = flags,
    });

    lib.addIncludePath(b.path("vendor/sqlite-vec"));
    lib.addIncludePath(b.path("vendor/sqlite-vec/vendor"));

    return lib;
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
    const lib_name = build_utils.getLibName(std.heap.page_allocator, "sqlite-vec", target_str);

    const lib = addSqliteVecLib(b, target, optimize, lib_name);

    const install = b.addInstallArtifact(lib, .{});

    const hash_step = build_utils.HashAndMoveStep.create(
        b,
        lib_name,
        target_str,
        artifacts_dir,
        hashes,
    );
    hash_step.step.dependOn(&install.step);

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
        const lib = addSqliteVecLib(b, target, optimize, "sqlite-vec");
        b.installArtifact(lib);
    }
}
