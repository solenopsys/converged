//! Minimal RESP client so a processor moves heavy model/gcode bytes straight
//! through Valkey (the storage-integrated cache) instead of the messaging
//! channel. A task carries small params plus cache refs (cacheKeys); the
//! processor GETs the bytes to a temp file for the native library and SETs any
//! produced file back, returning a cache ref. Values are raw bytes —
//! byte-compatible with back-core's `cache.getBytes`/`setBytes` (a plain
//! `SET key <bytes>` + `EXPIRE`).
//!
//! One short-lived connection per call: task volume is low (a couple of blobs
//! per estimate) and this keeps the client free of pooling/lifecycle state.

const std = @import("std");
const net = std.Io.net;

var g_key_seq: std.atomic.Value(u64) = .init(0);

pub const Client = struct {
    host: []const u8,
    port: u16,
    key_prefix: []const u8,
    ttl_seconds: u32,
    /// Namespace segment in a generated key, so two processors sharing one
    /// Valkey never collide on the same sequence number.
    owner: []const u8,

    /// Reads `<PREFIX>_VALKEY_*` first, then the platform-wide `VALKEY_*` the
    /// ptah operator injects into every pod.
    pub fn fromEnv(environ: *const std.process.Environ.Map, prefix: []const u8, owner: []const u8) Client {
        return .{
            .host = env(environ, prefix, "VALKEY_HOST") orelse "127.0.0.1",
            .port = parseU16(env(environ, prefix, "VALKEY_PORT")) orelse 6379,
            .key_prefix = env(environ, prefix, "VALKEY_KEY_PREFIX") orelse "cache",
            .ttl_seconds = parseU32(env(environ, prefix, "VALKEY_TTL_SECONDS")) orelse 1800,
            .owner = owner,
        };
    }

    fn connect(self: *const Client, io: std.Io) !net.Stream {
        const host = try net.HostName.init(self.host);
        return host.connect(io, self.port, .{ .mode = .stream });
    }

    /// GET `key` and stream the bulk bytes into `path`. Returns false when the
    /// key is missing (RESP nil), so the caller can fail the task cleanly.
    pub fn getToFile(self: *const Client, io: std.Io, key: []const u8, path: []const u8) !bool {
        var stream = try self.connect(io);
        defer stream.close(io);

        var wbuf: [512]u8 = undefined;
        var sw = stream.writer(io, &wbuf);
        try writeCommand(&sw.interface, &.{ "GET", key });
        try sw.interface.flush();

        var rbuf: [64 * 1024]u8 = undefined;
        var sr = stream.reader(io, &rbuf);
        const reader = &sr.interface;

        const header = try reader.takeDelimiterInclusive('\n');
        if (header.len < 1 or header[0] != '$') return error.ValkeyProtocol;
        const n = try std.fmt.parseInt(i64, std.mem.trimEnd(u8, header[1..], "\r\n"), 10);
        if (n < 0) return false; // nil
        const len: usize = @intCast(n);

        var file = try std.Io.Dir.cwd().createFile(io, path, .{});
        defer file.close(io);
        var fwbuf: [64 * 1024]u8 = undefined;
        var fw = file.writer(io, &fwbuf);
        _ = try reader.stream(&fw.interface, .limited(len));
        try fw.interface.flush();

        _ = try reader.take(2); // trailing \r\n
        return true;
    }

    /// SET the bytes under a fresh namespaced key with the cache TTL and return
    /// that key (the cacheKey the caller hands back to the workflow).
    pub fn putBytes(self: *const Client, io: std.Io, alloc: std.mem.Allocator, bytes: []const u8) ![]u8 {
        const seq = g_key_seq.fetchAdd(1, .monotonic);
        const key = try std.fmt.allocPrint(alloc, "{s}:{s}:{x}", .{ self.key_prefix, self.owner, seq });

        var stream = try self.connect(io);
        defer stream.close(io);

        var wbuf: [512]u8 = undefined;
        var sw = stream.writer(io, &wbuf);
        try writeCommand(&sw.interface, &.{ "SET", key, bytes });
        var ttlbuf: [16]u8 = undefined;
        const ttl = try std.fmt.bufPrint(&ttlbuf, "{d}", .{self.ttl_seconds});
        try writeCommand(&sw.interface, &.{ "EXPIRE", key, ttl });
        try sw.interface.flush();

        var rbuf: [256]u8 = undefined;
        var sr = stream.reader(io, &rbuf);
        const reader = &sr.interface;
        const set_line = try reader.takeDelimiterInclusive('\n');
        if (set_line.len == 0 or set_line[0] != '+') return error.ValkeyError;
        _ = try reader.takeDelimiterInclusive('\n'); // EXPIRE reply (:1)
        return key;
    }
};

fn writeCommand(w: *std.Io.Writer, args: []const []const u8) !void {
    try w.print("*{d}\r\n", .{args.len});
    for (args) |a| {
        try w.print("${d}\r\n", .{a.len});
        try w.writeAll(a);
        try w.writeAll("\r\n");
    }
}

/// `<PREFIX>_<NAME>` overrides the shared `<NAME>`; the lookup key is built on
/// the stack, the returned value belongs to the environment map.
pub fn env(environ: *const std.process.Environ.Map, prefix: []const u8, name: []const u8) ?[]const u8 {
    var buffer: [128]u8 = undefined;
    const key = std.fmt.bufPrint(&buffer, "{s}_{s}", .{ prefix, name }) catch return environ.get(name);
    return environ.get(key) orelse environ.get(name);
}

fn parseU16(text: ?[]const u8) ?u16 {
    const value = text orelse return null;
    return std.fmt.parseInt(u16, std.mem.trim(u8, value, " \t\r\n"), 10) catch null;
}

fn parseU32(text: ?[]const u8) ?u32 {
    const value = text orelse return null;
    return std.fmt.parseInt(u32, std.mem.trim(u8, value, " \t\r\n"), 10) catch null;
}
