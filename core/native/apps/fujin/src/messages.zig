const std = @import("std");

/// Bounded diagnostic journal exposed by the protected Fujin admin NRPC API.
/// Entries deliberately
/// contain route metadata only; payloads never leave the transport path.
///
/// Storage is a fixed-size ring of pre-encoded JSON entries:
///
///   - recording is O(1) — the oldest slot is overwritten in place, there is
///     no per-append memmove of the whole journal;
///   - a snapshot walks only the requested tail (default 100) newest-first and
///     concatenates it into a single exactly-sized allocation, so keeping a
///     deep journal costs nothing on the common read.
///
/// The lock is held only for the ring walk and the byte copy: entries are
/// encoded by the caller's thread before it is taken.
pub const Journal = struct {
    allocator: std.mem.Allocator,
    /// Ring storage. `slots.len` is the capacity and never changes; only the
    /// first `len` slots reachable from `head` hold live entries.
    slots: [][]u8,
    /// Index of the slot the next entry goes into.
    head: usize = 0,
    /// Live entries, saturating at `slots.len`.
    len: usize = 0,
    /// Total entries ever recorded, also the id handed to each entry. Lets a
    /// reader tell "nothing happened" from "the journal wrapped".
    recorded: u64 = 0,
    mutex: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,

    /// Default number of entries returned by `fujin.messages` and `fujin.logs`.
    pub const default_limit: usize = 100;

    pub fn init(allocator: std.mem.Allocator, capacity: usize) !Journal {
        std.debug.assert(capacity > 0);
        return .{ .allocator = allocator, .slots = try allocator.alloc([]u8, capacity) };
    }

    pub fn deinit(self: *Journal) void {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        for (0..self.len) |offset| self.allocator.free(self.entryAt(offset));
        self.allocator.free(self.slots);
        self.* = undefined;
    }

    pub fn recordEnvelope(
        self: *Journal,
        transport_name: []const u8,
        action: []const u8,
        env: anytype,
        payload_bytes: usize,
    ) void {
        const Entry = struct {
            seq: u64,
            ts: i64,
            transport: []const u8,
            action: []const u8,
            kind: []const u8,
            target: []const u8,
            service: []const u8,
            from: []const u8,
            method: []const u8,
            requestId: []const u8,
            payloadBytes: usize,
        };
        const encoded = std.json.Stringify.valueAlloc(self.allocator, Entry{
            .seq = self.nextSeq(),
            .ts = milliTimestamp(),
            .transport = transport_name,
            .action = action,
            .kind = @tagName(env.kind),
            .target = env.to.target,
            .service = env.to.service,
            .from = env.from.target,
            .method = env.method,
            .requestId = env.request_id,
            .payloadBytes = payload_bytes,
        }, .{}) catch return;
        self.append(encoded);
    }

    pub fn recordWebSocket(
        self: *Journal,
        action: []const u8,
        client_id: u64,
        target: []const u8,
        service: []const u8,
        method: []const u8,
        request_id: []const u8,
        payload_bytes: usize,
    ) void {
        const Entry = struct {
            seq: u64,
            ts: i64,
            transport: []const u8 = "websocket",
            action: []const u8,
            clientId: u64,
            target: []const u8,
            service: []const u8,
            method: []const u8,
            requestId: []const u8,
            payloadBytes: usize,
        };
        const encoded = std.json.Stringify.valueAlloc(self.allocator, Entry{
            .seq = self.nextSeq(),
            .ts = milliTimestamp(),
            .action = action,
            .clientId = client_id,
            .target = target,
            .service = service,
            .method = method,
            .requestId = request_id,
            .payloadBytes = payload_bytes,
        }, .{}) catch return;
        self.append(encoded);
    }

    /// Newest-first snapshot of at most `limit` entries — `messages[0]` is the
    /// most recent thing fujin saw. `count` is what came back, `stored` how
    /// much the ring currently holds and `recorded` how many entries ever
    /// passed through it.
    pub fn snapshotJson(self: *Journal, limit: usize) ![]u8 {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);

        const count = @min(limit, self.len);
        var entry_bytes: usize = 0;
        for (0..count) |offset| entry_bytes += self.entryAt(offset).len;

        // header (bounded by four u64 decimals) + entries + separators + tail.
        const header_bound = 96;
        var out: std.Io.Writer.Allocating = try .initCapacity(self.allocator, header_bound + entry_bytes + count + 3);
        errdefer out.deinit();
        const writer = &out.writer;

        try writer.print(
            "{{\"count\":{d},\"stored\":{d},\"capacity\":{d},\"recorded\":{d},\"messages\":[",
            .{ count, self.len, self.slots.len, self.recorded },
        );
        for (0..count) |offset| {
            if (offset > 0) try writer.writeByte(',');
            try writer.writeAll(self.entryAt(offset));
        }
        try writer.writeAll("]}\n");
        return out.toOwnedSlice();
    }

    /// `offset` counts back from the newest entry: 0 is the last one recorded.
    /// Caller holds the lock.
    fn entryAt(self: *const Journal, offset: usize) []u8 {
        std.debug.assert(offset < self.len);
        const ring = self.slots.len;
        return self.slots[(self.head + ring - 1 - offset) % ring];
    }

    fn nextSeq(self: *Journal) u64 {
        return @atomicRmw(u64, &self.recorded, .Add, 1, .monotonic);
    }

    fn append(self: *Journal, entry: []u8) void {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        if (self.len == self.slots.len) {
            self.allocator.free(self.slots[self.head]);
        } else {
            self.len += 1;
        }
        self.slots[self.head] = entry;
        self.head = (self.head + 1) % self.slots.len;
    }
};

/// Wall-clock milliseconds; std.time.milliTimestamp is gone in Zig 0.16.
fn milliTimestamp() i64 {
    var ts: std.c.timespec = undefined;
    _ = std.c.clock_gettime(.REALTIME, &ts);
    return ts.sec * std.time.ms_per_s + @divFloor(ts.nsec, std.time.ns_per_ms);
}

// ── Tests ────────────────────────────────────────────────────────────────────

const testing = std.testing;

fn record(journal: *Journal, method: []const u8) void {
    journal.recordWebSocket("routed", 1, "ms:logs", "logs", method, "req", 0);
}

fn parsed(allocator: std.mem.Allocator, body: []const u8) !std.json.Parsed(std.json.Value) {
    return std.json.parseFromSlice(std.json.Value, allocator, body, .{});
}

test "snapshot returns the newest entries first" {
    var journal = try Journal.init(testing.allocator, 8);
    defer journal.deinit();

    record(&journal, "first");
    record(&journal, "second");
    record(&journal, "third");

    const body = try journal.snapshotJson(Journal.default_limit);
    defer testing.allocator.free(body);
    var doc = try parsed(testing.allocator, body);
    defer doc.deinit();

    const messages = doc.value.object.get("messages").?.array;
    try testing.expectEqual(@as(usize, 3), messages.items.len);
    try testing.expectEqualStrings("third", messages.items[0].object.get("method").?.string);
    try testing.expectEqualStrings("second", messages.items[1].object.get("method").?.string);
    try testing.expectEqualStrings("first", messages.items[2].object.get("method").?.string);
    try testing.expectEqual(@as(i64, 3), doc.value.object.get("recorded").?.integer);
}

test "snapshot honours the limit and reports what it left behind" {
    var journal = try Journal.init(testing.allocator, 16);
    defer journal.deinit();

    for (0..10) |index| {
        var buffer: [8]u8 = undefined;
        record(&journal, try std.fmt.bufPrint(&buffer, "m{d}", .{index}));
    }

    const body = try journal.snapshotJson(3);
    defer testing.allocator.free(body);
    var doc = try parsed(testing.allocator, body);
    defer doc.deinit();

    const messages = doc.value.object.get("messages").?.array;
    try testing.expectEqual(@as(usize, 3), messages.items.len);
    try testing.expectEqualStrings("m9", messages.items[0].object.get("method").?.string);
    try testing.expectEqualStrings("m7", messages.items[2].object.get("method").?.string);
    try testing.expectEqual(@as(i64, 3), doc.value.object.get("count").?.integer);
    try testing.expectEqual(@as(i64, 10), doc.value.object.get("stored").?.integer);
    try testing.expectEqual(@as(i64, 16), doc.value.object.get("capacity").?.integer);
}

test "a limit above what is stored returns everything, not padding" {
    var journal = try Journal.init(testing.allocator, 4);
    defer journal.deinit();

    record(&journal, "only");

    const body = try journal.snapshotJson(1000);
    defer testing.allocator.free(body);
    var doc = try parsed(testing.allocator, body);
    defer doc.deinit();

    try testing.expectEqual(@as(usize, 1), doc.value.object.get("messages").?.array.items.len);
    try testing.expectEqual(@as(i64, 1), doc.value.object.get("count").?.integer);
}

test "the ring drops the oldest entries and stays ordered after wrapping" {
    var journal = try Journal.init(testing.allocator, 3);
    defer journal.deinit();

    for (0..7) |index| {
        var buffer: [8]u8 = undefined;
        record(&journal, try std.fmt.bufPrint(&buffer, "m{d}", .{index}));
    }

    const body = try journal.snapshotJson(Journal.default_limit);
    defer testing.allocator.free(body);
    var doc = try parsed(testing.allocator, body);
    defer doc.deinit();

    const messages = doc.value.object.get("messages").?.array;
    try testing.expectEqual(@as(usize, 3), messages.items.len);
    try testing.expectEqualStrings("m6", messages.items[0].object.get("method").?.string);
    try testing.expectEqualStrings("m5", messages.items[1].object.get("method").?.string);
    try testing.expectEqualStrings("m4", messages.items[2].object.get("method").?.string);
    // Sequence ids survive the wrap, so a reader can see 4 entries were lost.
    try testing.expectEqual(@as(i64, 6), messages.items[0].object.get("seq").?.integer);
    try testing.expectEqual(@as(i64, 7), doc.value.object.get("recorded").?.integer);
}

test "an empty journal answers with an empty array" {
    var journal = try Journal.init(testing.allocator, 4);
    defer journal.deinit();

    const body = try journal.snapshotJson(Journal.default_limit);
    defer testing.allocator.free(body);

    try testing.expectEqualStrings(
        "{\"count\":0,\"stored\":0,\"capacity\":4,\"recorded\":0,\"messages\":[]}\n",
        body,
    );
}
