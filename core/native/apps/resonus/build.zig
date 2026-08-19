const std = @import("std");
const Build = std.Build;
const OptimizeMode = std.builtin.OptimizeMode;

/// Map a resolved target to the `-Dtarget=` triple the libdatachannel wrapper
/// understands. Mirrors centimanus/build.zig's helper of the same name.
fn getLinuxTargetTriple(b: *Build, target: Build.ResolvedTarget) []const u8 {
    const arch = switch (target.result.cpu.arch) {
        .x86_64 => "x86_64",
        .aarch64 => "aarch64",
        else => std.debug.panic("unsupported cpu arch for libdatachannel wrapper: {s}", .{@tagName(target.result.cpu.arch)}),
    };
    const libc = switch (target.result.abi) {
        .gnu, .gnueabi, .gnueabihf => "gnu",
        .musl, .musleabi, .musleabihf => "musl",
        else => std.debug.panic("unsupported abi for libdatachannel wrapper: {s}", .{@tagName(target.result.abi)}),
    };
    return b.fmt("{s}-linux-{s}", .{ arch, libc });
}

/// Build the native libdatachannel wrapper and link it in for its C header
/// (`llm/openai_realtime.zig` uses the raw `ldc_*` websocket API via
/// `@cImport`). The other native bridges in this app (baresip, datachannel
/// peer connections) dlopen the same .so at runtime instead — this is the one
/// compile-time consumer, carried over as-is from centimanus.
fn linkRealtimeWrapper(
    b: *Build,
    exe: *Build.Step.Compile,
    target: Build.ResolvedTarget,
    optimize: OptimizeMode,
) void {
    const triple = getLinuxTargetTriple(b, target);
    // The system command's cwd is the wrapper dir (see setCwd below), so
    // --prefix must climb back to resonus's own .zig-cache explicitly.
    const install_dir = b.fmt("../../../apps/resonus/.zig-cache/realtime-wrapper/{s}", .{triple});
    const lib_dir = b.fmt(".zig-cache/realtime-wrapper/{s}/lib", .{triple});
    const wrapper_dir = "../../wrappers/protocols/libdatachannel";
    const build_cmd = b.addSystemCommand(&[_][]const u8{
        b.graph.zig_exe,
        "build",
        b.fmt("-Dtarget={s}", .{triple}),
        b.fmt("-Doptimize={s}", .{@tagName(optimize)}),
        "--prefix",
        install_dir,
    });
    build_cmd.setCwd(b.path(wrapper_dir));
    build_cmd.setName(b.fmt("build realtime WebSocket wrapper ({s})", .{triple}));

    exe.step.dependOn(&build_cmd.step);
    exe.root_module.addIncludePath(b.path("../../wrappers/protocols/libdatachannel/include"));
    exe.root_module.addLibraryPath(.{ .cwd_relative = lib_dir });
    exe.root_module.addRPathSpecial("$ORIGIN/lib");
    exe.root_module.addRPathSpecial("$ORIGIN/../lib");
    exe.root_module.linkSystemLibrary("datachannel_wrapper", .{});
    // The wrapper also dlopens this library by SONAME. Linking it here makes
    // the already-loaded object available to that lookup on every runtime.
    exe.root_module.linkSystemLibrary("datachannel", .{});
}

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const host = b.graph.host.result;
    // Keep native Linux builds on Zig's host glibc range. The system GCC 16
    // crt1.o in this environment contains .sframe relocations unsupported by
    // the default native linker path; explicit cross-targets remain untouched.
    const runtime_target = if (target.query.isNative() and host.os.tag == .linux) b.resolveTargetQuery(.{
        .cpu_arch = host.cpu.arch,
        .os_tag = .linux,
        .abi = .gnu,
        .glibc_version = host.os.version_range.linux.glibc,
    }) else target;
    const optimize = b.option(std.builtin.OptimizeMode, "optimize", "Prioritize performance, safety, or binary size") orelse .ReleaseFast;
    const transport_dep = b.dependency("transport", .{ .target = runtime_target, .optimize = optimize });

    const exe = b.addExecutable(.{
        .name = "resonus",
        .use_lld = false,
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = runtime_target,
            .optimize = optimize,
        }),
    });
    exe.root_module.addImport("transport", transport_dep.module("transport"));

    exe.root_module.link_libc = true;
    linkRealtimeWrapper(b, exe, runtime_target, optimize);
    b.installArtifact(exe);

    // Focused end-to-end diagnostic for the OpenAI dictation media path.  It
    // deliberately has no Gateway, SIP, HTTP or browser-signaling dependency.
    const dictation_smoke = b.addExecutable(.{
        .name = "dictation-smoke",
        .use_lld = false,
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/dictation_smoke_main.zig"),
            .target = runtime_target,
            .optimize = optimize,
        }),
    });
    dictation_smoke.root_module.link_libc = true;
    linkRealtimeWrapper(b, dictation_smoke, runtime_target, optimize);

    const run_dictation_smoke = b.addRunArtifact(dictation_smoke);
    if (b.args) |args| run_dictation_smoke.addArgs(args);
    const dictation_smoke_step = b.step("dictation-smoke", "Send a known Opus fixture directly through the OpenAI dictation bridge");
    dictation_smoke_step.dependOn(&run_dictation_smoke.step);

    const run_cmd = b.addRunArtifact(exe);
    if (b.args) |args| run_cmd.addArgs(args);

    const run_step = b.step("run", "Run resonus");
    run_step.dependOn(&run_cmd.step);

    const unit_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = runtime_target,
            .optimize = optimize,
        }),
    });
    unit_tests.root_module.addImport("transport", transport_dep.module("transport"));

    unit_tests.root_module.link_libc = true;
    linkRealtimeWrapper(b, unit_tests, runtime_target, optimize);

    const run_unit_tests = b.addRunArtifact(unit_tests);
    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_unit_tests.step);

    const store_test_step = b.step("test-store", "Store tests require a live Valkey + service API environment");
    store_test_step.dependOn(&run_unit_tests.step);
}
