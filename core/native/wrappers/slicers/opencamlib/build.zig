const std = @import("std");

fn targetTriple(b: *std.Build, target: std.Build.ResolvedTarget) []const u8 {
    const arch = switch (target.result.cpu.arch) {
        .x86_64 => "x86_64",
        .aarch64 => "aarch64",
        else => @panic("unsupported OpenCAMLib architecture"),
    };
    const libc = switch (target.result.abi) {
        .gnu, .gnueabi, .gnueabihf => "gnu",
        .musl, .musleabi, .musleabihf => "musl",
        else => @panic("unsupported OpenCAMLib libc"),
    };
    return b.fmt("{s}-linux-{s}", .{ arch, libc });
}

fn targetProcessor(target: std.Build.ResolvedTarget) []const u8 {
    return switch (target.result.cpu.arch) {
        .x86_64 => "x86_64",
        .aarch64 => "aarch64",
        else => @panic("unsupported OpenCAMLib architecture"),
    };
}

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.option(std.builtin.OptimizeMode, "optimize", "Prioritize performance, safety, or binary size") orelse .ReleaseFast;
    const triple = targetTriple(b, target);
    const build_dir = b.fmt(".zig-cache/cmake-current/{s}/{s}", .{ triple, @tagName(optimize) });

    const configure = b.addSystemCommand(&.{
        "cmake",
        "-S",
        ".",
        "-B",
        build_dir,
        "-G",
        "Ninja",
        b.fmt("-DCMAKE_BUILD_TYPE={s}", .{switch (optimize) {
            .Debug => "Debug",
            else => "Release",
        }}),
        "-DCMAKE_SYSTEM_NAME=Linux",
        b.fmt("-DCMAKE_SYSTEM_PROCESSOR={s}", .{targetProcessor(target)}),
        "-DCMAKE_TRY_COMPILE_TARGET_TYPE=STATIC_LIBRARY",
        b.fmt("-DCMAKE_C_COMPILER={s};cc", .{b.graph.zig_exe}),
        b.fmt("-DCMAKE_CXX_COMPILER={s};c++", .{b.graph.zig_exe}),
        b.fmt("-DCMAKE_C_COMPILER_TARGET={s}", .{triple}),
        b.fmt("-DCMAKE_CXX_COMPILER_TARGET={s}", .{triple}),
    });
    const compile = b.addSystemCommand(&.{ "cmake", "--build", build_dir, "--target", "opencamlib_wrapper", "--parallel" });
    compile.step.dependOn(&configure.step);
    const install = b.addInstallFileWithDir(.{ .cwd_relative = b.fmt("{s}/libopencamlib.so", .{build_dir}) }, .lib, "libopencamlib.so");
    install.step.dependOn(&compile.step);
    b.getInstallStep().dependOn(&install.step);
}
