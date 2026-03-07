const std = @import("std");
const Allocator = std.mem.Allocator;
const Telemetry = @import("../telemetry.zig").Telemetry;

const c = @cImport({
    @cInclude("sqlite3.h");
});

pub const SqlEngine = struct {
    db: ?*c.sqlite3,
    path: [:0]const u8,
    allocator: Allocator,

    pub fn init(allocator: Allocator, path: [:0]const u8) SqlEngine {
        return .{
            .db = null,
            .path = path,
            .allocator = allocator,
        };
    }

    pub fn open(self: *SqlEngine) !void {
        const rc = c.sqlite3_open_v2(
            self.path.ptr,
            &self.db,
            c.SQLITE_OPEN_READWRITE | c.SQLITE_OPEN_CREATE,
            null,
        );
        if (rc != c.SQLITE_OK) return error.SqliteOpenFailed;

        // WAL mode + performance pragmas (matching Bun layer)
        try self.execPragma("PRAGMA journal_mode = WAL");
        try self.execPragma("PRAGMA busy_timeout = 10000");
        try self.execPragma("PRAGMA synchronous = NORMAL");
        try self.execPragma("PRAGMA cache_size = -64000");
        try self.execPragma("PRAGMA temp_store = MEMORY");
    }

    pub fn close(self: *SqlEngine) void {
        if (self.db) |db| {
            _ = c.sqlite3_close_v2(db);
            self.db = null;
        }
    }

    pub fn execSql(self: *SqlEngine, sql: [*:0]const u8) !void {
        const rc = c.sqlite3_exec(self.db.?, sql, null, null, null);
        if (rc != c.SQLITE_OK) return error.SqliteExecFailed;
    }

    pub fn execSqlTelemetry(self: *SqlEngine, sql: [*:0]const u8, tel: *Telemetry) !void {
        try self.execSql(sql);
        tel.op_count += 1;
    }

    /// Query and return results as JSON array
    pub fn queryJson(self: *SqlEngine, allocator: Allocator, sql: [*:0]const u8, tel: *Telemetry) ![]u8 {
        var stmt: ?*c.sqlite3_stmt = null;
        var rc = c.sqlite3_prepare_v2(self.db.?, sql, -1, &stmt, null);
        if (rc != c.SQLITE_OK) return error.SqlitePrepareFailed;
        defer _ = c.sqlite3_finalize(stmt);

        var result: std.ArrayList(u8) = .{};
        errdefer result.deinit(allocator);
        const writer = result.writer(allocator);

        try writer.writeByte('[');
        var row_idx: usize = 0;

        while (true) {
            rc = c.sqlite3_step(stmt.?);
            if (rc == c.SQLITE_DONE) break;
            if (rc != c.SQLITE_ROW) {
                const errmsg = c.sqlite3_errmsg(self.db.?);
                std.debug.print("SqliteStepFailed rc={d} msg={s}\n", .{ rc, errmsg });
                return error.SqliteStepFailed;
            }

            if (row_idx > 0) try writer.writeByte(',');

            try writer.writeByte('{');
            const col_count: usize = @intCast(c.sqlite3_column_count(stmt.?));
            for (0..col_count) |i| {
                if (i > 0) try writer.writeByte(',');
                const col_name_ptr = c.sqlite3_column_name(stmt.?, @intCast(i));
                const col_name = std.mem.span(col_name_ptr);
                try writer.print("\"{s}\":", .{col_name});

                const col_type = c.sqlite3_column_type(stmt.?, @intCast(i));
                switch (col_type) {
                    c.SQLITE_NULL => try writer.writeAll("null"),
                    c.SQLITE_INTEGER => {
                        const val = c.sqlite3_column_int64(stmt.?, @intCast(i));
                        try writer.print("{}", .{val});
                    },
                    c.SQLITE_FLOAT => {
                        const val = c.sqlite3_column_double(stmt.?, @intCast(i));
                        try writer.print("{d}", .{val});
                    },
                    c.SQLITE_TEXT => {
                        const text_ptr = c.sqlite3_column_text(stmt.?, @intCast(i));
                        const len: usize = @intCast(c.sqlite3_column_bytes(stmt.?, @intCast(i)));
                        const text = @as([*]const u8, @ptrCast(text_ptr))[0..len];
                        try writer.writeByte('"');
                        try writeJsonEscaped(writer, text);
                        try writer.writeByte('"');
                    },
                    c.SQLITE_BLOB => {
                        const len: usize = @intCast(c.sqlite3_column_bytes(stmt.?, @intCast(i)));
                        try writer.print("\"<blob:{}>\"", .{len});
                    },
                    else => try writer.writeAll("null"),
                }
            }
            try writer.writeByte('}');
            row_idx += 1;
        }

        try writer.writeByte(']');

        tel.bytes_read += result.items.len;
        tel.op_count += 1;

        return result.toOwnedSlice(allocator);
    }

    /// Get database file size
    pub fn getSize(self: *SqlEngine) !u64 {
        const file = try std.fs.cwd().openFile(self.path, .{});
        defer file.close();
        const stat = try file.stat();
        return stat.size;
    }

    pub fn execPragma(self: *SqlEngine, pragma: [*:0]const u8) !void {
        const rc = c.sqlite3_exec(self.db.?, pragma, null, null, null);
        if (rc != c.SQLITE_OK) return error.SqlitePragmaFailed;
    }
};

fn writeJsonEscaped(writer: anytype, s: []const u8) !void {
    for (s) |ch| {
        switch (ch) {
            '"' => try writer.writeAll("\\\""),
            '\\' => try writer.writeAll("\\\\"),
            '\n' => try writer.writeAll("\\n"),
            '\r' => try writer.writeAll("\\r"),
            '\t' => try writer.writeAll("\\t"),
            else => {
                if (ch < 0x20) {
                    try writer.print("\\u{x:0>4}", .{ch});
                } else {
                    try writer.writeByte(ch);
                }
            },
        }
    }
}
