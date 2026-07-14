// Time helpers. std.time.timestamp/nanoTimestamp/sleep removed in Zig 0.16.
const std = @import("std");

pub fn nanoTimestamp() i64 {
    var ts: std.c.timespec = undefined;
    _ = std.c.clock_gettime(.REALTIME, &ts);
    return ts.sec * std.time.ns_per_s + ts.nsec;
}

pub fn timestamp() i64 {
    var ts: std.c.timespec = undefined;
    _ = std.c.clock_gettime(.REALTIME, &ts);
    return ts.sec;
}

pub fn sleepMs(ms: u64) void {
    const io = std.Options.debug_io;
    std.Io.sleep(io, std.Io.Duration.fromMilliseconds(@intCast(ms)), .awake) catch {};
}

pub fn sleepNs(ns: u64) void {
    const io = std.Options.debug_io;
    std.Io.sleep(io, std.Io.Duration.fromNanoseconds(@intCast(ns)), .awake) catch {};
}
