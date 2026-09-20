const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.option(std.builtin.OptimizeMode, "optimize", "Build mode") orelse .ReleaseFast;
    const arch = switch (target.result.cpu.arch) {
        .x86_64 => "x86_64",
        .aarch64 => "aarch64",
        else => @panic("ONNX Runtime wrapper supports x86_64 and aarch64 Linux only"),
    };
    const abi = switch (target.result.abi) {
        .gnu, .gnueabi, .gnueabihf => "gnu",
        .musl, .musleabi, .musleabihf => "musl",
        else => @panic("ONNX Runtime wrapper supports gnu and musl Linux only"),
    };
    const triple = b.fmt("{s}-linux-{s}", .{ arch, abi });
    const command = b.addSystemCommand(&.{ "./tools/build.sh", triple, @tagName(optimize), "zig-out" });
    command.setCwd(b.path("."));
    command.setName("build self-contained ONNX Runtime C ABI wrapper");
    b.getInstallStep().dependOn(&command.step);

    const build_step = b.step("runtime", "Build one self-contained ONNX Runtime wrapper library");
    build_step.dependOn(&command.step);
}
