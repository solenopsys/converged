const std = @import("std");

fn targetTriple(b: *std.Build, target: std.Build.ResolvedTarget) []const u8 {
    const arch = switch (target.result.cpu.arch) {
        .x86_64 => "x86_64",
        .aarch64 => "aarch64",
        else => @panic("unsupported CuraEngine architecture"),
    };
    const libc = switch (target.result.abi) {
        .gnu, .gnueabi, .gnueabihf => "gnu",
        .musl, .musleabi, .musleabihf => "musl",
        else => @panic("unsupported CuraEngine libc"),
    };
    return b.fmt("{s}-linux-{s}", .{ arch, libc });
}

fn targetProcessor(target: std.Build.ResolvedTarget) []const u8 {
    return switch (target.result.cpu.arch) {
        .x86_64 => "x86_64",
        .aarch64 => "aarch64",
        else => @panic("unsupported CuraEngine architecture"),
    };
}

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.option(std.builtin.OptimizeMode, "optimize", "Prioritize performance, safety, or binary size") orelse .ReleaseFast;
    const zig = b.graph.zig_exe;
    const triple = targetTriple(b, target);
    const build_dir = b.fmt(".zig-cache/cmake-current/{s}/{s}", .{ triple, @tagName(optimize) });
    const cmake = b.addSystemCommand(&.{ "cmake", "-S", ".", "-B", build_dir, "-G", "Ninja" });
    cmake.addArg(b.fmt("-DCMAKE_BUILD_TYPE={s}", .{if (optimize == .Debug) "Debug" else "Release"}));
    cmake.addArg("-DCMAKE_SYSTEM_NAME=Linux");
    cmake.addArg(b.fmt("-DCMAKE_SYSTEM_PROCESSOR={s}", .{targetProcessor(target)}));
    cmake.addArg("-DCMAKE_TRY_COMPILE_TARGET_TYPE=STATIC_LIBRARY");
    cmake.addArg(b.fmt("-DCMAKE_C_COMPILER={s};cc", .{zig}));
    cmake.addArg(b.fmt("-DCMAKE_CXX_COMPILER={s};c++", .{zig}));
    cmake.addArg(b.fmt("-DCMAKE_C_COMPILER_TARGET={s}", .{triple}));
    cmake.addArg(b.fmt("-DCMAKE_CXX_COMPILER_TARGET={s}", .{triple}));

    const compile = b.addSystemCommand(&.{ "cmake", "--build", build_dir, "--target", "CuraEngine", "curaengine_wrapper", "--parallel" });
    compile.step.dependOn(&cmake.step);

    const install_lib = b.addInstallFileWithDir(b.path(b.fmt("{s}/libcuraengine.so", .{build_dir})), .lib, "libcuraengine.so");
    install_lib.step.dependOn(&compile.step);
    const install_bin = b.addInstallFileWithDir(b.path(b.fmt("{s}/vendor/curaengine/CuraEngine", .{build_dir})), .bin, "CuraEngine");
    install_bin.step.dependOn(&compile.step);
    b.getInstallStep().dependOn(&install_lib.step);
    b.getInstallStep().dependOn(&install_bin.step);
}
