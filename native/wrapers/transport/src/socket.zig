const std = @import("std");

const default_timeout_ms: u32 = 5_000;

fn getOperationTimeoutMs() u32 {
    const raw = std.posix.getenv("TRANSPORT_OP_TIMEOUT_MS") orelse return default_timeout_ms;
    const parsed = std.fmt.parseUnsigned(u32, raw, 10) catch return default_timeout_ms;
    return parsed;
}

pub fn setOperationTimeout(fd: std.posix.fd_t, timeout_ms: u32) !void {
    const sec: isize = @intCast(timeout_ms / 1000);
    const usec: isize = @intCast((timeout_ms % 1000) * 1000);
    var tv = std.posix.timeval{
        .sec = sec,
        .usec = usec,
    };
    const opt = std.mem.asBytes(&tv);
    try std.posix.setsockopt(fd, std.posix.SOL.SOCKET, std.posix.SO.RCVTIMEO, opt);
    try std.posix.setsockopt(fd, std.posix.SOL.SOCKET, std.posix.SO.SNDTIMEO, opt);
}

// ── Unix socket ───────────────────────────────────────────────────────────────

/// Create a Unix domain socket server, bind, and listen.
/// Returns the server fd.
pub fn listen(path: [*:0]const u8) !std.posix.fd_t {
    const path_slice = std.mem.span(path);

    std.posix.unlink(path_slice) catch |err| switch (err) {
        error.FileNotFound => {},
        else => return err,
    };

    const fd = try std.posix.socket(
        std.posix.AF.UNIX,
        std.posix.SOCK.STREAM,
        0,
    );
    errdefer std.posix.close(fd);

    var addr: std.posix.sockaddr.un = std.mem.zeroes(std.posix.sockaddr.un);
    addr.family = std.posix.AF.UNIX;
    if (path_slice.len + 1 > addr.path.len) return error.PathTooLong;
    @memcpy(addr.path[0..path_slice.len], path_slice);
    addr.path[path_slice.len] = 0;

    try std.posix.bind(fd, @ptrCast(&addr), @sizeOf(std.posix.sockaddr.un));
    try std.posix.listen(fd, 128);

    return fd;
}

/// Connect to a Unix domain socket server.
/// Returns the connected fd.
pub fn connect(path: [*:0]const u8) !std.posix.fd_t {
    const path_slice = std.mem.span(path);

    const fd = try std.posix.socket(
        std.posix.AF.UNIX,
        std.posix.SOCK.STREAM,
        0,
    );
    errdefer std.posix.close(fd);

    var addr: std.posix.sockaddr.un = std.mem.zeroes(std.posix.sockaddr.un);
    addr.family = std.posix.AF.UNIX;
    if (path_slice.len + 1 > addr.path.len) return error.PathTooLong;
    @memcpy(addr.path[0..path_slice.len], path_slice);
    addr.path[path_slice.len] = 0;

    try std.posix.connect(fd, @ptrCast(&addr), @sizeOf(std.posix.sockaddr.un));
    try setOperationTimeout(fd, getOperationTimeoutMs());

    return fd;
}

// ── TCP socket ────────────────────────────────────────────────────────────────

/// Create a TCP server socket, bind to host:port, and listen.
/// Pass host = "0.0.0.0" to listen on all interfaces.
/// Returns the server fd.
pub fn listenTcp(host: [*:0]const u8, port: u16) !std.posix.fd_t {
    const fd = try std.posix.socket(
        std.posix.AF.INET,
        std.posix.SOCK.STREAM,
        std.posix.IPPROTO.TCP,
    );
    errdefer std.posix.close(fd);

    // SO_REUSEADDR so the port is reusable immediately after restart
    const one: c_int = 1;
    try std.posix.setsockopt(
        fd,
        std.posix.SOL.SOCKET,
        std.posix.SO.REUSEADDR,
        std.mem.asBytes(&one),
    );

    const ip4 = try std.net.Address.parseIp4(std.mem.span(host), port);
    try std.posix.bind(fd, &ip4.any, ip4.getOsSockLen());
    try std.posix.listen(fd, 128);

    return fd;
}

/// Connect to a TCP server at host:port.
/// Returns the connected fd.
pub fn connectTcp(host: [*:0]const u8, port: u16) !std.posix.fd_t {
    const fd = try std.posix.socket(
        std.posix.AF.INET,
        std.posix.SOCK.STREAM,
        std.posix.IPPROTO.TCP,
    );
    errdefer std.posix.close(fd);

    const ip4 = try std.net.Address.parseIp4(std.mem.span(host), port);
    try std.posix.connect(fd, &ip4.any, ip4.getOsSockLen());
    try setOperationTimeout(fd, getOperationTimeoutMs());

    return fd;
}
