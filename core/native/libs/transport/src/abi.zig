const std = @import("std");
const transport = @import("transport");

const allocator = std.heap.c_allocator;
const max_connections = 1024;

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
    mutex: Mutex = .{},
    peer: transport.Peer,
    recv_timeout_ms: i32 = 0,
    system: SystemController = .{},
    application_messages: std.ArrayList(*IncomingMessage) = .empty,
};

var registry_mutex: Mutex = .{};
var connections: [max_connections]?Connection = [_]?Connection{null} ** max_connections;

const OwnedAddress = struct {
    target: [:0]const u8,
    service: [:0]const u8,
};

const IncomingMessage = struct {
    incoming: transport.endpoint.Incoming,
    arena: std.heap.ArenaAllocator,
    version: u8,
    kind: transport.Kind,
    request_id: [:0]const u8,
    to: OwnedAddress,
    from: OwnedAddress,
    method: [:0]const u8,
    scope: [:0]const u8,
    user: [:0]const u8,
    auth: [:0]const u8,
    codec: transport.PayloadCodec,
    seq: u32,
    fin: bool,
    deadline_ms: u32,
    error_code: [:0]const u8,

    fn init(incoming: transport.endpoint.Incoming) !*IncomingMessage {
        var owned_incoming = incoming;
        errdefer owned_incoming.deinit();
        const decoded = try owned_incoming.parseEnvelope();

        const result = try allocator.create(IncomingMessage);
        errdefer allocator.destroy(result);
        result.* = .{
            .incoming = owned_incoming,
            .arena = std.heap.ArenaAllocator.init(allocator),
            .version = decoded.version,
            .kind = decoded.kind,
            .request_id = undefined,
            .to = undefined,
            .from = undefined,
            .method = undefined,
            .scope = undefined,
            .user = undefined,
            .auth = undefined,
            .codec = decoded.codec,
            .seq = decoded.seq,
            .fin = decoded.fin,
            .deadline_ms = decoded.deadline_ms,
            .error_code = undefined,
        };
        errdefer result.arena.deinit();

        const arena = result.arena.allocator();
        result.request_id = try arena.dupeZ(u8, decoded.request_id);
        result.to = .{
            .target = try arena.dupeZ(u8, decoded.to.target),
            .service = try arena.dupeZ(u8, decoded.to.service),
        };
        result.from = .{
            .target = try arena.dupeZ(u8, decoded.from.target),
            .service = try arena.dupeZ(u8, decoded.from.service),
        };
        result.method = try arena.dupeZ(u8, decoded.method);
        result.scope = try arena.dupeZ(u8, decoded.scope);
        result.user = try arena.dupeZ(u8, decoded.user);
        result.auth = try arena.dupeZ(u8, decoded.auth);
        result.error_code = try arena.dupeZ(u8, decoded.error_code);
        return result;
    }

    fn deinit(self: *IncomingMessage) void {
        self.incoming.deinit();
        self.arena.deinit();
        allocator.destroy(self);
    }
};

/// Owns registration and restart recovery for one connection target.
const SystemController = struct {
    target: ?[]u8 = null,
    registered: bool = false,
    last_send_ns: i128 = 0,
    last_reply_ns: i128 = 0,
    running: std.atomic.Value(bool) = .init(false),
    thread: ?std.Thread = null,

    const interval_ns = 250 * std.time.ns_per_ms;
    const timeout_ns = std.time.ns_per_s;

    fn deinit(self: *SystemController) void {
        if (self.target) |target| allocator.free(target);
        self.* = undefined;
    }
};

fn nowNs() i128 {
    return std.Io.Timestamp.now(std.Options.debug_io, .awake).toNanoseconds();
}

fn sleepNs(ns: u64) void {
    var delay = std.c.timespec{
        .sec = @intCast(ns / std.time.ns_per_s),
        .nsec = @intCast(ns % std.time.ns_per_s),
    };
    while (std.c.nanosleep(&delay, &delay) == -1) {}
}

fn cString(value: ?[*:0]const u8) []const u8 {
    return if (value) |ptr| std.mem.span(ptr) else "";
}

fn lockConnection(handle: i32) ?*Connection {
    if (handle <= 0 or handle > max_connections) return null;
    registry_mutex.lock();
    const slot = &connections[@intCast(handle - 1)];
    const connection = if (slot.*) |*value| value else {
        registry_mutex.unlock();
        return null;
    };
    connection.mutex.lock();
    registry_mutex.unlock();
    return connection;
}

pub export fn msg_connect(endpoint: [*:0]const u8, max_envelope_bytes: u64, max_payload_bytes: u64) i32 {
    if (max_envelope_bytes == 0 or max_payload_bytes == 0) return -1;
    if (max_envelope_bytes > std.math.maxInt(usize) or max_payload_bytes > std.math.maxInt(usize)) return -1;

    var peer = transport.Peer.init(std.mem.span(endpoint), .{
        .max_envelope_bytes = @intCast(max_envelope_bytes),
        .max_payload_bytes = @intCast(max_payload_bytes),
    }) catch return -1;
    errdefer peer.deinit();

    registry_mutex.lock();
    defer registry_mutex.unlock();
    for (&connections, 0..) |*slot, index| {
        if (slot.* == null) {
            slot.* = .{ .peer = peer };
            return @intCast(index + 1);
        }
    }
    return -1;
}

pub export fn msg_set_timeout_ms(handle: i32, recv_ms: i32, send_ms: i32) i32 {
    const connection = lockConnection(handle) orelse return -1;
    defer connection.mutex.unlock();
    connection.peer.setRecvTimeoutMs(recv_ms) catch return -1;
    connection.peer.setSendTimeoutMs(send_ms) catch return -1;
    connection.recv_timeout_ms = recv_ms;
    return 0;
}

/// Declares the single target owned by this physical connection.
pub export fn msg_declare_target(handle: i32, target_ptr: ?[*:0]const u8) i32 {
    const target = cString(target_ptr);
    if (target.len == 0) return -1;
    const connection = lockConnection(handle) orelse return -1;
    defer connection.mutex.unlock();

    if (connection.system.target == null) {
        connection.system.target = allocator.dupe(u8, target) catch return -1;
        connection.system.running.store(true, .release);
        connection.system.thread = std.Thread.spawn(.{}, systemLoop, .{connection}) catch {
            connection.system.running.store(false, .release);
            allocator.free(connection.system.target.?);
            connection.system.target = null;
            return -1;
        };
    } else if (!std.mem.eql(u8, connection.system.target.?, target)) return -1;
    connection.system.registered = false;
    connection.system.last_send_ns = 0;
    return 0;
}

pub export fn msg_send(
    handle: i32,
    version: u8,
    kind_raw: u16,
    codec_raw: u16,
    seq: u32,
    fin: u8,
    deadline_ms: u32,
    request_id: ?[*:0]const u8,
    to_target: ?[*:0]const u8,
    to_service: ?[*:0]const u8,
    from_target: ?[*:0]const u8,
    from_service: ?[*:0]const u8,
    method: ?[*:0]const u8,
    scope: ?[*:0]const u8,
    user: ?[*:0]const u8,
    error_code: ?[*:0]const u8,
    auth: ?[*:0]const u8,
    payload_ptr: ?[*]const u8,
    payload_len: u64,
) i32 {
    if (payload_len > std.math.maxInt(usize)) return -1;
    const payload: []const u8 = if (payload_len == 0)
        ""
    else if (payload_ptr) |ptr|
        ptr[0..@intCast(payload_len)]
    else
        return -1;

    const env = transport.Envelope{
        .version = version,
        .kind = std.enums.fromInt(transport.Kind, kind_raw) orelse return -1,
        .request_id = cString(request_id),
        .to = .{ .target = cString(to_target), .service = cString(to_service) },
        .from = .{ .target = cString(from_target), .service = cString(from_service) },
        .method = cString(method),
        .scope = cString(scope),
        .user = cString(user),
        .auth = cString(auth),
        .codec = std.enums.fromInt(transport.PayloadCodec, codec_raw) orelse return -1,
        .seq = seq,
        .fin = fin != 0,
        .deadline_ms = deadline_ms,
        .error_code = cString(error_code),
    };
    transport.envelope.validateForSend(&env) catch return -1;

    const encoded = transport.envelope.encodeAlloc(allocator, &env) catch return -1;
    defer allocator.free(encoded);

    const connection = lockConnection(handle) orelse return -1;
    defer connection.mutex.unlock();
    maintainSystem(connection, true);
    connection.peer.send(encoded, payload) catch return -1;
    return 0;
}

fn systemLoop(connection: *Connection) void {
    while (connection.system.running.load(.acquire)) {
        connection.mutex.lock();
        drainIncoming(connection);
        maintainSystem(connection, false);
        connection.mutex.unlock();
        sleepNs(25 * std.time.ns_per_ms);
    }
}

fn takeApplicationMessage(handle: i32) ?*IncomingMessage {
    const connection = lockConnection(handle) orelse return null;
    defer connection.mutex.unlock();
    drainIncoming(connection);
    if (connection.application_messages.items.len == 0) return null;
    return connection.application_messages.orderedRemove(0);
}

fn drainIncoming(connection: *Connection) void {
    while (true) {
        var incoming = connection.peer.recvNonBlocking() catch return;
        if (incoming == null) return;
        const decoded = incoming.?.parseEnvelope() catch {
            incoming.?.deinit();
            continue;
        };
        if (decoded.kind == .system) {
            if (std.mem.eql(u8, decoded.method, "registered") or std.mem.eql(u8, decoded.method, "pong")) {
                connection.system.registered = true;
                connection.system.last_reply_ns = nowNs();
            } else if (std.mem.eql(u8, decoded.method, "register_required")) {
                connection.system.registered = false;
                connection.system.last_send_ns = 0;
            }
            incoming.?.deinit();
            continue;
        }
        const message = IncomingMessage.init(incoming.?) catch {
            incoming.?.deinit();
            continue;
        };
        connection.application_messages.append(allocator, message) catch message.deinit();
    }
}

fn maintainSystem(connection: *Connection, force: bool) void {
    const controller = &connection.system;
    const target = controller.target orelse return;
    const now = nowNs();
    if (controller.registered and now - controller.last_reply_ns >= SystemController.timeout_ns) {
        controller.registered = false;
    }
    if (!force and now - controller.last_send_ns < SystemController.interval_ns) return;

    if (controller.registered) {
        var packet = transport.control.ping(allocator, target) catch return;
        defer packet.deinit(allocator);
        const encoded = encodePacket(&packet) catch return;
        defer allocator.free(encoded);
        connection.peer.send(encoded, packet.payload) catch {};
    } else {
        var packet = transport.control.register(allocator, .{
            .target = target,
        }) catch return;
        defer packet.deinit(allocator);
        const encoded = encodePacket(&packet) catch return;
        defer allocator.free(encoded);
        connection.peer.send(encoded, packet.payload) catch {};
    }
    controller.last_send_ns = now;
}

fn encodePacket(packet: *const transport.control.Packet) ![]u8 {
    return transport.envelope.encodeAlloc(allocator, &packet.envelope);
}

pub export fn msg_recv(handle: i32) ?*IncomingMessage {
    const connection = lockConnection(handle) orelse return null;
    if (connection.system.thread == null) {
        const incoming = connection.peer.recv() catch {
            connection.mutex.unlock();
            return null;
        };
        connection.mutex.unlock();
        const value = incoming orelse return null;
        return IncomingMessage.init(value) catch null;
    }
    const timeout_ms = connection.recv_timeout_ms;
    connection.mutex.unlock();
    const deadline_ns = nowNs() + @as(i128, @max(timeout_ms, 0)) * std.time.ns_per_ms;
    while (true) {
        const message = takeApplicationMessage(handle) orelse {
            if (timeout_ms == 0 or nowNs() >= deadline_ns) return null;
            sleepNs(std.time.ns_per_ms);
            continue;
        };
        return message;
    }
}

pub export fn msg_recv_nowait(handle: i32) ?*IncomingMessage {
    return takeApplicationMessage(handle);
}

pub export fn msg_close(handle: i32) void {
    if (handle <= 0 or handle > max_connections) return;
    registry_mutex.lock();
    defer registry_mutex.unlock();
    const slot = &connections[@intCast(handle - 1)];
    const connection = if (slot.*) |*value| value else return;
    connection.mutex.lock();
    connection.system.running.store(false, .release);
    connection.mutex.unlock();
    if (connection.system.thread) |thread| thread.join();
    connection.mutex.lock();
    for (connection.application_messages.items) |message| message.deinit();
    connection.application_messages.deinit(allocator);
    connection.system.deinit();
    connection.peer.deinit();
    connection.mutex.unlock();
    slot.* = null;
}

pub export fn msg_in_version(message: *const IncomingMessage) u8 {
    return message.version;
}
pub export fn msg_in_kind(message: *const IncomingMessage) u16 {
    return @intFromEnum(message.kind);
}
pub export fn msg_in_codec(message: *const IncomingMessage) u16 {
    return @intFromEnum(message.codec);
}
pub export fn msg_in_seq(message: *const IncomingMessage) u32 {
    return message.seq;
}
pub export fn msg_in_fin(message: *const IncomingMessage) u8 {
    return @intFromBool(message.fin);
}
pub export fn msg_in_deadline_ms(message: *const IncomingMessage) u32 {
    return message.deadline_ms;
}
pub export fn msg_in_request_id(message: *const IncomingMessage) [*:0]const u8 {
    return message.request_id.ptr;
}
pub export fn msg_in_to_target(message: *const IncomingMessage) [*:0]const u8 {
    return message.to.target.ptr;
}
pub export fn msg_in_to_service(message: *const IncomingMessage) [*:0]const u8 {
    return message.to.service.ptr;
}
pub export fn msg_in_from_target(message: *const IncomingMessage) [*:0]const u8 {
    return message.from.target.ptr;
}
pub export fn msg_in_from_service(message: *const IncomingMessage) [*:0]const u8 {
    return message.from.service.ptr;
}
pub export fn msg_in_method(message: *const IncomingMessage) [*:0]const u8 {
    return message.method.ptr;
}
pub export fn msg_in_scope(message: *const IncomingMessage) [*:0]const u8 {
    return message.scope.ptr;
}
pub export fn msg_in_user(message: *const IncomingMessage) [*:0]const u8 {
    return message.user.ptr;
}
pub export fn msg_in_auth(message: *const IncomingMessage) [*:0]const u8 {
    return message.auth.ptr;
}
pub export fn msg_in_error_code(message: *const IncomingMessage) [*:0]const u8 {
    return message.error_code.ptr;
}
pub export fn msg_in_payload_ptr(message: *IncomingMessage) ?[*]const u8 {
    const payload = message.incoming.payload();
    return if (payload.len == 0) null else payload.ptr;
}
pub export fn msg_in_payload_len(message: *IncomingMessage) u64 {
    return message.incoming.payload().len;
}
pub export fn msg_in_free(message: ?*IncomingMessage) void {
    if (message) |value| value.deinit();
}

test "C ABI peer exchanges an envelope and payload with a Router" {
    var endpoint_buffer: [128]u8 = undefined;
    const endpoint_name = try std.fmt.bufPrintZ(
        &endpoint_buffer,
        "ipc:///tmp/transport-abi-test-{d}.sock",
        .{std.c.getpid()},
    );
    const limits = transport.Limits{ .max_envelope_bytes = 4096, .max_payload_bytes = 1 << 20 };

    var router = try transport.Router.init(endpoint_name, limits);
    defer router.deinit();
    try router.setRecvTimeoutMs(2000);

    const handle = msg_connect(endpoint_name.ptr, limits.max_envelope_bytes, limits.max_payload_bytes);
    try std.testing.expect(handle > 0);
    defer msg_close(handle);
    try std.testing.expectEqual(@as(i32, 0), msg_set_timeout_ms(handle, 2000, 2000));

    const payload = "{\"id\":42}";
    try std.testing.expectEqual(@as(i32, 0), msg_send(
        handle,
        transport.envelope.envelope_version,
        @intFromEnum(transport.Kind.request),
        @intFromEnum(transport.PayloadCodec.json),
        0,
        0,
        5000,
        "req-abi",
        "core",
        "threads",
        "worker",
        "runtime",
        "get",
        "tenant-a",
        "",
        "",
        "test.jwt",
        payload.ptr,
        payload.len,
    ));

    var request = (try router.recv()) orelse return error.TestTimeout;
    defer request.deinit();
    const request_env = try request.parseEnvelope();
    try std.testing.expectEqualStrings("req-abi", request_env.request_id);
    try std.testing.expectEqualStrings("test.jwt", request_env.auth);
    try std.testing.expectEqualStrings(payload, request.payload());

    const response_env = transport.Envelope{
        .kind = .response,
        .request_id = request_env.request_id,
        .to = request_env.from,
        .from = request_env.to,
        .codec = .json,
    };
    var response_buffer: [512]u8 = undefined;
    const response_bytes = try transport.envelope.encode(&response_env, &response_buffer);
    try router.send(request.identity(), response_bytes, "{\"ok\":true}");

    const response = msg_recv(handle) orelse return error.TestTimeout;
    defer msg_in_free(response);
    try std.testing.expectEqual(@as(u16, @intFromEnum(transport.Kind.response)), msg_in_kind(response));
    try std.testing.expectEqualStrings("req-abi", std.mem.span(msg_in_request_id(response)));
    try std.testing.expectEqualStrings(
        "{\"ok\":true}",
        msg_in_payload_ptr(response).?[0..@intCast(msg_in_payload_len(response))],
    );
}

test "FFI system controller owns target registration and restart recovery" {
    var endpoint_buffer: [128]u8 = undefined;
    const endpoint_name = try std.fmt.bufPrintZ(
        &endpoint_buffer,
        "ipc:///tmp/transport-abi-system-{d}.sock",
        .{std.c.getpid()},
    );
    const limits = transport.Limits{ .max_envelope_bytes = 4096, .max_payload_bytes = 1 << 20 };
    var router = try transport.Router.init(endpoint_name, limits);
    defer router.deinit();
    try router.setRecvTimeoutMs(2000);

    const handle = msg_connect(endpoint_name.ptr, limits.max_envelope_bytes, limits.max_payload_bytes);
    try std.testing.expect(handle > 0);
    defer msg_close(handle);
    try std.testing.expectEqual(@as(i32, 0), msg_set_timeout_ms(handle, 25, 1000));
    try std.testing.expectEqual(@as(i32, 0), msg_declare_target(handle, "ui"));

    var registration = (try router.recv()) orelse return error.TestTimeout;
    defer registration.deinit();
    const registration_env = try registration.parseEnvelope();
    try std.testing.expectEqual(transport.Kind.system, registration_env.kind);
    try std.testing.expectEqualStrings("register", registration_env.method);
    try std.testing.expectEqualStrings("ui", registration_env.from.target);
    try std.testing.expectEqualStrings("{}", registration.payload());

    try sendSystemReply(&router, registration.identity(), registration_env, "registered");
    var ping = (try router.recv()) orelse return error.TestTimeout;
    defer ping.deinit();
    const ping_env = try ping.parseEnvelope();
    try std.testing.expectEqual(transport.Kind.system, ping_env.kind);
    try std.testing.expectEqualStrings("ping", ping_env.method);

    try sendSystemReply(&router, ping.identity(), ping_env, "register_required");
    var replay = (try router.recv()) orelse return error.TestTimeout;
    defer replay.deinit();
    const replay_env = try replay.parseEnvelope();
    try std.testing.expectEqual(transport.Kind.system, replay_env.kind);
    try std.testing.expectEqualStrings("register", replay_env.method);
    try std.testing.expectEqualStrings("ui", replay_env.from.target);
}

fn sendSystemReply(router: *transport.Router, identity: []const u8, inbound: transport.Envelope, method: []const u8) !void {
    const response = transport.Envelope{
        .kind = .system,
        .to = inbound.from,
        .from = .{ .target = "fujin" },
        .method = method,
        .codec = .json,
    };
    var buffer: [256]u8 = undefined;
    const encoded = try transport.envelope.encode(&response, &buffer);
    try router.send(identity, encoded, "{}");
}
