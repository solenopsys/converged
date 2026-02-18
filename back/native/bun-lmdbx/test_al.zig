const std = @import("std");
pub fn main() void {
    var list = std.ArrayList(u8).init(std.heap.c_allocator);
    list.deinit();
}
