const std = @import("std");
const fs = std.fs;
const print = std.debug.print;

// ClickHouse Native format writer
pub fn writeClickHouseNative(data: []const i32, file_path: []const u8) !void {
    const file = try fs.cwd().createFile(file_path, .{});
    defer file.close();

    const writer = file.writer();

    // ClickHouse Native format header (ПРАВИЛЬНЫЙ ПОРЯДОК!)
    // 1. Number of columns (UVarInt)
    try writeUVarInt(writer, 1);

    // 2. Number of rows (UVarInt) - ПЕРЕНЕСЕНО СЮДА!
    try writeUVarInt(writer, data.len);

    // 3. Column name length + name
    const column_name = "value";
    try writeUVarInt(writer, column_name.len);
    try writer.writeAll(column_name);

    // 4. Column type length + type
    const column_type = "Int32";
    try writeUVarInt(writer, column_type.len);
    try writer.writeAll(column_type);

    // 5. Write column data - Int32 values in little-endian
    for (data) |value| {
        try writer.writeInt(i32, value, .little);
    }
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
    for (buffer[0..@min(bytes_read, 20)]) |byte| {
        print("{x:0>2} ", .{byte});
    }
    print("\n", .{});
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();

    // Пример данных
    const data = [_]i32{ 1, 2, 3, 42, 100, 999, 1337 };

    // Записываем данные в native формате
    try writeClickHouseNative(&data, "data.native");

    print("Данные записаны в файл data.native в ClickHouse Native формате\n", .{});

    // Отладочная информация
    try debugNativeFile("data.native");

    // Создаем SQL для импорта
    const schema_file = try fs.cwd().createFile("import.sql", .{});
    defer schema_file.close();

    const schema_writer = schema_file.writer();
    try schema_writer.writeAll(
        \\CREATE TABLE IF NOT EXISTS numbers (
        \\    value Int32
        \\) ENGINE = MergeTree()
        \\ORDER BY value;
        \\
        \\INSERT INTO numbers FORMAT Native
    );

    print("\nДля импорта в ClickHouse:\n", .{});
    print("clickhouse-client --query=\"$(cat import.sql)\" < data.native\n", .{});
    print("Или через chdb: SELECT * FROM file('data.native', 'Native', 'value Int32')\n", .{});

    print("\n=== ПРОВЕРКА СТРУКТУРЫ ===\n", .{});
    print("Ожидаемая структура файла:\n", .{});
    print("1. Количество колонок: 1 (байт: 01)\n", .{});
    print("2. Количество строк: {} (байт: 07)\n", .{data.len});
    print("3. Длина имени колонки: {} (байт: 05)\n", .{"value".len});
    print("4. Имя колонки: 'value' (байты: 76 61 6c 75 65)\n", .{});
    print("5. Длина типа: {} (байт: 05)\n", .{"Int32".len});
    print("6. Тип: 'Int32' (байты: 49 6e 74 33 32)\n", .{});
    print("7. Данные: {} значений Int32 ({} байт)\n", .{ data.len, data.len * 4 });
}
