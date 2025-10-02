const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // Получаем зависимость lz4
    const lz4_dep = b.dependency("lz4", .{
        .target = target,
        .optimize = optimize,
    });

    // Создаем исполняемый файл
    const exe = b.addExecutable(.{
        .name = "lz4_example",
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });

    // Линкуем C-библиотеку lz4
    exe.linkLibrary(lz4_dep.artifact("lz4"));

    b.installArtifact(exe);

    // Команда для запуска
    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());

    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    const run_step = b.step("run", "Run the app");
    run_step.dependOn(&run_cmd.step);
}
