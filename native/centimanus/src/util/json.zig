const std = @import("std");

pub fn appendQuoted(list: *std.ArrayList(u8), allocator: std.mem.Allocator, value: []const u8) !void {
    try list.append(allocator, '"');
    for (value) |ch| {
        switch (ch) {
            '"' => try list.appendSlice(allocator, "\\\""),
            '\\' => try list.appendSlice(allocator, "\\\\"),
            '\n' => try list.appendSlice(allocator, "\\n"),
            '\r' => try list.appendSlice(allocator, "\\r"),
            '\t' => try list.appendSlice(allocator, "\\t"),
            else => {
                if (ch < 0x20) {
                    var buf: [6]u8 = undefined;
                    _ = try std.fmt.bufPrint(&buf, "\\u{x:0>4}", .{@as(u16, ch)});
                    try list.appendSlice(allocator, &buf);
                } else {
                    try list.append(allocator, ch);
                }
            },
        }
    }
    try list.append(allocator, '"');
}
