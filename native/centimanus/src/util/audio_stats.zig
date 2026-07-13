// Per-direction audio throughput counter. Thread-safe (called from
// libdatachannel C++ threads and the RTP recv thread). No timer thread:
// the data path itself triggers a report on the first packet after each
// ~1s window, so an idle stream simply stops reporting.
const std = @import("std");
const clock = @import("clock.zig");

pub const AudioStats = struct {
    packets: std.atomic.Value(u64) = .init(0),
    bytes: std.atomic.Value(u64) = .init(0),
    window_start_ns: std.atomic.Value(i64) = .init(0),

    pub fn add(self: *AudioStats, session_id: []const u8, dir: []const u8, len: usize) void {
        _ = self.packets.fetchAdd(1, .monotonic);
        _ = self.bytes.fetchAdd(len, .monotonic);

        const now = clock.nanoTimestamp();
        const start = self.window_start_ns.load(.monotonic);
        if (start == 0) {
            _ = self.window_start_ns.cmpxchgStrong(0, now, .monotonic, .monotonic);
            return;
        }
        const elapsed = now - start;
        if (elapsed < std.time.ns_per_s) return;
        // First thread to move the window does the reporting; others keep counting.
        if (self.window_start_ns.cmpxchgStrong(start, now, .monotonic, .monotonic) != null) return;

        const pkts = self.packets.swap(0, .monotonic);
        const byts = self.bytes.swap(0, .monotonic);
        const secs = @as(f64, @floatFromInt(elapsed)) / @as(f64, std.time.ns_per_s);
        const pkt_rate = @as(f64, @floatFromInt(pkts)) / secs;
        const kb_rate = @as(f64, @floatFromInt(byts)) / 1024.0 / secs;
        std.log.info("audio-stats [{s}] {s}: {d:.0} pkt/s, {d:.1} KB/s", .{ session_id, dir, pkt_rate, kb_rate });
    }
};
