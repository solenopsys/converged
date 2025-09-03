const std = @import("std");
const fs = std.fs;
const print = std.debug.print;

// Структура данных для записи
const RowData = struct {
    value: i32,
    message: []const u8,
};

// ClickHouse Native format writer с deflate компрессией
pub fn writeClickHouseNative(data: []const RowData, file_path: []const u8, allocator: std.mem.Allocator) !void {
    const file = try fs.cwd().createFile(file_path, .{});
    defer file.close();

    const writer = file.writer();

    // ClickHouse Native format header
    // 1. Number of columns (UVarInt)
    try writeUVarInt(writer, 2); // 2 колонки

    // 2. Number of rows (UVarInt)
    try writeUVarInt(writer, data.len);

    // 3. Первая колонка - Int32
    const int_column_name = "value";
    try writeUVarInt(writer, int_column_name.len);
    try writer.writeAll(int_column_name);

    const int_column_type = "Int32";
    try writeUVarInt(writer, int_column_type.len);
    try writer.writeAll(int_column_type);

    // 4. Вторая колонка - String
    const str_column_name = "message";
    try writeUVarInt(writer, str_column_name.len);
    try writer.writeAll(str_column_name);

    const str_column_type = "String";
    try writeUVarInt(writer, str_column_type.len);
    try writer.writeAll(str_column_type);

    // 5. Данные первой колонки (Int32) - без сжатия
    for (data) |row| {
        try writer.writeInt(i32, row.value, .little);
    }

    // 6. Данные второй колонки (String с deflate компрессией)
    try writeDeflateStringColumn(writer, data, allocator);
}

// Запись строковой колонки с deflate компрессией
fn writeDeflateStringColumn(writer: anytype, data: []const RowData, allocator: std.mem.Allocator) !void {
    // Собираем все строки в один буфер (несжатые данные)
    var total_size: usize = 0;
    for (data) |row| {
        total_size += getUVarIntSize(row.message.len) + row.message.len;
    }

    // Создаем буфер для несжатых данных
    const uncompressed_data = try allocator.alloc(u8, total_size);
    defer allocator.free(uncompressed_data);

    var offset: usize = 0;
    for (data) |row| {
        // Записываем длину строки как UVarInt
        const len_bytes = try writeUVarIntToBuffer(uncompressed_data[offset..], row.message.len);
        offset += len_bytes;

        // Записываем саму строку
        @memcpy(uncompressed_data[offset .. offset + row.message.len], row.message);
        offset += row.message.len;
    }

    print("Несжатые данные: {} байт\n", .{uncompressed_data.len});

    // Сжимаем данные с gzip
    var compressed_buffer = std.ArrayList(u8).init(allocator);
    defer compressed_buffer.deinit();

    // Создаем поток для чтения несжатых данных
    var input_stream = std.io.fixedBufferStream(uncompressed_data);

    // Сжимаем с помощью gzip
    try std.compress.gzip.compress(input_stream.reader(), compressed_buffer.writer(), .{});

    const compressed_data = compressed_buffer.items;

    print("Сжатые данные: {} байт (коэффициент: {d:.2})\n", .{ compressed_data.len, @as(f64, @floatFromInt(uncompressed_data.len)) / @as(f64, @floatFromInt(compressed_data.len)) });

    // Записываем заголовок сжатого блока
    // Формат: [compression_method][compressed_size][uncompressed_size][compressed_data]

    // 1. Метод сжатия: 0x82 = gzip
    try writer.writeByte(0x82);

    // 2. Размер сжатых данных (UVarInt)
    try writeUVarInt(writer, compressed_data.len);

    // 3. Размер несжатых данных (UVarInt)
    try writeUVarInt(writer, uncompressed_data.len);

    // 4. Сжатые данные
    try writer.writeAll(compressed_data);
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

// Записывает UVarInt в буфер и возвращает количество записанных байт
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

// Write UVarInt (unsigned variable length integer)
fn writeUVarInt(writer: anytype, value: u64) !void {
    var val = value;
    while (val >= 0x80) {
        try writer.writeByte(@as(u8, @intCast((val & 0x7F) | 0x80)));
        val >>= 7;
    }
    try writer.writeByte(@as(u8, @intCast(val & 0x7F)));
}

// Функция для отладочного вывода созданного файла
fn debugNativeFile(file_path: []const u8) !void {
    const file = try fs.cwd().openFile(file_path, .{});
    defer file.close();

    const file_size = try file.getEndPos();
    print("Размер созданного файла: {} байт\n", .{file_size});

    // Читаем и выводим первые байты для проверки
    var buffer: [100]u8 = undefined;
    const bytes_read = try file.readAll(&buffer);

    print("Первые байты (hex): ", .{});
    for (buffer[0..@min(bytes_read, 40)]) |byte| {
        print("{x:0>2} ", .{byte});
    }
    print("\n", .{});
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    // Пример данных для демонстрации сжатия
    const data = [_]RowData{
        RowData{ .value = 1, .message = "Hello World" },
        RowData{ .value = 2, .message = "ClickHouse Native Format" },
        RowData{ .value = 3, .message = "Deflate Compression Test" },
        RowData{ .value = 42, .message = "Lorem ipsum dolor sit amet" },
        RowData{ .value = 100, .message = "Compressed string data" },
        RowData{ .value = 999, .message = "This is a longer message for better compression ratio" },
        RowData{ .value = 1337, .message = "Final test message with deflate algorithm" },
    };

    // Записываем данные в native формате
    try writeClickHouseNative(&data, "data.native", allocator);

    print("Данные записаны в файл data.native с gzip компрессией\n", .{});

    // Отладочная информация
    try debugNativeFile("data.native");

    print("\n=== ПРОВЕРКА СТРУКТУРЫ ===\n", .{});
    print("1. Количество колонок: 2\n", .{});
    print("2. Количество строк: {}\n", .{data.len});
    print("3. Колонка 1: 'value' тип 'Int32'\n", .{});
    print("4. Колонка 2: 'message' тип 'String' (gzip сжатие)\n", .{});
    print("5. Данные Int32: {} значений ({} байт)\n", .{ data.len, data.len * 4 });
    print("6. Данные String: gzip сжатые\n", .{});

    print("\n=== ТЕСТОВЫЕ ДАННЫЕ ===\n", .{});
    for (data, 0..) |row, i| {
        print("Строка {}: value={}, message='{s}'\n", .{ i + 1, row.value, row.message });
    }

    print("\nДля тестирования используйте:\n", .{});
    print("const STRUCT = \"value Int32, message String\";\n", .{});
}
