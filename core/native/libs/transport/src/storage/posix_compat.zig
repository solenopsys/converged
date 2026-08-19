const std = @import("std");

pub fn getenv(name: [*:0]const u8) ?[:0]const u8 {
    const value = std.c.getenv(name) orelse return null;
    return std.mem.span(value);
}

pub fn write(fd: std.posix.fd_t, data: []const u8) !usize {
    if (data.len == 0) return 0;
    while (true) {
        const rc = std.c.write(fd, data.ptr, data.len);
        switch (std.c.errno(rc)) {
            .SUCCESS => return @intCast(rc),
            .INTR => continue,
            .AGAIN => return error.WouldBlock,
            .PIPE => return error.BrokenPipe,
            .BADF => return error.Unexpected,
            else => return error.Unexpected,
        }
    }
}

pub fn close(fd: std.posix.fd_t) void {
    _ = std.c.close(fd);
}

pub fn unlink(path: []const u8) !void {
    const path_z = try std.posix.toPosixPath(path);
    switch (std.c.errno(std.c.unlink(&path_z))) {
        .SUCCESS => return,
        .NOENT => return error.FileNotFound,
        .ACCES => return error.AccessDenied,
        else => return error.Unexpected,
    }
}

pub fn socket(domain: anytype, socket_type: anytype, protocol: anytype) !std.posix.fd_t {
    const rc = std.c.socket(
        @as(c_uint, @intCast(domain)),
        @as(c_uint, @intCast(socket_type)),
        @as(c_uint, @intCast(protocol)),
    );
    switch (std.c.errno(rc)) {
        .SUCCESS => return @intCast(rc),
        .ACCES => return error.AccessDenied,
        .AFNOSUPPORT => return error.AddressFamilyNotSupported,
        .MFILE, .NFILE, .NOBUFS, .NOMEM => return error.SystemResources,
        .PROTONOSUPPORT => return error.ProtocolNotSupported,
        else => return error.Unexpected,
    }
}

pub fn parseIp4Address(host: []const u8, port: u16) !std.posix.sockaddr.in {
    const ip4 = try std.Io.net.Ip4Address.parse(host, port);
    return .{
        .port = std.mem.nativeToBig(u16, ip4.port),
        .addr = std.mem.readInt(u32, &ip4.bytes, .little),
    };
}

pub fn resolveHost(host: []const u8, port: u16) !std.posix.sockaddr.in {
    // fast path: already an IPv4 literal
    if (std.Io.net.Ip4Address.parse(host, port)) |ip4| {
        return .{
            .port = std.mem.nativeToBig(u16, ip4.port),
            .addr = std.mem.readInt(u32, &ip4.bytes, .little),
        };
    } else |_| {}

    // hostname — use getaddrinfo
    const host_z = try std.posix.toPosixPath(host);
    var port_buf: [6]u8 = undefined;
    const port_str = std.fmt.bufPrintZ(&port_buf, "{d}", .{port}) catch return error.Unexpected;

    var hints = std.mem.zeroes(std.c.addrinfo);
    hints.family = std.posix.AF.INET;
    hints.socktype = std.posix.SOCK.STREAM;

    var res: ?*std.c.addrinfo = null;
    const gai_rc = std.c.getaddrinfo(&host_z, port_str.ptr, &hints, &res);
    if (@intFromEnum(gai_rc) != 0) return error.NameResolutionFailed;
    defer std.c.freeaddrinfo(res.?);

    const ai = res orelse return error.NameResolutionFailed;
    const sa = ai.addr orelse return error.NameResolutionFailed;
    return @as(*const std.posix.sockaddr.in, @ptrCast(@alignCast(sa))).*;
}

pub fn bind(fd: std.posix.fd_t, addr: *const anyopaque, len: std.posix.socklen_t) !void {
    switch (std.c.errno(std.c.bind(fd, @ptrCast(@alignCast(addr)), len))) {
        .SUCCESS => return,
        .ACCES => return error.AccessDenied,
        .ADDRINUSE => return error.AddressInUse,
        .BADF => return error.Unexpected,
        else => return error.Unexpected,
    }
}

pub fn listen(fd: std.posix.fd_t, backlog: u32) !void {
    switch (std.c.errno(std.c.listen(fd, backlog))) {
        .SUCCESS => return,
        .ADDRINUSE => return error.AddressInUse,
        .BADF => return error.Unexpected,
        else => return error.Unexpected,
    }
}

pub fn connect(fd: std.posix.fd_t, addr: *const anyopaque, len: std.posix.socklen_t) !void {
    switch (std.c.errno(std.c.connect(fd, @ptrCast(@alignCast(addr)), len))) {
        .SUCCESS => return,
        .ACCES => return error.AccessDenied,
        .CONNREFUSED => return error.ConnectionRefused,
        .NOENT => return error.FileNotFound,
        .TIMEDOUT => return error.ConnectionTimedOut,
        else => return error.Unexpected,
    }
}

pub fn accept(
    fd: std.posix.fd_t,
    addr: ?*std.posix.sockaddr,
    len: ?*std.posix.socklen_t,
    flags: u32,
) !std.posix.fd_t {
    const rc = if (flags == 0)
        std.c.accept(fd, addr, len)
    else
        std.c.accept4(fd, addr, len, flags);

    switch (std.c.errno(rc)) {
        .SUCCESS => return @intCast(rc),
        .AGAIN => return error.WouldBlock,
        .BADF => return error.Unexpected,
        else => return error.Unexpected,
    }
}
