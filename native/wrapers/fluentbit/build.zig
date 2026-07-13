const std = @import("std");

pub fn build(b: *std.Build) void {
    const optimize = b.standardOptimizeOption(.{});
    const zig = b.graph.zig_exe;
    const build_dir = b.fmt(".zig-cache/cmake/{s}", .{@tagName(optimize)});
    const cmake = b.addSystemCommand(&.{ "cmake", "-S", ".", "-B", build_dir, "-G", "Ninja" });
    cmake.addArg(b.fmt("-DCMAKE_BUILD_TYPE={s}", .{if (optimize == .Debug) "Debug" else "Release"}));
    cmake.addArg(b.fmt("-DCMAKE_C_COMPILER={s}", .{zig}));
    cmake.addArg("-DCMAKE_C_COMPILER_ARG1=cc");
    cmake.addArg(b.fmt("-DCMAKE_CXX_COMPILER={s}", .{zig}));
    cmake.addArg("-DCMAKE_CXX_COMPILER_ARG1=c++");

    const compile = b.addSystemCommand(&.{ "cmake", "--build", build_dir, "--target", "fluentbit_wrapper", "--parallel" });
    compile.step.dependOn(&cmake.step);

    const install_lib = b.addInstallFileWithDir(
        b.path(b.fmt("{s}/libfluentbit.so", .{build_dir})),
        .lib,
        "libfluentbit.so",
    );
    install_lib.step.dependOn(&compile.step);
    b.getInstallStep().dependOn(&install_lib.step);
}
