//! Triggers: the bus half of the workflow runtime.
//!
//! An operator configures "when this topic appears, run that workflow" in
//! rp-dag. This file pulls that list, tells Fujin which topics it therefore
//! cares about, and matches an arriving event against it.
//!
//! The whole set lives in memory on purpose. Triggers are system configuration
//! — tens of rows, not millions — so matching an event is a loop over an array
//! rather than a query, and an event with no trigger behind it costs nothing.
//! The durable, high-cardinality question ("which of a million users watches
//! order 42") is a different problem and belongs to whichever service answers
//! it, not here.
//!
//! Subscriptions are connection state in Fujin: they vanish when this process
//! disconnects and are re-sent on every refresh, so a Fujin restart repairs
//! itself within one cycle without anyone tracking leases.

const std = @import("std");
const Engine = @import("engine.zig").Engine;

/// How often the trigger list is re-read and the subscription re-sent. Also the
/// worst-case delay before a newly configured trigger starts firing.
const refresh_ms: i64 = 30_000;

pub const Trigger = struct {
    id: []const u8,
    name: []const u8,
    topic: []const u8,
    script: []const u8,
    params_json: []const u8,
};

/// True when a bus pattern selects a topic.
///
/// Deliberately a copy of Fujin's matcher rather than a shared module: the two
/// live in different binaries with no common dependency, and the rule is four
/// lines. Both are covered by their own tests, and the shape of the rule —
/// `*` is one segment, `>` is the tail — is fixed by the wire contract.
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

pub const Registry = struct {
    gpa: std.mem.Allocator,
    engine: *Engine,
    scope: []const u8,
    arena: std.heap.ArenaAllocator,
    entries: []Trigger = &.{},
    mutex: std.Io.Mutex = .init,

    pub fn init(gpa: std.mem.Allocator, engine: *Engine, scope: []const u8) Registry {
        return .{
            .gpa = gpa,
            .engine = engine,
            .scope = scope,
            .arena = std.heap.ArenaAllocator.init(gpa),
        };
    }

    pub fn deinit(self: *Registry) void {
        self.arena.deinit();
        self.* = undefined;
    }

    /// Background loop: refresh the list, re-subscribe, sleep.
    pub fn run(self: *Registry) void {
        std.debug.print("centimanus: trigger loop started\n", .{});
        while (true) {
            self.refresh() catch |err| {
                std.debug.print("centimanus: trigger refresh failed: {s} (retrying)\n", .{@errorName(err)});
            };
            self.engine.io.sleep(std.Io.Duration.fromMilliseconds(refresh_ms), .awake) catch {};
        }
    }

    /// Copies of every matching trigger, in the caller's allocator. Copied
    /// rather than borrowed because a workflow run takes as long as it takes,
    /// and the next refresh must not be blocked by it or free it underneath.
    pub fn matching(self: *Registry, allocator: std.mem.Allocator, topic: []const u8) ![]Trigger {
        self.mutex.lockUncancelable(self.engine.io);
        defer self.mutex.unlock(self.engine.io);
        var found: std.ArrayList(Trigger) = .empty;
        errdefer found.deinit(allocator);
        for (self.entries) |entry| {
            if (!matches(entry.topic, topic)) continue;
            try found.append(allocator, .{
                .id = try allocator.dupe(u8, entry.id),
                .name = try allocator.dupe(u8, entry.name),
                .topic = try allocator.dupe(u8, entry.topic),
                .script = try allocator.dupe(u8, entry.script),
                .params_json = try allocator.dupe(u8, entry.params_json),
            });
        }
        return found.toOwnedSlice(allocator);
    }

    fn refresh(self: *Registry) !void {
        var next = std.heap.ArenaAllocator.init(self.gpa);
        errdefer next.deinit();
        const allocator = next.allocator();

        const reply = try self.engine.callService(allocator, "dag", "activeTriggers", "{}", self.scope);
        if (!reply.ok()) return error.TriggersUnavailable;
        const entries = try parse(allocator, reply.body);

        {
            self.mutex.lockUncancelable(self.engine.io);
            defer self.mutex.unlock(self.engine.io);
            // Swap first, free after: a match running right now borrows nothing
            // from the old arena, because `matching` hands out copies.
            const previous = self.arena;
            self.arena = next;
            self.entries = entries;
            previous.deinit();
        }

        try self.subscribe(entries);
    }

    /// One `subscribe` with every topic this runtime cares about. Sent on every
    /// refresh: Fujin de-duplicates, so a repeat is free, and a Fujin that
    /// restarted gets its table back without being asked.
    fn subscribe(self: *Registry, entries: []const Trigger) !void {
        var arena = std.heap.ArenaAllocator.init(self.gpa);
        defer arena.deinit();
        const allocator = arena.allocator();

        var out: std.Io.Writer.Allocating = .init(allocator);
        const writer = &out.writer;
        try writer.writeAll("{\"patterns\":[");
        var written: usize = 0;
        for (entries, 0..) |entry, index| {
            var duplicate = false;
            for (entries[0..index]) |earlier| {
                if (std.mem.eql(u8, earlier.topic, entry.topic)) duplicate = true;
            }
            if (duplicate) continue;
            if (written > 0) try writer.writeByte(',');
            written += 1;
            const encoded = try std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = entry.topic }, .{});
            try writer.writeAll(encoded);
        }
        try writer.writeAll("]}");

        const body = try out.toOwnedSlice();
        const reply = try self.engine.callServiceAt(allocator, "fujin", "bus", "subscribe", body, self.scope);
        if (!reply.ok()) return error.SubscribeRejected;
        std.debug.print("centimanus: subscribed to {d} topic(s)\n", .{written});
    }
};

fn parse(allocator: std.mem.Allocator, body: []const u8) ![]Trigger {
    const parsed = try std.json.parseFromSliceLeaky(std.json.Value, allocator, body, .{});
    const items = switch (parsed) {
        .array => |value| value.items,
        .object => |object| switch (object.get("items") orelse return error.TriggersInvalid) {
            .array => |value| value.items,
            else => return error.TriggersInvalid,
        },
        else => return error.TriggersInvalid,
    };

    var list: std.ArrayList(Trigger) = .empty;
    for (items) |item| {
        const object = switch (item) {
            .object => |value| value,
            else => continue,
        };
        const topic = stringField(object, "topic") orelse continue;
        const script = stringField(object, "script") orelse continue;
        const params = object.get("params") orelse std.json.Value{ .object = .empty };
        try list.append(allocator, .{
            .id = try allocator.dupe(u8, stringField(object, "id") orelse ""),
            .name = try allocator.dupe(u8, stringField(object, "name") orelse topic),
            .topic = try allocator.dupe(u8, topic),
            .script = try allocator.dupe(u8, script),
            .params_json = try std.json.Stringify.valueAlloc(allocator, params, .{}),
        });
    }
    return list.toOwnedSlice(allocator);
}

fn stringField(object: std.json.ObjectMap, key: []const u8) ?[]const u8 {
    const value = object.get(key) orelse return null;
    return switch (value) {
        .string => |text| text,
        else => null,
    };
}

test "a trigger topic pattern matches the way the bus does" {
    try std.testing.expect(matches("order.paid.42", "order.paid.42"));
    try std.testing.expect(matches("order.*.42", "order.paid.42"));
    try std.testing.expect(matches("order.>", "order.paid.42"));
    try std.testing.expect(!matches("order.>", "order"));
    try std.testing.expect(!matches("order.paid.42", "order.paid.43"));
}

test "the trigger list survives rows it does not understand" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const body =
        \\{"items":[
        \\{"id":"1","name":"paid","topic":"order.paid.>","script":"wf-invoice.js","params":{"x":1}},
        \\{"id":"2","name":"broken"},
        \\{"id":"3","topic":"mail.received.>","script":"wf-mail.js"}
        \\]}
    ;
    const entries = try parse(arena.allocator(), body);
    try std.testing.expectEqual(@as(usize, 2), entries.len);
    try std.testing.expectEqualStrings("order.paid.>", entries[0].topic);
    try std.testing.expectEqualStrings("{\"x\":1}", entries[0].params_json);
    // A row with no name of its own is listed under its topic, not dropped.
    try std.testing.expectEqualStrings("mail.received.>", entries[1].name);
    try std.testing.expectEqualStrings("{}", entries[1].params_json);
}
