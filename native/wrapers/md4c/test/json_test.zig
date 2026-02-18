const std = @import("std");
const testing = std.testing;

// Test JSON serialization with structures
test "json value serialization" {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const Data = struct {
        level: i32,
        text: []const u8,
        flag: bool,
    };

    const obj = Data{
        .level = 1,
        .text = "Hello",
        .flag = true,
    };

    // Serialize to string
    var list: std.ArrayListUnmanaged(u8) = .{};
    defer list.deinit(allocator);

    try std.json.stringify(obj, .{}, list.writer(allocator));

    const result = list.items;

    std.debug.print("JSON result: {s}\n", .{result});

    // Check that it contains expected values
    try testing.expect(std.mem.indexOf(u8, result, "\"level\"") != null);
    try testing.expect(std.mem.indexOf(u8, result, "\"text\"") != null);
    try testing.expect(std.mem.indexOf(u8, result, "\"Hello\"") != null);
}

// Test nested JSON structure
test "nested json structure" {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const Child = struct {
        type: []const u8,
        level: i32,
    };

    const Root = struct {
        type: []const u8,
        children: []const Child,
    };

    const children = [_]Child{
        .{ .type = "h", .level = 1 },
    };

    const root = Root{
        .type = "doc",
        .children = &children,
    };

    // Serialize
    var list: std.ArrayListUnmanaged(u8) = .{};
    defer list.deinit(allocator);

    try std.json.stringify(root, .{}, list.writer(allocator));

    const result = list.items;

    std.debug.print("Nested JSON: {s}\n", .{result});

    try testing.expect(std.mem.indexOf(u8, result, "\"children\"") != null);
    try testing.expect(std.mem.indexOf(u8, result, "\"type\"") != null);
}

// Test string escaping
test "json string escaping" {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const Data = struct {
        text: []const u8,
    };

    const obj = Data{
        .text = "Line 1\nLine 2\t\"quoted\"",
    };

    var list: std.ArrayListUnmanaged(u8) = .{};
    defer list.deinit(allocator);

    try std.json.stringify(obj, .{}, list.writer(allocator));

    const result = list.items;

    std.debug.print("Escaped JSON: {s}\n", .{result});

    // Should contain escaped sequences
    try testing.expect(std.mem.indexOf(u8, result, "\\n") != null);
    try testing.expect(std.mem.indexOf(u8, result, "\\t") != null);
    try testing.expect(std.mem.indexOf(u8, result, "\\\"") != null);
}

// Test manual JSON writing (like our implementation)
test "manual json writing" {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    var list = std.ArrayListUnmanaged(u8){};
    defer list.deinit(allocator);

    const w = list.writer(allocator);

    // Write JSON manually
    try w.writeByte('{');
    try w.writeAll("\"type\":");
    try w.writeAll("\"heading\"");
    try w.writeAll(",\"level\":");
    try w.print("{d}", .{1});
    try w.writeByte('}');

    const result = try list.toOwnedSlice(allocator);
    defer allocator.free(result);

    std.debug.print("Manual JSON: {s}\n", .{result});

    try testing.expectEqualStrings("{\"type\":\"heading\",\"level\":1}", result);
}
