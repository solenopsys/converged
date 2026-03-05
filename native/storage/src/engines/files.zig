const std = @import("std");
const Allocator = std.mem.Allocator;
const Telemetry = @import("../telemetry.zig").Telemetry;

pub const FilesEngine = struct {
    base_path: []const u8,
    allocator: Allocator,

    pub fn init(allocator: Allocator, base_path: []const u8) FilesEngine {
        return .{
            .base_path = base_path,
            .allocator = allocator,
        };
    }

    pub fn open(self: *FilesEngine) !void {
        try std.fs.cwd().makePath(self.base_path);
    }

    pub fn close(self: *FilesEngine) void {
        _ = self;
    }

    pub fn put(self: *FilesEngine, key: []const u8, data: []const u8, tel: *Telemetry) !void {
        const full_path = try std.fmt.allocPrint(self.allocator, "{s}/{s}", .{ self.base_path, key });
        defer self.allocator.free(full_path);

        // Ensure parent dir exists
        if (std.mem.lastIndexOfScalar(u8, full_path, '/')) |idx| {
            try std.fs.cwd().makePath(full_path[0..idx]);
        }

        const file = try std.fs.cwd().createFile(full_path, .{});
        defer file.close();
        try file.writeAll(data);

        tel.addWrite(data.len);
    }

    pub fn get(self: *FilesEngine, key: []const u8, tel: *Telemetry) !?[]u8 {
        const full_path = try std.fmt.allocPrint(self.allocator, "{s}/{s}", .{ self.base_path, key });
        defer self.allocator.free(full_path);

        const file = std.fs.cwd().openFile(full_path, .{}) catch |err| blk: {
            if (err != error.FileNotFound) return err;

            // Backward compatibility: some stores may still keep files directly
            // under "<store>/" instead of "<store>/data/".
            const parent = std.fs.path.dirname(self.base_path) orelse return null;
            const legacy_path = try std.fmt.allocPrint(self.allocator, "{s}/{s}", .{ parent, key });
            defer self.allocator.free(legacy_path);

            const legacy_file = std.fs.cwd().openFile(legacy_path, .{}) catch |legacy_err| {
                if (legacy_err == error.FileNotFound) return null;
                return legacy_err;
            };
            break :blk legacy_file;
        };
        defer file.close();

        const data = try file.readToEndAlloc(self.allocator, 256 * 1024 * 1024);
        tel.addRead(data.len);
        return data;
    }

    pub fn delete(self: *FilesEngine, key: []const u8, tel: *Telemetry) !bool {
        const full_path = try std.fmt.allocPrint(self.allocator, "{s}/{s}", .{ self.base_path, key });
        defer self.allocator.free(full_path);

        std.fs.cwd().deleteFile(full_path) catch |err| {
            if (err == error.FileNotFound) return false;
            return err;
        };
        tel.op_count += 1;
        return true;
    }

    pub fn exists(self: *FilesEngine, key: []const u8) !bool {
        const full_path = try std.fmt.allocPrint(self.allocator, "{s}/{s}", .{ self.base_path, key });
        defer self.allocator.free(full_path);

        std.fs.cwd().access(full_path, .{}) catch return false;
        return true;
    }

    /// Get total size of all files
    pub fn getSize(self: *FilesEngine) !u64 {
        var total: u64 = 0;
        var dir = std.fs.cwd().openDir(self.base_path, .{ .iterate = true }) catch return 0;
        defer dir.close();

        var walker = try dir.walk(self.allocator);
        defer walker.deinit();

        while (try walker.next()) |entry| {
            if (entry.kind == .file) {
                const stat = try dir.statFile(entry.path);
                total += stat.size;
            }
        }
        return total;
    }

    /// List all keys as JSON array
    pub fn listKeysJson(self: *FilesEngine, tel: *Telemetry) ![]u8 {
        var result: std.ArrayList(u8) = .{};
        errdefer result.deinit(self.allocator);
        const writer = result.writer(self.allocator);
        try writer.writeByte('[');

        var dir = std.fs.cwd().openDir(self.base_path, .{ .iterate = true }) catch {
            try writer.writeByte(']');
            return result.toOwnedSlice(self.allocator);
        };
        defer dir.close();

        var walker = try dir.walk(self.allocator);
        defer walker.deinit();

        var idx: usize = 0;
        while (try walker.next()) |entry| {
            if (entry.kind == .file) {
                if (idx > 0) try writer.writeByte(',');
                try writer.writeByte('"');
                try writer.writeAll(entry.path);
                try writer.writeByte('"');
                idx += 1;
            }
        }

        try writer.writeByte(']');
        tel.addRead(result.items.len);
        return result.toOwnedSlice(self.allocator);
    }
};
