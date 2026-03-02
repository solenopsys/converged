const std = @import("std");

// Message framing: 4-byte little-endian length prefix + raw body.
// Body will be Cap'n Proto bytes once the codec is wired in.
// Max message size: 64 MB.

const max_message_size: u32 = 64 * 1024 * 1024;

pub fn sendMessage(fd: std.posix.fd_t, data: []const u8) !void {
    if (data.len > max_message_size) return error.MessageTooLarge;
    var len_buf: [4]u8 = undefined;
    std.mem.writeInt(u32, &len_buf, @intCast(data.len), .little);
    try writeAll(fd, &len_buf);
    try writeAll(fd, data);
}

/// Caller owns the returned slice — free with allocator.free().
pub fn recvMessage(fd: std.posix.fd_t, allocator: std.mem.Allocator) ![]u8 {
    var len_buf: [4]u8 = undefined;
    try readAll(fd, &len_buf);
    const len = std.mem.readInt(u32, &len_buf, .little);
    if (len > max_message_size) return error.MessageTooLarge;

    const buf = try allocator.alloc(u8, len);
    errdefer allocator.free(buf);
    try readAll(fd, buf);
    return buf;
}

fn writeAll(fd: std.posix.fd_t, data: []const u8) !void {
    var sent: usize = 0;
    while (sent < data.len) {
        const n = try std.posix.write(fd, data[sent..]);
        if (n == 0) return error.BrokenPipe;
        sent += n;
    }
}

fn readAll(fd: std.posix.fd_t, buf: []u8) !void {
    var got: usize = 0;
    while (got < buf.len) {
        const n = try std.posix.read(fd, buf[got..]);
        if (n == 0) return error.EndOfStream;
        got += n;
    }
}
