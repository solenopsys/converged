const std = @import("std");
const Allocator = std.mem.Allocator;
const lmdbx = @import("lmdbx");
const Telemetry = @import("../telemetry.zig").Telemetry;

pub const KvEngine = struct {
    db: ?lmdbx.Database,
    path: [:0]const u8,
    allocator: Allocator,

    pub fn init(allocator: Allocator, path: [:0]const u8) KvEngine {
        return .{
            .db = null,
            .path = path,
            .allocator = allocator,
        };
    }

    pub fn open(self: *KvEngine) !void {
        self.db = try lmdbx.Database.open(self.path);
    }

    pub fn close(self: *KvEngine) void {
        if (self.db) |*db| {
            db.close();
            self.db = null;
        }
    }

    pub fn put(self: *KvEngine, key: []const u8, value: []const u8, tel: *Telemetry) !void {
        var db = self.db orelse return error.NotOpen;
        try db.put(key, value);
        tel.addWrite(value.len);
    }

    pub fn get(self: *KvEngine, key: []const u8, tel: *Telemetry) !?[]u8 {
        var db = self.db orelse return error.NotOpen;
        const result = try db.get(self.allocator, key);
        if (result) |data| {
            tel.addRead(data.len);
        }
        return result;
    }

    pub fn delete(self: *KvEngine, key: []const u8, tel: *Telemetry) !void {
        var db = self.db orelse return error.NotOpen;
        try db.delete(key);
        tel.op_count += 1;
    }

    pub fn hasKey(self: *KvEngine, key: []const u8) !bool {
        var db = self.db orelse return error.NotOpen;
        return try db.hasKey(key);
    }

    /// List keys with prefix, return as JSON array
    pub fn listKeysJson(self: *KvEngine, prefix: []const u8, tel: *Telemetry) ![]u8 {
        var db = self.db orelse return error.NotOpen;
        var cursor = try db.openCursor();
        defer lmdbx.Database.closeCursor(cursor);

        var result: std.ArrayList(u8) = .{};
        errdefer result.deinit(self.allocator);
        const writer = result.writer(self.allocator);
        try writer.writeByte('[');

        var idx: usize = 0;
        var entry = try cursor.seekPrefix(self.allocator, prefix);
        while (entry) |e| {
            // Check prefix match
            if (e.key.len < prefix.len or !std.mem.eql(u8, e.key[0..prefix.len], prefix)) break;

            if (idx > 0) try writer.writeByte(',');
            try writer.writeByte('"');
            try writer.writeAll(e.key);
            try writer.writeByte('"');
            idx += 1;

            self.allocator.free(e.key);
            self.allocator.free(e.value);

            entry = try cursor.next(self.allocator);
        }

        try writer.writeByte(']');
        tel.addRead(result.items.len);
        return result.toOwnedSlice(self.allocator);
    }

    pub fn flush(self: *KvEngine) !void {
        var db = self.db orelse return error.NotOpen;
        try db.flush();
    }

    pub fn getSize(self: *KvEngine) !u64 {
        const file = try std.fs.cwd().openFile(self.path, .{});
        defer file.close();
        const stat = try file.stat();
        return stat.size;
    }
};
