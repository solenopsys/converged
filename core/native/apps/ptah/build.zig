const std = @import("std");
const Build = std.Build;
const OptimizeMode = std.builtin.OptimizeMode;

/// The QuickJS wrapper lives beside us under navite/wrappers.
const qjs_wrapper_dir = "../../wrappers/rt/qjs";

fn qjsTargetTriple(b: *Build, target: Build.ResolvedTarget) []const u8 {
    const arch = switch (target.result.cpu.arch) {
        .x86_64 => "x86_64",
        .aarch64 => "aarch64",
        else => std.debug.panic("unsupported cpu arch for qjs: {s}", .{@tagName(target.result.cpu.arch)}),
    };
    const libc = switch (target.result.abi) {
        .gnu, .gnueabi, .gnueabihf => "gnu",
        .musl, .musleabi, .musleabihf => "musl",
        else => std.debug.panic("unsupported abi for qjs: {s}", .{@tagName(target.result.abi)}),
    };
    return b.fmt("{s}-linux-{s}", .{ arch, libc });
}

fn targetString(target: Build.ResolvedTarget) []const u8 {
    const arch = @tagName(target.result.cpu.arch);
    const abi = @tagName(target.result.abi);
    return std.fmt.allocPrint(std.heap.page_allocator, "{s}-{s}", .{ arch, abi }) catch @panic("OOM");
}

/// Bundle the TypeScript policy into one classic script.
///
/// Every source file is registered as an input by hand. Passing the directory
/// alone is not enough — the Run step keys its cache on declared file inputs,
/// so a directory argument leaves the bundle stale after an edit, and the
/// binary silently ships yesterday's rules.
fn addPolicyBundle(b: *Build) Build.LazyPath {
    const bundle = b.addSystemCommand(&.{ "bun", "run", "build.ts" });
    bundle.setCwd(b.path("policy"));
    bundle.setName("bundle policy (bun)");
    bundle.addDirectoryArg(b.path("policy/src"));
    bundle.addFileInput(b.path("policy/build.ts"));

    const io = b.graph.io;
    var dir = b.build_root.handle.openDir(io, "policy/src", .{ .iterate = true }) catch
        @panic("ptah: policy/src is missing");
    defer dir.close(io);
    var walker = dir.walk(b.allocator) catch @panic("OOM");
    defer walker.deinit();
    while (walker.next(io) catch @panic("ptah: cannot walk policy/src")) |entry| {
        if (entry.kind != .file) continue;
        bundle.addFileInput(b.path(b.fmt("policy/src/{s}", .{entry.path})));
    }

    return bundle.addOutputFileArg("policy.js");
}

/// Build libqjs.so for `target` and link it, installing a copy next to the
/// executable so a deployment is one bin/ plus one lib/ directory. Returns the
/// directory holding the freshly built .so, which the test runner needs on its
/// library path: it runs straight out of the cache, where `$ORIGIN/lib` does
/// not exist.
fn linkQjs(
    b: *Build,
    compile: *Build.Step.Compile,
    target: Build.ResolvedTarget,
    optimize: OptimizeMode,
) []const u8 {
    const target_str = targetString(target);
    const install_dir = b.fmt("../../../apps/ptah/.zig-cache/qjs/{s}", .{target_str});
    const lib_dir = b.fmt(".zig-cache/qjs/{s}/lib", .{target_str});

    const wrapper = b.addSystemCommand(&.{
        b.graph.zig_exe,
        "build",
        b.fmt("-Dtarget={s}", .{qjsTargetTriple(b, target)}),
        b.fmt("-Doptimize={s}", .{@tagName(optimize)}),
        "--prefix",
        install_dir,
    });
    wrapper.setCwd(b.path(qjs_wrapper_dir));
    wrapper.setName("build QuickJS wrapper");

    compile.step.dependOn(&wrapper.step);
    compile.root_module.addLibraryPath(.{ .cwd_relative = lib_dir });
    compile.root_module.addRPathSpecial("$ORIGIN/lib");
    compile.root_module.addRPathSpecial("$ORIGIN/../lib");
    compile.root_module.linkSystemLibrary("qjs", .{});
    compile.root_module.link_libc = true;

    const install_lib = b.addInstallFileWithDir(
        .{ .cwd_relative = b.fmt("{s}/libqjs.so", .{lib_dir}) },
        .lib,
        "libqjs.so",
    );
    install_lib.step.dependOn(&wrapper.step);
    b.getInstallStep().dependOn(&install_lib.step);
    return lib_dir;
}

pub fn build(b: *Build) void {
    const requested = b.standardTargetOptions(.{});
    const host = b.graph.host.result;
    // Local runs build against the host glibc; container builds pass musl.
    const target = if (requested.query.isNative() and host.os.tag == .linux)
        b.resolveTargetQuery(.{
            .cpu_arch = host.cpu.arch,
            .os_tag = .linux,
            .abi = .gnu,
            .glibc_version = host.os.version_range.linux.glibc,
        })
    else
        requested;
    const optimize = b.option(OptimizeMode, "optimize", "Prioritize performance, safety, or binary size") orelse .ReleaseFast;

    const policy_js = addPolicyBundle(b);

    const exe = b.addExecutable(.{
        .name = "ptah",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    exe.root_module.addAnonymousImport("policy.js", .{ .root_source_file = policy_js });
    _ = linkQjs(b, exe, target, optimize);
    b.installArtifact(exe);

    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());
    if (b.args) |args| run_cmd.addArgs(args);
    const run_step = b.step("run", "Run ptah");
    run_step.dependOn(&run_cmd.step);

    const tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/tests.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    tests.root_module.addAnonymousImport("policy.js", .{ .root_source_file = policy_js });
    const test_lib_dir = linkQjs(b, tests, target, optimize);
    const run_tests = b.addRunArtifact(tests);
    run_tests.setEnvironmentVariable(
        "LD_LIBRARY_PATH",
        b.pathFromRoot(test_lib_dir),
    );
    const test_step = b.step("test", "Run ptah unit tests");
    test_step.dependOn(&run_tests.step);
}
