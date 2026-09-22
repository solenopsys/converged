const std = @import("std");

const wrapper_out_dir = "../../wrappers/ai/onnxruntime/zig-out";
const opus_out_dir = "../../wrappers/protocols/opus/zig-out";

fn targetTriple(b: *std.Build, target: std.Build.ResolvedTarget) []const u8 {
    const arch = switch (target.result.cpu.arch) {
        .x86_64 => "x86_64",
        .aarch64 => "aarch64",
        else => @panic("SPEACH supports x86_64 and aarch64 Linux only"),
    };
    const abi = switch (target.result.abi) {
        .gnu, .gnueabi, .gnueabihf => "gnu",
        .musl, .musleabi, .musleabihf => "musl",
        else => @panic("SPEACH supports gnu and musl Linux only"),
    };
    return b.fmt("{s}-linux-{s}", .{ arch, abi });
}

// Vendored libopus, same per-target idea as the ONNX wrapper above:
// wrappers/protocols/opus/zig-out/lib/libopus-<arch>-<libc>.so
// (`zig build -Dall=true` over there also drops plain libopus.so for the
// native triple; the container build uses the explicit triple name).
fn opusLibPath(b: *std.Build, target: std.Build.ResolvedTarget) []const u8 {
    // Per-triple file in the opus wrapper (`-Dall=true` layout), installed
    // here as plain libopus.so so DT_NEEDED stays triple-independent.
    const arch = switch (target.result.cpu.arch) {
        .x86_64 => "x86_64",
        .aarch64 => "aarch64",
        else => @panic("SPEACH supports x86_64 and aarch64 Linux only"),
    };
    const abi = switch (target.result.abi) {
        .gnu, .gnueabi, .gnueabihf => "gnu",
        .musl, .musleabi, .musleabihf => "musl",
        else => @panic("SPEACH supports gnu and musl Linux only"),
    };
    return b.fmt("{s}/lib/libopus-{s}-{s}.so", .{ opus_out_dir, arch, abi });
}

fn linkOpus(b: *std.Build, exe: *std.Build.Step.Compile, target: std.Build.ResolvedTarget) void {
    _ = target;
    // Link against the plain-soname build of the current triple; build.zig
    // installs it as libopus.so so DT_NEEDED is triple-independent and the
    // container only carries one file. (The triple-suffixed copies in the
    // wrapper's zig-out are for the -Dall=true artifacts flow.)
    exe.root_module.addLibraryPath(.{ .cwd_relative = b.fmt("{s}/lib", .{opus_out_dir}) });
    exe.root_module.linkSystemLibrary("opus", .{});
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
        .name = "speach",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    const triple = targetTriple(b, target);
    const lib_dir = b.fmt("{s}/{s}/lib", .{ wrapper_out_dir, triple });
    exe.root_module.addLibraryPath(.{ .cwd_relative = lib_dir });
    exe.root_module.addRPathSpecial("$ORIGIN/lib");
    exe.root_module.linkSystemLibrary("onnxruntime", .{});
    linkOpus(b, exe, target);
    exe.root_module.link_libc = true;
    const install_lib = b.addInstallFileWithDir(
        .{ .cwd_relative = b.fmt("{s}/libonnxruntime.so", .{lib_dir}) },
        .lib,
        "libonnxruntime.so",
    );
    b.getInstallStep().dependOn(&install_lib.step);
    const install_opus = b.addInstallFileWithDir(
        .{ .cwd_relative = opusLibPath(b, target) },
        .lib,
        "libopus.so",
    );
    b.getInstallStep().dependOn(&install_opus.step);
    b.installArtifact(exe);
    const run = b.addRunArtifact(exe);
    run.step.dependOn(b.getInstallStep());
    if (b.args) |args| run.addArgs(args);
    b.step("run", "Run SPEACH").dependOn(&run.step);
}
