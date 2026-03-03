const std = @import("std");
const Build = std.Build;
const OptimizeMode = std.builtin.OptimizeMode;
const build_utils = @import("build_utils.zig");

const sqlite_dir = "../../../../../solenopsys/detonation/wrapers/sqlite/vendor/sqlite";
const sqlite_src = sqlite_dir ++ "/sqlite3.c";

fn supportsTransport(target: Build.ResolvedTarget) bool {
    return target.result.os.tag == .linux;
}

const transport_vendor_src = "../wrapers/transport/vendor/capnproto/c++/src";

const kj_sources = [_][]const u8{
    transport_vendor_src ++ "/kj/array.c++",
    transport_vendor_src ++ "/kj/arena.c++",
    transport_vendor_src ++ "/kj/common.c++",
    transport_vendor_src ++ "/kj/debug.c++",
    transport_vendor_src ++ "/kj/encoding.c++",
    transport_vendor_src ++ "/kj/exception.c++",
    transport_vendor_src ++ "/kj/hash.c++",
    transport_vendor_src ++ "/kj/io.c++",
    transport_vendor_src ++ "/kj/list.c++",
    transport_vendor_src ++ "/kj/memory.c++",
    transport_vendor_src ++ "/kj/mutex.c++",
    transport_vendor_src ++ "/kj/refcount.c++",
    transport_vendor_src ++ "/kj/source-location.c++",
    transport_vendor_src ++ "/kj/string.c++",
    transport_vendor_src ++ "/kj/string-tree.c++",
    transport_vendor_src ++ "/kj/table.c++",
    transport_vendor_src ++ "/kj/thread.c++",
    transport_vendor_src ++ "/kj/time.c++",
    transport_vendor_src ++ "/kj/units.c++",
};

const capnp_sources = [_][]const u8{
    transport_vendor_src ++ "/capnp/any.c++",
    transport_vendor_src ++ "/capnp/arena.c++",
    transport_vendor_src ++ "/capnp/blob.c++",
    transport_vendor_src ++ "/capnp/c++.capnp.c++",
    transport_vendor_src ++ "/capnp/persistent.capnp.c++",
    transport_vendor_src ++ "/capnp/rpc.capnp.c++",
    transport_vendor_src ++ "/capnp/rpc-twoparty.capnp.c++",
    transport_vendor_src ++ "/capnp/dynamic.c++",
    transport_vendor_src ++ "/capnp/layout.c++",
    transport_vendor_src ++ "/capnp/list.c++",
    transport_vendor_src ++ "/capnp/message.c++",
    transport_vendor_src ++ "/capnp/schema.c++",
    transport_vendor_src ++ "/capnp/schema.capnp.c++",
    transport_vendor_src ++ "/capnp/schema-loader.c++",
    transport_vendor_src ++ "/capnp/stream.capnp.c++",
    transport_vendor_src ++ "/capnp/serialize.c++",
    transport_vendor_src ++ "/capnp/serialize-packed.c++",
    transport_vendor_src ++ "/capnp/stringify.c++",
};

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

fn buildSqlite3(b: *Build, target: Build.ResolvedTarget, optimize: OptimizeMode) *Build.Step.Compile {
    const target_str = build_utils.getTargetString(target);
    const sqlite_name = build_utils.getLibName(std.heap.page_allocator, "sqlite3", target_str);

    const sqlite = b.addLibrary(.{
        .name = sqlite_name,
        .linkage = .static,
        .root_module = b.createModule(.{
            .target = target,
            .optimize = optimize,
        }),
    });

    sqlite.addCSourceFile(.{
        .file = b.path(sqlite_src),
        .flags = &[_][]const u8{
            "-std=c99",
            "-O2",
            "-fPIC",
        },
    });
    sqlite.addIncludePath(b.path(sqlite_dir));
    sqlite.linkLibC();

    return sqlite;
}

fn addStorageExecutable(
    b: *Build,
    target: Build.ResolvedTarget,
    optimize: OptimizeMode,
    name: []const u8,
    with_transport: bool,
) *Build.Step.Compile {
    const mdbx = buildMdbx(b, target, optimize);
    const sqlite_vec = addSqliteVecObj(b, target, optimize);
    const sqlite3 = buildSqlite3(b, target, optimize);

    const exe = b.addExecutable(.{
        .name = name,
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });

    const exe_options = b.addOptions();
    exe_options.addOption(bool, "with_transport", with_transport);
    exe.root_module.addOptions("build_options", exe_options);

    exe.linkLibrary(mdbx);
    exe.linkLibrary(sqlite3);
    exe.addObject(sqlite_vec);

    exe.addCSourceFile(.{
        .file = b.path("../wrapers/column/src/sqlite3/c/result-transient.c"),
        .flags = &[_][]const u8{"-std=c99"},
    });
    exe.root_module.addIncludePath(b.path("../wrapers/column/src/sqlite3/c"));
    exe.root_module.addIncludePath(b.path(sqlite_dir));

    const stanchion_mod = b.createModule(.{
        .root_source_file = b.path("../wrapers/column/src/main.zig"),
        .target = target,
        .optimize = optimize,
    });
    stanchion_mod.addIncludePath(b.path("../wrapers/column/src/sqlite3/c"));
    stanchion_mod.addIncludePath(b.path(sqlite_dir));

    const stanchion_options = b.addOptions();
    stanchion_options.addOption(bool, "loadable_extension", false);
    stanchion_mod.addOptions("build_options", stanchion_options);

    exe.root_module.addImport("stanchion", stanchion_mod);

    exe.root_module.addImport("lmdbx", b.createModule(.{
        .root_source_file = b.path("../wrapers/lmdbx/src/lmdbx.zig"),
        .target = target,
        .optimize = optimize,
    }));

    exe.root_module.addImport("lmdbx_pure", b.createModule(.{
        .root_source_file = b.path("../wrapers/lmdbx/src/lmdbx_pure.zig"),
        .target = target,
        .optimize = optimize,
    }));

    exe.root_module.addImport("sqlite3", b.createModule(.{
        .root_source_file = b.path("../wrapers/column/src/sqlite3.zig"),
        .target = target,
        .optimize = optimize,
    }));

    if (with_transport) {
        const cpp_flags = &[_][]const u8{
            "-std=c++17",
            "-fPIC",
            "-fvisibility=hidden",
            "-O2",
            "-Wno-unused-parameter",
        };

        for (kj_sources) |src| {
            exe.addCSourceFile(.{ .file = b.path(src), .flags = cpp_flags });
        }
        for (capnp_sources) |src| {
            exe.addCSourceFile(.{ .file = b.path(src), .flags = cpp_flags });
        }

        exe.addCSourceFile(.{
            .file = b.path("../wrapers/transport/src/generated/wire.capnp.cpp"),
            .flags = cpp_flags,
        });
        exe.addCSourceFile(.{
            .file = b.path("../wrapers/transport/src/capnp_wrap.cpp"),
            .flags = cpp_flags,
        });
        exe.addIncludePath(b.path("../wrapers/transport/include"));
        exe.addIncludePath(b.path("../wrapers/transport/src/generated"));
        exe.addIncludePath(b.path(transport_vendor_src));
        exe.linkLibCpp();
    }

    exe.linkLibC();

    return exe;
}

pub fn build(b: *Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    const build_all = b.option(bool, "all", "Build for all supported targets") orelse false;
    const transport_override = b.option(bool, "transport", "Enable Cap'n Proto transport/server support");

    if (build_all) {
        for (build_utils.supported_targets) |query| {
            const resolved_target = b.resolveTargetQuery(query);
            const with_transport = transport_override orelse supportsTransport(resolved_target);
            const target_str = build_utils.getTargetString(resolved_target);
            const exe_name = build_utils.getExeName(std.heap.page_allocator, "storage", target_str);
            const exe = addStorageExecutable(b, resolved_target, optimize, exe_name, with_transport);
            b.installArtifact(exe);
        }
        return;
    }

    const with_transport = transport_override orelse supportsTransport(target);
    const exe = addStorageExecutable(b, target, optimize, "storage", with_transport);
    b.installArtifact(exe);

    const mdbx = buildMdbx(b, target, optimize);
    const sqlite_vec = addSqliteVecObj(b, target, optimize);
    const sqlite3 = buildSqlite3(b, target, optimize);

    const tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });

    const tests_options = b.addOptions();
    tests_options.addOption(bool, "with_transport", false);
    tests.root_module.addOptions("build_options", tests_options);

    tests.linkLibrary(mdbx);
    tests.linkLibrary(sqlite3);
    tests.addObject(sqlite_vec);
    tests.addCSourceFile(.{
        .file = b.path("../wrapers/column/src/sqlite3/c/result-transient.c"),
        .flags = &[_][]const u8{"-std=c99"},
    });
    tests.root_module.addIncludePath(b.path("../wrapers/column/src/sqlite3/c"));
    tests.root_module.addIncludePath(b.path(sqlite_dir));
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

    const run_tests = b.addRunArtifact(tests);
    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_tests.step);

    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());
    if (b.args) |args| run_cmd.addArgs(args);
    const run_step = b.step("run", "Run storage engine");
    run_step.dependOn(&run_cmd.step);
}
