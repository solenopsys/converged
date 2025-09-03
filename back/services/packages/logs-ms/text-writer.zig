const std = @import("std");
const fs = std.fs;
const print = std.debug.print;

// Write UVarInt (unsigned variable length integer)
fn writeUVarInt(writer: anytype, value: u64) !void {
    var val = value;
    while (val >= 0x80) {
        try writer.writeByte(@as(u8, @intCast((val & 0x7F) | 0x80)));
        val >>= 7;
    }
    try writer.writeByte(@as(u8, @intCast(val & 0x7F)));
}

pub fn main() !void {
    const data = [_]i32{ 1, 2, 3, 42, 100, 999, 1337 };

    const file = try fs.cwd().createFile("data.native", .{});
    defer file.close();

    const writer = file.writer();

    // 1 колонка, N строк
    try writeUVarInt(writer, 1);
    try writeUVarInt(writer, data.len);

    // Метаданные колонки
    const column_name = "value";
    try writeUVarInt(writer, column_name.len);
    try writer.writeAll(column_name);

    const column_type = "Int32";
    try writeUVarInt(writer, column_type.len);
    try writer.writeAll(column_type);

    // Данные
    for (data) |value| {
        try writer.writeInt(i32, value, .little);
    }

    print("Создан файл data.native с одной Int32 колонкой\n", .{});
    print("Размер: {} значений\n", .{data.len});
    print("Для тестирования: const STRUCT = \"value Int32\";\n", .{});

    // Проверяем размер файла
    const file_size = try fs.cwd().openFile("data.native", .{});
    defer file_size.close();
    const size = try file_size.getEndPos();
    print("Размер файла: {} байт\n", .{size});
}
