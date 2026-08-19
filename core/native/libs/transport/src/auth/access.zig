const std = @import("std");

/// Mirrors tools/nrpc/src/runtime/access-control.ts.
pub const Mode = enum(u2) {
    read = 1,
    write = 2,
    read_write = 3,

    pub fn allows(self: Mode, required: Mode) bool {
        return (@intFromEnum(self) & @intFromEnum(required)) == @intFromEnum(required);
    }
};

pub const Permission = struct {
    service: []const u8,
    method: []const u8,
    mode: Mode,
};

pub const ParseError = error{InvalidPermission};

pub fn parsePermission(value: []const u8) ParseError!Permission {
    const input = std.mem.trim(u8, value, " \t\r\n");
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
    } else .read_write;

    return .{ .service = service, .method = method, .mode = mode };
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

    pub fn can(self: Matcher, service: []const u8, method: []const u8, required: Mode) bool {
        for (self.permissions) |raw| {
            const permission = parsePermission(raw) catch continue;
            if (!matches(permission.service, service) or !matches(permission.method, method)) continue;
            if (permission.mode.allows(required)) return true;
        }
        return false;
    }
};

fn parseMode(value: []const u8) ParseError!Mode {
    if (value.len == 0) return error.InvalidPermission;
    var has_read = false;
    var has_write = false;
    for (value) |char| switch (std.ascii.toLower(char)) {
        'r' => has_read = true,
        'w' => has_write = true,
        else => return error.InvalidPermission,
    };
    if (has_read and has_write) return .read_write;
    if (has_read) return .read;
    if (has_write) return .write;
    return error.InvalidPermission;
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
    try std.testing.expectEqual(Mode.read_write, no_mode.mode);

    try std.testing.expectEqual(Mode.read_write, (try parsePermission("files/list( wr )")).mode);
    try std.testing.expectError(error.InvalidPermission, parsePermission("files list(r)"));
    try std.testing.expectError(error.InvalidPermission, parsePermission("files/list(rx)"));
    try std.testing.expectError(error.InvalidPermission, parsePermission("files/list(r) trailing"));
}

test "matcher applies service and method wildcards case insensitively" {
    const permissions = [_][]const u8{
        "Files/List(r)",
        "all/audit(w)",
        "logs/*(r)",
    };
    const matcher = Matcher{ .permissions = &permissions };

    try std.testing.expect(matcher.can("files", "list", .read));
    try std.testing.expect(!matcher.can("files", "list", .write));
    try std.testing.expect(matcher.can("any-service", "AUDIT", .write));
    try std.testing.expect(matcher.can("LOGS", "tail", .read));
    try std.testing.expect(!matcher.can("logs", "tail", .write));
}

test "method mode follows the TS read prefixes" {
    try std.testing.expectEqual(Mode.read, resolveMode("getUser"));
    try std.testing.expectEqual(Mode.read, resolveMode("DESCRIBE"));
    try std.testing.expectEqual(Mode.write, resolveMode("deleteUser"));
}
