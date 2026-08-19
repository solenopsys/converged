const std = @import("std");
const zimq = @import("zimq");
const posix_compat = @import("posix_compat.zig");

const allocator = std.heap.c_allocator;
const default_timeout_ms: u32 = 5_000;
const max_message_size: usize = 64 * 1024 * 1024;

const Role = enum { client, server };
const EndpointKind = enum { unix, tcp };

const Mutex = struct {
    raw: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,

    fn lock(self: *Mutex) void {
        _ = std.c.pthread_mutex_lock(&self.raw);
    }

    fn unlock(self: *Mutex) void {
        _ = std.c.pthread_mutex_unlock(&self.raw);
    }
};

const Connection = struct {
    context: *zimq.Context,
    socket: *zimq.Socket,
    role: Role,

    fn deinit(self: *Connection) void {
        self.socket.deinit();
        self.context.deinit();
        allocator.destroy(self);
    }
};

var registry_mutex: Mutex = .{};
var registry = std.AutoHashMap(i32, *Connection).init(allocator);
var next_handle: i32 = 1;

fn operationTimeoutMs() u32 {
    const raw = posix_compat.getenv("TRANSPORT_OP_TIMEOUT_MS") orelse return default_timeout_ms;
    return std.fmt.parseUnsigned(u32, raw, 10) catch default_timeout_ms;
}

fn endpoint(kind: EndpointKind, addr: [*:0]const u8, port: u16) ![:0]u8 {
    const value = std.mem.span(addr);
    const formatted = try switch (kind) {
        .unix => std.fmt.allocPrint(allocator, "ipc://{s}", .{value}),
        .tcp => std.fmt.allocPrint(allocator, "tcp://{s}:{d}", .{ value, port }),
    };
    defer allocator.free(formatted);
    return allocator.dupeZ(u8, formatted);
}

fn setTimeout(connection: *Connection, timeout_ms: u32) !void {
    const timeout: c_int = @intCast(@min(timeout_ms, @as(u32, std.math.maxInt(c_int))));
    try connection.socket.set(.rcvtimeo, timeout);
    try connection.socket.set(.sndtimeo, timeout);
}

fn create(role: Role, kind: EndpointKind, addr: [*:0]const u8, port: u16) !*Connection {
    const connection = try allocator.create(Connection);
    errdefer allocator.destroy(connection);

    const context = try zimq.Context.init();
    errdefer context.deinit();

    const socket = try zimq.Socket.init(context, switch (role) {
        .client => .req,
        .server => .rep,
    });
    errdefer socket.deinit();

    connection.* = .{ .context = context, .socket = socket, .role = role };
    try connection.socket.set(.linger, @as(c_int, 0));
    try setTimeout(connection, operationTimeoutMs());

    const url = try endpoint(kind, addr, port);
    defer allocator.free(url);
    if (role == .server and kind == .unix) {
        posix_compat.unlink(std.mem.span(addr)) catch |err| switch (err) {
            error.FileNotFound => {},
            else => return err,
        };
    }
    switch (role) {
        .client => try connection.socket.connect(url),
        .server => try connection.socket.bind(url),
    }
    return connection;
}

fn register(connection: *Connection) !i32 {
    registry_mutex.lock();
    defer registry_mutex.unlock();

    const handle = next_handle;
    next_handle +%= 1;
    if (next_handle <= 0) next_handle = 1;
    try registry.put(handle, connection);
    return handle;
}

pub fn connectUnix(path: [*:0]const u8) !i32 {
    return register(try create(.client, .unix, path, 0));
}

pub fn connectTcp(host: [*:0]const u8, port: u16) !i32 {
    return register(try create(.client, .tcp, host, port));
}

pub fn listenUnix(path: [*:0]const u8) !i32 {
    return register(try create(.server, .unix, path, 0));
}

pub fn listenTcp(host: [*:0]const u8, port: u16) !i32 {
    return register(try create(.server, .tcp, host, port));
}

/// ZeroMQ owns connection acceptance internally. The listener is the REP socket
/// that receives requests and sends responses, so its stable handle is returned.
pub fn accept(handle: i32) !i32 {
    registry_mutex.lock();
    defer registry_mutex.unlock();
    const connection = registry.get(handle) orelse return error.InvalidHandle;
    if (connection.role != .server) return error.NotServer;
    return handle;
}

pub fn close(handle: i32) void {
    registry_mutex.lock();
    const removed = registry.fetchRemove(handle);
    registry_mutex.unlock();
    if (removed) |entry| entry.value.deinit();
}

pub fn setOperationTimeout(handle: i32, timeout_ms: u32) !void {
    registry_mutex.lock();
    defer registry_mutex.unlock();
    const connection = registry.get(handle) orelse return error.InvalidHandle;
    try setTimeout(connection, timeout_ms);
}

pub fn sendMessage(handle: i32, data: []const u8) !void {
    if (data.len > max_message_size) return error.MessageTooLarge;
    registry_mutex.lock();
    defer registry_mutex.unlock();
    const connection = registry.get(handle) orelse return error.InvalidHandle;
    try connection.socket.sendSlice(data, .{});
}

/// Caller owns the returned buffer and must free it with the supplied allocator.
pub fn recvMessage(handle: i32, out_allocator: std.mem.Allocator) ![]u8 {
    registry_mutex.lock();
    defer registry_mutex.unlock();
    const connection = registry.get(handle) orelse return error.InvalidHandle;

    var message = zimq.Message.empty();
    defer message.deinit();
    const len = try connection.socket.recvMsg(&message, .{});
    if (len > max_message_size) return error.MessageTooLarge;
    return try out_allocator.dupe(u8, message.slice());
}

fn uniqueIpcPath(buffer: []u8) ![:0]const u8 {
    return std.fmt.bufPrintZ(buffer, "/tmp/behemoth-transport-{d}.sock", .{std.c.getpid()});
}

test "IPC transports raw Cap'n Proto bytes as one ZeroMQ message" {
    var path_buf: [96]u8 = undefined;
    const path = try uniqueIpcPath(&path_buf);

    const server = try listenUnix(path.ptr);
    defer close(server);
    const client = try connectUnix(path.ptr);
    defer close(client);

    try sendMessage(client, "capnp-request");
    const request = try recvMessage(server, std.testing.allocator);
    defer std.testing.allocator.free(request);
    try std.testing.expectEqualStrings("capnp-request", request);

    try sendMessage(server, "capnp-response");
    const response = try recvMessage(client, std.testing.allocator);
    defer std.testing.allocator.free(response);
    try std.testing.expectEqualStrings("capnp-response", response);
}

test "TCP transports raw Cap'n Proto bytes as one ZeroMQ message" {
    const port: u16 = 49_000 + @as(u16, @intCast(@mod(std.c.getpid(), 1_000)));
    const server = try listenTcp("127.0.0.1", port);
    defer close(server);
    const client = try connectTcp("127.0.0.1", port);
    defer close(client);

    try sendMessage(client, "capnp-request");
    const request = try recvMessage(server, std.testing.allocator);
    defer std.testing.allocator.free(request);
    try std.testing.expectEqualStrings("capnp-request", request);

    try sendMessage(server, "capnp-response");
    const response = try recvMessage(client, std.testing.allocator);
    defer std.testing.allocator.free(response);
    try std.testing.expectEqualStrings("capnp-response", response);
}
