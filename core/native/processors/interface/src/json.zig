//! Field readers and file helpers shared by every processor. A processor
//! parses its task with these instead of a generated struct: the schema is
//! open (callers add tool parameters without a rebuild) and an absent field
//! must fall back to the processor's own default, not to a zero value.

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

test "field readers fall back to the processor default" {
    const allocator = std.testing.allocator;
    var parsed = try std.json.parseFromSlice(
        std.json.Value,
        allocator,
        \\{"stlPath":"/tmp/a.stl","toolDiameter":6,"stepover":0.4,"threads":"nope"}
    ,
        .{},
    );
    defer parsed.deinit();
    const object = parsed.value.object;

    try std.testing.expectEqualStrings("/tmp/a.stl", stringField(object, "stlPath").?);
    try std.testing.expect(stringField(object, "gcodePath") == null);
    // An integer literal still answers a float field.
    try std.testing.expectEqual(@as(f64, 6), f64Field(object, "toolDiameter", 3.175));
    try std.testing.expectEqual(@as(f64, 0.4), f64Field(object, "stepover", 1));
    try std.testing.expectEqual(@as(f64, 5), f64Field(object, "safeZ", 5));
    // A wrongly typed field is treated as absent rather than failing the task.
    try std.testing.expectEqual(@as(u32, 0), u32Field(object, "threads", 0));
}

test "jsonString escapes a path before it is spliced into a reply" {
    const allocator = std.testing.allocator;
    const quoted = try jsonString(allocator, "/tmp/we\"ird.gcode");
    defer allocator.free(quoted);
    try std.testing.expectEqualStrings("\"/tmp/we\\\"ird.gcode\"", quoted);
}
