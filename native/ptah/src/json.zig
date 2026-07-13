const std = @import("std");

pub fn stringField(map: std.json.ObjectMap, name: []const u8) ?[]const u8 {
    return switch (map.get(name) orelse return null) {
        .string => |value| value,
        else => null,
    };
}

pub fn boolField(map: std.json.ObjectMap, name: []const u8, default: bool) bool {
    return switch (map.get(name) orelse return default) {
        .bool => |value| value,
        else => default,
    };
}

pub fn f64Field(map: std.json.ObjectMap, name: []const u8, default: f64) f64 {
    return switch (map.get(name) orelse return default) {
        .float => |value| value,
        .integer => |value| @floatFromInt(value),
        else => default,
    };
}

pub fn u32Field(map: std.json.ObjectMap, name: []const u8, default: u32) u32 {
    return switch (map.get(name) orelse return default) {
        .integer => |value| std.math.cast(u32, value) orelse default,
        else => default,
    };
}

pub fn jsonString(allocator: std.mem.Allocator, value: []const u8) ![]u8 {
    return std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = value }, .{});
}

pub fn readFile(allocator: std.mem.Allocator, path: []const u8, max_bytes: usize) ![]u8 {
    return std.Io.Dir.cwd().readFileAlloc(
        std.Options.debug_io,
        path,
        allocator,
        .limited(max_bytes),
    );
}

pub fn writeFile(path: []const u8, data: []const u8) !void {
    try std.Io.Dir.cwd().writeFile(std.Options.debug_io, .{
        .sub_path = path,
        .data = data,
    });
}
