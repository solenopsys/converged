const std = @import("std");

const wrapper_dir = "../../wrappers/slicers/curaengine";

fn targetTriple(b: *std.Build, target: std.Build.ResolvedTarget) []const u8 {
    const arch = switch (target.result.cpu.arch) {
        .x86_64 => "x86_64",
        .aarch64 => "aarch64",
        else => @panic("unsupported curaengine processor architecture"),
    };
    const libc = switch (target.result.abi) {
        .musl, .musleabi, .musleabihf => "musl",
        .gnu, .gnueabi, .gnueabihf => "gnu",
        else => @panic("unsupported curaengine processor libc"),
    };
    return b.fmt("{s}-linux-{s}", .{ arch, libc });
}

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.option(std.builtin.OptimizeMode, "optimize", "Prioritize performance, safety, or binary size") orelse .ReleaseFast;
    const host = b.graph.host.result;
    // The container is Alpine, so a native build targets musl too: the same
    // binary that is tested here is the one that ships.
    const runtime_target = if (target.query.isNative() and host.os.tag == .linux) b.resolveTargetQuery(.{
        .cpu_arch = host.cpu.arch,
        .os_tag = .linux,
        .abi = .musl,
    }) else target;

    // Both dependencies are resolved with identical options so the build graph
    // hands out one transport module — the generated NRPC descriptor and the
    // shared server must agree on `MethodPolicy`.
    const processor_dep = b.dependency("processor", .{ .target = runtime_target, .optimize = optimize });
    const transport_dep = b.dependency("transport", .{ .target = runtime_target, .optimize = optimize });

    const exe = b.addExecutable(.{
        .name = "curaengine",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = runtime_target,
            .optimize = optimize,
        }),
    });
    exe.root_module.addImport("processor", processor_dep.module("processor"));
    exe.root_module.addImport("transport", transport_dep.module("transport"));
    exe.root_module.link_libc = true;
    exe.root_module.strip = optimize != .Debug;
    // transport links libzimq.so dynamically, and the container keeps every
    // shared object in one directory beside the binary.
    exe.root_module.addRPathSpecial("$ORIGIN/lib");
    exe.root_module.addRPathSpecial("$ORIGIN/../lib");
    b.installArtifact(exe);

    const zimq_dep = transport_dep.builder.dependency("zimq", .{ .target = runtime_target, .optimize = optimize });
    b.installArtifact(zimq_dep.artifact("zimq"));

    // The slicer wrapper is dlopened at runtime, never linked, so it is a
    // separate build step rather than a dependency of the executable.
    const wrapper = b.addSystemCommand(&.{
        b.graph.zig_exe,
        "build",
        b.fmt("-Dtarget={s}", .{targetTriple(b, runtime_target)}),
        b.fmt("-Doptimize={s}", .{@tagName(optimize)}),
        "--prefix",
        b.fmt("zig-out/{s}", .{targetTriple(b, runtime_target)}),
    });
    wrapper.setCwd(b.path(wrapper_dir));
    wrapper.setName("build CuraEngine wrapper");
    const wrapper_step = b.step("wrapper", "Build libcuraengine.so (CMake, slow)");
    wrapper_step.dependOn(&wrapper.step);

    // Tests run on the host, not on the musl runtime target: the host loader
    // cannot execute a musl-linked binary, and nothing under test dlopens the
    // native wrapper. Building them still type-checks main.zig against the
    // generated NRPC descriptor and the shared server.
    const test_processor_dep = b.dependency("processor", .{ .target = target, .optimize = optimize });
    const test_transport_dep = b.dependency("transport", .{ .target = target, .optimize = optimize });
    const tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    tests.root_module.addImport("processor", test_processor_dep.module("processor"));
    tests.root_module.addImport("transport", test_transport_dep.module("transport"));
    tests.root_module.link_libc = true;
    const test_step = b.step("test", "Run curaengine processor tests");
    test_step.dependOn(&b.addRunArtifact(tests).step);
}
