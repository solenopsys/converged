const std = @import("std");
const Allocator = std.mem.Allocator;
const Telemetry = @import("../telemetry.zig").Telemetry;
const sql_engine = @import("sql.zig");

const c = @cImport({
    @cInclude("sqlite3.h");
    @cInclude("sqlite-vec.h");
});

/// Vector engine — SQLite with sqlite-vec extension loaded
/// Reuses SqlEngine, adds vector search capability
pub const VectorEngine = struct {
    sql: sql_engine.SqlEngine,

    pub fn init(allocator: Allocator, path: [:0]const u8) VectorEngine {
        return .{
            .sql = sql_engine.SqlEngine.init(allocator, path),
        };
    }

    pub fn open(self: *VectorEngine) !void {
        // Register sqlite-vec as auto extension BEFORE opening the database
        const rc = c.sqlite3_auto_extension(@ptrCast(&c.sqlite3_vec_init));
        if (rc != c.SQLITE_OK) return error.VecExtensionFailed;

        try self.sql.open();
        // Enable trusted schema for sqlite-vec virtual tables
        try self.sql.execPragma("PRAGMA trusted_schema = ON");
    }

    pub fn close(self: *VectorEngine) void {
        self.sql.close();
    }

    pub fn execSql(self: *VectorEngine, stmt: [*:0]const u8) !void {
        try self.sql.execSql(stmt);
    }

    pub fn execSqlTelemetry(self: *VectorEngine, stmt: [*:0]const u8, tel: *Telemetry) !void {
        try self.sql.execSqlTelemetry(stmt, tel);
    }

    pub fn queryJson(self: *VectorEngine, allocator: Allocator, stmt: [*:0]const u8, tel: *Telemetry) ![]u8 {
        return self.sql.queryJson(allocator, stmt, tel);
    }

    pub fn getSize(self: *VectorEngine) !u64 {
        return self.sql.getSize();
    }
};
