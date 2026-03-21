const std = @import("std");
const Allocator = std.mem.Allocator;
const Telemetry = @import("../telemetry.zig").Telemetry;
const sql_engine = @import("sql.zig");

/// Column engine — SQLite with Stanchion extension
/// Currently operates as plain SQL (stanchion virtual table registration pending)
/// Reuses SqlEngine for all SQL operations
pub const ColumnEngine = struct {
    sql: sql_engine.SqlEngine,

    pub fn init(allocator: Allocator, path: [:0]const u8) ColumnEngine {
        return .{
            .sql = sql_engine.SqlEngine.init(allocator, path),
        };
    }

    pub fn open(self: *ColumnEngine) !void {
        try self.sql.open();
    }

    pub fn close(self: *ColumnEngine) void {
        self.sql.close();
    }

    pub fn execSql(self: *ColumnEngine, stmt: [*:0]const u8) !void {
        try self.sql.execSql(stmt);
    }

    pub fn execSqlTelemetry(self: *ColumnEngine, stmt: [*:0]const u8, tel: *Telemetry) !void {
        try self.sql.execSqlTelemetry(stmt, tel);
    }

    pub fn queryJson(self: *ColumnEngine, allocator: Allocator, stmt: [*:0]const u8, tel: *Telemetry) ![]u8 {
        return self.sql.queryJson(allocator, stmt, tel);
    }

    pub fn getSize(self: *ColumnEngine) !u64 {
        return self.sql.getSize();
    }
};
