const std = @import("std");

/// Supported target configurations for cross-compilation
/// Using .baseline for x86_64 to ensure compatibility with older AMD CPUs (like t3a.medium with AMD EPYC 1st Gen)
pub const supported_targets = [_]std.Target.Query{
    .{ .cpu_arch = .x86_64, .os_tag = .linux, .abi = .gnu, .cpu_model = .{ .explicit = &std.Target.x86.cpu.x86_64 } },
    .{ .cpu_arch = .x86_64, .os_tag = .linux, .abi = .musl, .cpu_model = .{ .explicit = &std.Target.x86.cpu.x86_64 } },
    .{ .cpu_arch = .aarch64, .os_tag = .linux, .abi = .gnu },
    .{ .cpu_arch = .aarch64, .os_tag = .linux, .abi = .musl },
};

/// Get a string representation of the target (e.g., "x86_64-gnu")
pub fn getTargetString(target: std.Build.ResolvedTarget) []const u8 {
    const cpu_arch = target.result.cpu.arch;
    const abi = target.result.abi;

    const arch_str = switch (cpu_arch) {
        .x86_64 => "x86_64",
        .aarch64 => "aarch64",
        else => "unknown",
    };

    const libc_str = switch (abi) {
        .musl, .musleabi, .musleabihf => "musl",
        .gnu, .gnueabi, .gnueabihf => "gnu",
        else => "gnu",
    };

    return std.fmt.allocPrint(
        std.heap.page_allocator,
        "{s}-{s}",
        .{ arch_str, libc_str },
    ) catch "unknown";
}

/// Step that hashes the built library and moves it to artifacts directory
pub const HashAndMoveStep = struct {
    step: std.Build.Step,
    lib_name: []const u8,
    target_str: []const u8,
    artifacts_dir: []const u8,
    hashes: *std.StringHashMap([]const u8),

    pub fn create(
        b: *std.Build,
        lib_name: []const u8,
        target_str: []const u8,
        artifacts_dir: []const u8,
        hashes: *std.StringHashMap([]const u8),
    ) *HashAndMoveStep {
        const self = b.allocator.create(HashAndMoveStep) catch @panic("OOM");
        self.* = .{
            .step = std.Build.Step.init(.{
                .id = .custom,
                .name = "hash_and_move",
                .owner = b,
                .makeFn = make,
            }),
            .lib_name = lib_name,
            .target_str = target_str,
            .artifacts_dir = artifacts_dir,
            .hashes = hashes,
        };
        return self;
    }

    fn make(step: *std.Build.Step, _: std.Build.Step.MakeOptions) !void {
        const self: *HashAndMoveStep = @fieldParentPtr("step", step);

        const path = try std.fmt.allocPrint(step.owner.allocator, "zig-out/lib/lib{s}.so", .{self.lib_name});
        const content = try std.fs.cwd().readFileAlloc(step.owner.allocator, path, 100 * 1024 * 1024);
        defer step.owner.allocator.free(content);

        var hasher = std.crypto.hash.sha2.Sha256.init(.{});
        hasher.update(content);
        const digest = hasher.finalResult();

        var hash_str: [64]u8 = undefined;
        const hex_chars = "0123456789abcdef";
        for (digest, 0..) |byte, j| {
            hash_str[j * 2] = hex_chars[byte >> 4];
            hash_str[j * 2 + 1] = hex_chars[byte & 0xf];
        }

        const dest_path = try std.fmt.allocPrint(step.owner.allocator, "{s}/{s}.so", .{ self.artifacts_dir, hash_str });

        try std.fs.cwd().makePath(self.artifacts_dir);
        try std.fs.cwd().copyFile(path, std.fs.cwd(), dest_path, .{});

        const hash_copy = try step.owner.allocator.dupe(u8, &hash_str);
        try self.hashes.put(self.target_str, hash_copy);
    }
};

/// Step that writes the current.json file with all hashes
pub const WriteJsonStep = struct {
    step: std.Build.Step,
    hashes: *std.StringHashMap([]const u8),
    json_path: []const u8,

    pub fn create(
        b: *std.Build,
        hashes: *std.StringHashMap([]const u8),
        json_path: []const u8,
    ) *WriteJsonStep {
        const self = b.allocator.create(WriteJsonStep) catch @panic("OOM");
        self.* = .{
            .step = std.Build.Step.init(.{
                .id = .custom,
                .name = "write_json",
                .owner = b,
                .makeFn = make,
            }),
            .hashes = hashes,
            .json_path = json_path,
        };
        return self;
    }

    fn make(step: *std.Build.Step, _: std.Build.Step.MakeOptions) !void {
        const self: *WriteJsonStep = @fieldParentPtr("step", step);

        var obj = std.json.ObjectMap.init(step.owner.allocator);
        var it = self.hashes.iterator();
        while (it.next()) |entry| {
            try obj.put(entry.key_ptr.*, .{ .string = entry.value_ptr.* });
        }

        const file = try std.fs.cwd().createFile(self.json_path, .{});
        defer file.close();

        try file.writeAll("{\n");
        var first = true;
        var it2 = obj.iterator();
        while (it2.next()) |entry| {
            if (!first) try file.writeAll(",\n");
            first = false;
            const line = try std.fmt.allocPrint(step.owner.allocator, "  \"{s}\": \"{s}\"", .{ entry.key_ptr.*, entry.value_ptr.*.string });
            try file.writeAll(line);
        }
        try file.writeAll("\n}\n");
    }
};

/// Create a hash map for storing target->hash mappings
pub fn createHashMap(b: *std.Build) *std.StringHashMap([]const u8) {
    const hashes = b.allocator.create(std.StringHashMap([]const u8)) catch @panic("OOM");
    hashes.* = std.StringHashMap([]const u8).init(b.allocator);
    return hashes;
}

/// Helper to build a library name with target suffix
pub fn getLibName(allocator: std.mem.Allocator, base_name: []const u8, target_str: []const u8) []const u8 {
    return std.fmt.allocPrint(
        allocator,
        "{s}-{s}",
        .{ base_name, target_str },
    ) catch base_name;
}
