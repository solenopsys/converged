const std = @import("std");
const fs = std.fs;
const Allocator = std.mem.Allocator;
const c = @cImport({
    @cInclude("lz4.h");
});

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
    use_compression: bool,

    pub fn init(allocator: Allocator, file_path: []const u8, columns: []const ColumnDef, use_compression: bool) !NativeWriter {
        const file = try fs.cwd().createFile(file_path, .{});
        return NativeWriter{
            .file = file,
            .columns = columns,
            .allocator = allocator,
            .use_compression = use_compression,
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

        var buffer = std.ArrayList(u8).init(self.allocator);
        defer buffer.deinit();
        const buf_writer = buffer.writer();

        // Native Block Format
        try writeUVarInt(buf_writer, self.columns.len);
        try writeUVarInt(buf_writer, rows.len);

        for (self.columns, 0..) |col, col_idx| {
            try writeUVarInt(buf_writer, col.name.len);
            try buf_writer.writeAll(col.name);

            const type_str = col.type.toString();
            try writeUVarInt(buf_writer, type_str.len);
            try buf_writer.writeAll(type_str);

            for (rows) |row| {
                try writeValue(buf_writer, row[col_idx], col.type);
            }
        }

        if (self.use_compression) {
            try self.writeCompressedBlock(buffer.items);
        } else {
            try self.file.writeAll(buffer.items);
        }
    }

    fn writeCompressedBlock(self: *NativeWriter, data: []const u8) !void {
        // Сжимаем данные
        const max_size: usize = @intCast(c.LZ4_compressBound(@intCast(data.len)));
        const compressed_buf = try self.allocator.alloc(u8, max_size);
        defer self.allocator.free(compressed_buf);

        const compressed_size = c.LZ4_compress_default(
            data.ptr,
            compressed_buf.ptr,
            @intCast(data.len),
            @intCast(compressed_buf.len),
        );

        if (compressed_size <= 0) return error.CompressionFailed;

        const comp_size: usize = @intCast(compressed_size);

        // Формат ClickHouse compressed block:
        // [16 bytes checksum][1 byte method][4 bytes compressed_size+9][4 bytes uncompressed_size][compressed data]

        const writer = self.file.writer();

        // 1. Checksum (16 bytes) - пробуем с нулями
        const checksum = [_]u8{0} ** 16;
        try writer.writeAll(&checksum);

        // 2. Method (1 byte) = 0x82 для LZ4
        try writer.writeByte(0x82);

        // 3. Compressed size (4 bytes) = compressed_size + 9
        const total_size: u32 = @intCast(comp_size + 9);
        try writer.writeInt(u32, total_size, .little);

        // 4. Uncompressed size (4 bytes)
        try writer.writeInt(u32, @intCast(data.len), .little);

        // 5. Compressed data
        try writer.writeAll(compressed_buf[0..comp_size]);
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

    std.debug.print("=== LOGS.NATIVE (несжатый) ===\n", .{});
    var logs_writer = try NativeWriter.init(allocator, "logs.native", &logs_columns, false);
    defer logs_writer.deinit();
    try logs_writer.write(&log_rows);
    const uncompressed_size = (try fs.cwd().statFile("logs.native")).size;
    std.debug.print("✅ {} байт\n\n", .{uncompressed_size});

    std.debug.print("=== LOGS_COMPRESSED.NATIVE (блочное LZ4) ===\n", .{});
    var logs_comp = try NativeWriter.init(allocator, "logs_compressed.native", &logs_columns, true);
    defer logs_comp.deinit();
    try logs_comp.write(&log_rows);
    const compressed_size = (try fs.cwd().statFile("logs_compressed.native")).size;
    const ratio = @as(f64, @floatFromInt(compressed_size)) / @as(f64, @floatFromInt(uncompressed_size)) * 100.0;
    std.debug.print("✅ {} байт ({d:.1}% от оригинала)\n\n", .{ compressed_size, ratio });

    const metrics_columns = [_]ColumnDef{
        .{ .name = "timestamp", .type = .DateTime },
        .{ .name = "metric_name", .type = .String },
        .{ .name = "value", .type = .Float64 },
        .{ .name = "host", .type = .String },
        .{ .name = "datacenter", .type = .String },
    };

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

    std.debug.print("=== METRICS_COMPRESSED.NATIVE ===\n", .{});
    var metrics = try NativeWriter.init(allocator, "metrics_compressed.native", &metrics_columns, true);
    defer metrics.deinit();
    try metrics.write(&metric_rows);
    std.debug.print("✅ {} байт\n\n", .{(try fs.cwd().statFile("metrics_compressed.native")).size});

    std.debug.print("✅ Готово! Файлы с блочным LZ4 сжатием:\n", .{});
    std.debug.print("  logs.native (несжатый)\n", .{});
    std.debug.print("  logs_compressed.native (LZ4 блоки)\n", .{});
    std.debug.print("  metrics_compressed.native (LZ4 блоки)\n", .{});
}
