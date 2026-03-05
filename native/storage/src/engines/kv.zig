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

    pub const Pair = struct {
        key: []const u8,
        value: []const u8,
    };

    /// Prefix scan — one LMDB pass returning key+value pairs.
    /// Caller owns the returned slice and each pair's key/value and must free them.
    pub fn getRange(self: *KvEngine, prefix: []const u8, tel: *Telemetry) ![]Pair {
        var db = self.db orelse return error.NotOpen;
        var cursor = try db.openCursor();
        defer lmdbx.Database.closeCursor(cursor);

        var pairs: std.ArrayList(Pair) = .{};
        errdefer {
            for (pairs.items) |p| {
                self.allocator.free(p.key);
                self.allocator.free(p.value);
            }
            pairs.deinit(self.allocator);
        }

        var entry = try cursor.seekPrefix(self.allocator, prefix);
        while (entry) |e| {
            if (e.key.len < prefix.len or !std.mem.eql(u8, e.key[0..prefix.len], prefix)) {
                self.allocator.free(e.key);
                self.allocator.free(e.value);
                break;
            }
            tel.addRead(e.value.len);
            try pairs.append(self.allocator, .{ .key = e.key, .value = e.value });
            entry = try cursor.next(self.allocator);
        }

        return pairs.toOwnedSlice(self.allocator);
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
