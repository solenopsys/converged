const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const host = b.graph.host.result;
    // Keep native Linux builds on Zig's host glibc range. The system GCC 16
    // crt1.o in this environment contains .sframe relocations unsupported by
    // the default native linker path; explicit cross-targets remain untouched.
    const runtime_target = if (target.query.isNative() and host.os.tag == .linux) b.resolveTargetQuery(.{
        .cpu_arch = host.cpu.arch,
        .os_tag = .linux,
        .abi = .gnu,
        .glibc_version = host.os.version_range.linux.glibc,
    }) else target;
    const optimize = b.standardOptimizeOption(.{});
    const fujin_client = b.addModule("fujin-client", .{
        .root_source_file = b.path("../fujin_client.zig"),
        .target = runtime_target,
        .optimize = optimize,
    });

    const exe = b.addExecutable(.{
        .name = "resonus",
        .use_lld = false,
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = runtime_target,
            .optimize = optimize,
        }),
    });
    exe.root_module.addImport("fujin-client", fujin_client);

    exe.root_module.link_libc = true;
    b.installArtifact(exe);

    const run_cmd = b.addRunArtifact(exe);
    if (b.args) |args| run_cmd.addArgs(args);

    const run_step = b.step("run", "Run resonus");
    run_step.dependOn(&run_cmd.step);

    const unit_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = runtime_target,
            .optimize = optimize,
        }),
    });
    unit_tests.root_module.addImport("fujin-client", fujin_client);

    unit_tests.root_module.link_libc = true;

    const run_unit_tests = b.addRunArtifact(unit_tests);
    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_unit_tests.step);

    const store_test_step = b.step("test-store", "Store tests require a live Valkey + service API environment");
    store_test_step.dependOn(&run_unit_tests.step);
}
