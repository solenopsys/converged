const std = @import("std");

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

    return fd;
}
