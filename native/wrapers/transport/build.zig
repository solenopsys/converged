const std = @import("std");

const supported_targets = [_]std.Target.Query{
    .{ .cpu_arch = .x86_64, .os_tag = .linux, .abi = .gnu, .cpu_model = .{ .explicit = &std.Target.x86.cpu.x86_64 } },
    .{ .cpu_arch = .x86_64, .os_tag = .linux, .abi = .musl, .cpu_model = .{ .explicit = &std.Target.x86.cpu.x86_64 } },
    .{ .cpu_arch = .aarch64, .os_tag = .linux, .abi = .gnu },
    .{ .cpu_arch = .aarch64, .os_tag = .linux, .abi = .musl },
};

const vendor_src = "vendor/capnproto/c++/src";

const kj_sources = [_][]const u8{
    vendor_src ++ "/kj/array.c++",
    vendor_src ++ "/kj/arena.c++",
    vendor_src ++ "/kj/common.c++",
    vendor_src ++ "/kj/debug.c++",
    vendor_src ++ "/kj/encoding.c++",
    vendor_src ++ "/kj/exception.c++",
    vendor_src ++ "/kj/hash.c++",
    vendor_src ++ "/kj/io.c++",
    vendor_src ++ "/kj/list.c++",
    vendor_src ++ "/kj/memory.c++",
    vendor_src ++ "/kj/mutex.c++",
    vendor_src ++ "/kj/refcount.c++",
    vendor_src ++ "/kj/source-location.c++",
    vendor_src ++ "/kj/string.c++",
    vendor_src ++ "/kj/string-tree.c++",
    vendor_src ++ "/kj/table.c++",
    vendor_src ++ "/kj/thread.c++",
    vendor_src ++ "/kj/time.c++",
    vendor_src ++ "/kj/units.c++",
};

const capnp_sources = [_][]const u8{
    vendor_src ++ "/capnp/any.c++",
    vendor_src ++ "/capnp/arena.c++",
    vendor_src ++ "/capnp/blob.c++",
    vendor_src ++ "/capnp/c++.capnp.c++",
    vendor_src ++ "/capnp/layout.c++",
    vendor_src ++ "/capnp/list.c++",
    vendor_src ++ "/capnp/message.c++",
    vendor_src ++ "/capnp/schema.capnp.c++",
    vendor_src ++ "/capnp/serialize.c++",
    vendor_src ++ "/capnp/serialize-packed.c++",
    vendor_src ++ "/capnp/stringify.c++",
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

fn addTransportLib(
    b: *std.Build,
    target: std.Build.ResolvedTarget,
    optimize: std.builtin.OptimizeMode,
    name: []const u8,
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

    // vendored kj sources
    for (kj_sources) |src| {
        lib.addCSourceFile(.{ .file = b.path(src), .flags = cpp_flags });
    }

    // vendored capnp sources
    for (capnp_sources) |src| {
        lib.addCSourceFile(.{ .file = b.path(src), .flags = cpp_flags });
    }

    // transport application sources
    lib.addCSourceFile(.{ .file = b.path("src/generated/wire.capnp.cpp"), .flags = cpp_flags });
    lib.addCSourceFile(.{ .file = b.path("src/capnp_wrap.cpp"), .flags = cpp_flags });

    lib.addIncludePath(b.path("include"));
    lib.addIncludePath(b.path("src/generated"));
    lib.addIncludePath(b.path(vendor_src));

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
            const lib = addTransportLib(b, resolved_target, optimize, lib_name);
            b.installArtifact(lib);
        }
        return;
    }

    const lib = addTransportLib(b, target, optimize, "transport");
    b.installArtifact(lib);
}
