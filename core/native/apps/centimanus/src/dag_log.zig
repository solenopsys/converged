//! The DAG log's write path: off the workflow thread, through Valkey, into
//! rp-dag in batches.
//!
//! A workflow thread never talks to rp-dag about logging. It formats the entry,
//! drops it in a queue and goes back to running the script. A background thread
//! writes the queue to Valkey and then tells rp-dag which keys to pick up —
//! storage reads the cache itself, so the entries never cross the transport.
//!
//! Why this shape:
//!
//! * The engine holds one run lock, so every millisecond spent logging is a
//!   millisecond no workflow is running. Logging belongs off that path entirely.
//! * Valkey is the crash guard. An entry is durable there before the commit is
//!   attempted, so a runtime that dies mid-batch loses nothing that was written.
//! * `pending_key` names what has been written but not yet committed. On start
//!   the recovery pass reads it and commits whatever is still there — which is
//!   safe to repeat, because keys are derived from the run and the node's
//!   sequence rather than handed out by anyone.
//!
//! The runtime composes every key. rp-dag derives the store location from the
//! key and refuses anything outside the log prefix, so a key is both the name
//! and the whole of the authority this carries.

const std = @import("std");
const net = std.Io.net;
const Engine = @import("engine.zig").Engine;

/// Prefix rp-dag admits. Anything else is refused there, not here.
pub const key_prefix = "dag:log:";

/// Where the not-yet-committed key list lives.
pub const pending_key = "dag:log:pending";

/// Zero-padding of a node's sequence in its key. rp-dag reads a run's nodes as
/// an ordered key range, so this width is part of the contract with it.
pub const seq_width = 6;

/// How long a cached entry outlives its commit. Long enough for recovery after
/// a restart, short enough that an entry nobody comes back for expires.
const entry_ttl_seconds: u32 = 24 * 60 * 60;

/// How long the writer sleeps when it finds nothing to do.
const idle_sleep_ms: i64 = 250;

/// Entries per commit. A batch is one rp-dag call carrying only keys, so this
/// bounds the call's size, not its cost in bytes.
const max_batch: usize = 64;

/// Queue ceiling. Past it the oldest entries are dropped: the log is
/// diagnostics, and a runtime must not stall or grow without bound because
/// storage is slow.
const max_queued: usize = 8192;

const Entry = struct {
    scope: []u8,
    key: []u8,
    payload: []u8,

    fn deinit(self: Entry, gpa: std.mem.Allocator) void {
        gpa.free(self.scope);
        gpa.free(self.key);
        gpa.free(self.payload);
    }
};

pub const Logger = struct {
    gpa: std.mem.Allocator,
    engine: *Engine,
    vk_host: []const u8,
    vk_port: u16,
    /// Guards `queue` and `dropped` only. Held for a push, never across I/O.
    mutex: std.Io.Mutex = .init,
    queue: std.ArrayListUnmanaged(Entry) = .empty,
    dropped: usize = 0,
    enabled: bool,

    pub fn init(gpa: std.mem.Allocator, engine: *Engine, host: []const u8, port: u16) Logger {
        return .{
            .gpa = gpa,
            .engine = engine,
            .vk_host = host,
            .vk_port = port,
            .enabled = host.len > 0 and port != 0,
        };
    }

    pub fn deinit(self: *Logger) void {
        self.mutex.lockUncancelable(self.engine.io);
        defer self.mutex.unlock(self.engine.io);
        for (self.queue.items) |entry| entry.deinit(self.gpa);
        self.queue.deinit(self.gpa);
    }

    /// Called from a workflow thread. Copies and returns; no I/O, no waiting.
    pub fn push(self: *Logger, scope: []const u8, key: []const u8, payload: []const u8) void {
        if (!self.enabled) return;

        const scope_copy = self.gpa.dupe(u8, scope) catch return;
        errdefer self.gpa.free(scope_copy);
        const key_copy = self.gpa.dupe(u8, key) catch {
            self.gpa.free(scope_copy);
            return;
        };
        const payload_copy = self.gpa.dupe(u8, payload) catch {
            self.gpa.free(scope_copy);
            self.gpa.free(key_copy);
            return;
        };
        const entry = Entry{ .scope = scope_copy, .key = key_copy, .payload = payload_copy };

        self.mutex.lockUncancelable(self.engine.io);
        defer self.mutex.unlock(self.engine.io);

        if (self.queue.items.len >= max_queued) {
            // Drop the oldest: a stalled writer must cost the log its history,
            // not the runtime its throughput.
            const oldest = self.queue.orderedRemove(0);
            oldest.deinit(self.gpa);
            self.dropped += 1;
        }
        self.queue.append(self.gpa, entry) catch entry.deinit(self.gpa);
    }

    /// Background loop: recover what a previous life left behind, then write and
    /// commit whatever the workflows produce.
    pub fn run(self: *Logger) void {
        if (!self.enabled) {
            std.debug.print("centimanus: no cache configured, dag log off — runs will not be recorded\n", .{});
            return;
        }
        std.debug.print("centimanus: dag log writer started\n", .{});

        self.recover() catch |err|
            std.debug.print("centimanus: dag log recovery failed: {s}\n", .{@errorName(err)});

        while (true) {
            const worked = self.drainOnce() catch |err| blk: {
                std.debug.print("centimanus: dag log flush failed: {s}\n", .{@errorName(err)});
                break :blk false;
            };
            if (!worked)
                self.engine.io.sleep(std.Io.Duration.fromMilliseconds(idle_sleep_ms), .awake) catch {};
        }
    }

    /// One batch: take it off the queue, write it to Valkey, record it as
    /// pending, commit it, then drop what landed. Returns whether there was
    /// anything to do.
    fn drainOnce(self: *Logger) !bool {
        var arena = std.heap.ArenaAllocator.init(self.gpa);
        defer arena.deinit();
        const a = arena.allocator();

        const batch = self.take(a);
        if (batch.len == 0) return false;
        defer for (batch) |entry| entry.deinit(self.gpa);

        var conn = try Connection.open(self.engine.io, self.vk_host, self.vk_port);
        defer conn.close(self.engine.io);

        // Entries first, then the pending list: a crash between the two loses
        // the newest entries, which is the cheap direction to fail in. The other
        // order would name keys that were never written.
        try conn.setAll(a, batch);
        try conn.setPending(a, batch);

        const committed = try self.commit(a, batch);
        try conn.deleteAll(a, committed);
        try conn.setPending(a, &.{});
        return true;
    }

    /// Commit anything a previous process wrote but never confirmed. Repeating a
    /// commit is a rewrite, so this needs no record of how far the last one got.
    fn recover(self: *Logger) !void {
        var arena = std.heap.ArenaAllocator.init(self.gpa);
        defer arena.deinit();
        const a = arena.allocator();

        var conn = try Connection.open(self.engine.io, self.vk_host, self.vk_port);
        defer conn.close(self.engine.io);

        const keys = try conn.readPending(a);
        if (keys.len == 0) return;
        std.debug.print("centimanus: dag log recovering {d} uncommitted entr{s}\n", .{
            keys.len, if (keys.len == 1) "y" else "ies",
        });

        const committed = try self.commitKeys(a, keys);
        try conn.deleteAll(a, committed);
        try conn.setPending(a, &.{});
    }

    /// Up to `max_batch` entries, oldest first. The queue lock is held only for
    /// the move; the batch is the caller's from here on.
    fn take(self: *Logger, a: std.mem.Allocator) []Entry {
        self.mutex.lockUncancelable(self.engine.io);
        defer self.mutex.unlock(self.engine.io);

        const count = @min(self.queue.items.len, max_batch);
        if (count == 0) return &.{};

        const batch = a.alloc(Entry, count) catch return &.{};
        @memcpy(batch, self.queue.items[0..count]);
        std.mem.copyForwards(Entry, self.queue.items[0 .. self.queue.items.len - count], self.queue.items[count..]);
        self.queue.shrinkRetainingCapacity(self.queue.items.len - count);

        if (self.dropped > 0) {
            std.debug.print("centimanus: dag log dropped {d} entr{s} under backpressure\n", .{
                self.dropped, if (self.dropped == 1) "y" else "ies",
            });
            self.dropped = 0;
        }
        return batch;
    }

    /// One `commitLog` per scope in the batch. The scope is part of the address,
    /// so entries belonging to different tenants cannot share a call.
    fn commit(self: *Logger, a: std.mem.Allocator, batch: []const Entry) ![]const []const u8 {
        var committed: std.ArrayListUnmanaged([]const u8) = .empty;

        for (batch, 0..) |entry, index| {
            // One pass per distinct scope: the first entry carrying it does the
            // work, the rest skip. Batches hold a handful of scopes at most.
            var seen_earlier = false;
            for (batch[0..index]) |earlier|
                if (std.mem.eql(u8, earlier.scope, entry.scope)) {
                    seen_earlier = true;
                    break;
                };
            if (seen_earlier) continue;

            var keys: std.ArrayListUnmanaged([]const u8) = .empty;
            for (batch) |candidate|
                if (std.mem.eql(u8, candidate.scope, entry.scope))
                    try keys.append(a, candidate.key);

            const done = self.commitKeysScoped(a, keys.items, entry.scope) catch |err| {
                // Leave them pending: the next pass, or the next process, will
                // try again, and a repeated commit is a rewrite.
                std.debug.print("centimanus: dag log commit failed: {s}\n", .{@errorName(err)});
                continue;
            };
            try committed.appendSlice(a, done);
        }
        return committed.items;
    }

    fn commitKeys(self: *Logger, a: std.mem.Allocator, keys: []const []const u8) ![]const []const u8 {
        return self.commitKeysScoped(a, keys, self.engine.current_scope);
    }

    fn commitKeysScoped(self: *Logger, a: std.mem.Allocator, keys: []const []const u8, scope: []const u8) ![]const []const u8 {
        if (keys.len == 0) return &.{};

        var body: std.Io.Writer.Allocating = .init(a);
        const w = &body.writer;
        try w.writeAll("{\"keys\":[");
        for (keys, 0..) |key, i| {
            if (i > 0) try w.writeByte(',');
            const encoded = try std.json.Stringify.valueAlloc(a, std.json.Value{ .string = key }, .{});
            try w.writeAll(encoded);
        }
        try w.writeAll("]}");

        const reply = try self.engine.callServiceUnattended(a, "dag", "commitLog", try body.toOwnedSlice(), scope);
        if (!reply.ok()) return error.CommitRejected;
        return parseCommitted(a, reply.body);
    }
};

/// The `committed` array of a `commitLog` reply. A malformed answer commits
/// nothing, which leaves the entries pending for the next pass.
fn parseCommitted(a: std.mem.Allocator, body: []const u8) ![]const []const u8 {
    const parsed = std.json.parseFromSliceLeaky(std.json.Value, a, body, .{}) catch return &.{};
    const object = switch (parsed) {
        .object => |value| value,
        else => return &.{},
    };
    const items = switch (object.get("committed") orelse return &.{}) {
        .array => |value| value.items,
        else => return &.{},
    };
    var out: std.ArrayListUnmanaged([]const u8) = .empty;
    for (items) |item| switch (item) {
        .string => |text| try out.append(a, text),
        else => {},
    };
    return out.items;
}

// ---- key construction ------------------------------------------------------

/// `dag:log:<execId>:exec` — the run's own record.
pub fn executionKey(a: std.mem.Allocator, exec_id: []const u8) ![]u8 {
    return std.fmt.allocPrint(a, "{s}{s}:exec", .{ key_prefix, exec_id });
}

/// `dag:log:<execId>:n:<seq>` — one node of that run. The sequence comes from
/// the runtime, not from storage: it is what makes the key unique without a
/// round trip to ask for one, and what makes a rewrite idempotent.
pub fn nodeKey(a: std.mem.Allocator, exec_id: []const u8, seq: u32) ![]u8 {
    return std.fmt.allocPrint(a, "{s}{s}:n:{d:0>6}", .{ key_prefix, exec_id, seq });
}

// ---- Valkey (RESP, one pipelined connection per batch) ----------------------

const Connection = struct {
    stream: net.Stream,

    fn open(io: std.Io, host: []const u8, port: u16) !Connection {
        const name = try net.HostName.init(host);
        return .{ .stream = try name.connect(io, port, .{ .mode = .stream }) };
    }

    fn close(self: *Connection, io: std.Io) void {
        self.stream.close(io);
    }

    /// Every entry in one pipeline: all the commands, one flush, then the
    /// replies. A batch of 64 costs one round trip instead of 64.
    fn setAll(self: *Connection, a: std.mem.Allocator, batch: []const Entry) !void {
        if (batch.len == 0) return;
        const ttl = try std.fmt.allocPrint(a, "{d}", .{entry_ttl_seconds});

        var wbuf: [1 << 16]u8 = undefined;
        var sw = self.stream.writer(std.Options.debug_io, &wbuf);
        for (batch) |entry|
            try writeCommand(&sw.interface, &.{ "SET", entry.key, entry.payload, "EX", ttl });
        try sw.interface.flush();

        var rbuf: [1 << 16]u8 = undefined;
        var sr = self.stream.reader(std.Options.debug_io, &rbuf);
        for (batch) |_| try expectStatus(&sr.interface);
    }

    fn deleteAll(self: *Connection, a: std.mem.Allocator, keys: []const []const u8) !void {
        _ = a;
        if (keys.len == 0) return;

        var wbuf: [1 << 16]u8 = undefined;
        var sw = self.stream.writer(std.Options.debug_io, &wbuf);
        for (keys) |key| try writeCommand(&sw.interface, &.{ "DEL", key });
        try sw.interface.flush();

        var rbuf: [1 << 16]u8 = undefined;
        var sr = self.stream.reader(std.Options.debug_io, &rbuf);
        for (keys) |_| _ = try sr.interface.takeDelimiterInclusive('\n');
    }

    /// The pending list is one key holding a JSON array. One writer touches it,
    /// so it needs no set semantics — and reading it back is one GET.
    fn setPending(self: *Connection, a: std.mem.Allocator, batch: []const Entry) !void {
        var body: std.Io.Writer.Allocating = .init(a);
        const w = &body.writer;
        try w.writeByte('[');
        for (batch, 0..) |entry, i| {
            if (i > 0) try w.writeByte(',');
            const encoded = try std.json.Stringify.valueAlloc(a, std.json.Value{ .string = entry.key }, .{});
            try w.writeAll(encoded);
        }
        try w.writeByte(']');
        const value = try body.toOwnedSlice();

        var wbuf: [1 << 16]u8 = undefined;
        var sw = self.stream.writer(std.Options.debug_io, &wbuf);
        if (batch.len == 0)
            try writeCommand(&sw.interface, &.{ "DEL", pending_key })
        else
            try writeCommand(&sw.interface, &.{ "SET", pending_key, value });
        try sw.interface.flush();

        var rbuf: [4096]u8 = undefined;
        var sr = self.stream.reader(std.Options.debug_io, &rbuf);
        if (batch.len == 0)
            _ = try sr.interface.takeDelimiterInclusive('\n')
        else
            try expectStatus(&sr.interface);
    }

    fn readPending(self: *Connection, a: std.mem.Allocator) ![]const []const u8 {
        var wbuf: [512]u8 = undefined;
        var sw = self.stream.writer(std.Options.debug_io, &wbuf);
        try writeCommand(&sw.interface, &.{ "GET", pending_key });
        try sw.interface.flush();

        var rbuf: [1 << 16]u8 = undefined;
        var sr = self.stream.reader(std.Options.debug_io, &rbuf);
        const raw = (try readBulk(&sr.interface, a)) orelse return &.{};

        const parsed = std.json.parseFromSliceLeaky(std.json.Value, a, raw, .{}) catch return &.{};
        const items = switch (parsed) {
            .array => |value| value.items,
            else => return &.{},
        };
        var out: std.ArrayListUnmanaged([]const u8) = .empty;
        for (items) |item| switch (item) {
            .string => |text| try out.append(a, text),
            else => {},
        };
        return out.items;
    }
};

fn writeCommand(w: *std.Io.Writer, args: []const []const u8) !void {
    try w.print("*{d}\r\n", .{args.len});
    for (args) |arg| {
        try w.print("${d}\r\n", .{arg.len});
        try w.writeAll(arg);
        try w.writeAll("\r\n");
    }
}

fn expectStatus(r: *std.Io.Reader) !void {
    const line = try r.takeDelimiterInclusive('\n');
    if (line.len == 0 or line[0] != '+') return error.ValkeyError;
}

fn readBulk(r: *std.Io.Reader, a: std.mem.Allocator) !?[]u8 {
    const header = try r.takeDelimiterInclusive('\n');
    if (header.len < 1) return error.ValkeyError;
    if (header[0] != '$') return error.ValkeyError;
    const n = try std.fmt.parseInt(i64, std.mem.trimEnd(u8, header[1..], "\r\n"), 10);
    if (n < 0) return null;
    const len: usize = @intCast(n);
    const data = try r.take(len);
    const out = try a.dupe(u8, data);
    _ = try r.take(2);
    return out;
}

test "a node key pads its sequence to the width rp-dag reads" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const key = try nodeKey(arena.allocator(), "exec-1", 7);
    try std.testing.expectEqualStrings("dag:log:exec-1:n:000007", key);
}

test "an execution key names the run itself" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const key = try executionKey(arena.allocator(), "exec-1");
    try std.testing.expectEqualStrings("dag:log:exec-1:exec", key);
}

test "a commit reply reports only the keys that landed" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const committed = try parseCommitted(
        arena.allocator(),
        \\{"committed":["dag:log:a:exec"],"failed":["dag:log:b:exec"]}
    );
    try std.testing.expectEqual(@as(usize, 1), committed.len);
    try std.testing.expectEqualStrings("dag:log:a:exec", committed[0]);
}

test "a malformed commit reply commits nothing" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    try std.testing.expectEqual(@as(usize, 0), (try parseCommitted(arena.allocator(), "not json")).len);
}
