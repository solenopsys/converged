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
};

/// What a permission is about.
///
/// Without it every grant reads as a service method, which is why "may run this
/// workflow" had to be spelled "may call the runtime's runWorkflow" — a grant
/// that cannot tell one workflow from another. The kind makes the resource the
/// subject of the permission:
///
/// * `rp` — a repository microservice (`rp/files/save(w)`)
/// * `ap` — a native application (`ap/resonus/call(w)`)
/// * `wf` — a workflow, executed rather than called (`wf/file-processing(x)`)
/// * `lm` — a lambda (`lm/thumbnail(x)`)
///
/// A grant written without one — `files/save(w)` — matches any kind. That keeps
/// every permission issued before kinds existed working, and lets a deployment
/// tighten its presets one line at a time instead of all at once.
pub const Permission = struct {
    kind: ?[]const u8,
    service: []const u8,
    method: []const u8,
    mode: Mode,
};

pub const ParseError = error{InvalidPermission};

/// `[kind/]service/method[(mode)]`.
///
/// Two segments leave the kind unset and match anything; three name it. A
/// workflow has no method of its own, so `wf/file-processing(x)` puts the
/// workflow in the service position and leaves the method to a wildcard.
pub fn parsePermission(value: []const u8) ParseError!Permission {
    var input = std.mem.trim(u8, value, " \t\r\n");

    var kind: ?[]const u8 = null;
    if (std.mem.count(u8, input, "/") == 2) {
        const first = std.mem.indexOfScalar(u8, input, '/').?;
        const head = std.mem.trim(u8, input[0..first], " \t\r\n");
        if (head.len == 0 or containsWhitespace(head)) return error.InvalidPermission;
        kind = head;
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
    permissions: []const []const u8,

    /// An empty `kind` asks about any kind, which is what a caller that predates
    /// kinds does. A grant carrying no kind of its own answers either way.
    pub fn can(self: Matcher, kind: []const u8, service: []const u8, method: []const u8, required: Mode) bool {
        for (self.permissions) |raw| {
            const permission = parsePermission(raw) catch continue;
            if (!kindMatches(permission.kind, kind)) continue;
            if (!matches(permission.service, service) or !matches(permission.method, method)) continue;
            if (permission.mode.allows(required)) return true;
        }
        return false;
    }
};

fn kindMatches(granted: ?[]const u8, wanted: []const u8) bool {
    const value = granted orelse return true;
    if (wanted.len == 0) return true;
    return matches(value, wanted);
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

test "permission parsing mirrors TS defaults and normalization" {
    const no_mode = try parsePermission(" Files / List ");
    try std.testing.expectEqualStrings("Files", no_mode.service);
    try std.testing.expectEqualStrings("List", no_mode.method);
    try std.testing.expectEqual(Mode.all, no_mode.mode);
    try std.testing.expect(no_mode.kind == null);

    try std.testing.expectEqual(Mode.read_write, (try parsePermission("files/list( wr )")).mode);
    try std.testing.expectError(error.InvalidPermission, parsePermission("files list(r)"));
    try std.testing.expectError(error.InvalidPermission, parsePermission("files/list(rz)"));
    try std.testing.expectError(error.InvalidPermission, parsePermission("files/list(r) trailing"));
}

test "a third segment names the kind the permission is about" {
    const repository = try parsePermission("rp/files/save(w)");
    try std.testing.expectEqualStrings("rp", repository.kind.?);
    try std.testing.expectEqualStrings("files", repository.service);
    try std.testing.expectEqualStrings("save", repository.method);

    const workflow = try parsePermission("wf/file-processing/*(x)");
    try std.testing.expectEqualStrings("wf", workflow.kind.?);
    try std.testing.expectEqual(Mode.execute, workflow.mode);
}

test "execute is its own bit, not a step above write" {
    try std.testing.expectEqual(Mode.execute, (try parsePermission("wf/report(x)")).mode);
    try std.testing.expectEqual(Mode.all, (try parsePermission("wf/report(rwx)")).mode);
    // A grant to write says nothing about running, and vice versa.
    try std.testing.expect(!Mode.write.allows(.execute));
    try std.testing.expect(!Mode.execute.allows(.write));
    try std.testing.expect(Mode.all.allows(.execute));
}

test "matcher applies service and method wildcards case insensitively" {
    const permissions = [_][]const u8{
        "Files/List(r)",
        "all/audit(w)",
        "logs/*(r)",
    };
    const matcher = Matcher{ .permissions = &permissions };

    try std.testing.expect(matcher.can("", "files", "list", .read));
    try std.testing.expect(!matcher.can("", "files", "list", .write));
    try std.testing.expect(matcher.can("", "any-service", "AUDIT", .write));
    try std.testing.expect(matcher.can("", "LOGS", "tail", .read));
    try std.testing.expect(!matcher.can("", "logs", "tail", .write));
}

test "a kindless grant still answers a kinded question" {
    // Every preset written before kinds existed looks like this, and must keep
    // working without being rewritten.
    const permissions = [_][]const u8{"files/save(w)"};
    const matcher = Matcher{ .permissions = &permissions };
    try std.testing.expect(matcher.can("rp", "files", "save", .write));
    try std.testing.expect(matcher.can("", "files", "save", .write));
}

test "a kinded grant does not leak across kinds" {
    const permissions = [_][]const u8{
        "wf/file-processing/*(x)",
        "rp/files/save(w)",
    };
    const matcher = Matcher{ .permissions = &permissions };

    try std.testing.expect(matcher.can("wf", "file-processing", "run", .execute));
    // The same name under another kind is a different resource entirely.
    try std.testing.expect(!matcher.can("rp", "file-processing", "run", .execute));
    try std.testing.expect(!matcher.can("wf", "other-workflow", "run", .execute));
    try std.testing.expect(matcher.can("rp", "files", "save", .write));
    try std.testing.expect(!matcher.can("ap", "files", "save", .write));
}

test "method mode follows the TS read prefixes" {
    try std.testing.expectEqual(Mode.read, resolveMode("getUser"));
    try std.testing.expectEqual(Mode.read, resolveMode("DESCRIBE"));
    try std.testing.expectEqual(Mode.write, resolveMode("deleteUser"));
}
