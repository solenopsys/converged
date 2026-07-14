//! State store — dumb key/value over opaque bytes. The RT never interprets the
//! values (the JS prelude owns all JSON); Zig just reads and writes them. All
//! durable workflow state (task memoisation, exec status, vars) lives here.
//!
//! Backend chosen explicitly via RT_STATE_BACKEND (no silent default):
//!   * memory — process-local map (local runs / tests)
//!   * valkey — RESP GET/SET against Valkey (production; storage-integrated)
//!
//! Calls are already serialised by the engine's run lock, so no locking here.

const std = @import("std");
const env = @import("env.zig");
const net = std.Io.net;

pub const Backend = enum { memory, valkey };

pub const StateStore = struct {
    gpa: std.mem.Allocator,
    backend: Backend,
    map: std.StringHashMapUnmanaged([]u8) = .{},
    vk_host: []const u8 = "",
    vk_port: u16 = 0,

    pub fn init(gpa: std.mem.Allocator) !StateStore {
        const name = try env.require("RT_STATE_BACKEND");
        if (std.mem.eql(u8, name, "memory")) {
            return .{ .gpa = gpa, .backend = .memory };
        } else if (std.mem.eql(u8, name, "valkey")) {
            return .{
                .gpa = gpa,
                .backend = .valkey,
                .vk_host = try env.require("VALKEY_HOST"),
                .vk_port = try env.requirePort("VALKEY_PORT"),
            };
        }
        std.debug.print("centimanus: RT_STATE_BACKEND='{s}' is not memory|valkey\n", .{name});
        return error.MissingEnv;
    }

    pub fn deinit(self: *StateStore) void {
        if (self.backend == .memory) {
            var it = self.map.iterator();
            while (it.next()) |e| {
                self.gpa.free(e.key_ptr.*);
                self.gpa.free(e.value_ptr.*);
            }
            self.map.deinit(self.gpa);
        }
    }

    /// `alloc`-owned copy of the value, or null if absent.
    pub fn get(self: *StateStore, io: std.Io, alloc: std.mem.Allocator, key: []const u8) !?[]u8 {
        switch (self.backend) {
            .memory => {
                const v = self.map.get(key) orelse return null;
                return try alloc.dupe(u8, v);
            },
            .valkey => return self.valkeyGet(io, alloc, key),
        }
    }

    pub fn set(self: *StateStore, io: std.Io, alloc: std.mem.Allocator, key: []const u8, value: []const u8) !void {
        switch (self.backend) {
            .memory => {
                const gop = try self.map.getOrPut(self.gpa, key);
                if (gop.found_existing) {
                    self.gpa.free(gop.value_ptr.*);
                } else {
                    gop.key_ptr.* = try self.gpa.dupe(u8, key);
                }
                gop.value_ptr.* = try self.gpa.dupe(u8, value);
            },
            .valkey => try self.valkeySet(io, alloc, key, value),
        }
    }

    // ---- Valkey RESP (one connection per call; small values) ---------------

    fn valkeyConnect(self: *StateStore, io: std.Io) !net.Stream {
        const host = try net.HostName.init(self.vk_host);
        return host.connect(io, self.vk_port, .{ .mode = .stream });
    }

    fn valkeyGet(self: *StateStore, io: std.Io, alloc: std.mem.Allocator, key: []const u8) !?[]u8 {
        var stream = try self.valkeyConnect(io);
        defer stream.close(io);

        var wbuf: [512]u8 = undefined;
        var sw = stream.writer(io, &wbuf);
        try writeCommand(&sw.interface, &.{ "GET", key });
        try sw.interface.flush();

        var rbuf: [1 << 16]u8 = undefined;
        var sr = stream.reader(io, &rbuf);
        return readBulk(&sr.interface, alloc);
    }

    fn valkeySet(self: *StateStore, io: std.Io, alloc: std.mem.Allocator, key: []const u8, value: []const u8) !void {
        _ = alloc;
        var stream = try self.valkeyConnect(io);
        defer stream.close(io);

        var wbuf: [512]u8 = undefined;
        var sw = stream.writer(io, &wbuf);
        try writeCommand(&sw.interface, &.{ "SET", key, value });
        try sw.interface.flush();

        var rbuf: [256]u8 = undefined;
        var sr = stream.reader(io, &rbuf);
        const line = try sr.interface.takeDelimiterInclusive('\n');
        if (line.len == 0 or line[0] != '+') return error.ValkeyError;
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

fn readBulk(r: *std.Io.Reader, alloc: std.mem.Allocator) !?[]u8 {
    const header = try r.takeDelimiterInclusive('\n');
    if (header.len < 1) return error.ValkeyError;
    switch (header[0]) {
        '$' => {
            const n = try std.fmt.parseInt(i64, std.mem.trimEnd(u8, header[1..], "\r\n"), 10);
            if (n < 0) return null;
            const len: usize = @intCast(n);
            const data = try r.take(len);
            const out = try alloc.dupe(u8, data);
            _ = try r.take(2); // trailing \r\n
            return out;
        },
        else => return error.ValkeyError,
    }
}
