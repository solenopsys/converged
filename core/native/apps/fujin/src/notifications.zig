const std = @import("std");

/// Replay buffer for user push notifications.
///
/// A notification is delivered to the live WebSocket sessions of its recipient
/// and, separately, kept here so a session that was not connected at that
/// moment — a reload, a second tab opened later, a login a minute after the
/// order landed — can still show it. This is a *replay* window, not durable
/// history: it lives in memory and a Fujin restart drops it. Anything that has
/// to survive that belongs in a repository behind `services`.
///
/// Storage is one fixed ring shared by every recipient rather than a map of
/// per-user rings. A single ring bounds total memory no matter how many users
/// connect, which is the property that matters for a router; the cost is that
/// a read filters the ring instead of indexing into it, and a burst addressed
/// to one user can age out another's entries early.
pub const Store = struct {
    allocator: std.mem.Allocator,
    slots: []Entry,
    /// Index of the slot the next entry goes into.
    head: usize = 0,
    /// Live entries, saturating at `slots.len`.
    len: usize = 0,
    mutex: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,

    /// Default number of messages returned by `pushrouter.history`.
    pub const default_limit: usize = 50;

    pub const Entry = struct {
        scope: []u8,
        user: []u8,
        json: []u8,
    };

    pub fn init(allocator: std.mem.Allocator, capacity: usize) !Store {
        std.debug.assert(capacity > 0);
        return .{ .allocator = allocator, .slots = try allocator.alloc(Entry, capacity) };
    }

    pub fn deinit(self: *Store) void {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        for (0..self.len) |offset| self.free(self.entryAt(offset));
        self.allocator.free(self.slots);
        self.* = undefined;
    }

    /// Records one already-encoded message object. An empty `user` marks a
    /// message addressed to the whole tenant, which every session in that
    /// scope replays.
    pub fn record(self: *Store, scope: []const u8, user: []const u8, json: []const u8) !void {
        const entry = Entry{
            .scope = try self.allocator.dupe(u8, scope),
            .user = try self.allocator.dupe(u8, user),
            .json = try self.allocator.dupe(u8, json),
        };
        errdefer self.free(entry);

        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        if (self.len == self.slots.len) {
            self.free(self.slots[self.head]);
        } else {
            self.len += 1;
        }
        self.slots[self.head] = entry;
        self.head = (self.head + 1) % self.slots.len;
    }

    /// Newest-first replay for one subject: its own messages plus the tenant
    /// broadcasts it was entitled to see. The caller's identity comes from a
    /// verified token, never from a request parameter, so there is no way to
    /// ask for somebody else's feed.
    pub fn historyJson(self: *Store, scope: []const u8, user: []const u8, limit: usize) ![]u8 {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);

        var out: std.Io.Writer.Allocating = .init(self.allocator);
        errdefer out.deinit();
        const writer = &out.writer;

        var matched: usize = 0;
        // Two passes over the same tail would need the count up front; instead
        // the body is written first into a scratch list of slices.
        var picked: std.ArrayList([]const u8) = .empty;
        defer picked.deinit(self.allocator);
        for (0..self.len) |offset| {
            if (matched == limit) break;
            const entry = self.entryAt(offset);
            if (!std.mem.eql(u8, entry.scope, scope)) continue;
            if (entry.user.len != 0 and !std.mem.eql(u8, entry.user, user)) continue;
            try picked.append(self.allocator, entry.json);
            matched += 1;
        }

        try writer.print("{{\"count\":{d},\"messages\":[", .{matched});
        for (picked.items, 0..) |json, index| {
            if (index > 0) try writer.writeByte(',');
            try writer.writeAll(json);
        }
        try writer.writeAll("]}");
        return out.toOwnedSlice();
    }

    /// `offset` counts back from the newest entry: 0 is the last one recorded.
    /// Caller holds the lock.
    fn entryAt(self: *const Store, offset: usize) Entry {
        std.debug.assert(offset < self.len);
        const ring = self.slots.len;
        return self.slots[(self.head + ring - 1 - offset) % ring];
    }

    fn free(self: *Store, entry: Entry) void {
        self.allocator.free(entry.scope);
        self.allocator.free(entry.user);
        self.allocator.free(entry.json);
    }
};

// ── Tests ────────────────────────────────────────────────────────────────────

const testing = std.testing;

fn parsed(body: []const u8) !std.json.Parsed(std.json.Value) {
    return std.json.parseFromSlice(std.json.Value, testing.allocator, body, .{});
}

test "history replays a subject's own messages newest first" {
    var store = try Store.init(testing.allocator, 8);
    defer store.deinit();

    try store.record("club", "alice", "{\"id\":\"a1\"}");
    try store.record("club", "bob", "{\"id\":\"b1\"}");
    try store.record("club", "alice", "{\"id\":\"a2\"}");

    const body = try store.historyJson("club", "alice", Store.default_limit);
    defer testing.allocator.free(body);
    var doc = try parsed(body);
    defer doc.deinit();

    const messages = doc.value.object.get("messages").?.array;
    try testing.expectEqual(@as(usize, 2), messages.items.len);
    try testing.expectEqualStrings("a2", messages.items[0].object.get("id").?.string);
    try testing.expectEqualStrings("a1", messages.items[1].object.get("id").?.string);
}

test "a tenant broadcast replays for every subject in that scope only" {
    var store = try Store.init(testing.allocator, 8);
    defer store.deinit();

    try store.record("club", "", "{\"id\":\"all\"}");
    try store.record("other", "", "{\"id\":\"foreign\"}");

    for ([_][]const u8{ "alice", "bob" }) |subject| {
        const body = try store.historyJson("club", subject, Store.default_limit);
        defer testing.allocator.free(body);
        var doc = try parsed(body);
        defer doc.deinit();
        const messages = doc.value.object.get("messages").?.array;
        try testing.expectEqual(@as(usize, 1), messages.items.len);
        try testing.expectEqualStrings("all", messages.items[0].object.get("id").?.string);
    }
}

test "history honours the limit and the ring drops the oldest entries" {
    var store = try Store.init(testing.allocator, 3);
    defer store.deinit();

    for (0..5) |index| {
        var buffer: [32]u8 = undefined;
        try store.record("club", "alice", try std.fmt.bufPrint(&buffer, "{{\"id\":\"m{d}\"}}", .{index}));
    }

    const body = try store.historyJson("club", "alice", 2);
    defer testing.allocator.free(body);
    var doc = try parsed(body);
    defer doc.deinit();

    const messages = doc.value.object.get("messages").?.array;
    try testing.expectEqual(@as(usize, 2), messages.items.len);
    try testing.expectEqualStrings("m4", messages.items[0].object.get("id").?.string);
    try testing.expectEqualStrings("m3", messages.items[1].object.get("id").?.string);
}

test "an empty replay window answers with an empty array" {
    var store = try Store.init(testing.allocator, 4);
    defer store.deinit();

    const body = try store.historyJson("club", "alice", Store.default_limit);
    defer testing.allocator.free(body);
    try testing.expectEqualStrings("{\"count\":0,\"messages\":[]}", body);
}
