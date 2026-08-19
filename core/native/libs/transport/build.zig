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
    vendor_src ++ "/capnp/dynamic.c++",
    vendor_src ++ "/capnp/layout.c++",
    vendor_src ++ "/capnp/list.c++",
    vendor_src ++ "/capnp/message.c++",
    vendor_src ++ "/capnp/schema.capnp.c++",
    vendor_src ++ "/capnp/schema.c++",
    vendor_src ++ "/capnp/stream.capnp.c++",
    vendor_src ++ "/capnp/serialize.c++",
    vendor_src ++ "/capnp/serialize-packed.c++",
    vendor_src ++ "/capnp/stringify.c++",
};

fn createTransportModule(
    b: *std.Build,
    target: std.Build.ResolvedTarget,
    optimize: std.builtin.OptimizeMode,
) *std.Build.Module {
    const zimq = b.dependency("zimq", .{ .target = target, .optimize = optimize });
    const module = b.createModule(.{
        .root_source_file = b.path("src/root.zig"),
        .target = target,
        .optimize = optimize,
    });
    module.addImport("zimq", zimq.module("zimq"));
    module.linkLibrary(zimq.artifact("zimq"));
    return module;
}

fn addMessageLib(
    b: *std.Build,
    target: std.Build.ResolvedTarget,
    optimize: std.builtin.OptimizeMode,
    name: []const u8,
    transport_module: *std.Build.Module,
) *std.Build.Step.Compile {
    const lib = b.addLibrary(.{
        .name = name,
        .linkage = .dynamic,
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/abi.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    lib.root_module.addImport("transport", transport_module);
    lib.root_module.link_libc = true;
    lib.root_module.addRPathSpecial("$ORIGIN");
    return lib;
}

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

fn addStorageLib(
    b: *std.Build,
    target: std.Build.ResolvedTarget,
    optimize: std.builtin.OptimizeMode,
    name: []const u8,
) *std.Build.Step.Compile {
    const zimq = b.dependency("zimq", .{ .target = target, .optimize = optimize });
    const lib = b.addLibrary(.{
        .name = name,
        .linkage = .dynamic,
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/storage/lib.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });

    // vendored kj/capnp internals — keep hidden to avoid symbol pollution
    const vendor_flags = &[_][]const u8{
        "-std=c++17",
        "-fPIC",
        "-fvisibility=hidden",
        "-O2",
        "-Wno-unused-parameter",
    };

    // transport API sources — default visibility so symbols appear in .so
    const api_flags = &[_][]const u8{
        "-std=c++17",
        "-fPIC",
        "-O2",
        "-Wno-unused-parameter",
    };

    // vendored kj sources
    for (kj_sources) |src| {
        lib.root_module.addCSourceFile(.{ .file = b.path(src), .flags = vendor_flags });
    }

    // vendored capnp sources
    for (capnp_sources) |src| {
        lib.root_module.addCSourceFile(.{ .file = b.path(src), .flags = vendor_flags });
    }

    // transport application sources
    lib.root_module.addCSourceFile(.{ .file = b.path("src/storage/generated/wire.capnp.cpp"), .flags = api_flags });
    lib.root_module.addCSourceFile(.{ .file = b.path("src/storage/capnp_wrap.cpp"), .flags = api_flags });

    lib.root_module.addIncludePath(b.path("include"));
    lib.root_module.addIncludePath(b.path("src/storage/generated"));
    lib.root_module.addIncludePath(b.path(vendor_src));
    lib.root_module.addImport("zimq", zimq.module("zimq"));
    lib.root_module.linkLibrary(zimq.artifact("zimq"));
    lib.root_module.addRPathSpecial("$ORIGIN");

    lib.root_module.linkSystemLibrary("c++", .{});
    lib.root_module.linkSystemLibrary("c", .{});

    return lib;
}

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const host = b.graph.host.result;
    const runtime_target = if (target.query.isNative() and host.os.tag == .linux) b.resolveTargetQuery(.{
        .cpu_arch = host.cpu.arch,
        .os_tag = .linux,
        .abi = .gnu,
        .glibc_version = host.os.version_range.linux.glibc,
    }) else target;
    const optimize = b.option(std.builtin.OptimizeMode, "optimize", "Prioritize performance, safety, or binary size") orelse .ReleaseFast;
    const build_all = b.option(bool, "all", "Build for all supported targets") orelse false;

    const native_zimq = b.dependency("zimq", .{ .target = runtime_target, .optimize = optimize });
    const transport_module = b.addModule("transport", .{
        .root_source_file = b.path("src/root.zig"),
        .target = runtime_target,
        .optimize = optimize,
    });
    transport_module.addImport("zimq", native_zimq.module("zimq"));
    transport_module.linkLibrary(native_zimq.artifact("zimq"));

    const module_tests = b.addTest(.{
        .name = "transport-tests",
        .root_module = transport_module,
    });
    const run_module_tests = b.addRunArtifact(module_tests);
    const test_step = b.step("test", "Run message-core tests");
    test_step.dependOn(&run_module_tests.step);

    const router_fixture = b.addExecutable(.{
        .name = "message-router-fixture",
        .root_module = b.createModule(.{
            .root_source_file = b.path("tests/router_fixture.zig"),
            .target = runtime_target,
            .optimize = optimize,
        }),
    });
    router_fixture.root_module.addImport("transport", transport_module);
    router_fixture.root_module.addRPathSpecial("$ORIGIN/../lib");
    const fixture_step = b.step("fixture", "Build the messaging Router smoke-test fixture");
    fixture_step.dependOn(&b.addInstallArtifact(router_fixture, .{}).step);
    fixture_step.dependOn(&b.addInstallArtifact(native_zimq.artifact("zimq"), .{}).step);

    const abi_tests_module = b.createModule(.{
        .root_source_file = b.path("src/abi.zig"),
        .target = runtime_target,
        .optimize = optimize,
    });
    abi_tests_module.addImport("transport", transport_module);
    abi_tests_module.link_libc = true;
    const abi_tests = b.addTest(.{ .name = "message-abi-tests", .root_module = abi_tests_module });
    test_step.dependOn(&b.addRunArtifact(abi_tests).step);

    if (build_all) {
        for (supported_targets) |query| {
            const resolved_target = b.resolveTargetQuery(query);
            const target_str = getTargetString(resolved_target);
            const lib_name = getLibName(std.heap.page_allocator, "transport", target_str);
            const lib = addStorageLib(b, resolved_target, optimize, lib_name);
            const message_name = getLibName(std.heap.page_allocator, "message", target_str);
            const target_transport_module = createTransportModule(b, resolved_target, optimize);
            const message = addMessageLib(b, resolved_target, optimize, message_name, target_transport_module);
            const zimq = b.dependency("zimq", .{ .target = resolved_target, .optimize = optimize });
            b.installArtifact(lib);
            b.installArtifact(message);
            const so_name = std.fmt.allocPrint(std.heap.page_allocator, "lib{s}.so", .{lib_name}) catch continue;
            const sync = b.addInstallFileWithDir(
                lib.getEmittedBin(),
                .{ .custom = "../../cruller-transport/bin-libs" },
                so_name,
            );
            sync.step.dependOn(&lib.step);
            b.getInstallStep().dependOn(&sync.step);
            const message_so_name = std.fmt.allocPrint(std.heap.page_allocator, "lib{s}.so", .{message_name}) catch continue;
            const message_sync = b.addInstallFileWithDir(
                message.getEmittedBin(),
                .{ .custom = "../../cruller-transport/bin-libs" },
                message_so_name,
            );
            message_sync.step.dependOn(&message.step);
            b.getInstallStep().dependOn(&message_sync.step);
            const zimq_sync = b.addInstallFileWithDir(
                zimq.artifact("zimq").getEmittedBin(),
                .{ .custom = "../../cruller-transport/bin-libs" },
                b.fmt("libzimq-{s}.so", .{target_str}),
            );
            zimq_sync.step.dependOn(&zimq.artifact("zimq").step);
            b.getInstallStep().dependOn(&zimq_sync.step);
        }
        return;
    }

    const lib = addStorageLib(b, runtime_target, optimize, "transport");
    b.installArtifact(lib);
    const message = addMessageLib(b, runtime_target, optimize, "message", transport_module);
    b.installArtifact(message);
    const zimq = b.dependency("zimq", .{ .target = runtime_target, .optimize = optimize });
    b.installArtifact(zimq.artifact("zimq"));

    // In-memory mock with the same C ABI — for service tests without storage.
    // `zig build mock` → zig-out/lib/libtransport-mock.so
    const mock = b.addLibrary(.{
        .name = "transport-mock",
        .linkage = .dynamic,
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/storage/mock.zig"),
            .target = runtime_target,
            .optimize = optimize,
        }),
    });
    mock.root_module.link_libc = true;
    const mock_install = b.addInstallArtifact(mock, .{});
    const mock_step = b.step("mock", "Build in-memory mock transport library");
    mock_step.dependOn(&mock_install.step);
}
