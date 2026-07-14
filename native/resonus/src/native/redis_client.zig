const std = @import("std");

const CRLF = "\r\n";

pub const Config = struct {
    url: []const u8,
    key_prefix: []const u8,
    ttl_seconds: u32,
};

pub const Client = struct {
    allocator: std.mem.Allocator,
    host: []u8,
    port: u16,
    password: ?[]u8,
    db: ?u8,
    key_prefix: []u8,
    ttl_seconds: u32,

    pub fn init(allocator: std.mem.Allocator, cfg: Config) !Client {
        const parsed = try parseRedisUrl(allocator, cfg.url);
        errdefer parsed.deinit(allocator);
        return .{
            .allocator = allocator,
            .host = parsed.host,
            .port = parsed.port,
            .password = parsed.password,
            .db = parsed.db,
            .key_prefix = try allocator.dupe(u8, cfg.key_prefix),
            .ttl_seconds = cfg.ttl_seconds,
        };
    }

    pub fn deinit(self: *Client) void {
        self.allocator.free(self.host);
        if (self.password) |password| self.allocator.free(password);
        self.allocator.free(self.key_prefix);
        self.* = undefined;
    }

    pub fn buildKey(self: *const Client, allocator: std.mem.Allocator, parts: []const []const u8) ![]u8 {
        var len = self.key_prefix.len;
        for (parts) |part| len += 1 + part.len;
        const out = try allocator.alloc(u8, len);
        var pos: usize = 0;
        @memcpy(out[pos .. pos + self.key_prefix.len], self.key_prefix);
        pos += self.key_prefix.len;
        for (parts) |part| {
            out[pos] = ':';
            pos += 1;
            @memcpy(out[pos .. pos + part.len], part);
            pos += part.len;
        }
        return out;
    }

    pub fn setBytes(self: *Client, key: []const u8, value: []const u8) !void {
        const ttl = try std.fmt.allocPrint(self.allocator, "{d}", .{self.ttl_seconds});
        defer self.allocator.free(ttl);
        if (self.ttl_seconds > 0) {
            try self.simpleCommand(&.{ "SET", key, value, "EX", ttl });
        } else {
            try self.simpleCommand(&.{ "SET", key, value });
        }
    }

    pub fn getBytes(self: *Client, allocator: std.mem.Allocator, key: []const u8) !?[]u8 {
        const fd = try self.connect();
        defer _ = std.c.close(fd);
        try self.prepare(fd);
        try writeCommand(fd, &.{ "GET", key });
        return try readBulk(allocator, fd);
    }

    pub fn delete(self: *Client, key: []const u8) !void {
        try self.simpleCommand(&.{ "DEL", key });
    }

    pub fn keys(self: *Client, allocator: std.mem.Allocator, pattern: []const u8) ![][]u8 {
        const fd = try self.connect();
        defer _ = std.c.close(fd);
        try self.prepare(fd);
        try writeCommand(fd, &.{ "KEYS", pattern });
        return try readArray(allocator, fd);
    }

    fn simpleCommand(self: *Client, args: []const []const u8) !void {
        const fd = try self.connect();
        defer _ = std.c.close(fd);
        try self.prepare(fd);
        try writeCommand(fd, args);
        try readSimpleOrInteger(fd);
    }

    fn prepare(self: *Client, fd: std.posix.fd_t) !void {
        if (self.password) |password| {
            try writeCommand(fd, &.{ "AUTH", password });
            try readSimpleOrInteger(fd);
        }
        if (self.db) |db| {
            const db_s = try std.fmt.allocPrint(self.allocator, "{d}", .{db});
            defer self.allocator.free(db_s);
            try writeCommand(fd, &.{ "SELECT", db_s });
            try readSimpleOrInteger(fd);
        }
    }

    fn connect(self: *Client) !std.posix.fd_t {
        const addr = try resolveHost(self.host, self.port);
        const fd = try socket(std.posix.AF.INET, std.posix.SOCK.STREAM, std.posix.IPPROTO.TCP);
        errdefer _ = std.c.close(fd);
        try connectFd(fd, @ptrCast(&addr), @sizeOf(std.posix.sockaddr.in));
        return fd;
    }
};

const ParsedUrl = struct {
    host: []u8,
    port: u16,
    password: ?[]u8,
    db: ?u8,

    fn deinit(self: ParsedUrl, allocator: std.mem.Allocator) void {
        allocator.free(self.host);
        if (self.password) |password| allocator.free(password);
    }
};

fn parseRedisUrl(allocator: std.mem.Allocator, url_raw: []const u8) !ParsedUrl {
    const trimmed = std.mem.trim(u8, url_raw, " \t\r\n");
    const rest = if (std.mem.startsWith(u8, trimmed, "redis://"))
        trimmed["redis://".len..]
    else if (std.mem.startsWith(u8, trimmed, "valkey://"))
        trimmed["valkey://".len..]
    else
        trimmed;

    const slash = std.mem.indexOfScalar(u8, rest, '/') orelse rest.len;
    const authority = rest[0..slash];
    const db = if (slash < rest.len and slash + 1 < rest.len)
        std.fmt.parseInt(u8, rest[slash + 1 ..], 10) catch null
    else
        null;

    const at = std.mem.lastIndexOfScalar(u8, authority, '@');
    const host_port = if (at) |i| authority[i + 1 ..] else authority;
    const password = if (at) |i| blk: {
        const userinfo = authority[0..i];
        const colon = std.mem.lastIndexOfScalar(u8, userinfo, ':');
        const raw = if (colon) |c| userinfo[c + 1 ..] else userinfo;
        break :blk if (raw.len > 0) try allocator.dupe(u8, raw) else null;
    } else null;
    errdefer if (password) |p| allocator.free(p);

    const colon = std.mem.lastIndexOfScalar(u8, host_port, ':');
    const host_raw = if (colon) |i| host_port[0..i] else host_port;
    const port = if (colon) |i| std.fmt.parseInt(u16, host_port[i + 1 ..], 10) catch 6379 else 6379;
    const host = try allocator.dupe(u8, if (host_raw.len > 0) host_raw else "127.0.0.1");

    return .{ .host = host, .port = port, .password = password, .db = db };
}

fn writeCommand(fd: std.posix.fd_t, args: []const []const u8) !void {
    var head: [64]u8 = undefined;
    const n = try std.fmt.bufPrint(&head, "*{d}" ++ CRLF, .{args.len});
    try writeAll(fd, n);
    for (args) |arg| {
        const len = try std.fmt.bufPrint(&head, "${d}" ++ CRLF, .{arg.len});
        try writeAll(fd, len);
        try writeAll(fd, arg);
        try writeAll(fd, CRLF);
    }
}

fn readSimpleOrInteger(fd: std.posix.fd_t) !void {
    var prefix: [1]u8 = undefined;
    try readAll(fd, &prefix);
    switch (prefix[0]) {
        '+', ':' => {
            var buf: [512]u8 = undefined;
            _ = try readLine(fd, &buf);
        },
        '-' => return error.RedisCommandFailed,
        else => return error.InvalidRedisResponse,
    }
}

fn readBulk(allocator: std.mem.Allocator, fd: std.posix.fd_t) !?[]u8 {
    var prefix: [1]u8 = undefined;
    try readAll(fd, &prefix);
    if (prefix[0] == '-') return error.RedisCommandFailed;
    if (prefix[0] != '$') return error.InvalidRedisResponse;
    var line_buf: [64]u8 = undefined;
    const line = try readLine(fd, &line_buf);
    const len_i = try std.fmt.parseInt(isize, line, 10);
    if (len_i < 0) return null;
    const len: usize = @intCast(len_i);
    const out = try allocator.alloc(u8, len);
    errdefer allocator.free(out);
    try readAll(fd, out);
    var crlf: [2]u8 = undefined;
    try readAll(fd, &crlf);
    return out;
}

fn readArray(allocator: std.mem.Allocator, fd: std.posix.fd_t) ![][]u8 {
    var prefix: [1]u8 = undefined;
    try readAll(fd, &prefix);
    if (prefix[0] == '-') return error.RedisCommandFailed;
    if (prefix[0] != '*') return error.InvalidRedisResponse;
    var line_buf: [64]u8 = undefined;
    const line = try readLine(fd, &line_buf);
    const count_i = try std.fmt.parseInt(isize, line, 10);
    if (count_i <= 0) return try allocator.alloc([]u8, 0);
    const count: usize = @intCast(count_i);
    var out = try std.ArrayList([]u8).initCapacity(allocator, count);
    errdefer {
        for (out.items) |item| allocator.free(item);
        out.deinit(allocator);
    }
    for (0..count) |_| {
        const item = (try readBulk(allocator, fd)) orelse continue;
        try out.append(allocator, item);
    }
    return out.toOwnedSlice(allocator);
}

fn readLine(fd: std.posix.fd_t, buf: []u8) ![]u8 {
    var pos: usize = 0;
    while (pos < buf.len) {
        var c: [1]u8 = undefined;
        try readAll(fd, &c);
        if (c[0] == '\r') {
            try readAll(fd, &c);
            if (c[0] != '\n') return error.InvalidRedisResponse;
            return buf[0..pos];
        }
        buf[pos] = c[0];
        pos += 1;
    }
    return error.RedisLineTooLong;
}

fn socket(domain: c_uint, socket_type: c_uint, protocol: c_uint) !std.posix.fd_t {
    const rc = std.c.socket(domain, socket_type, protocol);
    if (rc < 0) return error.SocketFailed;
    return @intCast(rc);
}

fn connectFd(fd: std.posix.fd_t, addr: *const anyopaque, len: std.posix.socklen_t) !void {
    switch (std.c.errno(std.c.connect(fd, @ptrCast(@alignCast(addr)), len))) {
        .SUCCESS => {},
        else => return error.ConnectFailed,
    }
}

fn resolveHost(host: []const u8, port: u16) !std.posix.sockaddr.in {
    if (parseIp4Address(host, port)) |addr| return addr else |_| {}

    var host_z: [256:0]u8 = undefined;
    if (host.len >= host_z.len) return error.HostTooLong;
    @memcpy(host_z[0..host.len], host);
    host_z[host.len] = 0;
    var port_buf: [16:0]u8 = undefined;
    const port_str = try std.fmt.bufPrintZ(&port_buf, "{d}", .{port});

    var hints = std.mem.zeroes(std.c.addrinfo);
    hints.family = std.posix.AF.INET;
    hints.socktype = std.posix.SOCK.STREAM;
    hints.protocol = std.posix.IPPROTO.TCP;
    var res: ?*std.c.addrinfo = null;
    const rc = std.c.getaddrinfo(&host_z, port_str.ptr, &hints, &res);
    if (@intFromEnum(rc) != 0 or res == null) return error.ResolveFailed;
    defer std.c.freeaddrinfo(res.?);

    const sa = res.?.addr orelse return error.ResolveFailed;
    return @as(*const std.posix.sockaddr.in, @ptrCast(@alignCast(sa))).*;
}

fn parseIp4Address(host: []const u8, port: u16) !std.posix.sockaddr.in {
    var parts = std.mem.splitScalar(u8, host, '.');
    var octets: [4]u8 = undefined;
    var i: usize = 0;
    while (parts.next()) |part| {
        if (i >= 4) return error.InvalidIp;
        octets[i] = std.fmt.parseInt(u8, part, 10) catch return error.InvalidIp;
        i += 1;
    }
    if (i != 4) return error.InvalidIp;

    var addr: std.posix.sockaddr.in = .{
        .family = std.posix.AF.INET,
        .port = std.mem.nativeToBig(u16, port),
        .addr = 0,
        .zero = [_]u8{0} ** 8,
    };
    addr.addr = (@as(u32, octets[0]) << 24) | (@as(u32, octets[1]) << 16) | (@as(u32, octets[2]) << 8) | octets[3];
    addr.addr = std.mem.nativeToBig(u32, addr.addr);
    return addr;
}

fn writeAll(fd: std.posix.fd_t, data: []const u8) !void {
    var offset: usize = 0;
    while (offset < data.len) {
        const n = std.c.write(fd, data.ptr + offset, data.len - offset);
        if (n < 0) return error.WriteFailed;
        if (n == 0) return error.WriteFailed;
        offset += @intCast(n);
    }
}

fn readAll(fd: std.posix.fd_t, buf: []u8) !void {
    var offset: usize = 0;
    while (offset < buf.len) {
        const n = std.c.read(fd, buf.ptr + offset, buf.len - offset);
        if (n < 0) return error.ReadFailed;
        if (n == 0) return error.ConnectionClosed;
        offset += @intCast(n);
    }
}
