const std = @import("std");
const Build = std.Build;
const OptimizeMode = std.builtin.OptimizeMode;
const build_utils = @import("build_utils.zig");

/// Build libmdbx as static library for given target
fn buildMdbx(b: *Build, target: Build.ResolvedTarget, optimize: OptimizeMode) *Build.Step.Compile {
    const target_str = build_utils.getTargetString(target);
    const mdbx_name = build_utils.getLibName(std.heap.page_allocator, "mdbx", target_str);

    const mdbx = b.addLibrary(.{
        .name = mdbx_name,
        .linkage = .static,
        .root_module = b.createModule(.{
            .target = target,
            .optimize = optimize,
        }),
    });

    const cpu_arch = target.result.cpu.arch;
    const abi = target.result.abi;
    const base_flags = [_][]const u8{
        "-DMDBX_BUILD_SHARED_LIBRARY=0",
        "-DMDBX_WITHOUT_MSVC_CRT=0",
        "-DMDBX_BUILD_TOOLS=0",
        "-DMDBX_BUILD_FLAGS=\"zig\"",
        "-DMDBX_BUILD_COMPILER=\"zig-cc\"",
        "-DMDBX_BUILD_TARGET=\"cross\"",
        "-std=c11",
        "-Wno-error",
        "-Wno-expansion-to-defined",
        "-Wno-date-time",
        "-fno-sanitize=undefined",
        "-fPIC",
        "-O2",
        "-ffunction-sections",
        "-fdata-sections",
        "-fvisibility=hidden",
    };
    const x86_gnu_flags = base_flags ++ [_][]const u8{ "-DMDBX_GCC_FASTMATH_i686_SIMD_WORKAROUND=1", "-D_SYS_CACHECTL_H=1", "-march=x86-64" };
    const x86_flags = base_flags ++ [_][]const u8{ "-DMDBX_GCC_FASTMATH_i686_SIMD_WORKAROUND=1", "-march=x86-64" };
    const glibc_cross_flags = base_flags ++ [_][]const u8{"-D_SYS_CACHECTL_H=1"};
    const flags: []const []const u8 = if (cpu_arch == .x86_64 and (abi == .gnu or abi == .gnueabi or abi == .gnueabihf))
        &x86_gnu_flags
    else if (cpu_arch == .x86_64)
        &x86_flags
    else if (abi == .gnu or abi == .gnueabi or abi == .gnueabihf)
        &glibc_cross_flags
    else
        &base_flags;

    mdbx.addCSourceFile(.{
        .file = b.path("../wrapers/lmdbx/vendor/libmdbx/src/alloy.c"),
        .flags = flags,
    });
    mdbx.addCSourceFile(.{
        .file = b.path("../wrapers/lmdbx/version.c"),
        .flags = flags,
    });
    mdbx.addCSourceFile(.{
        .file = b.path("../wrapers/lmdbx/cpu_stub.c"),
        .flags = &[_][]const u8{"-fPIC"},
    });
    mdbx.addIncludePath(b.path("../wrapers/lmdbx/vendor/libmdbx"));
    mdbx.addIncludePath(b.path("../wrapers/lmdbx/vendor/libmdbx/src"));
    mdbx.linkLibC();

    return mdbx;
}

/// Build sqlite-vec as static C object for given target
fn addSqliteVecObj(b: *Build, target: Build.ResolvedTarget, optimize: OptimizeMode) *Build.Step.Compile {
    const vec = b.addObject(.{
        .name = "sqlite-vec",
        .root_module = b.createModule(.{
            .target = target,
            .optimize = optimize,
        }),
    });

    const cpu_arch = target.result.cpu.arch;
    const abi = target.result.abi;
    const is_musl = (abi == .musl or abi == .musleabi or abi == .musleabihf);

    const base_flags = [_][]const u8{ "-O3", "-fPIC", "-DSQLITE_VEC_OMIT_FS" };
    const musl_compat = [_][]const u8{ "-Du_int8_t=uint8_t", "-Du_int16_t=uint16_t", "-Du_int64_t=uint64_t" };
    const neon = [_][]const u8{"-DSQLITE_VEC_ENABLE_NEON"};

    const flags: []const []const u8 = if (cpu_arch == .x86_64 and is_musl)
        &(base_flags ++ musl_compat)
    else if (cpu_arch == .x86_64)
        &base_flags
    else if (cpu_arch == .aarch64 and is_musl)
        &(base_flags ++ musl_compat ++ neon)
    else if (cpu_arch == .aarch64)
        &(base_flags ++ neon)
    else if (is_musl)
        &(base_flags ++ musl_compat)
    else
        &base_flags;

    vec.addCSourceFile(.{
        .file = b.path("../wrapers/sqlite-vec/vendor/sqlite-vec/sqlite-vec.c"),
        .flags = flags,
    });
    vec.addIncludePath(b.path("../wrapers/sqlite-vec/vendor/sqlite-vec"));
    vec.addIncludePath(b.path("../wrapers/sqlite-vec/vendor/sqlite-vec/vendor"));
    vec.linkLibC();

    return vec;
}

pub fn build(b: *Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const mdbx = buildMdbx(b, target, optimize);

    const sqlite_vec = addSqliteVecObj(b, target, optimize);

    // Main executable — storage engine process
    const exe = b.addExecutable(.{
        .name = "storage",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });

    // Link lmdbx
    exe.linkLibrary(mdbx);

    // Link sqlite-vec object
    exe.addObject(sqlite_vec);

    // Stanchion C shim
    exe.addCSourceFile(.{
        .file = b.path("../wrapers/column/src/sqlite3/c/result-transient.c"),
        .flags = &[_][]const u8{"-std=c99"},
    });
    exe.root_module.addIncludePath(b.path("../wrapers/column/src/sqlite3/c"));

    // Import stanchion module from column project
    const stanchion_mod = b.createModule(.{
        .root_source_file = b.path("../wrapers/column/src/main.zig"),
        .target = target,
        .optimize = optimize,
    });
    stanchion_mod.addIncludePath(b.path("../wrapers/column/src/sqlite3/c"));

    const stanchion_options = b.addOptions();
    stanchion_options.addOption(bool, "loadable_extension", false);
    stanchion_mod.addOptions("build_options", stanchion_options);

    exe.root_module.addImport("stanchion", stanchion_mod);

    // Import lmdbx Zig API
    exe.root_module.addImport("lmdbx", b.createModule(.{
        .root_source_file = b.path("../wrapers/lmdbx/src/lmdbx.zig"),
        .target = target,
        .optimize = optimize,
    }));

    // Import lmdbx_pure for low-level FFI constants
    exe.root_module.addImport("lmdbx_pure", b.createModule(.{
        .root_source_file = b.path("../wrapers/lmdbx/src/lmdbx_pure.zig"),
        .target = target,
        .optimize = optimize,
    }));

    // SQLite3 wrapper from column project
    exe.root_module.addImport("sqlite3", b.createModule(.{
        .root_source_file = b.path("../wrapers/column/src/sqlite3.zig"),
        .target = target,
        .optimize = optimize,
    }));

    exe.linkLibC();
    exe.linkSystemLibrary("sqlite3");

    b.installArtifact(exe);

    // Tests
    const tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    tests.linkLibrary(mdbx);
    tests.addObject(sqlite_vec);
    tests.addCSourceFile(.{
        .file = b.path("../wrapers/column/src/sqlite3/c/result-transient.c"),
        .flags = &[_][]const u8{"-std=c99"},
    });
    tests.root_module.addIncludePath(b.path("../wrapers/column/src/sqlite3/c"));
    tests.root_module.addImport("lmdbx", b.createModule(.{
        .root_source_file = b.path("../wrapers/lmdbx/src/lmdbx.zig"),
        .target = target,
        .optimize = optimize,
    }));
    tests.root_module.addImport("lmdbx_pure", b.createModule(.{
        .root_source_file = b.path("../wrapers/lmdbx/src/lmdbx_pure.zig"),
        .target = target,
        .optimize = optimize,
    }));
    tests.root_module.addImport("sqlite3", b.createModule(.{
        .root_source_file = b.path("../wrapers/column/src/sqlite3.zig"),
        .target = target,
        .optimize = optimize,
    }));
    tests.linkLibC();
    tests.linkSystemLibrary("sqlite3");

    const run_tests = b.addRunArtifact(tests);
    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_tests.step);

    // Run step
    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());
    if (b.args) |args| run_cmd.addArgs(args);
    const run_step = b.step("run", "Run storage engine");
    run_step.dependOn(&run_cmd.step);
}
