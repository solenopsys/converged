pub fn main(init: std.process.Init) !void {
    return @import("tools/dictation_smoke.zig").main(init);
}

const std = @import("std");
