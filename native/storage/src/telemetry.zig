const std = @import("std");

pub const Telemetry = struct {
    start_ns: i128,
    op_count: u64,
    bytes_read: u64,
    bytes_written: u64,

    pub fn begin() Telemetry {
        return .{
            .start_ns = std.time.nanoTimestamp(),
            .op_count = 0,
            .bytes_read = 0,
            .bytes_written = 0,
        };
    }

    pub fn addRead(self: *Telemetry, bytes: u64) void {
        self.bytes_read += bytes;
        self.op_count += 1;
    }

    pub fn addWrite(self: *Telemetry, bytes: u64) void {
        self.bytes_written += bytes;
        self.op_count += 1;
    }

    pub fn elapsedUs(self: *const Telemetry) i64 {
        const now = std.time.nanoTimestamp();
        return @intCast(@divFloor(now - self.start_ns, 1000));
    }

    pub fn durationUs(self: *const Telemetry) u64 {
        const us = self.elapsedUs();
        return if (us > 0) @intCast(us) else 0;
    }

    pub fn writeJson(self: *const Telemetry, writer: anytype) !void {
        try writer.print(
            \\{{"elapsed_us":{},"op_count":{},"bytes_read":{},"bytes_written":{}}}
        , .{ self.elapsedUs(), self.op_count, self.bytes_read, self.bytes_written });
    }
};
