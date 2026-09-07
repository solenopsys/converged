const std = @import("std");

/// Mirrors tools/nrpc/src/runtime/access-control.ts.
///
/// A bit set, not an ordered scale: `allows` is a mask test, so `rwx` covers
/// every request and `x` alone covers only execution.
pub const Mode = enum(u3) {
    read = 1,
    write = 2,
    read_write = 3,
    execute = 4,
    read_execute = 5,
    write_execute = 6,
    all = 7,

    pub fn allows(self: Mode, required: Mode) bool {
        return (@intFromEnum(self) & @intFromEnum(required)) == @intFromEnum(required);
    }

    pub fn name(self: Mode) []const u8 {
        return switch (self) {
            .read => "r",
            .write => "w",
            .read_write => "rw",
            .execute => "x",
            .read_execute => "rx",
            .write_execute => "wx",
            .all => "rwx",
        };
    }
};

/// One grant, flattened out of the tree.
///
/// `kind` says what the grant is about — `rp` a repository microservice, `ap` a
/// native application, `wf` a workflow, `lm` a lambda. Empty means any kind,
/// which is what the tree's `*` writes. Without the kind every grant would read
/// as a service method, so "may run this workflow" could only be spelled "may
/// call the runtime's runWorkflow" — a grant that cannot tell one workflow from
/// another.
pub const Grant = struct {
    kind: []const u8 = "",
    service: []const u8,
    method: []const u8,
    mode: Mode,
};

pub const ParseError = error{InvalidPermission};

/// `[kind/]service/method[(mode)]` — the query syntax naming a single grant.
///
/// This is how a caller points at one permission, not how a set is stored. Two
/// segments leave the kind unset and match anything; three name it.
pub fn parsePermission(value: []const u8) ParseError!Grant {
    var input = std.mem.trim(u8, value, " \t\r\n");

    var kind: []const u8 = "";
    if (std.mem.count(u8, input, "/") == 2) {
        const first = std.mem.indexOfScalar(u8, input, '/').?;
        const head = std.mem.trim(u8, input[0..first], " \t\r\n");
        if (head.len == 0 or containsWhitespace(head)) return error.InvalidPermission;
        kind = if (isWildcard(head)) "" else head;
        input = std.mem.trim(u8, input[first + 1 ..], " \t\r\n");
    }

    const slash = std.mem.indexOfScalar(u8, input, '/') orelse return error.InvalidPermission;
    const service = std.mem.trim(u8, input[0..slash], " \t\r\n");
    if (service.len == 0 or containsWhitespace(service)) return error.InvalidPermission;

    const right = std.mem.trim(u8, input[slash + 1 ..], " \t\r\n");
    if (right.len == 0) return error.InvalidPermission;
    const open = std.mem.indexOfScalar(u8, right, '(');
    const method = std.mem.trim(u8, right[0 .. open orelse right.len], " \t\r\n");
    if (method.len == 0 or containsWhitespace(method)) return error.InvalidPermission;

    const mode = if (open) |offset| blk: {
        const close = std.mem.indexOfScalarPos(u8, right, offset + 1, ')') orelse return error.InvalidPermission;
        if (std.mem.trim(u8, right[close + 1 ..], " \t\r\n").len != 0) return error.InvalidPermission;
        break :blk try parseMode(std.mem.trim(u8, right[offset + 1 .. close], " \t\r\n"));
    } else .all;

    return .{ .kind = kind, .service = service, .method = method, .mode = mode };
}

/// Flattens the `perm` claim — `kind -> service -> method -> mode`, the same
/// shape a preset file is written in — into the grants the matcher walks. Every
/// string is copied, so the result outlives the parsed JSON document.
///
/// The kind and the service are named once each instead of on every line:
///
/// ```json
/// {
///   "ap": { "resonus": { "session.open": "w", "session.close": "w" } },
///   "rp": { "files": { "*": "r", "save": "w" } },
///   "wf": { "workflows": { "*": "x" } }
/// }
/// ```
///
/// `*` is a wildcard at any level — the middle line is what the flat syntax
/// spelled `rp/files/*(r)` plus `rp/files/save(w)`. A bare mode in place of the
/// method map covers every method, so full access is `{"*": {"*": "rwx"}}`.
///
/// A node this side cannot read is skipped rather than refused: an unreadable
/// grant becomes a grant not honoured, which is the safe direction. A claim
/// that is not an object at all is the caller's error to report.
pub fn parseTree(allocator: std.mem.Allocator, tree: std.json.Value) std.mem.Allocator.Error![]const Grant {
    var grants: std.ArrayList(Grant) = .empty;
    errdefer freeGrants(allocator, grants.items);
    errdefer grants.deinit(allocator);

    if (tree != .object) return grants.toOwnedSlice(allocator);

    var kinds = tree.object.iterator();
    while (kinds.next()) |kind_entry| {
        const services = kind_entry.value_ptr.*;
        if (services != .object) continue;
        const kind = normalizeWildcard(kind_entry.key_ptr.*);

        var service_iterator = services.object.iterator();
        while (service_iterator.next()) |service_entry| {
            const service = std.mem.trim(u8, service_entry.key_ptr.*, " \t\r\n");
            if (service.len == 0) continue;

            switch (service_entry.value_ptr.*) {
                // A bare mode stands for the method map that would list only
                // the wildcard, which is how `{"*": {"*": "rwx"}}` is written.
                .string => |raw_mode| {
                    const mode = parseMode(std.mem.trim(u8, raw_mode, " \t\r\n")) catch continue;
                    try appendGrant(allocator, &grants, kind, service, "*", mode);
                },
                .object => |methods| {
                    var method_iterator = methods.iterator();
                    while (method_iterator.next()) |method_entry| {
                        const method = std.mem.trim(u8, method_entry.key_ptr.*, " \t\r\n");
                        if (method.len == 0) continue;
                        if (method_entry.value_ptr.* != .string) continue;
                        const mode = parseMode(std.mem.trim(u8, method_entry.value_ptr.string, " \t\r\n")) catch continue;
                        try appendGrant(allocator, &grants, kind, service, method, mode);
                    }
                },
                else => continue,
            }
        }
    }

    return grants.toOwnedSlice(allocator);
}

fn appendGrant(
    allocator: std.mem.Allocator,
    grants: *std.ArrayList(Grant),
    kind: []const u8,
    service: []const u8,
    method: []const u8,
    mode: Mode,
) std.mem.Allocator.Error!void {
    const kind_copy = try allocator.dupe(u8, kind);
    errdefer allocator.free(kind_copy);
    const service_copy = try allocator.dupe(u8, service);
    errdefer allocator.free(service_copy);
    const method_copy = try allocator.dupe(u8, method);
    errdefer allocator.free(method_copy);
    try grants.append(allocator, .{
        .kind = kind_copy,
        .service = service_copy,
        .method = method_copy,
        .mode = mode,
    });
}

pub fn cloneGrants(
    allocator: std.mem.Allocator,
    grants: []const Grant,
) std.mem.Allocator.Error![]const Grant {
    var copy: std.ArrayList(Grant) = .empty;
    errdefer freeGrants(allocator, copy.items);
    errdefer copy.deinit(allocator);
    try copy.ensureTotalCapacityPrecise(allocator, grants.len);
    for (grants) |grant| {
        try appendGrant(allocator, &copy, grant.kind, grant.service, grant.method, grant.mode);
    }
    return copy.toOwnedSlice(allocator);
}

pub fn freeGrants(allocator: std.mem.Allocator, grants: []const Grant) void {
    for (grants) |grant| {
        allocator.free(grant.kind);
        allocator.free(grant.service);
        allocator.free(grant.method);
    }
    allocator.free(grants);
}

pub fn resolveMode(method: []const u8) Mode {
    const read_prefixes = [_][]const u8{
        "get", "list", "find", "search", "status", "stats", "count", "read", "fetch", "exists", "has", "is", "describe",
    };
    for (read_prefixes) |prefix| {
        if (startsWithIgnoreCase(method, prefix)) return .read;
    }
    return .write;
}

pub const Matcher = struct {
    grants: []const Grant,

    /// An empty `kind` asks about any kind. A grant carrying no kind of its own
    /// — the tree's `*` — answers either way.
    pub fn can(self: Matcher, kind: []const u8, service: []const u8, method: []const u8, required: Mode) bool {
        for (self.grants) |grant| {
            if (!kindMatches(grant.kind, kind)) continue;
            if (!matches(grant.service, service) or !matches(grant.method, method)) continue;
            if (grant.mode.allows(required)) return true;
        }
        return false;
    }
};

/// Renders grants back into query syntax for a denial log. Authorization
/// metadata, not credentials: printing it makes a stale token distinguishable
/// from a policy mismatch without exposing the JWT.
pub const GrantList = struct {
    grants: []const Grant,

    pub fn format(self: GrantList, writer: *std.Io.Writer) std.Io.Writer.Error!void {
        try writer.writeByte('[');
        for (self.grants, 0..) |grant, index| {
            if (index != 0) try writer.writeAll(", ");
            try writer.print("{s}/{s}/{s}({s})", .{
                if (grant.kind.len > 0) grant.kind else "*",
                grant.service,
                grant.method,
                grant.mode.name(),
            });
        }
        try writer.writeByte(']');
    }
};

fn normalizeWildcard(value: []const u8) []const u8 {
    const trimmed = std.mem.trim(u8, value, " \t\r\n");
    return if (isWildcard(trimmed)) "" else trimmed;
}

fn kindMatches(granted: []const u8, wanted: []const u8) bool {
    if (granted.len == 0 or wanted.len == 0) return true;
    return std.ascii.eqlIgnoreCase(granted, wanted);
}

fn parseMode(value: []const u8) ParseError!Mode {
    if (value.len == 0) return error.InvalidPermission;
    var bits: u3 = 0;
    for (value) |char| switch (std.ascii.toLower(char)) {
        'r' => bits |= @intFromEnum(Mode.read),
        'w' => bits |= @intFromEnum(Mode.write),
        'x' => bits |= @intFromEnum(Mode.execute),
        else => return error.InvalidPermission,
    };
    if (bits == 0) return error.InvalidPermission;
    return @enumFromInt(bits);
}

fn matches(pattern: []const u8, value: []const u8) bool {
    return isWildcard(pattern) or std.ascii.eqlIgnoreCase(pattern, value);
}

fn isWildcard(value: []const u8) bool {
    return std.mem.eql(u8, value, "*") or std.ascii.eqlIgnoreCase(value, "all");
}

fn containsWhitespace(value: []const u8) bool {
    for (value) |char| {
        if (std.ascii.isWhitespace(char) or char == '(' or char == ')') return true;
    }
    return false;
}

fn startsWithIgnoreCase(value: []const u8, prefix: []const u8) bool {
    return value.len >= prefix.len and std.ascii.eqlIgnoreCase(value[0..prefix.len], prefix);
}

fn parseTreeFromSlice(allocator: std.mem.Allocator, json: []const u8) ![]const Grant {
    var document = try std.json.parseFromSlice(std.json.Value, allocator, json, .{});
    defer document.deinit();
    return parseTree(allocator, document.value);
}

test "the tree names each kind and service once" {
    const allocator = std.testing.allocator;
    const grants = try parseTreeFromSlice(allocator,
        \\{"ap":{"resonus":{"session.open":"w","session.close":"w"}},
        \\ "rp":{"files":{"get":"r","save":"w"}}}
    );
    defer freeGrants(allocator, grants);

    try std.testing.expectEqual(@as(usize, 4), grants.len);
    const matcher = Matcher{ .grants = grants };
    try std.testing.expect(matcher.can("ap", "resonus", "session.open", .write));
    try std.testing.expect(matcher.can("rp", "files", "get", .read));
    try std.testing.expect(!matcher.can("rp", "files", "get", .write));
    try std.testing.expect(!matcher.can("rp", "resonus", "session.open", .write));
}

test "a bare mode in place of the method map covers every method" {
    const allocator = std.testing.allocator;
    const grants = try parseTreeFromSlice(allocator,
        \\{"*":{"*":"rwx"}}
    );
    defer freeGrants(allocator, grants);

    const matcher = Matcher{ .grants = grants };
    try std.testing.expect(matcher.can("rp", "anything", "atAll", .all));
    try std.testing.expect(matcher.can("", "anything", "atAll", .execute));
}

test "a grant under the wildcard kind answers a kinded question" {
    const allocator = std.testing.allocator;
    const grants = try parseTreeFromSlice(allocator,
        \\{"*":{"files":{"save":"w"}}}
    );
    defer freeGrants(allocator, grants);

    const matcher = Matcher{ .grants = grants };
    try std.testing.expect(matcher.can("rp", "files", "save", .write));
    try std.testing.expect(matcher.can("", "files", "save", .write));
}

test "a kinded grant does not leak across kinds" {
    const allocator = std.testing.allocator;
    const grants = try parseTreeFromSlice(allocator,
        \\{"wf":{"workflows":{"*":"x"}},"rp":{"files":{"save":"w"}}}
    );
    defer freeGrants(allocator, grants);

    const matcher = Matcher{ .grants = grants };
    try std.testing.expect(matcher.can("wf", "workflows", "run", .execute));
    // The same name under another kind is a different resource entirely.
    try std.testing.expect(!matcher.can("rp", "workflows", "run", .execute));
    try std.testing.expect(!matcher.can("wf", "other", "run", .execute));
    // A grant to write says nothing about running, and vice versa.
    try std.testing.expect(!matcher.can("rp", "files", "save", .execute));
    try std.testing.expect(!matcher.can("wf", "workflows", "run", .write));
}

test "matcher applies service and method wildcards case insensitively" {
    const allocator = std.testing.allocator;
    const grants = try parseTreeFromSlice(allocator,
        \\{"*":{"Files":{"List":"r"},"all":{"audit":"w"},"logs":{"*":"r"}}}
    );
    defer freeGrants(allocator, grants);

    const matcher = Matcher{ .grants = grants };
    try std.testing.expect(matcher.can("", "files", "list", .read));
    try std.testing.expect(!matcher.can("", "files", "list", .write));
    try std.testing.expect(matcher.can("", "any-service", "AUDIT", .write));
    try std.testing.expect(matcher.can("", "LOGS", "tail", .read));
    try std.testing.expect(!matcher.can("", "logs", "tail", .write));
}

test "an unreadable node grants nothing instead of refusing the whole claim" {
    const allocator = std.testing.allocator;
    const grants = try parseTreeFromSlice(allocator,
        \\{"rp":{"files":{"save":"zz","update":["w"],"get":"r"}},"ap":"not-an-object"}
    );
    defer freeGrants(allocator, grants);

    try std.testing.expectEqual(@as(usize, 1), grants.len);
    const matcher = Matcher{ .grants = grants };
    try std.testing.expect(matcher.can("rp", "files", "get", .read));
    try std.testing.expect(!matcher.can("rp", "files", "save", .write));
}

test "an empty claim grants nothing" {
    const allocator = std.testing.allocator;
    const grants = try parseTreeFromSlice(allocator, "{}");
    defer freeGrants(allocator, grants);
    try std.testing.expectEqual(@as(usize, 0), grants.len);
}

test "query syntax names one grant" {
    const no_mode = try parsePermission(" Files / List ");
    try std.testing.expectEqualStrings("Files", no_mode.service);
    try std.testing.expectEqualStrings("List", no_mode.method);
    try std.testing.expectEqual(Mode.all, no_mode.mode);
    try std.testing.expectEqualStrings("", no_mode.kind);

    const repository = try parsePermission("rp/files/save(w)");
    try std.testing.expectEqualStrings("rp", repository.kind);
    try std.testing.expectEqualStrings("files", repository.service);
    try std.testing.expectEqualStrings("save", repository.method);

    try std.testing.expectEqual(Mode.read_write, (try parsePermission("files/list( wr )")).mode);
    try std.testing.expectError(error.InvalidPermission, parsePermission("files list(r)"));
    try std.testing.expectError(error.InvalidPermission, parsePermission("files/list(rz)"));
    try std.testing.expectError(error.InvalidPermission, parsePermission("files/list(r) trailing"));
}

test "execute is its own bit, not a step above write" {
    try std.testing.expectEqual(Mode.execute, (try parsePermission("wf/report(x)")).mode);
    try std.testing.expectEqual(Mode.all, (try parsePermission("wf/report(rwx)")).mode);
    try std.testing.expect(!Mode.write.allows(.execute));
    try std.testing.expect(!Mode.execute.allows(.write));
    try std.testing.expect(Mode.all.allows(.execute));
}

test "method mode follows the TS read prefixes" {
    try std.testing.expectEqual(Mode.read, resolveMode("getUser"));
    try std.testing.expectEqual(Mode.read, resolveMode("DESCRIBE"));
    try std.testing.expectEqual(Mode.write, resolveMode("deleteUser"));
}
