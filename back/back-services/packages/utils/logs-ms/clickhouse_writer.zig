const std = @import("std");
const fs = std.fs;
const Allocator = std.mem.Allocator;

pub const ColumnType = enum {
    Int8,
    Int16,
    Int32,
    Int64,
    UInt8,
    UInt16,
    UInt32,
    UInt64,
    Float32,
    Float64,
    String,
    DateTime,
    DateTime64,
    UUID,

    pub fn toString(self: ColumnType) []const u8 {
        return switch (self) {
            .Int8 => "Int8",
            .Int16 => "Int16",
            .Int32 => "Int32",
            .Int64 => "Int64",
            .UInt8 => "UInt8",
            .UInt16 => "UInt16",
            .UInt32 => "UInt32",
            .UInt64 => "UInt64",
            .Float32 => "Float32",
            .Float64 => "Float64",
            .String => "String",
            .DateTime => "DateTime",
            .DateTime64 => "DateTime64(3)",
            .UUID => "UUID",
        };
    }
};

pub const ColumnValue = union(enum) {
    int8: i8,
    int16: i16,
    int32: i32,
    int64: i64,
    uint8: u8,
    uint16: u16,
    uint32: u32,
    uint64: u64,
    float32: f32,
    float64: f64,
    string: []const u8,
    datetime: i64,
    datetime64: i64,
    uuid: u128,
};

pub const ColumnDef = struct {
    name: []const u8,
    type: ColumnType,
};

pub const NativeWriter = struct {
    file: fs.File,
    columns: []const ColumnDef,
    allocator: Allocator,

    pub fn init(allocator: Allocator, file_path: []const u8, columns: []const ColumnDef) !NativeWriter {
        const file = try fs.cwd().createFile(file_path, .{});
        return NativeWriter{
            .file = file,
            .columns = columns,
            .allocator = allocator,
        };
    }

    pub fn deinit(self: *NativeWriter) void {
        self.file.close();
    }

    pub fn write(self: *NativeWriter, rows: []const []const ColumnValue) !void {
        if (rows.len == 0) return;

        for (rows) |row| {
            if (row.len != self.columns.len) {
                return error.ColumnCountMismatch;
            }
        }

        const writer = self.file.writer();

        // ClickHouse Native Block Format:
        // 1. Количество колонок (UVarInt)
        try writeUVarInt(writer, self.columns.len);

        // 2. Количество строк (UVarInt)
        try writeUVarInt(writer, rows.len);

        // 3. Для КАЖДОЙ колонки пишем: имя, тип, и СРАЗУ данные этой колонки
        for (self.columns, 0..) |col, col_idx| {
            // 3a. Длина имени колонки
            try writeUVarInt(writer, col.name.len);
            // 3b. Имя колонки
            try writer.writeAll(col.name);

            // 3c. Длина типа колонки
            const type_str = col.type.toString();
            try writeUVarInt(writer, type_str.len);
            // 3d. Тип колонки
            try writer.writeAll(type_str);

            // 3e. Данные ЭТОЙ колонки (все строки подряд)
            for (rows) |row| {
                try writeValue(writer, row[col_idx], col.type);
            }
        }
    }

    fn writeValue(writer: anytype, value: ColumnValue, expected_type: ColumnType) !void {
        switch (expected_type) {
            .Int8 => try writer.writeInt(i8, value.int8, .little),
            .Int16 => try writer.writeInt(i16, value.int16, .little),
            .Int32 => try writer.writeInt(i32, value.int32, .little),
            .Int64 => try writer.writeInt(i64, value.int64, .little),
            .UInt8 => try writer.writeByte(value.uint8),
            .UInt16 => try writer.writeInt(u16, value.uint16, .little),
            .UInt32 => try writer.writeInt(u32, value.uint32, .little),
            .UInt64 => try writer.writeInt(u64, value.uint64, .little),
            .Float32 => try writer.writeInt(u32, @bitCast(value.float32), .little),
            .Float64 => try writer.writeInt(u64, @bitCast(value.float64), .little),
            .String => {
                try writeUVarInt(writer, value.string.len);
                try writer.writeAll(value.string);
            },
            .DateTime => try writer.writeInt(u32, @intCast(value.datetime), .little),
            .DateTime64 => try writer.writeInt(i64, value.datetime64, .little),
            .UUID => try writer.writeInt(u128, value.uuid, .little),
        }
    }
};

fn writeUVarInt(writer: anytype, value: u64) !void {
    var val = value;
    while (val >= 0x80) {
        try writer.writeByte(@as(u8, @intCast((val & 0x7F) | 0x80)));
        val >>= 7;
    }
    try writer.writeByte(@as(u8, @intCast(val & 0x7F)));
}

pub fn generateCreateTableSQL(table_name: []const u8, columns: []const ColumnDef, allocator: Allocator) ![]u8 {
    var sql = std.ArrayList(u8).init(allocator);
    const writer = sql.writer();

    try writer.print("CREATE TABLE IF NOT EXISTS {s} (\n", .{table_name});

    for (columns, 0..) |col, i| {
        try writer.print("    {s} {s}", .{ col.name, col.type.toString() });
        if (i < columns.len - 1) {
            try writer.writeAll(",\n");
        } else {
            try writer.writeAll("\n");
        }
    }

    try writer.writeAll(") ENGINE = MergeTree()\n");
    try writer.print("ORDER BY {s};\n", .{columns[0].name});

    return sql.toOwnedSlice();
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    // Пример 1: Логи приложения
    std.debug.print("=== СОЗДАНИЕ LOGS.NATIVE ===\n", .{});

    const logs_columns = [_]ColumnDef{
        .{ .name = "timestamp", .type = .DateTime64 },
        .{ .name = "level", .type = .String },
        .{ .name = "service", .type = .String },
        .{ .name = "request_id", .type = .UUID },
        .{ .name = "user_id", .type = .UInt64 },
        .{ .name = "response_time_ms", .type = .UInt32 },
        .{ .name = "status_code", .type = .UInt16 },
        .{ .name = "error_count", .type = .UInt8 },
        .{ .name = "cpu_usage", .type = .Float32 },
        .{ .name = "memory_mb", .type = .Float64 },
    };

    var logs_writer = try NativeWriter.init(allocator, "logs.native", &logs_columns);
    defer logs_writer.deinit();

    const now = std.time.milliTimestamp();

    const log_rows = [_][]const ColumnValue{
        &[_]ColumnValue{
            .{ .datetime64 = now },
            .{ .string = "INFO" },
            .{ .string = "api-gateway" },
            .{ .uuid = 0x123e4567e89b12d3a456426614174000 },
            .{ .uint64 = 12345 },
            .{ .uint32 = 150 },
            .{ .uint16 = 200 },
            .{ .uint8 = 0 },
            .{ .float32 = 45.5 },
            .{ .float64 = 512.75 },
        },
        &[_]ColumnValue{
            .{ .datetime64 = now + 1000 },
            .{ .string = "ERROR" },
            .{ .string = "database" },
            .{ .uuid = 0x223e4567e89b12d3a456426614174001 },
            .{ .uint64 = 12346 },
            .{ .uint32 = 2500 },
            .{ .uint16 = 500 },
            .{ .uint8 = 1 },
            .{ .float32 = 78.2 },
            .{ .float64 = 1024.5 },
        },
        &[_]ColumnValue{
            .{ .datetime64 = now + 2000 },
            .{ .string = "WARN" },
            .{ .string = "cache" },
            .{ .uuid = 0x323e4567e89b12d3a456426614174002 },
            .{ .uint64 = 12347 },
            .{ .uint32 = 50 },
            .{ .uint16 = 200 },
            .{ .uint8 = 0 },
            .{ .float32 = 23.1 },
            .{ .float64 = 256.25 },
        },
    };

    try logs_writer.write(&log_rows);
    std.debug.print("✅ Записано {} строк в logs.native\n\n", .{log_rows.len});

    // SQL для логов
    const logs_sql = try generateCreateTableSQL("application_logs", &logs_columns, allocator);
    defer allocator.free(logs_sql);

    const logs_sql_file = try fs.cwd().createFile("import_logs.sql", .{});
    defer logs_sql_file.close();
    try logs_sql_file.writeAll(logs_sql);
    try logs_sql_file.writeAll("\nINSERT INTO application_logs FORMAT Native\n");

    // Пример 2: Метрики
    std.debug.print("=== СОЗДАНИЕ METRICS.NATIVE ===\n", .{});

    const metrics_columns = [_]ColumnDef{
        .{ .name = "timestamp", .type = .DateTime },
        .{ .name = "metric_name", .type = .String },
        .{ .name = "value", .type = .Float64 },
        .{ .name = "host", .type = .String },
        .{ .name = "datacenter", .type = .String },
    };

    var metrics_writer = try NativeWriter.init(allocator, "metrics.native", &metrics_columns);
    defer metrics_writer.deinit();

    const ts = @divFloor(std.time.milliTimestamp(), 1000);

    const metric_rows = [_][]const ColumnValue{
        &[_]ColumnValue{
            .{ .datetime = ts },
            .{ .string = "cpu.usage" },
            .{ .float64 = 65.3 },
            .{ .string = "web-01" },
            .{ .string = "us-east-1" },
        },
        &[_]ColumnValue{
            .{ .datetime = ts },
            .{ .string = "memory.used" },
            .{ .float64 = 4096.5 },
            .{ .string = "web-01" },
            .{ .string = "us-east-1" },
        },
        &[_]ColumnValue{
            .{ .datetime = ts },
            .{ .string = "disk.io" },
            .{ .float64 = 125.7 },
            .{ .string = "web-01" },
            .{ .string = "us-east-1" },
        },
    };

    try metrics_writer.write(&metric_rows);
    std.debug.print("✅ Записано {} строк в metrics.native\n\n", .{metric_rows.len});

    // SQL для метрик
    const metrics_sql = try generateCreateTableSQL("metrics", &metrics_columns, allocator);
    defer allocator.free(metrics_sql);

    const metrics_sql_file = try fs.cwd().createFile("import_metrics.sql", .{});
    defer metrics_sql_file.close();
    try metrics_sql_file.writeAll(metrics_sql);
    try metrics_sql_file.writeAll("\nINSERT INTO metrics FORMAT Native\n");

    std.debug.print("=== ГОТОВО ===\n", .{});
    std.debug.print("\nДля chdb используйте:\n", .{});
    std.debug.print("  SELECT * FROM file('logs.native', 'Native')\n", .{});
    std.debug.print("  SELECT * FROM file('metrics.native', 'Native')\n", .{});
    std.debug.print("\nДля ClickHouse:\n", .{});
    std.debug.print("  clickhouse-client --query=\"$(cat import_logs.sql)\" < logs.native\n", .{});
    std.debug.print("  clickhouse-client --query=\"$(cat import_metrics.sql)\" < metrics.native\n", .{});
}
