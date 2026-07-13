const std = @import("std");

pub fn build(b: *std.Build) void {
    const optimize = b.standardOptimizeOption(.{});
    const build_dir = b.fmt(".zig-cache/cmake/{s}", .{@tagName(optimize)});

    const configure = b.addSystemCommand(&.{
        "cmake", "-S", ".", "-B", build_dir, "-G", "Ninja",
        b.fmt("-DCMAKE_BUILD_TYPE={s}", .{switch (optimize) { .Debug => "Debug", else => "Release" }}),
        b.fmt("-DCMAKE_C_COMPILER={s}", .{b.graph.zig_exe}),
        "-DCMAKE_C_COMPILER_ARG1=cc",
        b.fmt("-DCMAKE_CXX_COMPILER={s}", .{b.graph.zig_exe}),
        "-DCMAKE_CXX_COMPILER_ARG1=c++",
    });
    const compile = b.addSystemCommand(&.{ "cmake", "--build", build_dir, "--target", "opencamlib_wrapper", "--parallel" });
    compile.step.dependOn(&configure.step);
    const install = b.addInstallFileWithDir(.{ .cwd_relative = b.fmt("{s}/libopencamlib.so", .{build_dir}) }, .lib, "libopencamlib.so");
    install.step.dependOn(&compile.step);
    b.getInstallStep().dependOn(&install.step);
}
