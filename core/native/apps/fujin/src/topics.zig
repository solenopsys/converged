//! Topic matching and the subscription table — the routing half of the event
//! bus.
//!
//! A topic is dot-separated and carries the entity it is about:
//! `order.updated.42`. A pattern matches it segment by segment, where `*`
//! stands for exactly one segment and `>` for the whole remaining tail. That is
//! the NATS convention, and it is the reason the bus needs no second mechanism
//! for "this session is looking at order 42": that interest is the pattern
//! `order.*.42`, matched by the same code that routes `order.>` to a workflow
//! engine.
//!
//! A subscription belongs to the connection that made it. There is no lease and
//! no expiry: Fujin already learns about a dead ZMQ peer from ROUTER_NOTIFY and
//! about a closed browser socket from the read loop, and both paths drop the
//! owner's rows here. What the table must never become is a registry of durable
//! business subscribers — "which of a million users watches order 42" is
//! application data with an index behind it, not routing state.

const std = @import("std");

/// Who holds a subscription. A peer is addressed by its Fujin target; a browser
/// session by the hub client id, because that is what survives a reconnect
/// under the same user.
pub const Owner = union(enum) {
    peer: []const u8,
    session: u64,

    pub fn eql(self: Owner, other: Owner) bool {
        return switch (self) {
            .peer => |target| switch (other) {
                .peer => |candidate| std.mem.eql(u8, target, candidate),
                .session => false,
            },
            .session => |id| switch (other) {
                .peer => false,
                .session => |candidate| id == candidate,
            },
        };
    }
};

pub const Error = error{
    PatternEmpty,
    PatternSegmentEmpty,
    PatternTailNotLast,
    TopicEmpty,
    TopicSegmentEmpty,
    TopicWildcard,
    TopicCharInvalid,
    SubscriptionLimitReached,
};

/// True when `pattern` selects `topic`.
///
/// `>` is only meaningful as the last segment and swallows everything left,
/// including nothing at all — `order.>` matches `order.created` and
/// `order.created.42`, but not the bare `order`, which has no tail to swallow.
pub fn matches(pattern: []const u8, topic: []const u8) bool {
    var pattern_parts = std.mem.splitScalar(u8, pattern, '.');
    var topic_parts = std.mem.splitScalar(u8, topic, '.');
    while (pattern_parts.next()) |segment| {
        if (std.mem.eql(u8, segment, ">")) return topic_parts.next() != null;
        const actual = topic_parts.next() orelse return false;
        if (std.mem.eql(u8, segment, "*")) continue;
        if (!std.mem.eql(u8, segment, actual)) return false;
    }
    return topic_parts.next() == null;
}

/// Rejects a pattern that could never behave: an empty segment silently
/// matches nothing, and a `>` in the middle reads as "tail" to whoever wrote it
/// while matching one segment here.
pub fn validatePattern(pattern: []const u8) Error!void {
    if (pattern.len == 0) return Error.PatternEmpty;
    var parts = std.mem.splitScalar(u8, pattern, '.');
    var previous_was_tail = false;
    while (parts.next()) |segment| {
        if (previous_was_tail) return Error.PatternTailNotLast;
        if (segment.len == 0) return Error.PatternSegmentEmpty;
        if (std.mem.eql(u8, segment, ">")) previous_was_tail = true;
    }
}

/// A published topic is a name, not a query: wildcards in it would let a
/// publisher address every subscriber of a family at once.
pub fn validateTopic(topic: []const u8) Error!void {
    if (topic.len == 0) return Error.TopicEmpty;
    var parts = std.mem.splitScalar(u8, topic, '.');
    while (parts.next()) |segment| {
        if (segment.len == 0) return Error.TopicSegmentEmpty;
        for (segment) |char| {
            if (char == '*' or char == '>') return Error.TopicWildcard;
            const ok = std.ascii.isAlphanumeric(char) or char == '_' or char == '-' or char == ':' or char == '@';
            if (!ok) return Error.TopicCharInvalid;
        }
    }
}

/// Live subscriptions, one row per (owner, pattern).
pub const Table = struct {
    allocator: std.mem.Allocator,
    entries: std.ArrayList(Entry) = .empty,
    /// Ceiling on rows so a client cannot subscribe the process out of memory.
    max_entries: usize,
    mutex: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,

    const Entry = struct {
        /// Owned copy for a peer; empty for a session.
        target: []u8,
        client_id: u64,
        is_session: bool,
        pattern: []u8,

        fn owner(self: Entry) Owner {
            return if (self.is_session) .{ .session = self.client_id } else .{ .peer = self.target };
        }
    };

    pub fn init(allocator: std.mem.Allocator, max_entries: usize) Table {
        return .{ .allocator = allocator, .max_entries = max_entries };
    }

    pub fn deinit(self: *Table) void {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        for (self.entries.items) |entry| {
            self.allocator.free(entry.target);
            self.allocator.free(entry.pattern);
        }
        self.entries.deinit(self.allocator);
        self.* = undefined;
    }

    /// Idempotent: subscribing twice to the same pattern is one row, so a
    /// client that re-subscribes after a reconnect cannot grow the table.
    pub fn add(self: *Table, owner: Owner, pattern: []const u8) !void {
        try validatePattern(pattern);
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        for (self.entries.items) |entry| {
            if (entry.owner().eql(owner) and std.mem.eql(u8, entry.pattern, pattern)) return;
        }
        if (self.entries.items.len >= self.max_entries) return Error.SubscriptionLimitReached;

        const target = try self.allocator.dupe(u8, switch (owner) {
            .peer => |name| name,
            .session => "",
        });
        errdefer self.allocator.free(target);
        const pattern_copy = try self.allocator.dupe(u8, pattern);
        errdefer self.allocator.free(pattern_copy);
        try self.entries.append(self.allocator, .{
            .target = target,
            .client_id = switch (owner) {
                .peer => 0,
                .session => |id| id,
            },
            .is_session = owner == .session,
            .pattern = pattern_copy,
        });
    }

    pub fn remove(self: *Table, owner: Owner, pattern: []const u8) void {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        var index: usize = 0;
        while (index < self.entries.items.len) {
            const entry = self.entries.items[index];
            if (entry.owner().eql(owner) and std.mem.eql(u8, entry.pattern, pattern)) {
                self.freeAt(index);
                continue;
            }
            index += 1;
        }
    }

    /// Called when a connection goes away. This is the only expiry the table
    /// has, and it is the reason it needs no timer.
    pub fn removeOwner(self: *Table, owner: Owner) void {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        var index: usize = 0;
        while (index < self.entries.items.len) {
            if (self.entries.items[index].owner().eql(owner)) {
                self.freeAt(index);
                continue;
            }
            index += 1;
        }
    }

    /// Distinct peer targets whose patterns select `topic`. Owned by the
    /// caller: the table's own storage may move on the next subscribe.
    pub fn peersFor(self: *Table, allocator: std.mem.Allocator, topic: []const u8) ![][]u8 {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        var targets: std.ArrayList([]u8) = .empty;
        errdefer {
            for (targets.items) |item| allocator.free(item);
            targets.deinit(allocator);
        }
        for (self.entries.items) |entry| {
            if (entry.is_session) continue;
            if (!matches(entry.pattern, topic)) continue;
            var seen = false;
            for (targets.items) |existing| {
                if (std.mem.eql(u8, existing, entry.target)) seen = true;
            }
            if (seen) continue;
            try targets.append(allocator, try allocator.dupe(u8, entry.target));
        }
        return targets.toOwnedSlice(allocator);
    }

    /// Distinct session ids whose patterns select `topic`.
    pub fn sessionsFor(self: *Table, allocator: std.mem.Allocator, topic: []const u8) ![]u64 {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        var ids: std.ArrayList(u64) = .empty;
        errdefer ids.deinit(allocator);
        for (self.entries.items) |entry| {
            if (!entry.is_session) continue;
            if (!matches(entry.pattern, topic)) continue;
            var seen = false;
            for (ids.items) |existing| {
                if (existing == entry.client_id) seen = true;
            }
            if (seen) continue;
            try ids.append(allocator, entry.client_id);
        }
        return ids.toOwnedSlice(allocator);
    }

    /// The owner's own patterns, for the reply to subscribe/unsubscribe.
    pub fn patternsJson(self: *Table, allocator: std.mem.Allocator, owner: Owner) ![]u8 {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        var out: std.Io.Writer.Allocating = .init(allocator);
        errdefer out.deinit();
        const writer = &out.writer;
        try writer.writeAll("{\"patterns\":[");
        var first = true;
        for (self.entries.items) |entry| {
            if (!entry.owner().eql(owner)) continue;
            if (!first) try writer.writeByte(',');
            first = false;
            const encoded = try std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = entry.pattern }, .{});
            defer allocator.free(encoded);
            try writer.writeAll(encoded);
        }
        try writer.writeAll("]}");
        return out.toOwnedSlice();
    }

    /// Every live subscription, grouped by owner, for the admin surface.
    pub fn snapshotJson(self: *Table, allocator: std.mem.Allocator) ![]u8 {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        var out: std.Io.Writer.Allocating = .init(allocator);
        errdefer out.deinit();
        const writer = &out.writer;
        try writer.writeByte('[');
        var written: usize = 0;
        for (self.entries.items, 0..) |entry, index| {
            var duplicate = false;
            for (self.entries.items[0..index]) |earlier| {
                if (earlier.owner().eql(entry.owner())) duplicate = true;
            }
            if (duplicate) continue;
            if (written > 0) try writer.writeByte(',');
            written += 1;

            var owner_buffer: [64]u8 = undefined;
            const owner_name = if (entry.is_session)
                try std.fmt.bufPrint(&owner_buffer, "session:{d}", .{entry.client_id})
            else
                try std.fmt.allocPrint(allocator, "peer:{s}", .{entry.target});
            defer if (!entry.is_session) allocator.free(owner_name);
            const owner_json = try std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = owner_name }, .{});
            defer allocator.free(owner_json);

            try writer.print("{{\"owner\":{s},\"patterns\":[", .{owner_json});
            var first = true;
            for (self.entries.items) |candidate| {
                if (!candidate.owner().eql(entry.owner())) continue;
                if (!first) try writer.writeByte(',');
                first = false;
                const encoded = try std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = candidate.pattern }, .{});
                defer allocator.free(encoded);
                try writer.writeAll(encoded);
            }
            try writer.writeAll("]}");
        }
        try writer.writeByte(']');
        return out.toOwnedSlice();
    }

    pub fn count(self: *Table) usize {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        return self.entries.items.len;
    }

    fn freeAt(self: *Table, index: usize) void {
        const entry = self.entries.orderedRemove(index);
        self.allocator.free(entry.target);
        self.allocator.free(entry.pattern);
    }
};

test "a pattern matches segment by segment" {
    try std.testing.expect(matches("order.created", "order.created"));
    try std.testing.expect(!matches("order.created", "order.updated"));
    try std.testing.expect(!matches("order.created", "order.created.42"));
}

test "one star stands for exactly one segment" {
    try std.testing.expect(matches("order.*.42", "order.updated.42"));
    try std.testing.expect(!matches("order.*.42", "order.42"));
    try std.testing.expect(!matches("order.*.42", "order.updated.status.42"));
}

test "a tail swallows the rest but needs something to swallow" {
    try std.testing.expect(matches("order.>", "order.created"));
    try std.testing.expect(matches("order.>", "order.created.42"));
    try std.testing.expect(!matches("order.>", "order"));
    try std.testing.expect(!matches("order.>", "invoice.created"));
}

test "malformed patterns and topics are refused" {
    try std.testing.expectError(Error.PatternEmpty, validatePattern(""));
    try std.testing.expectError(Error.PatternSegmentEmpty, validatePattern("order..created"));
    try std.testing.expectError(Error.PatternTailNotLast, validatePattern("order.>.42"));
    try validatePattern("order.*.>");
    try std.testing.expectError(Error.TopicWildcard, validateTopic("order.*"));
    try std.testing.expectError(Error.TopicSegmentEmpty, validateTopic("order..created"));
    try std.testing.expectError(Error.TopicCharInvalid, validateTopic("order created"));
    try validateTopic("webhook.stripe.evt_01H");
}

test "subscriptions are per owner and idempotent" {
    var table = Table.init(std.testing.allocator, 16);
    defer table.deinit();
    try table.add(.{ .peer = "centimanus" }, "order.>");
    try table.add(.{ .peer = "centimanus" }, "order.>");
    try table.add(.{ .session = 7 }, "order.*.42");
    try std.testing.expectEqual(@as(usize, 2), table.count());

    const peers = try table.peersFor(std.testing.allocator, "order.updated.42");
    defer {
        for (peers) |item| std.testing.allocator.free(item);
        std.testing.allocator.free(peers);
    }
    try std.testing.expectEqual(@as(usize, 1), peers.len);
    try std.testing.expectEqualStrings("centimanus", peers[0]);

    const sessions = try table.sessionsFor(std.testing.allocator, "order.updated.42");
    defer std.testing.allocator.free(sessions);
    try std.testing.expectEqual(@as(usize, 1), sessions.len);
    try std.testing.expectEqual(@as(u64, 7), sessions[0]);
}

test "a session that goes away leaves nothing behind" {
    var table = Table.init(std.testing.allocator, 16);
    defer table.deinit();
    try table.add(.{ .session = 7 }, "order.>");
    try table.add(.{ .peer = "services" }, "order.>");
    table.removeOwner(.{ .session = 7 });

    const sessions = try table.sessionsFor(std.testing.allocator, "order.created");
    defer std.testing.allocator.free(sessions);
    try std.testing.expectEqual(@as(usize, 0), sessions.len);
    try std.testing.expectEqual(@as(usize, 1), table.count());
}

test "the table refuses to grow past its ceiling" {
    var table = Table.init(std.testing.allocator, 1);
    defer table.deinit();
    try table.add(.{ .peer = "services" }, "a.>");
    try std.testing.expectError(Error.SubscriptionLimitReached, table.add(.{ .peer = "services" }, "b.>"));
}
