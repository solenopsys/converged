const std = @import("std");
const Allocator = std.mem.Allocator;

pub const StoreType = enum {
    sql,
    kv,
    column,
    vector,
    files,
    graph,

    pub fn toString(self: StoreType) []const u8 {
        return switch (self) {
            .sql => "SQL",
            .kv => "KEY_VALUE",
            .column => "COLUMN",
            .vector => "VECTOR",
            .files => "FILES",
            .graph => "GRAPH",
        };
    }

    pub fn fromString(s: []const u8) ?StoreType {
        if (std.mem.eql(u8, s, "SQL")) return .sql;
        if (std.mem.eql(u8, s, "KEY_VALUE")) return .kv;
        if (std.mem.eql(u8, s, "COLUMN")) return .column;
        if (std.mem.eql(u8, s, "VECTOR")) return .vector;
        if (std.mem.eql(u8, s, "FILES")) return .files;
        if (std.mem.eql(u8, s, "GRAPH")) return .graph;
        return null;
    }
};

pub const Manifest = struct {
    name: []const u8,
    version: []const u8,
    store_type: StoreType,
    migrations: std.ArrayList([]const u8),
    allocator: Allocator,

    pub fn init(allocator: Allocator, name: []const u8, store_type: StoreType) !Manifest {
        return .{
            .name = try allocator.dupe(u8, name),
            .version = try allocator.dupe(u8, "1"),
            .store_type = store_type,
            .migrations = .{},
            .allocator = allocator,
        };
    }

    pub fn deinit(self: *Manifest) void {
        for (self.migrations.items) |m| self.allocator.free(m);
        self.migrations.deinit(self.allocator);
        self.allocator.free(self.name);
        self.allocator.free(self.version);
    }

    pub fn addMigration(self: *Manifest, id: []const u8) !void {
        try self.migrations.append(self.allocator, try self.allocator.dupe(u8, id));
    }

    pub fn hasMigration(self: *const Manifest, id: []const u8) bool {
        for (self.migrations.items) |m| {
            if (std.mem.eql(u8, m, id)) return true;
        }
        return false;
    }

    /// Load manifest from JSON file
    pub fn load(allocator: Allocator, path: []const u8) !Manifest {
        const file = try std.fs.cwd().openFile(path, .{});
        defer file.close();

        const content = try file.readToEndAlloc(allocator, 1024 * 1024);
        defer allocator.free(content);

        const parsed = try std.json.parseFromSlice(std.json.Value, allocator, content, .{});
        defer parsed.deinit();

        const obj = parsed.value.object;

        const name = if (obj.get("name")) |v| try allocator.dupe(u8, v.string) else try allocator.dupe(u8, "");
        const version = if (obj.get("version")) |v| try allocator.dupe(u8, v.string) else try allocator.dupe(u8, "1");
        const type_str = if (obj.get("type")) |v| v.string else "SQL";
        const store_type = StoreType.fromString(type_str) orelse .sql;

        var migrations: std.ArrayList([]const u8) = .{};
        if (obj.get("migrations")) |migs| {
            if (migs == .array) {
                for (migs.array.items) |item| {
                    if (item == .string) {
                        try migrations.append(allocator, try allocator.dupe(u8, item.string));
                    }
                }
            }
        }

        return .{
            .name = name,
            .version = version,
            .store_type = store_type,
            .migrations = migrations,
            .allocator = allocator,
        };
    }

    /// Save manifest as JSON file
    pub fn save(self: *const Manifest, path: []const u8) !void {
        var buf: std.ArrayList(u8) = .{};
        defer buf.deinit(self.allocator);

        try buf.appendSlice(self.allocator, "{\n");
        const header = try std.fmt.allocPrint(self.allocator, "  \"name\": \"{s}\",\n  \"version\": \"{s}\",\n  \"type\": \"{s}\",\n  \"migrations\": [", .{ self.name, self.version, self.store_type.toString() });
        defer self.allocator.free(header);
        try buf.appendSlice(self.allocator, header);
        for (self.migrations.items, 0..) |m, i| {
            if (i > 0) try buf.appendSlice(self.allocator, ", ");
            const entry = try std.fmt.allocPrint(self.allocator, "\"{s}\"", .{m});
            defer self.allocator.free(entry);
            try buf.appendSlice(self.allocator, entry);
        }
        try buf.appendSlice(self.allocator, "]\n}\n");

        const file = try std.fs.cwd().createFile(path, .{});
        defer file.close();
        try file.writeAll(buf.items);
    }
};

/// Check if manifest file exists, create if needed
pub fn ensureManifest(allocator: Allocator, dir_path: []const u8, name: []const u8, store_type: StoreType) !Manifest {
    const manifest_path = try std.fmt.allocPrint(allocator, "{s}/manifest.json", .{dir_path});
    defer allocator.free(manifest_path);

    // Try loading existing
    if (Manifest.load(allocator, manifest_path)) |manifest| {
        return manifest;
    } else |_| {
        // Create new
        std.fs.cwd().makePath(dir_path) catch {};
        var manifest = try Manifest.init(allocator, name, store_type);
        try manifest.save(manifest_path);
        return manifest;
    }
}
