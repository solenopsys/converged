const std = @import("std");

/// Supported target configurations for cross-compilation.
pub const supported_targets = [_]std.Target.Query{
    .{ .cpu_arch = .x86_64, .os_tag = .linux, .abi = .gnu, .cpu_model = .{ .explicit = &std.Target.x86.cpu.x86_64 } },
    .{ .cpu_arch = .x86_64, .os_tag = .linux, .abi = .musl, .cpu_model = .{ .explicit = &std.Target.x86.cpu.x86_64 } },
    .{ .cpu_arch = .aarch64, .os_tag = .linux, .abi = .gnu },
    .{ .cpu_arch = .aarch64, .os_tag = .linux, .abi = .musl },
};

pub fn getTargetString(target: std.Build.ResolvedTarget) []const u8 {
    const arch = switch (target.result.cpu.arch) {
        .x86_64 => "x86_64",
        .aarch64 => "aarch64",
        else => "unknown",
    };
    const abi = switch (target.result.abi) {
        .musl, .musleabi, .musleabihf => "musl",
        .gnu, .gnueabi, .gnueabihf => "gnu",
        else => "gnu",
    };
    return std.fmt.allocPrint(std.heap.page_allocator, "{s}-{s}", .{ arch, abi }) catch "unknown";
}

const artifact_script = @embedFile("build_artifact.py");

fn addArtifactCommand(
    b: *std.Build,
    kind: []const u8,
    source: []const u8,
    target: []const u8,
    artifacts: []const u8,
    manifest: []const u8,
) *std.Build.Step.Run {
    const command = b.addSystemCommand(&.{ "python3", "-c", artifact_script });
    command.setCwd(b.path("."));
    command.addArgs(&.{ kind, source, target, artifacts, manifest });
    return command;
}

pub const HashAndMoveStep = struct {
    pub fn create(
        b: *std.Build,
        lib_name: []const u8,
        target_str: []const u8,
        artifacts_dir: []const u8,
        _: *std.StringHashMap([]const u8),
    ) *std.Build.Step.Run {
        return addArtifactCommand(
            b,
            "library",
            std.fmt.allocPrint(b.allocator, "zig-out/lib/lib{s}.so", .{lib_name}) catch @panic("OOM"),
            target_str,
            artifacts_dir,
            "current.json",
        );
    }
};

pub const WriteJsonStep = struct {
    pub fn create(
        b: *std.Build,
        _: *std.StringHashMap([]const u8),
        json_path: []const u8,
    ) *std.Build.Step.Run {
        const command = b.addSystemCommand(&.{ "python3", "-c", "import json,pathlib,sys; p=pathlib.Path(sys.argv[1]); p.write_text(json.dumps(json.loads(p.read_text()), indent=2) + '\\n')" });
        command.setCwd(b.path("."));
        command.addArg(json_path);
        return command;
    }
};

pub fn createHashMap(b: *std.Build) *std.StringHashMap([]const u8) {
    const hashes = b.allocator.create(std.StringHashMap([]const u8)) catch @panic("OOM");
    hashes.* = std.StringHashMap([]const u8).init(b.allocator);
    return hashes;
}

pub fn getLibName(allocator: std.mem.Allocator, base_name: []const u8, target_str: []const u8) []const u8 {
    return std.fmt.allocPrint(allocator, "{s}-{s}", .{ base_name, target_str }) catch base_name;
}

pub fn loadArtifactPath(
    allocator: std.mem.Allocator,
    json_path: []const u8,
    artifacts_dir: []const u8,
    target_str: []const u8,
) ![]const u8 {
    const json_content = try std.Io.Dir.cwd().readFileAlloc(std.Options.debug_io, json_path, allocator, .limited(10 * 1024));
    defer allocator.free(json_content);
    const parsed = try std.json.parseFromSlice(std.json.Value, allocator, json_content, .{});
    defer parsed.deinit();
    const hash = parsed.value.object.get(target_str) orelse return error.TargetNotFound;
    return std.fmt.allocPrint(allocator, "{s}/{s}.so", .{ artifacts_dir, hash.string });
}

pub fn loadArtifactHash(allocator: std.mem.Allocator, json_path: []const u8, target_str: []const u8) ![]const u8 {
    const json_content = try std.Io.Dir.cwd().readFileAlloc(std.Options.debug_io, json_path, allocator, .limited(10 * 1024));
    defer allocator.free(json_content);
    const parsed = try std.json.parseFromSlice(std.json.Value, allocator, json_content, .{});
    defer parsed.deinit();
    const hash = parsed.value.object.get(target_str) orelse return error.TargetNotFound;
    return allocator.dupe(u8, hash.string);
}

pub const HashAndMoveExeStep = struct {
    pub fn create(
        b: *std.Build,
        exe_name: []const u8,
        target_str: []const u8,
        artifacts_dir: []const u8,
        _: *std.StringHashMap([]const u8),
    ) *std.Build.Step.Run {
        return addArtifactCommand(
            b,
            "executable",
            std.fmt.allocPrint(b.allocator, "zig-out/bin/{s}", .{exe_name}) catch @panic("OOM"),
            target_str,
            artifacts_dir,
            "current.json",
        );
    }
};

pub fn getExeName(allocator: std.mem.Allocator, base_name: []const u8, target_str: []const u8) []const u8 {
    return std.fmt.allocPrint(allocator, "{s}-{s}", .{ base_name, target_str }) catch base_name;
}
