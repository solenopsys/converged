const std = @import("std");

const ContextNew = *const fn () callconv(.c) ?*anyopaque;
const ContextTerm = *const fn (?*anyopaque) callconv(.c) c_int;
const SocketNew = *const fn (?*anyopaque, c_int) callconv(.c) ?*anyopaque;
const SocketClose = *const fn (?*anyopaque) callconv(.c) c_int;
const Bind = *const fn (?*anyopaque, [*:0]const u8) callconv(.c) c_int;
const Receive = *const fn (?*anyopaque, ?*anyopaque, usize, c_int) callconv(.c) c_int;
const Send = *const fn (?*anyopaque, ?*const anyopaque, usize, c_int) callconv(.c) c_int;
const More = *const fn (?*anyopaque, c_int, ?*anyopaque, *usize) callconv(.c) c_int;
const SetSocketOption = *const fn (?*anyopaque, c_int, ?*const anyopaque, usize) callconv(.c) c_int;
const Errno = *const fn () callconv(.c) c_int;

const ZMQ_ROUTER = 6;
const ZMQ_SNDMORE = 2;
const ZMQ_RCVMORE = 13;
const ZMQ_RCVTIMEO = 27;
const EAGAIN = 11;

pub const Server = struct {
    lib: std.DynLib,
    context: ?*anyopaque,
    socket: ?*anyopaque,
    context_term: ContextTerm,
    socket_close: SocketClose,
    bind_fn: Bind,
    receive: Receive,
    send: Send,
    more: More,
    errno_fn: Errno,

    pub fn init(path: []const u8, endpoint: [:0]const u8) !Server {
        var lib = try std.DynLib.open(path);
        errdefer lib.close();
        const context_new = lib.lookup(ContextNew, "zmq_ctx_new") orelse return error.ZimqContextSymbolMissing;
        const socket_new = lib.lookup(SocketNew, "zmq_socket") orelse return error.ZimqSocketSymbolMissing;
        const context_term = lib.lookup(ContextTerm, "zmq_ctx_term") orelse return error.ZimqContextSymbolMissing;
        const context = context_new() orelse return error.ZimqContextCreateFailed;
        errdefer _ = context_term(context);
        const socket = socket_new(context, ZMQ_ROUTER) orelse return error.ZimqSocketCreateFailed;
        const set_option = lib.lookup(SetSocketOption, "zmq_setsockopt") orelse return error.ZimqSocketOptionSymbolMissing;
        var receive_timeout_ms: c_int = 25;
        if (set_option(socket, ZMQ_RCVTIMEO, &receive_timeout_ms, @sizeOf(c_int)) != 0)
            return error.ZimqSocketOptionFailed;
        const server = Server{
            .lib = lib,
            .context = context,
            .socket = socket,
            .context_term = context_term,
            .socket_close = lib.lookup(SocketClose, "zmq_close") orelse return error.ZimqSocketSymbolMissing,
            .bind_fn = lib.lookup(Bind, "zmq_bind") orelse return error.ZimqBindSymbolMissing,
            .receive = lib.lookup(Receive, "zmq_recv") orelse return error.ZimqReceiveSymbolMissing,
            .send = lib.lookup(Send, "zmq_send") orelse return error.ZimqSendSymbolMissing,
            .more = lib.lookup(More, "zmq_getsockopt") orelse return error.ZimqSocketOptionSymbolMissing,
            .errno_fn = lib.lookup(Errno, "zmq_errno") orelse return error.ZimqErrnoSymbolMissing,
        };
        if (server.bind_fn(socket, endpoint.ptr) != 0) return error.ZimqBindFailed;
        return server;
    }

    pub fn deinit(self: *Server) void {
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

    pub fn recv(self: *Server, buffer: []u8) !?Frame {
        const count = self.receive(self.socket, buffer.ptr, buffer.len, 0);
        if (count < 0) {
            if (self.errno_fn() == EAGAIN) return null;
            return error.ZimqReceiveFailed;
        }
        const wire_len: usize = @intCast(count);
        const len = @min(wire_len, buffer.len);
        return .{ .bytes = buffer[0..len], .wire_len = wire_len, .truncated = wire_len > buffer.len };
    }

    pub fn hasMore(self: *Server) !bool {
        var more_value: c_int = 0;
        var more_size: usize = @sizeOf(c_int);
        if (self.more(self.socket, ZMQ_RCVMORE, &more_value, &more_size) != 0) return error.ZimqSocketOptionFailed;
        return more_value != 0;
    }

    pub fn reply(self: *Server, identity: []const u8, payload: []const u8) !void {
        if (self.send(self.socket, identity.ptr, identity.len, ZMQ_SNDMORE) < 0) return error.ZimqSendFailed;
        if (self.send(self.socket, payload.ptr, payload.len, 0) < 0) return error.ZimqSendFailed;
    }
};
