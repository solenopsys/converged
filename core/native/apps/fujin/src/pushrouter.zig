const std = @import("std");
const transport = @import("transport");
const Hub = @import("hub.zig").Hub;
const Policy = @import("qjs_policy.zig").Policy;
const Store = @import("notifications.zig").Store;

/// The `pushrouter` NRPC service, hosted by Fujin on the `fujin` target.
///
/// This is the third of Fujin's message streams: not service-to-service RPC and
/// not log shipping, but business notifications addressed at a person — a
/// letter arrived, an order came in, the printer finished. They ride the same
/// WebSocket sessions as everything else, pass through the embedded JS policy
/// so a deployment can suppress or enrich them without a rebuild, and land in a
/// bounded replay window so a browser that reconnects does not miss them.
///
/// Written by hand rather than generated: the generator emits one uniform
/// `.level = .user, .mode = null` policy per method, and `publish` has to be
/// callable by a browser *and* by a backend service, which no single generated
/// level expresses. Keep in sync with `modules/types/platform/pushrouter.ts`.
pub const service = "pushrouter";

pub const method_policies = [_]transport.auth.authorize.MethodPolicy{
    // `.any`: a person forwarding something important and a service announcing
    // a finished job are the same operation. The permission still gates it.
    .{ .service = service, .method = "publish", .level = .any, .mode = .write },
    .{ .service = service, .method = "history", .level = .user, .mode = .read },
};

pub fn policy(method: []const u8) ?transport.auth.authorize.MethodPolicy {
    for (method_policies) |entry| {
        if (std.mem.eql(u8, entry.method, method)) return entry;
    }
    return null;
}

/// Identity of the caller, taken from a verified token — never from the request
/// body. `scope`/`user` are what the token asserted; `is_service` selects which
/// of the two addressing rules below applies.
pub const Caller = struct {
    scope: []const u8,
    user: []const u8,
    is_service: bool,
};

pub const Context = struct {
    allocator: std.mem.Allocator,
    hub: *Hub,
    store: *Store,
    policy: *Policy,
};

pub const Error = error{
    PushNameMissing,
    PushScopeMissing,
    PushScopeForbidden,
    PushLevelInvalid,
    PushMessageMissing,
    InvalidHistoryLimit,
};

pub const Published = struct {
    /// Response body for the caller.
    response: []u8,
    /// Sessions the message actually reached, for the log line.
    delivered: usize,
    /// False when the deployment policy dropped the message.
    accepted: bool,

    pub fn deinit(self: *Published, allocator: std.mem.Allocator) void {
        allocator.free(self.response);
        self.* = undefined;
    }
};

/// Delivers one notification and records it for replay.
///
/// Addressing is decided here and nowhere else:
///   - a user token may only address its own tenant, and any subject in it;
///   - a service token may address another tenant, but has to name it.
/// An unaddressed message reaches every session in the resolved scope. There is
/// no way to reach every tenant at once, which is the failure the old
/// payload-derived audience allowed.
pub fn publish(context: Context, caller: Caller, body: []const u8) !Published {
    const allocator = context.allocator;
    var parsed = try std.json.parseFromSlice(std.json.Value, allocator, body, .{});
    defer parsed.deinit();
    const input = messageArgument(parsed.value) orelse return Error.PushMessageMissing;

    const name = stringField(input, "name") orelse return Error.PushNameMissing;
    if (name.len == 0) return Error.PushNameMissing;

    const requested_scope = stringField(input, "scope") orelse "";
    const scope = try resolveScope(caller, requested_scope);
    const user = stringField(input, "user") orelse "";
    const level = try resolveLevel(stringField(input, "level"));

    var id_buffer: [32]u8 = undefined;
    const id = messageId(&id_buffer);
    const frame = try encodeMessage(allocator, .{
        .id = id,
        .name = name,
        .level = level,
        .at = milliTimestamp(),
        .input = input,
    });
    defer allocator.free(frame);

    // The deployment's own JS gets the finished frame, so a rule can suppress
    // noise ("printer progress below 10%") or raise a level without a rebuild.
    const shaped = try context.policy.transform(frame);
    defer allocator.free(shaped);
    if (isDropped(shaped)) {
        return .{
            .response = try std.fmt.allocPrint(allocator, "{{\"id\":\"{s}\",\"delivered\":0}}", .{id}),
            .delivered = 0,
            .accepted = false,
        };
    }

    const delivered = context.hub.deliver(shaped, .{
        .scope = scope,
        .user = if (user.len > 0) user else null,
    });
    // Recorded even when nobody was connected — that is the case replay exists
    // for. Recorded after delivery so a store failure cannot double-send.
    try context.store.record(scope, user, shaped);

    return .{
        .response = try std.fmt.allocPrint(allocator, "{{\"id\":\"{s}\",\"delivered\":{d}}}", .{ id, delivered }),
        .delivered = delivered,
        .accepted = true,
    };
}

/// Replay for the calling subject. Takes no recipient parameter by design.
pub fn history(context: Context, caller: Caller, body: []const u8) ![]u8 {
    return context.store.historyJson(caller.scope, caller.user, try historyLimit(body));
}

fn resolveScope(caller: Caller, requested: []const u8) ![]const u8 {
    if (!caller.is_service) {
        // A browser cannot reach out of the tenant its token names. Echoing
        // back its own scope is allowed; naming another one is a refusal, not
        // a silent correction, so a mistaken caller learns about it.
        if (requested.len > 0 and !std.mem.eql(u8, requested, caller.scope)) return Error.PushScopeForbidden;
        if (caller.scope.len == 0) return Error.PushScopeMissing;
        return caller.scope;
    }
    const scope = if (requested.len > 0) requested else caller.scope;
    if (scope.len == 0) return Error.PushScopeMissing;
    return scope;
}

fn resolveLevel(requested: ?[]const u8) ![]const u8 {
    const level = requested orelse return "info";
    for ([_][]const u8{ "info", "success", "warning", "error" }) |known| {
        if (std.mem.eql(u8, level, known)) return known;
    }
    return Error.PushLevelInvalid;
}

const MessageParts = struct {
    id: []const u8,
    name: []const u8,
    level: []const u8,
    at: i64,
    input: std.json.ObjectMap,
};

/// One flat object, the same shape on the wire and in the replay window, so the
/// browser has a single thing to parse. `name` stays at the top level because
/// that is what the signal channel dispatches named subscriptions on.
///
/// Text is carried as `titleKey`/`bodyKey` plus `params` wherever the sender
/// has a catalog entry: the sending service does not know the recipient's
/// locale, so a rendered sentence here could only ever be one language. Literal
/// `title`/`body` survive for real data — a mail subject, an order number.
fn encodeMessage(allocator: std.mem.Allocator, parts: MessageParts) ![]u8 {
    var out: std.Io.Writer.Allocating = .init(allocator);
    errdefer out.deinit();
    const writer = &out.writer;

    try writer.print("{{\"type\":\"push\",\"id\":\"{s}\",\"at\":{d},", .{ parts.id, parts.at });
    try writeStringField(allocator, writer, "name", parts.name);
    try writer.writeByte(',');
    try writeStringField(allocator, writer, "level", parts.level);

    for ([_][]const u8{ "titleKey", "title", "bodyKey", "body", "params", "link", "payload" }) |key| {
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

/// Writes `"key":` and, when `value` is given, the quoted value after it.
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

/// NRPC wraps positional arguments in an object keyed by parameter name, but a
/// hand-rolled caller may well post the message on its own. Accept both.
fn messageArgument(value: std.json.Value) ?std.json.ObjectMap {
    if (value != .object) return null;
    const message = value.object.get("message") orelse return value.object;
    return if (message == .object) message.object else null;
}

fn historyLimit(body: []const u8) !usize {
    if (body.len == 0) return Store.default_limit;
    var parsed = std.json.parseFromSlice(std.json.Value, std.heap.page_allocator, body, .{}) catch return Store.default_limit;
    defer parsed.deinit();
    if (parsed.value != .object) return Store.default_limit;
    const value = parsed.value.object.get("limit") orelse return Store.default_limit;
    if (value == .null) return Store.default_limit;
    if (value != .integer or value.integer <= 0) return Error.InvalidHistoryLimit;
    return std.math.cast(usize, value.integer) orelse Error.InvalidHistoryLimit;
}

/// A policy that returns nothing, `null` or a non-object has refused the
/// message. Without this check the string "null" would be broadcast verbatim.
fn isDropped(shaped: []const u8) bool {
    const trimmed = std.mem.trim(u8, shaped, " \t\r\n");
    return trimmed.len == 0 or std.mem.eql(u8, trimmed, "null") or trimmed[0] != '{';
}

fn stringField(object: std.json.ObjectMap, key: []const u8) ?[]const u8 {
    const value = object.get(key) orelse return null;
    return switch (value) {
        .string => |text| text,
        else => null,
    };
}

/// CSPRNG via the Io interface; std.crypto.random is gone in Zig 0.16.
fn messageId(buffer: *[32]u8) []const u8 {
    var raw: [16]u8 = undefined;
    std.Options.debug_io.random(&raw);
    return std.fmt.bufPrint(buffer, "{x}", .{&raw}) catch unreachable;
}

/// Wall-clock milliseconds; std.time.milliTimestamp is gone in Zig 0.16.
fn milliTimestamp() i64 {
    var ts: std.c.timespec = undefined;
    _ = std.c.clock_gettime(.REALTIME, &ts);
    return ts.sec * std.time.ms_per_s + @divFloor(ts.nsec, std.time.ns_per_ms);
}

// ── Tests ────────────────────────────────────────────────────────────────────

const testing = std.testing;

test "publish is reachable by both token kinds, history by users only" {
    try testing.expectEqual(transport.auth.authorize.Level.any, policy("publish").?.level);
    try testing.expectEqual(transport.auth.access.Mode.write, policy("publish").?.mode.?);
    try testing.expectEqual(transport.auth.authorize.Level.user, policy("history").?.level);
    try testing.expect(policy("nonesuch") == null);
}

test "a user token cannot address another tenant" {
    const browser = Caller{ .scope = "club", .user = "alice", .is_service = false };
    try testing.expectEqualStrings("club", try resolveScope(browser, ""));
    try testing.expectEqualStrings("club", try resolveScope(browser, "club"));
    try testing.expectError(Error.PushScopeForbidden, resolveScope(browser, "other"));
}

test "a service token may name a tenant and falls back to its own" {
    const worker = Caller{ .scope = "club", .user = "orders", .is_service = true };
    try testing.expectEqualStrings("other", try resolveScope(worker, "other"));
    try testing.expectEqualStrings("club", try resolveScope(worker, ""));
    try testing.expectError(
        Error.PushScopeMissing,
        resolveScope(.{ .scope = "", .user = "orders", .is_service = true }, ""),
    );
}

test "level defaults to info and rejects anything unknown" {
    try testing.expectEqualStrings("info", try resolveLevel(null));
    try testing.expectEqualStrings("error", try resolveLevel("error"));
    try testing.expectError(Error.PushLevelInvalid, resolveLevel("critical"));
}

test "the encoded message keeps its name flat and omits absent fields" {
    const allocator = testing.allocator;
    var parsed = try std.json.parseFromSlice(
        std.json.Value,
        allocator,
        "{\"name\":\"order.created\",\"titleKey\":\"notify.order.title\",\"params\":{\"number\":\"42\"},\"body\":null}",
        .{},
    );
    defer parsed.deinit();

    const frame = try encodeMessage(allocator, .{
        .id = "abc",
        .name = "order.created",
        .level = "success",
        .at = 1700,
        .input = parsed.value.object,
    });
    defer allocator.free(frame);

    var doc = try std.json.parseFromSlice(std.json.Value, allocator, frame, .{});
    defer doc.deinit();
    try testing.expectEqualStrings("push", doc.value.object.get("type").?.string);
    try testing.expectEqualStrings("order.created", doc.value.object.get("name").?.string);
    try testing.expectEqualStrings("success", doc.value.object.get("level").?.string);
    try testing.expectEqualStrings("notify.order.title", doc.value.object.get("titleKey").?.string);
    try testing.expectEqualStrings("42", doc.value.object.get("params").?.object.get("number").?.string);
    try testing.expect(doc.value.object.get("body") == null);
}

test "a name carrying quotes cannot break out of the frame" {
    const allocator = testing.allocator;
    var parsed = try std.json.parseFromSlice(std.json.Value, allocator, "{}", .{});
    defer parsed.deinit();

    const frame = try encodeMessage(allocator, .{
        .id = "abc",
        .name = "evil\",\"level\":\"error",
        .level = "info",
        .at = 1,
        .input = parsed.value.object,
    });
    defer allocator.free(frame);

    var doc = try std.json.parseFromSlice(std.json.Value, allocator, frame, .{});
    defer doc.deinit();
    try testing.expectEqualStrings("info", doc.value.object.get("level").?.string);
    try testing.expectEqualStrings("evil\",\"level\":\"error", doc.value.object.get("name").?.string);
}

test "a policy refusal is recognised in every shape it can take" {
    try testing.expect(isDropped(""));
    try testing.expect(isDropped("  null\n"));
    try testing.expect(isDropped("undefined"));
    try testing.expect(!isDropped("{\"type\":\"push\"}"));
}

test "history limit falls back to the default and rejects nonsense" {
    try testing.expectEqual(Store.default_limit, try historyLimit(""));
    try testing.expectEqual(Store.default_limit, try historyLimit("{}"));
    try testing.expectEqual(@as(usize, 5), try historyLimit("{\"limit\":5}"));
    try testing.expectError(Error.InvalidHistoryLimit, historyLimit("{\"limit\":0}"));
}

test "the message argument is read from the NRPC wrapper or a bare object" {
    const allocator = testing.allocator;
    var wrapped = try std.json.parseFromSlice(std.json.Value, allocator, "{\"message\":{\"name\":\"a\"}}", .{});
    defer wrapped.deinit();
    try testing.expectEqualStrings("a", stringField(messageArgument(wrapped.value).?, "name").?);

    var bare = try std.json.parseFromSlice(std.json.Value, allocator, "{\"name\":\"b\"}", .{});
    defer bare.deinit();
    try testing.expectEqualStrings("b", stringField(messageArgument(bare.value).?, "name").?);
}
