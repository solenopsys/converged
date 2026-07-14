const std = @import("std");

const ContextNew = *const fn () callconv(.c) ?*anyopaque;
const ContextTerm = *const fn (?*anyopaque) callconv(.c) c_int;
const SocketNew = *const fn (?*anyopaque, c_int) callconv(.c) ?*anyopaque;
const SocketClose = *const fn (?*anyopaque) callconv(.c) c_int;
const Connect = *const fn (?*anyopaque, [*:0]const u8) callconv(.c) c_int;
const SetSocketOption = *const fn (?*anyopaque, c_int, ?*const anyopaque, usize) callconv(.c) c_int;
const Receive = *const fn (?*anyopaque, ?*anyopaque, usize, c_int) callconv(.c) c_int;
const Send = *const fn (?*anyopaque, ?*const anyopaque, usize, c_int) callconv(.c) c_int;
const GetSocketOption = *const fn (?*anyopaque, c_int, ?*anyopaque, *usize) callconv(.c) c_int;
const Errno = *const fn () callconv(.c) c_int;

const ZMQ_DEALER = 5;
const ZMQ_IDENTITY = 5;
const ZMQ_RCVMORE = 13;
const ZMQ_RCVTIMEO = 27;
const EAGAIN = 11;
const READY_INTERVAL_TICKS = 5;

pub const Config = struct {
    allocator: std.mem.Allocator,
    endpoint: [:0]u8,
    lib_path: []u8,
    identity: []u8,

    pub fn init(
        allocator: std.mem.Allocator,
        environ: *const std.process.Environ.Map,
        service_key: []const u8,
        default_identity: []const u8,
    ) !Config {
        var endpoint_key: [96]u8 = undefined;
        var lib_key: [96]u8 = undefined;
        var identity_key: [96]u8 = undefined;
        const endpoint_key_slice = try std.fmt.bufPrint(&endpoint_key, "{s}_FUJIN_ZMQ_ENDPOINT", .{service_key});
        const lib_key_slice = try std.fmt.bufPrint(&lib_key, "{s}_FUJIN_ZIMQ_LIB", .{service_key});
        const identity_key_slice = try std.fmt.bufPrint(&identity_key, "{s}_FUJIN_ZMQ_IDENTITY", .{service_key});

        const endpoint_value = nonEmpty(environ.get(endpoint_key_slice)) orelse
            nonEmpty(environ.get("FUJIN_ZMQ_ENDPOINT")) orelse
            "tcp://127.0.0.1:5557";
        const identity_value = nonEmpty(environ.get(identity_key_slice)) orelse default_identity;
        if (identity_value.len == 0 or identity_value.len > 255) return error.InvalidZmqIdentity;

        var default_lib: [768]u8 = undefined;
        const default_lib_slice = if (environ.get("CONVERGED_ROOT")) |root|
            try std.fmt.bufPrint(
                &default_lib,
                "{s}/native/wrapers/zimq/zig-out/lib/libzimq.so",
                .{root},
            )
        else
            "libzimq.so";
        const lib_value = nonEmpty(environ.get(lib_key_slice)) orelse
            nonEmpty(environ.get("FUJIN_ZIMQ_LIB")) orelse
            default_lib_slice;

        return .{
            .allocator = allocator,
            .endpoint = try allocator.dupeZ(u8, endpoint_value),
            .lib_path = try allocator.dupe(u8, lib_value),
            .identity = try allocator.dupe(u8, identity_value),
        };
    }

    pub fn deinit(self: *Config) void {
        self.allocator.free(self.endpoint);
        self.allocator.free(self.lib_path);
        self.allocator.free(self.identity);
        self.* = undefined;
    }
};

fn nonEmpty(value: ?[]const u8) ?[]const u8 {
    const text = value orelse return null;
    return if (text.len == 0) null else text;
}

pub const Client = struct {
    lib: std.DynLib,
    context: ?*anyopaque,
    socket: ?*anyopaque,
    context_term: ContextTerm,
    socket_close: SocketClose,
    send_fn: Send,
    receive: Receive,
    more: GetSocketOption,
    errno_fn: Errno,

    pub fn init(config: *const Config) !Client {
        var lib = try std.DynLib.open(config.lib_path);
        errdefer lib.close();

        const context_new = lib.lookup(ContextNew, "zmq_ctx_new") orelse return error.ZmqContextSymbolMissing;
        const context_term = lib.lookup(ContextTerm, "zmq_ctx_term") orelse return error.ZmqContextSymbolMissing;
        const socket_new = lib.lookup(SocketNew, "zmq_socket") orelse return error.ZmqSocketSymbolMissing;
        const socket_close = lib.lookup(SocketClose, "zmq_close") orelse return error.ZmqSocketSymbolMissing;
        const connect = lib.lookup(Connect, "zmq_connect") orelse return error.ZmqConnectSymbolMissing;
        const set_option = lib.lookup(SetSocketOption, "zmq_setsockopt") orelse return error.ZmqSocketOptionSymbolMissing;
        const send_fn = lib.lookup(Send, "zmq_send") orelse return error.ZmqSendSymbolMissing;
        const receive = lib.lookup(Receive, "zmq_recv") orelse return error.ZmqReceiveSymbolMissing;
        const more = lib.lookup(GetSocketOption, "zmq_getsockopt") orelse return error.ZmqSocketOptionSymbolMissing;
        const errno_fn = lib.lookup(Errno, "zmq_errno") orelse return error.ZmqErrnoSymbolMissing;

        const context = context_new() orelse return error.ZmqContextCreateFailed;
        errdefer _ = context_term(context);
        const socket = socket_new(context, ZMQ_DEALER) orelse return error.ZmqSocketCreateFailed;
        errdefer _ = socket_close(socket);

        if (set_option(socket, ZMQ_IDENTITY, config.identity.ptr, config.identity.len) != 0)
            return error.ZmqIdentitySetFailed;
        var receive_timeout_ms: c_int = 1000;
        if (set_option(socket, ZMQ_RCVTIMEO, &receive_timeout_ms, @sizeOf(c_int)) != 0)
            return error.ZmqSocketOptionFailed;
        if (connect(socket, config.endpoint.ptr) != 0) return error.ZmqConnectFailed;

        return .{
            .lib = lib,
            .context = context,
            .socket = socket,
            .context_term = context_term,
            .socket_close = socket_close,
            .send_fn = send_fn,
            .receive = receive,
            .more = more,
            .errno_fn = errno_fn,
        };
    }

    pub fn deinit(self: *Client) void {
        if (self.socket) |socket| _ = self.socket_close(socket);
        if (self.context) |context| _ = self.context_term(context);
        self.lib.close();
        self.* = undefined;
    }

    pub const Frame = struct {
        bytes: []const u8,
        wire_len: usize,
        truncated: bool,
    };

    // libzmq sockets are owned by one thread. Startup sends happen before the
    // receive loop starts; later outbound commands should be queued to that
    // owner rather than calling send concurrently from another thread.
    pub fn send(self: *Client, payload: []const u8) !void {
        if (self.send_fn(self.socket, payload.ptr, payload.len, 0) < 0) return error.ZmqSendFailed;
    }

    pub fn recv(self: *Client, buffer: []u8) !?Frame {
        const count = self.receive(self.socket, buffer.ptr, buffer.len, 0);
        if (count < 0) {
            if (self.errno_fn() == EAGAIN) return null;
            return error.ZmqReceiveFailed;
        }
        const wire_len: usize = @intCast(count);
        const len = @min(wire_len, buffer.len);
        return .{ .bytes = buffer[0..len], .wire_len = wire_len, .truncated = wire_len > buffer.len };
    }

    pub fn hasMore(self: *Client) !bool {
        var more_value: c_int = 0;
        var more_size: usize = @sizeOf(c_int);
        if (self.more(self.socket, ZMQ_RCVMORE, &more_value, &more_size) != 0)
            return error.ZmqSocketOptionFailed;
        return more_value != 0;
    }

    pub fn discardMore(self: *Client, buffer: []u8) void {
        while (self.hasMore() catch false) {
            _ = (self.recv(buffer) catch return) orelse return;
        }
    }

    pub fn sendReady(self: *Client, service: []const u8) !void {
        var message: [256]u8 = undefined;
        const payload = try std.fmt.bufPrint(
            &message,
            "{{\"type\":\"service_ready\",\"service\":\"{s}\",\"transport\":\"fujin-zmq\"}}",
            .{service},
        );
        try self.send(payload);
    }

    pub const Command = struct {
        connection_id: u64,
        scope: []const u8,
        message: std.json.Value,
    };

    pub const Provider = struct {
        context: *anyopaque,
        handle_fn: *const fn (*anyopaque, std.mem.Allocator, Command) anyerror![]u8,

        pub fn handle(self: Provider, allocator: std.mem.Allocator, command: Command) ![]u8 {
            return self.handle_fn(self.context, allocator, command);
        }
    };

    /// Own the DEALER socket on this thread and dispatch addressed commands to
    /// an injected provider. The provider returns one browser-facing JSON event;
    /// this transport adds only the trusted connection route used by Fujin.
    pub fn serve(self: *Client, allocator: std.mem.Allocator, service: []const u8, provider: Provider) void {
        var buffer: [64 * 1024]u8 = undefined;
        var idle_ticks: u8 = READY_INTERVAL_TICKS;
        while (true) {
            if (idle_ticks >= READY_INTERVAL_TICKS) {
                self.sendReady(service) catch |err| {
                    std.log.warn("{s} fujin registration failed: {s}", .{ service, @errorName(err) });
                };
                idle_ticks = 0;
            }
            const frame = (self.recv(&buffer) catch |err| {
                std.log.err("{s} fujin receive failed: {s}", .{ service, @errorName(err) });
                return;
            }) orelse {
                idle_ticks +|= 1;
                continue;
            };
            if (frame.truncated) {
                std.log.warn("{s} fujin command truncated bytes={d}", .{ service, frame.wire_len });
                self.discardMore(&buffer);
                continue;
            }
            self.discardMore(&buffer);

            var arena = std.heap.ArenaAllocator.init(allocator);
            defer arena.deinit();
            const a = arena.allocator();
            const command = decodeCommand(a, frame.bytes) catch |err| {
                std.log.warn("{s} invalid fujin command: {s}", .{ service, @errorName(err) });
                continue;
            };

            const message = provider.handle(a, command) catch |err|
                errorMessage(a, command.message, @errorName(err)) catch continue;
            const response = std.fmt.allocPrint(
                a,
                "{{\"type\":\"fujin_response\",\"connectionId\":{d},\"message\":{s}}}",
                .{ command.connection_id, message },
            ) catch continue;
            self.send(response) catch |err| {
                std.log.warn("{s} fujin response failed: {s}", .{ service, @errorName(err) });
                return;
            };
        }
    }

    pub fn listen(self: *Client, service: []const u8) void {
        var buffer: [64 * 1024]u8 = undefined;
        while (true) {
            const frame = (self.recv(&buffer) catch |err| {
                std.log.err("{s} fujin receive failed: {s}", .{ service, @errorName(err) });
                return;
            }) orelse continue;
            if (frame.truncated) {
                std.log.warn("{s} fujin command truncated bytes={d}", .{ service, frame.wire_len });
                self.discardMore(&buffer);
                continue;
            }
            std.log.info("{s} fujin command: {s}", .{ service, frame.bytes });
            self.discardMore(&buffer);
        }
    }
};

fn decodeCommand(allocator: std.mem.Allocator, payload: []const u8) !Client.Command {
    const root = try std.json.parseFromSliceLeaky(std.json.Value, allocator, payload, .{});
    if (root != .object) return error.CommandEnvelopeInvalid;
    const event_type = stringField(root.object, "type") orelse return error.CommandEnvelopeInvalid;
    if (!std.mem.eql(u8, event_type, "fujin_command")) return error.CommandEnvelopeInvalid;
    const connection_id = integerField(root.object, "connectionId") orelse return error.ConnectionIdMissing;
    if (connection_id < 0) return error.ConnectionIdInvalid;
    return .{
        .connection_id = @intCast(connection_id),
        .scope = stringField(root.object, "scope") orelse "",
        .message = root.object.get("message") orelse return error.CommandMessageMissing,
    };
}

fn errorMessage(allocator: std.mem.Allocator, message: std.json.Value, detail: []const u8) ![]u8 {
    const request_id = if (message == .object) stringField(message.object, "requestId") orelse "" else "";
    const request_json = try std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = request_id }, .{});
    const detail_json = try std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = detail }, .{});
    return std.fmt.allocPrint(
        allocator,
        "{{\"type\":\"error\",\"requestId\":{s},\"error\":{{\"code\":\"provider_error\",\"message\":{s}}}}}",
        .{ request_json, detail_json },
    );
}

fn stringField(object: std.json.ObjectMap, key: []const u8) ?[]const u8 {
    const value = object.get(key) orelse return null;
    return switch (value) {
        .string => |text| text,
        else => null,
    };
}

fn integerField(object: std.json.ObjectMap, key: []const u8) ?i64 {
    const value = object.get(key) orelse return null;
    return switch (value) {
        .integer => |number| number,
        else => null,
    };
}
