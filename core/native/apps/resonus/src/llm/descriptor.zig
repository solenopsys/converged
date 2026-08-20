//! Loading a provider descriptor's decode table.
//!
//! The table is data emitted by the `resonus-providers` build. Parsing it once
//! into this shape is what keeps JavaScript off the event path entirely: at run
//! time the core resolves a hash lookup and a few pre-split paths, with no
//! interpretation and no second JSON pass.
//!
//! Everything here is validated on load and owned by one arena, so a descriptor
//! either comes up whole or fails at startup with the field that was wrong.
//! There is deliberately no partial-load path: a half-understood table would
//! turn a build mistake into a vendor 400 in production.

const std = @import("std");

/// A dotted path, pre-split into segments. A segment that parses as an integer
/// indexes an array; anything else is an object key.
pub const Path = []const []const u8;

pub const Emit = union(enum) {
    text_delta: struct { text: Path },
    tool_call_begin: struct { call_key: Path, id: ?Path, name: ?Path },
    tool_call_delta: struct { call_key: Path, args_text: Path, id: ?Path, name: ?Path },
    tool_call_ready: struct { id: Path, name: Path, args: Path },
    usage: struct { input: ?Path, output: ?Path },
    finish: struct { reason: ?Path },
    fatal: struct { message: ?Path },
    /// Marks the vendor event that ends a turn. A session transport holds its
    /// connection open across turns, so something has to say where one stops.
    turn_end,
    ignore,
    /// Names a warm hook. Reserved for shapes a path cannot address; the
    /// builder rejects a hook that is not implemented.
    hook: []const u8,
};

pub const Switch = struct {
    when: Path,
    /// Parallel arrays rather than a map: a switch has a handful of cases, and
    /// a linear scan over them beats hashing a short string.
    case_values: []const []const u8,
    case_rules: []const Rule,
    default: ?*const Rule,
};

pub const Each = struct {
    path: Path,
    rule: *const Rule,
};

pub const Rule = union(enum) {
    emit: Emit,
    branch: Switch,
    each: Each,
    list: []const Rule,
};

pub const Framing = struct {
    /// Lines without this prefix are skipped (`"data:"` for SSE).
    prefix: ?[]const u8 = null,
    /// A payload equal to this ends the stream without being decoded.
    done: ?[]const u8 = null,
};

/// One step of the post-connect handshake, executed in order.
///
/// `expect` blocks until an event of that type arrives; `send` puts a
/// hook-built payload on the wire. A session is not handed to the pool until
/// every step has passed, so a half-configured socket is never leased.
pub const HandshakeStep = union(enum) {
    expect: struct { event_type: []const u8, timeout_ms: u64 },
    send: struct { hook: []const u8, timeout_ms: u64 },
};

pub const Transport = struct {
    pub const Kind = enum { ws, https };

    kind: Kind,
    /// Whether the vendor keeps conversation state on the connection. Decides
    /// if the pool may hand a warm connection to a different session, so it is
    /// never defaulted.
    stateful: bool,
    url: []const u8,
    header_names: []const []const u8,
    header_values: []const []const u8,
    handshake: []const HandshakeStep,
    idle_per_model: ?u8,
};

/// Media signaling: one SDP exchange per call. A separate section from
/// `Transport` because it is a different exchange, not a different vendor.
pub const Signaling = struct {
    pub const ResponseKind = enum { text, json };

    url: []const u8,
    header_names: []const []const u8,
    header_values: []const []const u8,
    encode_hook: []const u8,
    response_kind: ResponseKind,
};

pub const Descriptor = struct {
    arena: std.heap.ArenaAllocator,
    name: []const u8,
    transport: Transport,
    signaling: ?Signaling,
    framing: Framing,
    event_type: ?Path,
    /// Parallel arrays keyed by event type. Built sorted so lookup can binary
    /// search instead of scanning tables with a few dozen entries.
    event_names: []const []const u8,
    event_rules: []const Rule,
    always: ?Rule,
    unknown: ?Rule,
    hooks: []const []const u8,

    pub fn deinit(self: *Descriptor) void {
        self.arena.deinit();
        self.* = undefined;
    }

    /// Rule for an event type, or `unknown` when the table has no entry.
    pub fn ruleFor(self: *const Descriptor, event_type: []const u8) ?*const Rule {
        var low: usize = 0;
        var high: usize = self.event_names.len;
        while (low < high) {
            const mid = low + (high - low) / 2;
            switch (std.mem.order(u8, self.event_names[mid], event_type)) {
                .eq => return &self.event_rules[mid],
                .lt => low = mid + 1,
                .gt => high = mid,
            }
        }
        return if (self.unknown) |*rule| rule else null;
    }

    pub fn hasHook(self: *const Descriptor, name: []const u8) bool {
        for (self.hooks) |hook| {
            if (std.mem.eql(u8, hook, name)) return true;
        }
        return false;
    }
};

pub const Error = error{
    DescriptorNotObject,
    DescriptorVersionUnsupported,
    DescriptorFieldMissing,
    DescriptorFieldInvalid,
    DescriptorUnknownEmit,
    DescriptorEmptyRule,
    OutOfMemory,
};

pub const api_version: i64 = 1;

/// Parse one `<name>.table.json`. The returned descriptor owns its arena.
pub fn parse(gpa: std.mem.Allocator, json: []const u8) Error!Descriptor {
    var arena = std.heap.ArenaAllocator.init(gpa);
    errdefer arena.deinit();
    const a = arena.allocator();

    const root = std.json.parseFromSliceLeaky(std.json.Value, a, json, .{}) catch
        return error.DescriptorFieldInvalid;
    if (root != .object) return error.DescriptorNotObject;

    // Refuse an unknown contract version outright. A descriptor built against a
    // newer core may use rules this build cannot execute, and silently skipping
    // them would decode a turn wrong rather than fail it.
    const version = intField(root, "apiVersion") orelse return error.DescriptorFieldMissing;
    if (version != api_version) return error.DescriptorVersionUnsupported;

    const name = try dupField(a, root, "name");
    const transport = try parseTransport(a, obj(root, "transport") orelse return error.DescriptorFieldMissing);
    const signaling = if (obj(root, "signaling")) |sig| try parseSignaling(a, sig) else null;
    const decode = obj(root, "decode") orelse return error.DescriptorFieldMissing;

    var framing = Framing{};
    if (obj(decode, "framing")) |f| {
        framing.prefix = try optDup(a, f, "prefix");
        framing.done = try optDup(a, f, "done");
    }

    const event_type = if (strField(decode, "eventType")) |p| try splitPath(a, p) else null;

    var names: std.ArrayList([]const u8) = .empty;
    var rules: std.ArrayList(Rule) = .empty;
    if (obj(decode, "events")) |events| {
        if (event_type == null) return error.DescriptorFieldMissing;
        var it = events.object.iterator();
        while (it.next()) |entry| {
            try names.append(a, try a.dupe(u8, entry.key_ptr.*));
            try rules.append(a, try parseRule(a, entry.value_ptr.*));
        }
        try sortEvents(a, names.items, rules.items);
    }

    const always = if (decode.object.get("always")) |v| try parseRule(a, v) else null;
    const unknown = if (decode.object.get("unknown")) |v| try parseRule(a, v) else null;

    var hooks: std.ArrayList([]const u8) = .empty;
    if (root.object.get("hooks")) |v| {
        if (v != .array) return error.DescriptorFieldInvalid;
        for (v.array.items) |item| {
            if (item != .string) return error.DescriptorFieldInvalid;
            try hooks.append(a, try a.dupe(u8, item.string));
        }
    }

    if (names.items.len == 0 and always == null) return error.DescriptorFieldMissing;

    return .{
        .arena = arena,
        .name = name,
        .transport = transport,
        .signaling = signaling,
        .framing = framing,
        .event_type = event_type,
        .event_names = names.items,
        .event_rules = rules.items,
        .always = always,
        .unknown = unknown,
        .hooks = hooks.items,
    };
}

/// Insertion sort over the two parallel arrays. Tables have tens of entries at
/// most, and this keeps the pair in step without allocating an index array.
fn sortEvents(a: std.mem.Allocator, names: [][]const u8, rules: []Rule) !void {
    _ = a;
    var i: usize = 1;
    while (i < names.len) : (i += 1) {
        var j = i;
        while (j > 0 and std.mem.order(u8, names[j - 1], names[j]) == .gt) : (j -= 1) {
            std.mem.swap([]const u8, &names[j - 1], &names[j]);
            std.mem.swap(Rule, &rules[j - 1], &rules[j]);
        }
    }
}

fn parseTransport(a: std.mem.Allocator, t: std.json.Value) Error!Transport {
    const kind_text = strField(t, "kind") orelse return error.DescriptorFieldMissing;
    const kind: Transport.Kind = if (std.mem.eql(u8, kind_text, "ws"))
        .ws
    else if (std.mem.eql(u8, kind_text, "https"))
        .https
    else
        return error.DescriptorFieldInvalid;

    const stateful = switch (t.object.get("stateful") orelse return error.DescriptorFieldMissing) {
        .bool => |b| b,
        else => return error.DescriptorFieldInvalid,
    };

    var header_names: std.ArrayList([]const u8) = .empty;
    var header_values: std.ArrayList([]const u8) = .empty;
    if (obj(t, "headers")) |headers| {
        var it = headers.object.iterator();
        while (it.next()) |entry| {
            if (entry.value_ptr.* != .string) return error.DescriptorFieldInvalid;
            try header_names.append(a, try a.dupe(u8, entry.key_ptr.*));
            try header_values.append(a, try a.dupe(u8, entry.value_ptr.string));
        }
    }

    var handshake: std.ArrayList(HandshakeStep) = .empty;
    if (t.object.get("handshake")) |steps| {
        if (steps != .array) return error.DescriptorFieldInvalid;
        for (steps.array.items) |step| {
            if (step != .object) return error.DescriptorFieldInvalid;
            const timeout: u64 = if (intField(step, "timeoutMs")) |ms| @intCast(@max(ms, 0)) else 10_000;
            if (strField(step, "await")) |event_type| {
                try handshake.append(a, .{ .expect = .{
                    .event_type = try a.dupe(u8, event_type),
                    .timeout_ms = timeout,
                } });
            } else if (strField(step, "send")) |hook| {
                try handshake.append(a, .{ .send = .{
                    .hook = try a.dupe(u8, hook),
                    .timeout_ms = timeout,
                } });
            } else return error.DescriptorFieldInvalid;
        }
    }

    const idle: ?u8 = if (intField(t, "idlePerModel")) |n| blk: {
        if (n < 1 or n > 16) return error.DescriptorFieldInvalid;
        break :blk @intCast(n);
    } else null;

    return .{
        .kind = kind,
        .stateful = stateful,
        .url = try dupField(a, t, "url"),
        .header_names = header_names.items,
        .header_values = header_values.items,
        .handshake = handshake.items,
        .idle_per_model = idle,
    };
}

fn parseSignaling(a: std.mem.Allocator, sig: std.json.Value) Error!Signaling {
    const kind_text = strField(sig, "responseKind") orelse return error.DescriptorFieldMissing;
    const kind: Signaling.ResponseKind = if (std.mem.eql(u8, kind_text, "text"))
        .text
    else if (std.mem.eql(u8, kind_text, "json"))
        .json
    else
        return error.DescriptorFieldInvalid;

    var names: std.ArrayList([]const u8) = .empty;
    var values: std.ArrayList([]const u8) = .empty;
    if (obj(sig, "headers")) |headers| {
        var it = headers.object.iterator();
        while (it.next()) |entry| {
            if (entry.value_ptr.* != .string) return error.DescriptorFieldInvalid;
            try names.append(a, try a.dupe(u8, entry.key_ptr.*));
            try values.append(a, try a.dupe(u8, entry.value_ptr.string));
        }
    }

    return .{
        .url = try dupField(a, sig, "url"),
        .header_names = names.items,
        .header_values = values.items,
        .encode_hook = try dupField(a, sig, "encode"),
        .response_kind = kind,
    };
}

fn parseRule(a: std.mem.Allocator, v: std.json.Value) Error!Rule {
    switch (v) {
        .array => |items| {
            if (items.items.len == 0) return error.DescriptorEmptyRule;
            const list = try a.alloc(Rule, items.items.len);
            for (items.items, 0..) |item, i| list[i] = try parseRule(a, item);
            return .{ .list = list };
        },
        .object => {},
        else => return error.DescriptorFieldInvalid,
    }

    if (strField(v, "each")) |path| {
        const inner = try a.create(Rule);
        inner.* = try parseRule(a, v.object.get("rule") orelse return error.DescriptorFieldMissing);
        return .{ .each = .{ .path = try splitPath(a, path), .rule = inner } };
    }

    if (strField(v, "when")) |when| {
        const cases = obj(v, "cases") orelse return error.DescriptorFieldMissing;
        var values: std.ArrayList([]const u8) = .empty;
        var rules: std.ArrayList(Rule) = .empty;
        var it = cases.object.iterator();
        while (it.next()) |entry| {
            try values.append(a, try a.dupe(u8, entry.key_ptr.*));
            try rules.append(a, try parseRule(a, entry.value_ptr.*));
        }
        if (values.items.len == 0) return error.DescriptorEmptyRule;

        const default: ?*const Rule = if (v.object.get("default")) |d| blk: {
            const ptr = try a.create(Rule);
            ptr.* = try parseRule(a, d);
            break :blk ptr;
        } else null;

        return .{ .branch = .{
            .when = try splitPath(a, when),
            .case_values = values.items,
            .case_rules = rules.items,
            .default = default,
        } };
    }

    return .{ .emit = try parseEmit(a, v) };
}

fn parseEmit(a: std.mem.Allocator, v: std.json.Value) Error!Emit {
    const kind = strField(v, "emit") orelse return error.DescriptorFieldMissing;

    if (std.mem.eql(u8, kind, "text.delta")) {
        return .{ .text_delta = .{ .text = try reqPath(a, v, "text") } };
    }
    if (std.mem.eql(u8, kind, "tool_call.begin")) {
        return .{ .tool_call_begin = .{
            .call_key = try reqPath(a, v, "callKey"),
            .id = try optPath(a, v, "id"),
            .name = try optPath(a, v, "name"),
        } };
    }
    if (std.mem.eql(u8, kind, "tool_call.delta")) {
        return .{ .tool_call_delta = .{
            .call_key = try reqPath(a, v, "callKey"),
            .args_text = try reqPath(a, v, "argumentsText"),
            .id = try optPath(a, v, "id"),
            .name = try optPath(a, v, "name"),
        } };
    }
    if (std.mem.eql(u8, kind, "tool_call.ready")) {
        return .{ .tool_call_ready = .{
            .id = try reqPath(a, v, "id"),
            .name = try reqPath(a, v, "name"),
            .args = try reqPath(a, v, "args"),
        } };
    }
    if (std.mem.eql(u8, kind, "usage")) {
        const input = try optPath(a, v, "inputTokens");
        const output = try optPath(a, v, "outputTokens");
        if (input == null and output == null) return error.DescriptorFieldMissing;
        return .{ .usage = .{ .input = input, .output = output } };
    }
    if (std.mem.eql(u8, kind, "finish")) {
        return .{ .finish = .{ .reason = try optPath(a, v, "finishReason") } };
    }
    if (std.mem.eql(u8, kind, "fatal")) {
        return .{ .fatal = .{ .message = try optPath(a, v, "message") } };
    }
    if (std.mem.eql(u8, kind, "turn.end")) return .turn_end;
    if (std.mem.eql(u8, kind, "ignore")) return .ignore;
    if (std.mem.eql(u8, kind, "hook")) {
        return .{ .hook = try dupField(a, v, "hook") };
    }
    return error.DescriptorUnknownEmit;
}

// ---- json helpers -----------------------------------------------------------

fn obj(v: std.json.Value, key: []const u8) ?std.json.Value {
    if (v != .object) return null;
    const found = v.object.get(key) orelse return null;
    return if (found == .object) found else null;
}

fn strField(v: std.json.Value, key: []const u8) ?[]const u8 {
    if (v != .object) return null;
    const found = v.object.get(key) orelse return null;
    return switch (found) {
        .string => |s| s,
        else => null,
    };
}

fn intField(v: std.json.Value, key: []const u8) ?i64 {
    if (v != .object) return null;
    const found = v.object.get(key) orelse return null;
    return switch (found) {
        .integer => |n| n,
        else => null,
    };
}

fn dupField(a: std.mem.Allocator, v: std.json.Value, key: []const u8) Error![]const u8 {
    const text = strField(v, key) orelse return error.DescriptorFieldMissing;
    if (text.len == 0) return error.DescriptorFieldInvalid;
    return a.dupe(u8, text);
}

fn optDup(a: std.mem.Allocator, v: std.json.Value, key: []const u8) Error!?[]const u8 {
    const text = strField(v, key) orelse return null;
    return try a.dupe(u8, text);
}

fn reqPath(a: std.mem.Allocator, v: std.json.Value, key: []const u8) Error!Path {
    return splitPath(a, strField(v, key) orelse return error.DescriptorFieldMissing);
}

fn optPath(a: std.mem.Allocator, v: std.json.Value, key: []const u8) Error!?Path {
    const text = strField(v, key) orelse return null;
    return try splitPath(a, text);
}

fn splitPath(a: std.mem.Allocator, text: []const u8) Error!Path {
    if (text.len == 0) return error.DescriptorFieldInvalid;
    var count: usize = 1;
    for (text) |ch| {
        if (ch == '.') count += 1;
    }
    const segments = try a.alloc([]const u8, count);
    var it = std.mem.splitScalar(u8, text, '.');
    var i: usize = 0;
    while (it.next()) |segment| : (i += 1) {
        if (segment.len == 0) return error.DescriptorFieldInvalid;
        segments[i] = try a.dupe(u8, segment);
    }
    return segments;
}
