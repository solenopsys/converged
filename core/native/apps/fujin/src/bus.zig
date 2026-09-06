//! `bus` — the business event service Fujin hosts on its own target.
//!
//! The fourth of Fujin's message streams. Service messaging answers a caller,
//! log ingest is one-way to storage, `pushrouter` addresses a person; this one
//! addresses nobody. A publisher states what happened, subscribers state which
//! topics they care about, and the two meet here.
//!
//! Written by hand rather than generated for the same reason `pushrouter` is:
//! `publish` and `subscribe` have to be callable by a browser *and* by a
//! backend service, which the generator's uniform `.user` policy cannot say.
//! Keep in sync with `modules/types/platform/bus.ts`.
//!
//! What this file does not do is decide *who* should care. A durable list of
//! interested people is application data with an index behind it; the bus knows
//! only the connections attached to it right now.

const std = @import("std");
const transport = @import("transport");
const topics = @import("topics.zig");
const Policy = @import("qjs_policy.zig").Policy;

pub const service = "bus";

pub const method_policies = [_]transport.auth.authorize.MethodPolicy{
    // `.any`: a browser publishing a UI fact and a service announcing a paid
    // order are the same operation. The permission still gates it.
    .{ .service = service, .method = "publish", .level = .any, .mode = .write },
    .{ .service = service, .method = "subscribe", .level = .any, .mode = .write },
    .{ .service = service, .method = "unsubscribe", .level = .any, .mode = .write },
    .{ .service = service, .method = "replay", .level = .internal, .mode = .read },
    .{ .service = service, .method = "subscriptions", .level = .user, .mode = .read },
};

pub fn policy(method: []const u8) ?transport.auth.authorize.MethodPolicy {
    for (method_policies) |entry| {
        if (std.mem.eql(u8, entry.method, method)) return entry;
    }
    return null;
}

/// Identity of the caller, taken from a verified token — never from the body.
pub const Caller = struct {
    scope: []const u8,
    user: []const u8,
    is_service: bool,
};

pub const Error = error{
    EventNameMissing,
    EventScopeMissing,
    EventScopeForbidden,
    EventBodyMissing,
    PatternsMissing,
};

/// One publish, resolved but not yet delivered.
///
/// Everything hangs off one arena: the fan-out lists, both encodings and the
/// journal row have exactly the same lifetime, and a single `deinit` is less
/// error-prone than seven `free`s on an error path that already has five
/// branches.
pub const Prepared = struct {
    arena: std.heap.ArenaAllocator,
    id: []const u8,
    topic: []const u8,
    scope: []const u8,
    /// Full event, for runtime peers and the journal.
    frame: []const u8,
    /// Id, topic and time only — what a browser session is allowed to learn.
    /// The data itself is refetched through the service that owns it, which is
    /// also the service that knows whether this session may see it.
    thin_frame: []const u8,
    peers: [][]u8,
    sessions: []u64,
    /// True when the deployment policy dropped the event.
    dropped: bool,

    pub fn deinit(self: *Prepared) void {
        self.arena.deinit();
        self.* = undefined;
    }
};

pub const Context = struct {
    allocator: std.mem.Allocator,
    table: *topics.Table,
    policy: *Policy,
};

/// Validates one publish and works out where it goes. Sending is the caller's
/// job: the router belongs to the transport loop and this function is also
/// reachable from the scheduler thread.
pub fn prepare(context: Context, caller: Caller, body: []const u8) !Prepared {
    var arena = std.heap.ArenaAllocator.init(context.allocator);
    errdefer arena.deinit();
    const allocator = arena.allocator();

    const parsed = try std.json.parseFromSlice(std.json.Value, allocator, body, .{});
    const input = eventArgument(parsed.value) orelse return Error.EventBodyMissing;

    const name = stringField(input, "name") orelse return Error.EventNameMissing;
    try topics.validateTopic(name);
    const scope = try resolveScope(caller, stringField(input, "scope") orelse "");

    var id_buffer: [26]u8 = undefined;
    const id = try allocator.dupe(u8, ulid(&id_buffer));
    const frame = try encode(allocator, .{
        .id = id,
        .name = name,
        .scope = scope,
        .actor = stringField(input, "actor") orelse caller.user,
        .at = milliTimestamp(),
        .input = input,
    });

    // The deployment's own JS sees the finished event, so a rule can suppress a
    // chatty source or reshape one without a rebuild.
    const shaped_owned = try context.policy.transform(frame);
    defer context.allocator.free(shaped_owned);
    const shaped = try allocator.dupe(u8, shaped_owned);
    if (isDropped(shaped)) {
        return .{
            .arena = arena,
            .id = id,
            .topic = try allocator.dupe(u8, name),
            .scope = try allocator.dupe(u8, scope),
            .frame = shaped,
            .thin_frame = "",
            .peers = &.{},
            .sessions = &.{},
            .dropped = true,
        };
    }

    // Routing follows the topic the policy left behind, not the one that came
    // in: a rule that renames an event must not deliver it under both names.
    const effective = effectiveTopic(allocator, shaped) orelse name;
    return .{
        .arena = arena,
        .id = id,
        .topic = try allocator.dupe(u8, effective),
        .scope = try allocator.dupe(u8, scope),
        .frame = shaped,
        .thin_frame = try encodeThin(allocator, id, effective, scope, milliTimestamp()),
        .peers = try context.table.peersFor(allocator, effective),
        .sessions = try context.table.sessionsFor(allocator, effective),
        .dropped = false,
    };
}

pub fn publishResponseJson(allocator: std.mem.Allocator, id: []const u8, peers: usize, sessions: usize) ![]u8 {
    return std.fmt.allocPrint(
        allocator,
        "{{\"id\":\"{s}\",\"peers\":{d},\"sessions\":{d}}}",
        .{ id, peers, sessions },
    );
}

/// Adds or removes this connection's patterns and answers with what it holds
/// afterwards, so a client never has to track the set itself.
pub fn subscribe(
    allocator: std.mem.Allocator,
    table: *topics.Table,
    owner: topics.Owner,
    body: []const u8,
    adding: bool,
) ![]u8 {
    var parsed = try std.json.parseFromSlice(std.json.Value, allocator, body, .{});
    defer parsed.deinit();
    const list = patternsArgument(parsed.value) orelse return Error.PatternsMissing;
    for (list) |item| {
        if (item != .string) continue;
        if (adding) try table.add(owner, item.string) else table.remove(owner, item.string);
    }
    return table.patternsJson(allocator, owner);
}

fn resolveScope(caller: Caller, requested: []const u8) ![]const u8 {
    if (!caller.is_service) {
        // A browser cannot publish into another tenant. Echoing its own scope
        // back is fine; naming a different one is refused rather than silently
        // corrected, so a mistaken caller finds out.
        if (requested.len > 0 and !std.mem.eql(u8, requested, caller.scope)) return Error.EventScopeForbidden;
        if (caller.scope.len == 0) return Error.EventScopeMissing;
        return caller.scope;
    }
    const scope = if (requested.len > 0) requested else caller.scope;
    if (scope.len == 0) return Error.EventScopeMissing;
    return scope;
}

const EventParts = struct {
    id: []const u8,
    name: []const u8,
    scope: []const u8,
    actor: []const u8,
    at: i64,
    input: std.json.ObjectMap,
};

fn encode(allocator: std.mem.Allocator, parts: EventParts) ![]u8 {
    var out: std.Io.Writer.Allocating = .init(allocator);
    errdefer out.deinit();
    const writer = &out.writer;

    try writer.print("{{\"type\":\"event\",\"id\":\"{s}\",\"at\":{d},", .{ parts.id, parts.at });
    try writeStringField(allocator, writer, "name", parts.name);
    try writer.writeByte(',');
    try writeStringField(allocator, writer, "scope", parts.scope);
    if (parts.actor.len > 0) {
        try writer.writeByte(',');
        try writeStringField(allocator, writer, "actor", parts.actor);
    }
    const source = stringField(parts.input, "source") orelse "service";
    try writer.writeByte(',');
    try writeStringField(allocator, writer, "source", source);

    for ([_][]const u8{ "correlationId", "dedupKey", "payload" }) |key| {
        const value = parts.input.get(key) orelse continue;
        if (value == .null) continue;
        const encoded = try std.json.Stringify.valueAlloc(allocator, value, .{});
        defer allocator.free(encoded);
        try writer.writeByte(',');
        try writeStringField(allocator, writer, key, null);
        try writer.writeAll(encoded);
    }

    try writer.writeByte('}');
    return out.toOwnedSlice();
}

/// What a browser gets: enough to know something happened and to go ask.
fn encodeThin(allocator: std.mem.Allocator, id: []const u8, name: []const u8, scope: []const u8, at: i64) ![]u8 {
    var out: std.Io.Writer.Allocating = .init(allocator);
    errdefer out.deinit();
    const writer = &out.writer;
    try writer.print("{{\"type\":\"event\",\"id\":\"{s}\",\"at\":{d},", .{ id, at });
    try writeStringField(allocator, writer, "name", name);
    try writer.writeByte(',');
    try writeStringField(allocator, writer, "scope", scope);
    try writer.writeByte('}');
    return out.toOwnedSlice();
}

fn effectiveTopic(allocator: std.mem.Allocator, frame: []const u8) ?[]const u8 {
    const parsed = std.json.parseFromSlice(std.json.Value, allocator, frame, .{}) catch return null;
    if (parsed.value != .object) return null;
    const name = stringField(parsed.value.object, "name") orelse return null;
    topics.validateTopic(name) catch return null;
    return name;
}

/// NRPC wraps arguments in an object keyed by parameter name; a hand-rolled
/// caller may well post the event on its own. Accept both.
fn eventArgument(value: std.json.Value) ?std.json.ObjectMap {
    if (value != .object) return null;
    const event = value.object.get("event") orelse return value.object;
    return if (event == .object) event.object else null;
}

fn patternsArgument(value: std.json.Value) ?[]std.json.Value {
    switch (value) {
        .array => |items| return items.items,
        .object => |object| {
            const patterns = object.get("patterns") orelse return null;
            return if (patterns == .array) patterns.array.items else null;
        },
        else => return null,
    }
}

/// A policy that returns nothing, `null` or a non-object has refused the event.
fn isDropped(shaped: []const u8) bool {
    const trimmed = std.mem.trim(u8, shaped, " \t\r\n");
    return trimmed.len == 0 or std.mem.eql(u8, trimmed, "null") or trimmed[0] != '{';
}

fn writeStringField(allocator: std.mem.Allocator, writer: *std.Io.Writer, key: []const u8, value: ?[]const u8) !void {
    const key_json = try std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = key }, .{});
    defer allocator.free(key_json);
    try writer.writeAll(key_json);
    try writer.writeByte(':');
    if (value) |text| {
        const value_json = try std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = text }, .{});
        defer allocator.free(value_json);
        try writer.writeAll(value_json);
    }
}

fn stringField(object: std.json.ObjectMap, key: []const u8) ?[]const u8 {
    const value = object.get(key) orelse return null;
    return switch (value) {
        .string => |text| text,
        else => null,
    };
}

const crockford = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/// ULID, the same shape the repositories generate. Lexicographic order is
/// chronological order, which is what makes an id usable as a replay cursor.
pub fn ulid(buffer: *[26]u8) []const u8 {
    var timestamp: u64 = @intCast(milliTimestamp());
    var index: usize = 10;
    while (index > 0) {
        index -= 1;
        buffer[index] = crockford[@intCast(timestamp & 0x1f)];
        timestamp >>= 5;
    }
    var random: [16]u8 = undefined;
    std.Options.debug_io.random(&random);
    for (random, 0..) |byte, position| buffer[10 + position] = crockford[byte & 0x1f];
    return buffer[0..];
}

/// Wall-clock milliseconds; std.time.milliTimestamp is gone in Zig 0.16.
fn milliTimestamp() i64 {
    var ts: std.c.timespec = undefined;
    _ = std.c.clock_gettime(.REALTIME, &ts);
    return ts.sec * std.time.ms_per_s + @divFloor(ts.nsec, std.time.ns_per_ms);
}

test "the bus contract lets a service and a browser publish, but only a service replay" {
    try std.testing.expectEqual(transport.auth.authorize.Level.any, policy("publish").?.level);
    try std.testing.expectEqual(transport.auth.authorize.Level.any, policy("subscribe").?.level);
    try std.testing.expectEqual(transport.auth.authorize.Level.internal, policy("replay").?.level);
    try std.testing.expectEqual(transport.auth.authorize.Level.user, policy("subscriptions").?.level);
    try std.testing.expect(policy("nonsense") == null);
}

test "a user token cannot publish into another tenant" {
    const user = Caller{ .scope = "club", .user = "alice", .is_service = false };
    try std.testing.expectEqualStrings("club", try resolveScope(user, ""));
    try std.testing.expectEqualStrings("club", try resolveScope(user, "club"));
    try std.testing.expectError(Error.EventScopeForbidden, resolveScope(user, "other"));

    const worker = Caller{ .scope = "club", .user = "ms", .is_service = true };
    try std.testing.expectEqualStrings("other", try resolveScope(worker, "other"));
    try std.testing.expectError(Error.EventScopeMissing, resolveScope(.{ .scope = "", .user = "ms", .is_service = true }, ""));
}

test "ulid ids sort chronologically" {
    var first: [26]u8 = undefined;
    var second: [26]u8 = undefined;
    const a = ulid(&first);
    std.Options.debug_io.sleep(std.Io.Duration.fromMilliseconds(2), .awake) catch {};
    const b = ulid(&second);
    try std.testing.expectEqual(@as(usize, 26), a.len);
    try std.testing.expect(std.mem.order(u8, a, b) == .lt);
}

test "arguments arrive either wrapped by nrpc or bare" {
    const allocator = std.testing.allocator;
    var wrapped = try std.json.parseFromSlice(std.json.Value, allocator, "{\"event\":{\"name\":\"order.created.1\"}}", .{});
    defer wrapped.deinit();
    try std.testing.expectEqualStrings("order.created.1", stringField(eventArgument(wrapped.value).?, "name").?);

    var bare = try std.json.parseFromSlice(std.json.Value, allocator, "{\"name\":\"order.created.1\"}", .{});
    defer bare.deinit();
    try std.testing.expectEqualStrings("order.created.1", stringField(eventArgument(bare.value).?, "name").?);

    var list = try std.json.parseFromSlice(std.json.Value, allocator, "{\"patterns\":[\"order.>\"]}", .{});
    defer list.deinit();
    try std.testing.expectEqual(@as(usize, 1), patternsArgument(list.value).?.len);
}
