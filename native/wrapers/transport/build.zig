const std = @import("std");

const supported_targets = [_]std.Target.Query{
    .{ .cpu_arch = .x86_64, .os_tag = .linux, .abi = .gnu, .cpu_model = .{ .explicit = &std.Target.x86.cpu.x86_64 } },
    .{ .cpu_arch = .x86_64, .os_tag = .linux, .abi = .musl, .cpu_model = .{ .explicit = &std.Target.x86.cpu.x86_64 } },
    .{ .cpu_arch = .aarch64, .os_tag = .linux, .abi = .gnu },
    .{ .cpu_arch = .aarch64, .os_tag = .linux, .abi = .musl },
};

fn getTargetString(target: std.Build.ResolvedTarget) []const u8 {
    const arch_str = switch (target.result.cpu.arch) {
        .x86_64 => "x86_64",
        .aarch64 => "aarch64",
        else => "unknown",
    };
    const libc_str = switch (target.result.abi) {
        .musl, .musleabi, .musleabihf => "musl",
        .gnu, .gnueabi, .gnueabihf => "gnu",
        else => "gnu",
    };
    return std.fmt.allocPrint(std.heap.page_allocator, "{s}-{s}", .{ arch_str, libc_str }) catch "unknown";
}

fn getLibName(allocator: std.mem.Allocator, base_name: []const u8, target_str: []const u8) []const u8 {
    return std.fmt.allocPrint(allocator, "{s}-{s}", .{ base_name, target_str }) catch base_name;
}

fn supportsSystemCapnp(target: std.Build.ResolvedTarget) bool {
    return target.result.os.tag == .linux and target.result.cpu.arch == .x86_64 and target.result.abi == .gnu;
}

fn addTransportLib(
    b: *std.Build,
    target: std.Build.ResolvedTarget,
    optimize: std.builtin.OptimizeMode,
    name: []const u8,
    with_system_capnp: bool,
) *std.Build.Step.Compile {
    const lib = b.addLibrary(.{
        .name = name,
        .linkage = .dynamic,
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/lib.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });

    const cpp_flags = &[_][]const u8{
        "-std=c++17",
        "-fPIC",
        "-fvisibility=hidden",
        "-O2",
        "-Wno-unused-parameter",
    };

    lib.addCSourceFile(.{
        .file = b.path("src/generated/wire.capnp.cpp"),
        .flags = cpp_flags,
    });

    lib.addCSourceFile(.{
        .file = b.path("src/capnp_wrap.cpp"),
        .flags = cpp_flags,
    });

    lib.addIncludePath(b.path("include"));
    lib.addIncludePath(b.path("src/generated"));
    lib.addSystemIncludePath(.{ .cwd_relative = "/usr/include" });

    if (with_system_capnp) {
        lib.addLibraryPath(.{ .cwd_relative = "/usr/lib" });
        lib.linkSystemLibrary("capnp");
        lib.linkSystemLibrary("kj");
    }

    lib.linkLibCpp();
    lib.linkLibC();

    return lib;
}

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    const build_all = b.option(bool, "all", "Build for all supported targets") orelse false;

    if (build_all) {
        for (supported_targets) |query| {
            const resolved_target = b.resolveTargetQuery(query);
            const target_str = getTargetString(resolved_target);
            const lib_name = getLibName(std.heap.page_allocator, "transport", target_str);
            const lib = addTransportLib(
                b,
                resolved_target,
                optimize,
                lib_name,
                supportsSystemCapnp(resolved_target),
            );
            b.installArtifact(lib);
        }
        return;
    }

    const with_system_capnp = supportsSystemCapnp(target);
    const lib = addTransportLib(b, target, optimize, "transport", with_system_capnp);
    b.installArtifact(lib);

    const test_step = b.step("test", "Run unit tests");
    if (!with_system_capnp) return;

    const unit_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/lib.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });

    unit_tests.addIncludePath(b.path("include"));
    unit_tests.addSystemIncludePath(.{ .cwd_relative = "/usr/include" });
    unit_tests.addLibraryPath(.{ .cwd_relative = "/usr/lib" });
    unit_tests.linkSystemLibrary("capnp");
    unit_tests.linkSystemLibrary("kj");
    unit_tests.linkLibCpp();
    unit_tests.linkLibC();

    test_step.dependOn(&b.addRunArtifact(unit_tests).step);
}
