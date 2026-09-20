const std = @import("std");

const wrapper_dir = "../wrappers/ai/onnxruntime";

fn targetTriple(b: *std.Build, target: std.Build.ResolvedTarget) []const u8 {
    const arch = switch (target.result.cpu.arch) {
        .x86_64 => "x86_64",
        .aarch64 => "aarch64",
        else => @panic("CASE supports x86_64 and aarch64 Linux only"),
    };
    const abi = switch (target.result.abi) {
        .gnu, .gnueabi, .gnueabihf => "gnu",
        .musl, .musleabi, .musleabihf => "musl",
        else => @panic("CASE supports gnu and musl Linux only"),
    };
    return b.fmt("{s}-linux-{s}", .{ arch, abi });
}

fn linkOnnxRuntime(b: *std.Build, exe: *std.Build.Step.Compile, target: std.Build.ResolvedTarget, optimize: std.builtin.OptimizeMode) void {
    const triple = targetTriple(b, target);
    const lib_dir = b.fmt("../wrappers/ai/onnxruntime/zig-out/{s}/lib", .{triple});
    const wrapper = b.addSystemCommand(&.{
        b.graph.zig_exe,
        "build",
        b.fmt("-Dtarget={s}", .{triple}),
        b.fmt("-Doptimize={s}", .{@tagName(optimize)}),
    });
    wrapper.setCwd(b.path(wrapper_dir));
    wrapper.setName(b.fmt("build ONNX Runtime wrapper ({s})", .{triple}));
    exe.step.dependOn(&wrapper.step);
    exe.root_module.addLibraryPath(.{ .cwd_relative = lib_dir });
    exe.root_module.addRPathSpecial("$ORIGIN/lib");
    exe.root_module.addRPathSpecial("$ORIGIN/../lib");
    exe.root_module.linkSystemLibrary("onnxruntime", .{});
    exe.root_module.link_libc = true;

    const install_lib = b.addInstallFileWithDir(
        .{ .cwd_relative = b.fmt("{s}/libonnxruntime.so", .{lib_dir}) },
        .lib,
        "libonnxruntime.so",
    );
    install_lib.step.dependOn(&wrapper.step);
    b.getInstallStep().dependOn(&install_lib.step);
}

pub fn build(b: *std.Build) void {
    const requested = b.standardTargetOptions(.{});
    const host = b.graph.host.result;
    const target = if (requested.query.isNative() and host.os.tag == .linux) b.resolveTargetQuery(.{
        .cpu_arch = host.cpu.arch,
        .os_tag = .linux,
        .abi = .gnu,
        .glibc_version = host.os.version_range.linux.glibc,
    }) else requested;
    const optimize = b.option(std.builtin.OptimizeMode, "optimize", "Prioritize performance, safety, or binary size") orelse .ReleaseFast;
    const exe = b.addExecutable(.{
        .name = "case",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    linkOnnxRuntime(b, exe, target, optimize);
    b.installArtifact(exe);
    const run = b.addRunArtifact(exe);
    run.step.dependOn(b.getInstallStep());
    if (b.args) |args| run.addArgs(args);
    const run_step = b.step("run", "Run the CASE HTTP service");
    run_step.dependOn(&run.step);
}
