const std = @import("std");
const zimq = @import("zimq");
const envelope = @import("envelope.zig");

// Cluster messaging endpoints (cluster-messaging.md §3, §5).
//
// Wire form is strict multipart:
//   Peer   → Router:  [envelope][payload]            (DEALER → ROUTER)
//   Router → Peer:    [identity][envelope][payload]  (identity is ZMQ routing)
//
// The payload frame is opaque; only the envelope frame is parsed. Frames of
// any other shape are drained and rejected — never repaired. This module owns
// socket shape and framing only; registries, pending tables and heartbeat
// loops belong to the applications (fujin v2, client runtimes).

pub const Limits = struct {
    /// Hard cap for the envelope frame. Envelopes are small; anything large
    /// here is a protocol violation.
    max_envelope_bytes: usize,
    /// Hard cap for one payload frame (intra-cluster bulk limit).
    max_payload_bytes: usize,
};

pub const RecvError = error{
    /// Wrong number of frames or missing payload frame.
    FrameShapeInvalid,
    /// A frame exceeded the configured limits.
    FrameTooLarge,
    Unexpected,
};

pub const SendError = error{
    FrameTooLarge,
    IdentityInvalid,
    /// The peer this identity names is not connected: nothing was queued, and
    /// no reply will ever come. Distinct from Unexpected because it is a normal
    ///, actionable outcome — the caller answers the request itself.
    PeerUnreachable,
    /// The peer's queue is full at the high-water mark. Also a drop, but a
    /// backpressure one: the peer is alive and behind, not gone.
    PeerBacklogged,
    Unexpected,
};

/// Queue depth per peer, in messages. Sized for a burst a healthy consumer
/// drains in well under the send timeout; past it the peer is not slow, it is
/// stuck, and failing fast beats buffering for it.
const send_high_water_mark: c_int = 4096;
const recv_high_water_mark: c_int = 4096;

/// One received packet. Owns the underlying zmq messages — zero-copy slices
/// stay valid until deinit().
pub const Incoming = struct {
    identity_msg: zimq.Message,
    envelope_msg: zimq.Message,
    payload_msg: zimq.Message,

    pub fn identity(self: *Incoming) []const u8 {
        return self.identity_msg.slice();
    }

    pub fn envelopeBytes(self: *Incoming) []const u8 {
        return self.envelope_msg.slice();
    }

    pub fn payload(self: *Incoming) []const u8 {
        return self.payload_msg.slice();
    }

    /// Decode the envelope header. Slices point into the message — same
    /// lifetime as the Incoming itself.
    pub fn parseEnvelope(self: *Incoming) envelope.DecodeError!envelope.Envelope {
        return envelope.decode(self.envelopeBytes());
    }

    pub fn deinit(self: *Incoming) void {
        self.identity_msg.deinit();
        self.envelope_msg.deinit();
        self.payload_msg.deinit();
        self.* = undefined;
    }
};

/// Router endpoint — the fujin side. Binds a ROUTER socket; peers are
/// addressed by the identity frame captured from their packets.
pub const Router = struct {
    context: *zimq.Context,
    socket: *zimq.Socket,
    limits: Limits,

    pub fn init(endpoint: [:0]const u8, limits: Limits) !Router {
        const pair = try initSocket(.router, limits);
        errdefer deinitSocket(pair.socket, pair.context);
        // So the registry controller can cascade-remove a dead peer's routes
        // instead of leaving them stale forever. Surfaces as a bare
        // [identity][empty] packet from recv() — see recvPacket below.
        // connect=true is deliberately NOT set: it fires an extra notify
        // packet the instant a peer connects, before any real traffic, which
        // every caller of recv() would then have to filter out up front.
        try pair.socket.set(.router_notify, .{ .disconnect = true });
        // Undeliverable must be an error, not silence. A ROUTER defaults to
        // discarding a message whose identity is unknown or whose connection is
        // already gone, and reports success for it — the sender then waits out
        // its full deadline for a reply that was never queued. With this set,
        // send fails with CannotRoute and the caller can answer immediately.
        try pair.socket.set(.router_mandatory, true);
        try pair.socket.bind(endpoint);
        return .{ .context = pair.context, .socket = pair.socket, .limits = pair.limits };
    }

    pub fn deinit(self: *Router) void {
        deinitSocket(self.socket, self.context);
        self.* = undefined;
    }

    pub fn setRecvTimeoutMs(self: *Router, ms: i32) !void {
        try self.socket.set(.rcvtimeo, ms);
    }

    pub fn setSendTimeoutMs(self: *Router, ms: i32) !void {
        try self.socket.set(.sndtimeo, ms);
    }

    /// Receive one [identity][envelope][payload] packet.
    /// Returns null on receive timeout.
    pub fn recv(self: *Router) RecvError!?Incoming {
        return recvPacket(self.socket, self.limits, .with_identity, .{});
    }

    pub fn recvNonBlocking(self: *Router) RecvError!?Incoming {
        return recvPacket(self.socket, self.limits, .with_identity, .noblock);
    }

    /// Send [identity][envelope][payload] to a connected peer.
    pub fn send(self: *Router, peer_identity: []const u8, envelope_bytes: []const u8, payload: []const u8) SendError!void {
        if (peer_identity.len == 0 or peer_identity.len > 255) return SendError.IdentityInvalid;
        try validateFrameSizes(self.limits, envelope_bytes, payload);
        // The identity frame is where routing is decided, so an unroutable
        // destination surfaces on this first send; the remaining frames belong
        // to a message that was already accepted.
        self.socket.sendSlice(peer_identity, .more) catch |err| return sendError(err);
        self.socket.sendSlice(envelope_bytes, .more) catch |err| return sendError(err);
        self.socket.sendSlice(payload, .{}) catch |err| return sendError(err);
    }
};

/// Peer endpoint — the service side. A DEALER connected to one router
/// contour. Multi-contour fan-out is a client-runtime concern: hold one Peer
/// per contour.
pub const Peer = struct {
    context: *zimq.Context,
    socket: *zimq.Socket,
    limits: Limits,

    pub fn init(endpoint: [:0]const u8, limits: Limits) !Peer {
        return initWithIdentity(endpoint, "", limits);
    }

    pub fn initWithIdentity(endpoint: [:0]const u8, identity: []const u8, limits: Limits) !Peer {
        if (identity.len > 255) return error.IdentityInvalid;
        const pair = try initSocket(.dealer, limits);
        errdefer deinitSocket(pair.socket, pair.context);
        if (identity.len > 0) try pair.socket.set(.routing_id, identity);
        try pair.socket.connect(endpoint);
        return .{ .context = pair.context, .socket = pair.socket, .limits = pair.limits };
    }

    pub fn deinit(self: *Peer) void {
        deinitSocket(self.socket, self.context);
        self.* = undefined;
    }

    pub fn setRecvTimeoutMs(self: *Peer, ms: i32) !void {
        try self.socket.set(.rcvtimeo, ms);
    }

    pub fn setSendTimeoutMs(self: *Peer, ms: i32) !void {
        try self.socket.set(.sndtimeo, ms);
    }

    /// Send [envelope][payload] to the router.
    pub fn send(self: *Peer, envelope_bytes: []const u8, payload: []const u8) SendError!void {
        try validateFrameSizes(self.limits, envelope_bytes, payload);
        self.socket.sendSlice(envelope_bytes, .more) catch return SendError.Unexpected;
        self.socket.sendSlice(payload, .{}) catch return SendError.Unexpected;
    }

    /// Receive one [envelope][payload] packet (identity frame stays empty).
    /// Returns null on receive timeout.
    pub fn recv(self: *Peer) RecvError!?Incoming {
        return recvPacket(self.socket, self.limits, .without_identity, .{});
    }

    pub fn recvNonBlocking(self: *Peer) RecvError!?Incoming {
        return recvPacket(self.socket, self.limits, .without_identity, .noblock);
    }
};

// ── Shared internals ─────────────────────────────────────────────────────────

const SocketPair = struct { context: *zimq.Context, socket: *zimq.Socket, limits: Limits };

/// Keeps the two drop reasons a caller can act on separate from genuine
/// transport faults: gone (answer now) and behind (retry or shed load).
fn sendError(err: anyerror) SendError {
    return switch (err) {
        error.CannotRoute => SendError.PeerUnreachable,
        error.WouldBlock => SendError.PeerBacklogged,
        else => SendError.Unexpected,
    };
}

fn initSocket(socket_type: zimq.socket.Type, limits: Limits) !SocketPair {
    const context = try zimq.Context.init();
    errdefer context.deinit();
    const socket = try zimq.Socket.init(context, socket_type);
    errdefer socket.deinit();
    try socket.set(.linger, 0);
    // Do not accept a local queue as proof of a connection. The runtime's
    // system packets must fail/retry until Fujin is actually reachable.
    try socket.set(.immediate, true);
    // ZMTP heartbeating: without this a peer whose TCP connection dies
    // without a FIN (SIGKILL, node eviction, k8s pod churn) is invisible to
    // libzmq — writes just sit in the kernel send buffer until the OS's
    // default TCP retransmission timeout gives up (tens of minutes) before
    // the DEALER side reconnects. Heartbeats make libzmq notice a dead peer
    // and reconnect well under a second instead.
    try socket.set(.heartbeat_ivl, 250);
    try socket.set(.heartbeat_timeout, 750);
    try socket.set(.heartbeat_ttl, 1000);
    try socket.set(.reconnect_ivl, 50);
    try socket.set(.reconnect_ivl_max, 250);
    // Stated rather than inherited: the queue depth decides when a slow peer
    // starts costing memory and when it starts losing messages, so it belongs
    // in the code that reasons about both. Paired with sndtimeo, a full queue
    // reaches the caller as WouldBlock instead of a silent discard.
    try socket.set(.sndhwm, send_high_water_mark);
    try socket.set(.rcvhwm, recv_high_water_mark);
    return .{ .context = context, .socket = socket, .limits = limits };
}

fn deinitSocket(socket: *zimq.Socket, context: *zimq.Context) void {
    socket.deinit();
    context.deinit();
}

const FrameShape = enum { with_identity, without_identity };

fn recvFrame(socket: *zimq.Socket, msg: *zimq.Message, flags: zimq.Socket.RecvFlags) RecvError!?void {
    _ = socket.recvMsg(msg, flags) catch |err| return switch (err) {
        error.WouldBlock => null, // rcvtimeo hit
        error.Interrupted => null,
        else => RecvError.Unexpected,
    };
    return {};
}

fn hasMore(socket: *zimq.Socket) RecvError!bool {
    var more: bool = false;
    socket.get(.rcvmore, &more) catch return RecvError.Unexpected;
    return more;
}

/// Drain the rest of a multipart message so the socket stays consistent
/// after a rejected packet.
fn drain(socket: *zimq.Socket) void {
    while (hasMore(socket) catch return) {
        var msg: zimq.Message = .empty();
        defer msg.deinit();
        _ = socket.recvMsg(&msg, .{}) catch return;
    }
}

fn validateFrameSizes(limits: Limits, envelope_bytes: []const u8, payload: []const u8) SendError!void {
    if (envelope_bytes.len > limits.max_envelope_bytes or payload.len > limits.max_payload_bytes) {
        return SendError.FrameTooLarge;
    }
}

fn recvPacket(
    socket: *zimq.Socket,
    limits: Limits,
    shape: FrameShape,
    flags: zimq.Socket.RecvFlags,
) RecvError!?Incoming {
    var incoming = Incoming{
        .identity_msg = .empty(),
        .envelope_msg = .empty(),
        .payload_msg = .empty(),
    };
    errdefer incoming.deinit();

    if (shape == .with_identity) {
        (try recvFrame(socket, &incoming.identity_msg, flags)) orelse {
            incoming.deinit();
            return null;
        };
        if (!try hasMore(socket)) return RecvError.FrameShapeInvalid;
        if (incoming.identity_msg.size() > 255) {
            drain(socket);
            return RecvError.FrameShapeInvalid;
        }
    }

    (try recvFrame(socket, &incoming.envelope_msg, flags)) orelse {
        if (shape == .with_identity) return RecvError.FrameShapeInvalid;
        incoming.deinit();
        return null;
    };
    if (!try hasMore(socket)) {
        // ZMQ_ROUTER_NOTIFY delivers a bare [identity][empty] pair on
        // peer connect/disconnect — no payload frame follows. A real
        // envelope is never legitimately empty, so this is an unambiguous
        // sentinel: surface it as a normal Incoming (payload stays empty)
        // instead of erroring, so the caller can tell it apart from traffic.
        if (shape == .with_identity and incoming.envelope_msg.size() == 0) {
            return incoming;
        }
        return RecvError.FrameShapeInvalid;
    }
    if (incoming.envelope_msg.size() > limits.max_envelope_bytes) {
        drain(socket);
        return RecvError.FrameTooLarge;
    }

    (try recvFrame(socket, &incoming.payload_msg, flags)) orelse return RecvError.FrameShapeInvalid;
    if (try hasMore(socket)) {
        drain(socket);
        return RecvError.FrameShapeInvalid;
    }
    if (incoming.payload_msg.size() > limits.max_payload_bytes) {
        return RecvError.FrameTooLarge;
    }

    return incoming;
}

// ── Tests ────────────────────────────────────────────────────────────────────

const test_limits = Limits{ .max_envelope_bytes = 4096, .max_payload_bytes = 1 << 20 };

fn testEndpoint(buffer: []u8) [:0]const u8 {
    return std.fmt.bufPrintZ(buffer, "ipc:///tmp/transport-endpoint-test-{d}.sock", .{std.c.getpid()}) catch unreachable;
}

test "peer to router round-trip with envelope frames" {
    var endpoint_buf: [128]u8 = undefined;
    const endpoint = testEndpoint(&endpoint_buf);

    var router = try Router.init(endpoint, test_limits);
    defer router.deinit();
    try router.setRecvTimeoutMs(2000);

    var peer = try Peer.init(endpoint, test_limits);
    defer peer.deinit();
    try peer.setRecvTimeoutMs(2000);

    const request = envelope.Envelope{
        .kind = .request,
        .request_id = "req-1",
        .to = .{ .target = "core", .service = "threads" },
        .from = .{ .target = "gate", .service = "calls" },
        .method = "list",
        .scope = "tenant-a",
        .deadline_ms = 5000,
    };
    var env_buf: [512]u8 = undefined;
    const env_bytes = try envelope.encode(&request, &env_buf);
    try peer.send(env_bytes, "{\"limit\":10}");

    var incoming = (try router.recv()) orelse return error.TestTimeout;
    defer incoming.deinit();
    try std.testing.expect(incoming.identity().len > 0);
    try std.testing.expectEqualStrings("{\"limit\":10}", incoming.payload());
    const parsed = try incoming.parseEnvelope();
    try std.testing.expectEqualStrings("req-1", parsed.request_id);
    try std.testing.expectEqualStrings("core", parsed.to.target);
    try std.testing.expectEqual(envelope.Kind.request, parsed.kind);

    // reply back over the captured identity
    const response = envelope.Envelope{
        .kind = .response,
        .request_id = parsed.request_id,
        .to = parsed.from,
        .from = parsed.to,
    };
    var resp_buf: [512]u8 = undefined;
    const resp_bytes = try envelope.encode(&response, &resp_buf);
    var identity_copy: [255]u8 = undefined;
    const identity_len = incoming.identity().len;
    @memcpy(identity_copy[0..identity_len], incoming.identity());
    try router.send(identity_copy[0..identity_len], resp_bytes, "[]");

    var reply = (try peer.recv()) orelse return error.TestTimeout;
    defer reply.deinit();
    const reply_env = try reply.parseEnvelope();
    try std.testing.expectEqual(envelope.Kind.response, reply_env.kind);
    try std.testing.expectEqualStrings("req-1", reply_env.request_id);
    try std.testing.expectEqualStrings("[]", reply.payload());
}

test "router rejects malformed frame shapes and recovers" {
    var endpoint_buf: [128]u8 = undefined;
    const endpoint = std.fmt.bufPrintZ(&endpoint_buf, "ipc:///tmp/transport-endpoint-shape-{d}.sock", .{std.c.getpid()}) catch unreachable;

    var router = try Router.init(endpoint, test_limits);
    defer router.deinit();
    try router.setRecvTimeoutMs(2000);

    var peer = try Peer.init(endpoint, test_limits);
    defer peer.deinit();

    // single frame — no payload
    try peer.socket.sendSlice("lonely", .{});
    try std.testing.expectError(RecvError.FrameShapeInvalid, router.recv());

    // three frames from the peer (router sees four) — extra frame
    try peer.socket.sendSlice("a", .more);
    try peer.socket.sendSlice("b", .more);
    try peer.socket.sendSlice("c", .{});
    try std.testing.expectError(RecvError.FrameShapeInvalid, router.recv());

    // the socket must stay usable after both rejections
    const ping = envelope.Envelope{ .kind = .system, .method = "ping" };
    var env_buf: [256]u8 = undefined;
    const env_bytes = try envelope.encode(&ping, &env_buf);
    try peer.send(env_bytes, "");
    var incoming = (try router.recv()) orelse return error.TestTimeout;
    defer incoming.deinit();
    const parsed = try incoming.parseEnvelope();
    try std.testing.expectEqualStrings("ping", parsed.method);
}

test "a bare empty frame from a peer surfaces as an empty-envelope Incoming (matches ZMQ_ROUTER_NOTIFY shape)" {
    var endpoint_buf: [128]u8 = undefined;
    const endpoint = std.fmt.bufPrintZ(&endpoint_buf, "ipc:///tmp/transport-endpoint-notify-{d}.sock", .{std.c.getpid()}) catch unreachable;

    var router = try Router.init(endpoint, test_limits);
    defer router.deinit();
    try router.setRecvTimeoutMs(2000);

    var peer = try Peer.init(endpoint, test_limits);
    defer peer.deinit();

    // ZMQ_ROUTER_NOTIFY delivers exactly this shape on the ROUTER socket when
    // a peer connects/disconnects: [identity][empty], no payload frame. A
    // bare single empty frame sent by a DEALER produces the same wire shape
    // once the ROUTER prepends the peer's identity, so this exercises the
    // real parsing path without needing a live libzmq-triggered disconnect.
    try peer.socket.sendSlice("", .{});

    var incoming = (try router.recv()) orelse return error.TestTimeout;
    defer incoming.deinit();
    try std.testing.expect(incoming.identity().len > 0);
    try std.testing.expectEqual(@as(usize, 0), incoming.envelopeBytes().len);
    try std.testing.expectEqual(@as(usize, 0), incoming.payload().len);
}

test "recv times out with null" {
    var endpoint_buf: [128]u8 = undefined;
    const endpoint = std.fmt.bufPrintZ(&endpoint_buf, "ipc:///tmp/transport-endpoint-idle-{d}.sock", .{std.c.getpid()}) catch unreachable;

    var router = try Router.init(endpoint, test_limits);
    defer router.deinit();
    try router.setRecvTimeoutMs(50);
    try std.testing.expectEqual(@as(?Incoming, null), try router.recv());
}

test "non-blocking recv returns null without a timeout option" {
    var endpoint_buf: [128]u8 = undefined;
    const endpoint = std.fmt.bufPrintZ(&endpoint_buf, "ipc:///tmp/transport-endpoint-nowait-{d}.sock", .{std.c.getpid()}) catch unreachable;

    var router = try Router.init(endpoint, test_limits);
    defer router.deinit();
    try std.testing.expectEqual(@as(?Incoming, null), try router.recvNonBlocking());
}

test "sending to an identity nobody answers for fails instead of being discarded" {
    var endpoint_buf: [128]u8 = undefined;
    const endpoint = std.fmt.bufPrintZ(&endpoint_buf, "ipc:///tmp/transport-endpoint-unroutable-{d}.sock", .{std.c.getpid()}) catch unreachable;

    var router = try Router.init(endpoint, test_limits);
    defer router.deinit();
    try router.setSendTimeoutMs(100);

    const reply = envelope.Envelope{ .kind = .response, .request_id = "req-1" };
    var env_buf: [256]u8 = undefined;
    const env_bytes = try envelope.encode(&reply, &env_buf);

    // No peer ever connected under this identity. Silently dropping here is
    // what leaves a caller waiting for a reply that will never be sent.
    try std.testing.expectError(
        SendError.PeerUnreachable,
        router.send("nobody-is-here", env_bytes, ""),
    );
}

test "payload over the limit is rejected" {
    var endpoint_buf: [128]u8 = undefined;
    const endpoint = std.fmt.bufPrintZ(&endpoint_buf, "ipc:///tmp/transport-endpoint-limit-{d}.sock", .{std.c.getpid()}) catch unreachable;

    var router = try Router.init(endpoint, .{ .max_envelope_bytes = 4096, .max_payload_bytes = 16 });
    defer router.deinit();
    try router.setRecvTimeoutMs(2000);

    var peer = try Peer.init(endpoint, test_limits);
    defer peer.deinit();

    const ping = envelope.Envelope{ .kind = .system, .method = "ping" };
    var env_buf: [256]u8 = undefined;
    const env_bytes = try envelope.encode(&ping, &env_buf);
    try peer.send(env_bytes, "this payload is longer than sixteen bytes");
    try std.testing.expectError(RecvError.FrameTooLarge, router.recv());
}
