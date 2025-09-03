const std = @import("std");
const fs = std.fs;
const print = std.debug.print;
const lz4 = @import("lib.zig"); // LZ4 библиотека с C-биндингами

// Структура данных для записи
const RowData = struct {
    value: i32,
    message: []const u8,
};

// ClickHouse Native format writer с настоящим LZ4 сжатием
pub fn writeClickHouseNative(data: []const RowData, file_path: []const u8, allocator: std.mem.Allocator) !void {
    const file = try fs.cwd().createFile(file_path, .{});
    defer file.close();

    const writer = file.writer();

    // ClickHouse Native format header
    try writeUVarInt(writer, 2); // 2 колонки
    try writeUVarInt(writer, data.len); // количество строк

    // Первая колонка - Int32
    const int_column_name = "value";
    try writeUVarInt(writer, int_column_name.len);
    try writer.writeAll(int_column_name);

    const int_column_type = "Int32";
    try writeUVarInt(writer, int_column_type.len);
    try writer.writeAll(int_column_type);

    // Вторая колонка - String
    const str_column_name = "message";
    try writeUVarInt(writer, str_column_name.len);
    try writer.writeAll(str_column_name);

    const str_column_type = "String";
    try writeUVarInt(writer, str_column_type.len);
    try writer.writeAll(str_column_type);

    // Данные первой колонки (Int32)
    for (data) |row| {
        try writer.writeInt(i32, row.value, .little);
    }

    // Данные второй колонки с настоящим LZ4 сжатием
    try writeLZ4CompressedStringColumn(writer, data, allocator);
}

// LZ4 сжатие строковых данных
fn writeLZ4CompressedStringColumn(writer: anytype, data: []const RowData, allocator: std.mem.Allocator) !void {
    // Собираем несжатые данные
    var total_size: usize = 0;
    for (data) |row| {
        total_size += getUVarIntSize(row.message.len) + row.message.len;
    }

    const uncompressed_data = try allocator.alloc(u8, total_size);
    defer allocator.free(uncompressed_data);

    var offset: usize = 0;
    for (data) |row| {
        const len_bytes = try writeUVarIntToBuffer(uncompressed_data[offset..], row.message.len);
        offset += len_bytes;
        @memcpy(uncompressed_data[offset .. offset + row.message.len], row.message);
        offset += row.message.len;
    }

    print("Несжатые данные: {} байт\n", .{uncompressed_data.len});

    // Сжимаем с настоящим LZ4 Standard API
    const compressed_data = try lz4.Standard.compress(allocator, uncompressed_data);
    defer allocator.free(compressed_data);

    print("Сжатые данные: {} байт (коэффициент: {d:.2})\n", .{ compressed_data.len, @as(f64, @floatFromInt(uncompressed_data.len)) / @as(f64, @floatFromInt(compressed_data.len)) });

    // ClickHouse compressed block format
    try writeClickHouseCompressedBlock(writer, compressed_data, uncompressed_data.len);
}

// Записывает сжатый блок в формате ClickHouse
fn writeClickHouseCompressedBlock(writer: anytype, compressed_data: []const u8, uncompressed_size: usize) !void {
    // ClickHouse compressed block header:
    // [checksum:4][method:1][compressed_size:4][uncompressed_size:4][data...]

    var header_buf: [13]u8 = undefined;
    var header_pos: usize = 0;

    // 1. Checksum (CityHash64 low 32 bits) - вычислим позже
    header_pos += 4; // пропускаем пока

    // 2. Compression method
    header_buf[header_pos] = 0x82; // LZ4HC method в ClickHouse
    header_pos += 1;

    // 3. Compressed size (4 bytes LE)
    const comp_size = @as(u32, @intCast(compressed_data.len));
    header_buf[header_pos] = @as(u8, @intCast(comp_size & 0xFF));
    header_buf[header_pos + 1] = @as(u8, @intCast((comp_size >> 8) & 0xFF));
    header_buf[header_pos + 2] = @as(u8, @intCast((comp_size >> 16) & 0xFF));
    header_buf[header_pos + 3] = @as(u8, @intCast((comp_size >> 24) & 0xFF));
    header_pos += 4;

    // 4. Uncompressed size (4 bytes LE)
    const uncomp_size = @as(u32, @intCast(uncompressed_size));
    header_buf[header_pos] = @as(u8, @intCast(uncomp_size & 0xFF));
    header_buf[header_pos + 1] = @as(u8, @intCast((uncomp_size >> 8) & 0xFF));
    header_buf[header_pos + 2] = @as(u8, @intCast((uncomp_size >> 16) & 0xFF));
    header_buf[header_pos + 3] = @as(u8, @intCast((uncomp_size >> 24) & 0xFF));

    // 5. Вычисляем checksum для заголовка + данных (упрощенный CityHash)
    const checksum = calculateClickHouseChecksum(header_buf[4..], compressed_data);
    header_buf[0] = @as(u8, @intCast(checksum & 0xFF));
    header_buf[1] = @as(u8, @intCast((checksum >> 8) & 0xFF));
    header_buf[2] = @as(u8, @intCast((checksum >> 16) & 0xFF));
    header_buf[3] = @as(u8, @intCast((checksum >> 24) & 0xFF));

    // Записываем заголовок и данные
    try writer.writeAll(&header_buf);
    try writer.writeAll(compressed_data);
}

// Вычисляет checksum в стиле ClickHouse (упрощенная версия CityHash64)
fn calculateClickHouseChecksum(header: []const u8, data: []const u8) u32 {
    // Упрощенный CityHash64 → uint32
    var h: u64 = 0xc3a5c85c97cb3127; // CityHash64 seed

    // Хэшируем заголовок
    for (header) |byte| {
        h ^= @as(u64, byte);
        h = h *% 0x9e3779b97f4a7c15; // golden ratio multiplier
        h ^= h >> 30;
    }

    // Хэшируем данные блоками по 8 байт
    var i: usize = 0;
    while (i + 8 <= data.len) {
        const chunk = std.mem.readInt(u64, data[i .. i + 8][0..8], .little);
        h ^= chunk;
        h = h *% 0x9e3779b97f4a7c15;
        h ^= h >> 30;
        i += 8;
    }

    // Обрабатываем остаток
    while (i < data.len) {
        h ^= @as(u64, data[i]);
        h = h *% 0x9e3779b97f4a7c15;
        h ^= h >> 30;
        i += 1;
    }

    // Финализируем
    h ^= @as(u64, header.len + data.len);
    h = h *% 0x9e3779b97f4a7c15;
    h ^= h >> 30;

    return @as(u32, @truncate(h));
}

// Определяет размер UVarInt в байтах
fn getUVarIntSize(value: u64) usize {
    var val = value;
    var size: usize = 1;
    while (val >= 0x80) {
        val >>= 7;
        size += 1;
    }
    return size;
}

// Записывает UVarInt в буфер
fn writeUVarIntToBuffer(buffer: []u8, value: u64) !usize {
    var val = value;
    var pos: usize = 0;
    while (val >= 0x80) {
        buffer[pos] = @as(u8, @intCast((val & 0x7F) | 0x80));
        val >>= 7;
        pos += 1;
    }
    buffer[pos] = @as(u8, @intCast(val & 0x7F));
    return pos + 1;
}

// Write UVarInt
fn writeUVarInt(writer: anytype, value: u64) !void {
    var val = value;
    while (val >= 0x80) {
        try writer.writeByte(@as(u8, @intCast((val & 0x7F) | 0x80)));
        val >>= 7;
    }
    try writer.writeByte(@as(u8, @intCast(val & 0x7F)));
}

fn debugNativeFile(file_path: []const u8) !void {
    const file = try fs.cwd().openFile(file_path, .{});
    defer file.close();

    const file_size = try file.getEndPos();
    print("Размер созданного файла: {} байт\n", .{file_size});

    var buffer: [100]u8 = undefined;
    const bytes_read = try file.readAll(&buffer);

    print("Первые байты (hex): ", .{});
    for (buffer[0..@min(bytes_read, 50)]) |byte| {
        print("{x:0>2} ", .{byte});
    }
    print("\n", .{});
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const data = [_]RowData{
        RowData{ .value = 1, .message = "Hello World!" },
        RowData{ .value = 2, .message = "ClickHouse Native Format with LZ4" },
        RowData{ .value = 3, .message = "Real LZ4 Compression using C library" },
        RowData{ .value = 42, .message = "Lorem ipsum dolor sit amet, consectetur adipiscing elit" },
        RowData{ .value = 100, .message = "This is a longer message to test compression efficiency" },
        RowData{ .value = 999, .message = "LZ4 Standard API compression integration successful" },
        RowData{ .value = 1337, .message = "Final test message with proper LZ4 C library binding" },
    };

    try writeClickHouseNative(&data, "data.native", allocator);

    print("Данные записаны в файл data.native с НАСТОЯЩИМ LZ4 сжатием!\n", .{});
    try debugNativeFile("data.native");

    print("\n=== REAL LZ4 C LIBRARY COMPRESSION ===\n", .{});
    print("1. Количество колонок: 2\n", .{});
    print("2. Количество строк: {}\n", .{data.len});
    print("3. Колонка 1: 'value' Int32\n", .{});
    print("4. Колонка 2: 'message' String (LZ4 C library)\n", .{});
    print("5. API: lz4.Standard.compress() + ClickHouse block format\n", .{});
    print("6. Checksum: упрощенный CityHash64\n", .{});

    print("\nТестовые данные:\n", .{});
    for (data, 0..) |row, i| {
        print("{}: value={}, message='{s}'\n", .{ i + 1, row.value, row.message });
    }

    print("\nТребуется: libLZ4 установленная в системе\n", .{});
    print("Установка: sudo apt install liblz4-dev (Ubuntu/Debian)\n", .{});
    print("Для тестирования: bun run query.ts\n", .{});
}
