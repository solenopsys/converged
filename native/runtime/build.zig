const std = @import("std");
const Build = std.Build;
const OptimizeMode = std.builtin.OptimizeMode;
const build_utils = @import("build_utils.zig");

// The qjs dynamic-library wrapper lives alongside us under native/wrapers.
const qjs_wrapper_dir = "../wrapers/qjs";

/// Map a resolved target to the `-Dtarget=` triple the qjs wrapper understands.
fn getQjsTargetTriple(b: *Build, target: Build.ResolvedTarget) []const u8 {
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

/// Run the qjs wrapper's own `zig build` for `target`, installing libqjs.so into
/// `install_dir` (a prefix relative to the wrapper's directory).
fn addQjsWrapperBuild(
    b: *Build,
    target: Build.ResolvedTarget,
    optimize: OptimizeMode,
    install_dir: []const u8,
) *Build.Step.Run {
    const triple = getQjsTargetTriple(b, target);
    const build_cmd = b.addSystemCommand(&[_][]const u8{
        b.graph.zig_exe,
        "build",
        b.fmt("-Dtarget={s}", .{triple}),
        b.fmt("-Doptimize={s}", .{@tagName(optimize)}),
        "--prefix",
        install_dir,
    });
    build_cmd.setCwd(b.path(qjs_wrapper_dir));
    build_cmd.setName(b.fmt("build qjs wrapper ({s})", .{build_utils.getTargetString(target)}));
    return build_cmd;
}

/// Build the qjs wrapper, link the resulting libqjs.so into `exe`, and install a
/// copy of the .so next to the executable (under zig-out/lib/<install_name>).
fn linkQjsWrapper(
    b: *Build,
    exe: *Build.Step.Compile,
    target: Build.ResolvedTarget,
    optimize: OptimizeMode,
    install_name: []const u8,
) void {
    const target_str = build_utils.getTargetString(target);
    // The wrapper build writes here; the path is expressed both relative to the
    // wrapper (for --prefix) and relative to us (for linking), aimed at the same
    // directory inside our cache.
    const install_dir = b.fmt("../../runtime/.zig-cache/qjs-wrapper/{s}", .{target_str});
    const lib_dir = b.fmt(".zig-cache/qjs-wrapper/{s}/lib", .{target_str});
    const build_cmd = addQjsWrapperBuild(b, target, optimize, install_dir);

    exe.step.dependOn(&build_cmd.step);
    exe.root_module.addLibraryPath(.{ .cwd_relative = lib_dir });
    exe.root_module.addRPathSpecial("$ORIGIN/lib");
    exe.root_module.addRPathSpecial("$ORIGIN/../lib");
    exe.root_module.linkSystemLibrary("qjs", .{});
    exe.root_module.link_libc = true;

    const install_lib = b.addInstallFileWithDir(
        .{ .cwd_relative = b.fmt("{s}/libqjs.so", .{lib_dir}) },
        .lib,
        install_name,
    );
    install_lib.step.dependOn(&build_cmd.step);
    b.getInstallStep().dependOn(&install_lib.step);
}

fn addRuntimeExecutable(
    b: *Build,
    target: Build.ResolvedTarget,
    optimize: OptimizeMode,
    name: []const u8,
) *Build.Step.Compile {
    return b.addExecutable(.{
        .name = name,
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
}

pub fn build(b: *Build) void {
    const target = b.standardTargetOptions(.{
        .default_target = .{
            .cpu_arch = .x86_64,
            .os_tag = .linux,
            .abi = .musl,
        },
    });
    const optimize = b.standardOptimizeOption(.{});
    const build_all = b.option(bool, "all", "Build for all supported targets") orelse false;

    if (build_all) {
        for (build_utils.supported_targets) |query| {
            const resolved = b.resolveTargetQuery(query);
            const target_str = build_utils.getTargetString(resolved);
            const exe_name = build_utils.getExeName(std.heap.page_allocator, "runtime", target_str);
            const lib_name = build_utils.getLibName(std.heap.page_allocator, "qjs", target_str);
            const lib_install = b.fmt("lib{s}.so", .{lib_name});
            const exe = addRuntimeExecutable(b, resolved, optimize, exe_name);
            linkQjsWrapper(b, exe, resolved, optimize, lib_install);
            b.installArtifact(exe);
        }
        return;
    }

    const exe = addRuntimeExecutable(b, target, optimize, "runtime");
    linkQjsWrapper(b, exe, target, optimize, "libqjs.so");
    b.installArtifact(exe);

    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());
    if (b.args) |args| run_cmd.addArgs(args);
    const run_step = b.step("run", "Run the runtime HTTP server");
    run_step.dependOn(&run_cmd.step);
}
