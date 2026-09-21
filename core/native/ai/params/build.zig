const std = @import("std");

const wrapper_out_dir = "../../wrappers/ai/onnxruntime/zig-out";

fn targetTriple(b: *std.Build, target: std.Build.ResolvedTarget) []const u8 {
    const arch = switch (target.result.cpu.arch) {
        .x86_64 => "x86_64",
        .aarch64 => "aarch64",
        else => @panic("PARAMS supports x86_64 and aarch64 Linux only"),
    };
    const abi = switch (target.result.abi) {
        .gnu, .gnueabi, .gnueabihf => "gnu",
        .musl, .musleabi, .musleabihf => "musl",
        else => @panic("PARAMS supports gnu and musl Linux only"),
    };
    return b.fmt("{s}-linux-{s}", .{ arch, abi });
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
    const optimize = b.option(std.builtin.OptimizeMode, "optimize", "Build mode") orelse .ReleaseFast;
    const exe = b.addExecutable(.{
        .name = "params",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    exe.root_module.addImport("tokenizer", b.createModule(.{
        .root_source_file = b.path("src/tokenizer.zig"),
        .target = target,
        .optimize = optimize,
    }));
    const triple = targetTriple(b, target);
    const lib_dir = b.fmt("{s}/{s}/lib", .{ wrapper_out_dir, triple });
    exe.root_module.addLibraryPath(.{ .cwd_relative = lib_dir });
    exe.root_module.addRPathSpecial("$ORIGIN/lib");
    exe.root_module.linkSystemLibrary("onnxruntime", .{});
    exe.root_module.link_libc = true;
    const install_lib = b.addInstallFileWithDir(
        .{ .cwd_relative = b.fmt("{s}/libonnxruntime.so", .{lib_dir}) },
        .lib,
        "libonnxruntime.so",
    );
    b.getInstallStep().dependOn(&install_lib.step);
    b.installArtifact(exe);
    const run = b.addRunArtifact(exe);
    run.step.dependOn(b.getInstallStep());
    if (b.args) |args| run.addArgs(args);
    b.step("run", "Run PARAMS").dependOn(&run.step);
}
