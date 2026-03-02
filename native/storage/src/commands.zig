const std = @import("std");
const Allocator = std.mem.Allocator;
const manifest_mod = @import("manifest.zig");
const Manifest = manifest_mod.Manifest;
const StoreType = manifest_mod.StoreType;
const Telemetry = @import("telemetry.zig").Telemetry;

const SqlEngine = @import("engines/sql.zig").SqlEngine;
const KvEngine = @import("engines/kv.zig").KvEngine;
const ColumnEngine = @import("engines/column.zig").ColumnEngine;
const VectorEngine = @import("engines/vector.zig").VectorEngine;
const FilesEngine = @import("engines/files.zig").FilesEngine;

pub const StoreHandle = union(StoreType) {
    sql: SqlEngine,
    kv: KvEngine,
    column: ColumnEngine,
    vector: VectorEngine,
    files: FilesEngine,
};

pub const StoreInstance = struct {
    handle: StoreHandle,
    manifest: Manifest,
    manifest_path: []const u8,
    data_path_z: ?[:0]u8,
};

pub const StorageCommands = struct {
    stores: std.StringHashMap(StoreInstance),
    data_dir: []const u8,
    allocator: Allocator,

    pub fn init(allocator: Allocator, data_dir: []const u8) StorageCommands {
        return .{
            .stores = std.StringHashMap(StoreInstance).init(allocator),
            .data_dir = data_dir,
            .allocator = allocator,
        };
    }

    pub fn deinit(self: *StorageCommands) void {
        var it = self.stores.iterator();
        while (it.next()) |entry| {
            std.debug.print("storage closing {s}\n", .{entry.key_ptr.*});
            switch (entry.value_ptr.handle) {
                .sql => |*e| e.close(),
                .kv => |*e| e.close(),
                .column => |*e| e.close(),
                .vector => |*e| e.close(),
                .files => |*e| e.close(),
            }
            if (entry.value_ptr.data_path_z) |path_z| self.allocator.free(path_z);
            entry.value_ptr.manifest.deinit();
            self.allocator.free(entry.value_ptr.manifest_path);
            self.allocator.free(entry.key_ptr.*);
        }
        self.stores.deinit();
    }

    // ── Store lifecycle ──

    pub fn openStore(self: *StorageCommands, ms_name: []const u8, store_name: []const u8, store_type: StoreType) !void {
        const store_dir = try std.fmt.allocPrint(self.allocator, "{s}/{s}/{s}", .{ self.data_dir, ms_name, store_name });
        defer self.allocator.free(store_dir);
        const store_key = try std.fmt.allocPrint(self.allocator, "{s}/{s}", .{ ms_name, store_name });
        errdefer self.allocator.free(store_key);

        if (self.stores.contains(store_key)) return error.StoreAlreadyOpen;

        try std.fs.cwd().makePath(store_dir);

        const mfst = try manifest_mod.ensureManifest(self.allocator, store_dir, store_name, store_type);
        errdefer {
            var manifest = mfst;
            manifest.deinit();
        }

        var data_path_z: ?[:0]u8 = null;
        var handle: StoreHandle = undefined;

        switch (store_type) {
            .sql => {
                const path_z = try self.allocator.dupeZ(u8, mfst.data_location);
                data_path_z = path_z;
                handle = .{ .sql = SqlEngine.init(self.allocator, path_z) };
            },
            .kv => {
                const path_z = try self.allocator.dupeZ(u8, mfst.data_location);
                data_path_z = path_z;
                handle = .{ .kv = KvEngine.init(self.allocator, path_z) };
            },
            .column => {
                const path_z = try self.allocator.dupeZ(u8, mfst.data_location);
                data_path_z = path_z;
                handle = .{ .column = ColumnEngine.init(self.allocator, path_z) };
            },
            .vector => {
                const path_z = try self.allocator.dupeZ(u8, mfst.data_location);
                data_path_z = path_z;
                handle = .{ .vector = VectorEngine.init(self.allocator, path_z) };
            },
            .files => {
                handle = .{ .files = FilesEngine.init(self.allocator, mfst.data_location) };
            },
        }

        errdefer if (data_path_z) |path_z| self.allocator.free(path_z);

        switch (handle) {
            .sql => |*e| try e.open(),
            .kv => |*e| try e.open(),
            .column => |*e| try e.open(),
            .vector => |*e| try e.open(),
            .files => |*e| try e.open(),
        }

        const manifest_path = try std.fmt.allocPrint(self.allocator, "{s}/manifest.json", .{store_dir});
        errdefer self.allocator.free(manifest_path);

        try self.stores.put(store_key, .{
            .handle = handle,
            .manifest = mfst,
            .manifest_path = manifest_path,
            .data_path_z = data_path_z,
        });

        std.debug.print(
            "storage opened {s} type={s} path={s}\n",
            .{ store_key, store_type.toString(), mfst.data_location },
        );
    }

    pub fn closeStore(self: *StorageCommands, store_key: []const u8) void {
        if (self.stores.fetchRemove(store_key)) |kv| {
            std.debug.print("storage closed {s}\n", .{kv.key});
            self.allocator.free(kv.key);
            var inst = kv.value;
            switch (inst.handle) {
                .sql => |*e| e.close(),
                .kv => |*e| e.close(),
                .column => |*e| e.close(),
                .vector => |*e| e.close(),
                .files => |*e| e.close(),
            }
            if (inst.data_path_z) |path_z| self.allocator.free(path_z);
            inst.manifest.deinit();
            self.allocator.free(inst.manifest_path);
        }
    }

    // ── Migration state ──

    pub fn recordMigration(self: *StorageCommands, store_key: []const u8, migration_id: []const u8) !void {
        const inst = self.stores.getPtr(store_key) orelse return error.StoreNotFound;
        if (inst.manifest.hasMigration(migration_id)) return;
        try inst.manifest.addMigration(migration_id);
        try inst.manifest.save(inst.manifest_path);
    }

    // ── SQL exec/query (sql, column, vector) ──

    pub fn execSql(self: *StorageCommands, store_key: []const u8, sql: [*:0]const u8) !void {
        const inst = self.stores.getPtr(store_key) orelse return error.StoreNotFound;
        switch (inst.handle) {
            .sql => |*e| try e.execSql(sql),
            .column => |*e| try e.execSql(sql),
            .vector => |*e| try e.execSql(sql),
            else => return error.UnsupportedOperation,
        }
    }

    pub fn querySql(self: *StorageCommands, store_key: []const u8, sql: [*:0]const u8, tel: *Telemetry) ![]u8 {
        const inst = self.stores.getPtr(store_key) orelse return error.StoreNotFound;
        return switch (inst.handle) {
            .sql => |*e| try e.queryJson(self.allocator, sql, tel),
            .column => |*e| try e.queryJson(self.allocator, sql, tel),
            .vector => |*e| try e.queryJson(self.allocator, sql, tel),
            else => return error.UnsupportedOperation,
        };
    }

    // ── KV operations ──

    pub fn kvPut(self: *StorageCommands, store_key: []const u8, key: []const u8, value: []const u8, tel: *Telemetry) !void {
        const inst = self.stores.getPtr(store_key) orelse return error.StoreNotFound;
        switch (inst.handle) {
            .kv => |*e| try e.put(key, value, tel),
            else => return error.UnsupportedOperation,
        }
    }

    pub fn kvGet(self: *StorageCommands, store_key: []const u8, key: []const u8, tel: *Telemetry) !?[]u8 {
        const inst = self.stores.getPtr(store_key) orelse return error.StoreNotFound;
        return switch (inst.handle) {
            .kv => |*e| try e.get(key, tel),
            else => return error.UnsupportedOperation,
        };
    }

    pub fn kvDelete(self: *StorageCommands, store_key: []const u8, key: []const u8, tel: *Telemetry) !void {
        const inst = self.stores.getPtr(store_key) orelse return error.StoreNotFound;
        switch (inst.handle) {
            .kv => |*e| try e.delete(key, tel),
            else => return error.UnsupportedOperation,
        }
    }

    // ── File operations ──

    pub fn filePut(self: *StorageCommands, store_key: []const u8, key: []const u8, data: []const u8, tel: *Telemetry) !void {
        const inst = self.stores.getPtr(store_key) orelse return error.StoreNotFound;
        switch (inst.handle) {
            .files => |*e| try e.put(key, data, tel),
            else => return error.UnsupportedOperation,
        }
    }

    pub fn fileGet(self: *StorageCommands, store_key: []const u8, key: []const u8, tel: *Telemetry) !?[]u8 {
        const inst = self.stores.getPtr(store_key) orelse return error.StoreNotFound;
        return switch (inst.handle) {
            .files => |*e| try e.get(key, tel),
            else => return error.UnsupportedOperation,
        };
    }

    pub fn fileDelete(self: *StorageCommands, store_key: []const u8, key: []const u8, tel: *Telemetry) !bool {
        const inst = self.stores.getPtr(store_key) orelse return error.StoreNotFound;
        return switch (inst.handle) {
            .files => |*e| try e.delete(key, tel),
            else => return error.UnsupportedOperation,
        };
    }

    // ── Info ──

    pub fn getStoreSize(self: *StorageCommands, store_key: []const u8) !u64 {
        const inst = self.stores.getPtr(store_key) orelse return error.StoreNotFound;
        return switch (inst.handle) {
            .sql => |*e| try e.getSize(),
            .kv => |*e| try e.getSize(),
            .column => |*e| try e.getSize(),
            .vector => |*e| try e.getSize(),
            .files => |*e| try e.getSize(),
        };
    }

    pub fn getManifest(self: *StorageCommands, store_key: []const u8) ?*const Manifest {
        const inst = self.stores.getPtr(store_key) orelse return null;
        return &inst.manifest;
    }

    // ── Archive ──

    pub fn createArchive(self: *StorageCommands, store_key: []const u8, output_path: []const u8) !void {
        const inst = self.stores.getPtr(store_key) orelse return error.StoreNotFound;
        const store_dir = std.fs.path.dirname(inst.manifest.data_location) orelse return error.InvalidPath;

        const result = try std.process.Child.run(.{
            .allocator = self.allocator,
            .argv = &[_][]const u8{ "tar", "czf", output_path, "-C", store_dir, "." },
        });
        self.allocator.free(result.stdout);
        self.allocator.free(result.stderr);
    }
};
