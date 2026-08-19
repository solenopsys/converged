const std = @import("std");
const Policy = @import("qjs_policy.zig").Policy;

pub const Hub = struct {
    allocator: std.mem.Allocator,
    policy: *Policy,
    max_control_bytes: usize,
    authentication_required: bool,
    clients: std.ArrayList(*Client) = .empty,
    pending: std.ArrayList(PendingCommand) = .empty,
    mutex: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,
    sequence: u64 = 0,

    pub const Client = struct {
        id: u64,
        user: []u8,
        scope: []u8,
        auth: []u8,
        stream: std.Io.net.Stream,
        write_mutex: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,
    };

    pub const PendingCommand = struct {
        allocator: std.mem.Allocator,
        client_id: u64,
        target: []u8,
        service: []u8,
        request_id: []u8,
        method: []u8,
        scope: []u8,
        user: []u8,
        auth: []u8,
        payload: []u8,

        pub fn deinit(self: *PendingCommand) void {
            self.allocator.free(self.target);
            self.allocator.free(self.service);
            self.allocator.free(self.request_id);
            self.allocator.free(self.method);
            self.allocator.free(self.scope);
            self.allocator.free(self.user);
            self.allocator.free(self.auth);
            self.allocator.free(self.payload);
            self.* = undefined;
        }
    };

    pub fn init(allocator: std.mem.Allocator, policy: *Policy, max_control_bytes: usize, authentication_required: bool) Hub {
        return .{ .allocator = allocator, .policy = policy, .max_control_bytes = max_control_bytes, .authentication_required = authentication_required };
    }

    pub fn deinit(self: *Hub) void {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        for (self.clients.items) |client| {
            self.allocator.free(client.scope);
            self.allocator.free(client.user);
            self.allocator.free(client.auth);
            self.allocator.destroy(client);
        }
        for (self.pending.items) |*command| command.deinit();
        self.clients.deinit(self.allocator);
        self.pending.deinit(self.allocator);
        self.* = undefined;
    }

    pub fn addClient(self: *Hub, stream: std.Io.net.Stream, scope: []const u8) !*Client {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        self.sequence += 1;
        const client = try self.allocator.create(Client);
        errdefer self.allocator.destroy(client);
        const user = try self.allocator.dupe(u8, "");
        errdefer self.allocator.free(user);
        const scope_copy = try self.allocator.dupe(u8, scope);
        errdefer self.allocator.free(scope_copy);
        const auth = try self.allocator.dupe(u8, "");
        errdefer self.allocator.free(auth);
        client.* = .{
            .id = self.sequence,
            .user = user,
            .scope = scope_copy,
            .auth = auth,
            .stream = stream,
        };
        try self.clients.append(self.allocator, client);
        return client;
    }

    /// Called only after the WebSocket boundary verified the JWT. The raw
    /// command frame never supplies identity or scope to this method.
    pub fn setClientAuthentication(self: *Hub, client: *Client, user: []const u8, scope: []const u8, auth: []const u8) !void {
        const user_copy = try self.allocator.dupe(u8, user);
        errdefer self.allocator.free(user_copy);
        const scope_copy = try self.allocator.dupe(u8, scope);
        errdefer self.allocator.free(scope_copy);
        const auth_copy = try self.allocator.dupe(u8, auth);
        errdefer self.allocator.free(auth_copy);

        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        for (self.clients.items) |registered| {
            if (registered != client) continue;
            self.allocator.free(client.user);
            self.allocator.free(client.scope);
            self.allocator.free(client.auth);
            client.user = user_copy;
            client.scope = scope_copy;
            client.auth = auth_copy;
            return;
        }
        return error.ClientNotConnected;
    }

    pub fn clientsJson(self: *Hub) ![]u8 {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        const ClientState = struct { id: u64, scope: []const u8 };
        var states: std.ArrayList(ClientState) = .empty;
        defer states.deinit(self.allocator);
        for (self.clients.items) |client| try states.append(self.allocator, .{ .id = client.id, .scope = client.scope });
        return std.json.Stringify.valueAlloc(self.allocator, states.items, .{});
    }

    pub fn removeClient(self: *Hub, client: *Client) void {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        for (self.clients.items, 0..) |item, index| {
            if (item == client) {
                _ = self.clients.orderedRemove(index);
                self.allocator.free(client.scope);
                self.allocator.free(client.user);
                self.allocator.free(client.auth);
                self.allocator.destroy(client);
                return;
            }
        }
    }

    pub fn onWebSocketEvent(self: *Hub, client: *Client, payload: []const u8) void {
        self.queueWebSocketCommand(client, payload) catch |err| {
            self.sendError(client.id, "", "invalid_command", @errorName(err));
            std.log.warn("websocket command rejected client={d}: {s}", .{ client.id, @errorName(err) });
        };
    }

    fn queueWebSocketCommand(self: *Hub, client: *Client, payload: []const u8) !void {
        if (payload.len == 0 or payload.len > self.max_control_bytes) return error.ControlFrameInvalid;
        var parsed = try std.json.parseFromSlice(std.json.Value, self.allocator, payload, .{});
        defer parsed.deinit();
        if (parsed.value != .object) return error.ControlFrameInvalid;

        const event_type = stringField(parsed.value.object, "type");
        if (event_type != null and std.mem.eql(u8, event_type.?, "ping")) {
            try self.send(client, "{\"type\":\"pong\"}", .text);
            return;
        }
        if (self.authentication_required and client.auth.len == 0) return error.Unauthenticated;
        const kind = stringField(parsed.value.object, "kind");
        const legacy = event_type != null and std.mem.eql(u8, event_type.?, "command");
        if (!legacy and (kind == null or !std.mem.eql(u8, kind.?, "request"))) return error.CommandTypeInvalid;

        const to = parsed.value.object.get("to");
        const target = if (legacy)
            stringField(parsed.value.object, "target") orelse return error.CommandTargetMissing
        else if (to != null and to.? == .object)
            stringField(to.?.object, "target") orelse return error.CommandTargetMissing
        else
            return error.CommandTargetMissing;
        const service = if (!legacy and to != null and to.? == .object)
            stringField(to.?.object, "service") orelse target
        else
            target;
        const request_id = stringField(parsed.value.object, "requestId") orelse return error.CommandRequestIdMissing;
        const method = stringField(parsed.value.object, if (legacy) "name" else "method") orelse return error.CommandNameMissing;
        if (target.len == 0 or request_id.len == 0) return error.CommandRoutingInvalid;
        const payload_value = parsed.value.object.get("payload") orelse std.json.Value{ .object = .empty };
        const encoded_payload = try std.json.Stringify.valueAlloc(self.allocator, payload_value, .{});
        errdefer self.allocator.free(encoded_payload);

        var command = PendingCommand{
            .allocator = self.allocator,
            .client_id = client.id,
            .target = try self.allocator.dupe(u8, target),
            .service = try self.allocator.dupe(u8, service),
            .request_id = try self.allocator.dupe(u8, request_id),
            .method = try self.allocator.dupe(u8, method),
            .scope = try self.allocator.dupe(u8, client.scope),
            .user = try self.allocator.dupe(u8, client.user),
            .auth = try self.allocator.dupe(u8, client.auth),
            .payload = encoded_payload,
        };
        errdefer command.deinit();

        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        try self.pending.append(self.allocator, command);
    }

    pub fn takePending(self: *Hub) ?PendingCommand {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        if (self.pending.items.len == 0) return null;
        return self.pending.orderedRemove(0);
    }

    pub fn serviceUnavailable(self: *Hub, command: *const PendingCommand) void {
        self.sendError(command.client_id, command.request_id, "service_unavailable", command.target);
    }

    pub fn sendAdminResponse(self: *Hub, client_id: u64, request_id: []const u8, payload: []const u8) !void {
        const request_json = try std.json.Stringify.valueAlloc(self.allocator, std.json.Value{ .string = request_id }, .{});
        defer self.allocator.free(request_json);
        const reply = try std.fmt.allocPrint(
            self.allocator,
            "{{\"kind\":\"response\",\"requestId\":{s},\"payload\":{s},\"seq\":0,\"fin\":false,\"errorCode\":\"\"}}",
            .{ request_json, if (payload.len == 0) "null" else payload },
        );
        defer self.allocator.free(reply);
        try self.sendToClient(client_id, reply);
    }

    pub fn sendAdminError(self: *Hub, client_id: u64, request_id: []const u8, code: []const u8, detail: []const u8) void {
        self.sendError(client_id, request_id, code, detail);
    }

    pub fn sendAdminStreamChunk(self: *Hub, client_id: u64, request_id: []const u8, sequence: u64, payload: []const u8, fin: bool) !void {
        const request_json = try std.json.Stringify.valueAlloc(self.allocator, std.json.Value{ .string = request_id }, .{});
        defer self.allocator.free(request_json);
        const reply = try std.fmt.allocPrint(
            self.allocator,
            "{{\"kind\":\"streamChunk\",\"requestId\":{s},\"payload\":{s},\"seq\":{d},\"fin\":{},\"errorCode\":\"\"}}",
            .{ request_json, if (payload.len == 0) "null" else payload, sequence, fin },
        );
        defer self.allocator.free(reply);
        try self.sendToClient(client_id, reply);
    }

    pub fn sendTransportReply(self: *Hub, client_id: u64, env: anytype, payload: []const u8) !void {
        const kind = switch (env.kind) {
            .response => "response",
            .@"error" => "error",
            .stream_chunk => "streamChunk",
            else => return error.ControlFrameInvalid,
        };
        const request_json = try std.json.Stringify.valueAlloc(self.allocator, std.json.Value{ .string = env.request_id }, .{});
        defer self.allocator.free(request_json);
        const error_code_json = try std.json.Stringify.valueAlloc(self.allocator, std.json.Value{ .string = env.error_code }, .{});
        defer self.allocator.free(error_code_json);
        const payload_json = if (payload.len == 0) "null" else payload;
        const reply = try std.fmt.allocPrint(
            self.allocator,
            "{{\"kind\":\"{s}\",\"requestId\":{s},\"payload\":{s},\"seq\":{d},\"fin\":{},\"errorCode\":{s}}}",
            .{ kind, request_json, payload_json, env.seq, env.fin, error_code_json },
        );
        defer self.allocator.free(reply);
        try self.sendToClient(client_id, reply);
    }

    pub fn onTransportEvent(self: *Hub, payload: []const u8) !void {
        if (payload.len == 0 or payload.len > self.max_control_bytes) return error.ControlFrameInvalid;
        var parsed = try std.json.parseFromSlice(std.json.Value, self.allocator, payload, .{});
        defer parsed.deinit();
        const event_type = if (parsed.value == .object) stringField(parsed.value.object, "type") else null;
        const audience = eventAudience(parsed.value);
        const signal = if (event_type != null and std.mem.eql(u8, event_type.?, "user_event"))
            try self.policy.transform(payload)
        else
            try self.allocator.dupe(u8, payload);
        defer self.allocator.free(signal);
        self.broadcastForAudience(signal, audience);
    }

    pub fn announceBulk(self: *Hub, bytes: usize) void {
        var message: [128]u8 = undefined;
        const signal = std.fmt.bufPrint(&message, "{{\"type\":\"bulk_available\",\"transport\":\"zmq\",\"bytes\":{d}}}", .{bytes}) catch return;
        self.broadcast(signal);
    }

    fn sendError(self: *Hub, client_id: u64, request_id: []const u8, code: []const u8, detail: []const u8) void {
        const request_json = std.json.Stringify.valueAlloc(self.allocator, std.json.Value{ .string = request_id }, .{}) catch return;
        defer self.allocator.free(request_json);
        const code_json = std.json.Stringify.valueAlloc(self.allocator, std.json.Value{ .string = code }, .{}) catch return;
        defer self.allocator.free(code_json);
        const detail_json = std.json.Stringify.valueAlloc(self.allocator, std.json.Value{ .string = detail }, .{}) catch return;
        defer self.allocator.free(detail_json);
        const payload = std.fmt.allocPrint(
            self.allocator,
            "{{\"type\":\"error\",\"requestId\":{s},\"error\":{{\"code\":{s},\"message\":{s}}}}}",
            .{ request_json, code_json, detail_json },
        ) catch return;
        defer self.allocator.free(payload);
        self.sendToClient(client_id, payload) catch {};
    }

    fn clientCount(self: *Hub) usize {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        return self.clients.items.len;
    }

    fn broadcast(self: *Hub, payload: []const u8) void {
        self.broadcastForAudience(payload, .{});
    }

    fn broadcastForAudience(self: *Hub, payload: []const u8, audience: EventAudience) void {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        var sent: usize = 0;
        for (self.clients.items) |client| {
            if (!matchesAudience(client, audience)) continue;
            self.sendLocked(client, payload, .text) catch continue;
            sent += 1;
        }
        std.log.info("signal broadcast bytes={d} clients={d}", .{ payload.len, sent });
    }

    fn sendToClient(self: *Hub, client_id: u64, payload: []const u8) !void {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        for (self.clients.items) |client| {
            if (client.id == client_id) return self.sendLocked(client, payload, .text);
        }
        return error.ClientNotConnected;
    }

    pub fn send(self: *Hub, client: *Client, payload: []const u8, opcode: Opcode) !void {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        try self.sendLocked(client, payload, opcode);
    }

    pub const Opcode = enum(u8) { text = 0x1, pong = 0xA };

    fn sendLocked(_: *Hub, client: *Client, payload: []const u8, opcode: Opcode) !void {
        if (payload.len > 65535) return error.WebSocketFrameTooLarge;
        _ = std.c.pthread_mutex_lock(&client.write_mutex);
        defer _ = std.c.pthread_mutex_unlock(&client.write_mutex);

        var header: [4]u8 = undefined;
        const header_len: usize = if (payload.len < 126) blk: {
            header[0] = 0x80 | @intFromEnum(opcode);
            header[1] = @intCast(payload.len);
            break :blk 2;
        } else blk: {
            header[0] = 0x80 | @intFromEnum(opcode);
            header[1] = 126;
            header[2] = @intCast(payload.len >> 8);
            header[3] = @truncate(payload.len);
            break :blk 4;
        };
        const io = std.Options.debug_io;
        var buffer: [4096]u8 = undefined;
        var writer = client.stream.writer(io, &buffer);
        try writer.interface.writeAll(header[0..header_len]);
        try writer.interface.writeAll(payload);
        try writer.interface.flush();
    }
};

fn stringField(object: std.json.ObjectMap, key: []const u8) ?[]const u8 {
    const value = object.get(key) orelse return null;
    return switch (value) {
        .string => |text| text,
        else => null,
    };
}

const EventAudience = struct {
    scope: ?[]const u8 = null,
    user: ?[]const u8 = null,
};

/// Transport events can explicitly target a tenant and optionally one user.
/// Unaddressed operational events remain broadcasts; addressed events never
/// cross either the verified scope or subject boundary.
fn eventAudience(value: std.json.Value) EventAudience {
    if (value != .object) return .{};
    const object = value.object;
    const payload = object.get("payload");
    const nested = if (payload != null and payload.? == .object) payload.?.object else null;
    return .{
        .scope = stringField(object, "scope") orelse if (nested) |item| stringField(item, "scope") else null,
        .user = stringField(object, "user") orelse stringField(object, "targetUser") orelse if (nested) |item| stringField(item, "user") orelse stringField(item, "targetUser") else null,
    };
}

fn matchesAudience(client: *const Hub.Client, audience: EventAudience) bool {
    if (audience.scope) |scope| if (!std.mem.eql(u8, client.scope, scope)) return false;
    if (audience.user) |user| if (!std.mem.eql(u8, client.user, user)) return false;
    return true;
}

test "websocket command stores trusted route and scope" {
    const allocator = std.testing.allocator;
    var policy: Policy = undefined;
    var hub = Hub.init(allocator, &policy, 4096, false);
    defer hub.deinit();
    const client = try hub.addClient(undefined, "untrusted-scope");
    try hub.setClientAuthentication(client, "user-a", "tenant-a", "jwt");
    try hub.queueWebSocketCommand(client, "{\"type\":\"command\",\"target\":\"resonus\",\"requestId\":\"req-1\",\"name\":\"call.offer\",\"payload\":{}}");
    var command = hub.takePending().?;
    defer command.deinit();
    try std.testing.expectEqualStrings("resonus", command.target);
    try std.testing.expectEqualStrings("call.offer", command.method);
    try std.testing.expectEqualStrings("tenant-a", command.scope);
    try std.testing.expectEqualStrings("user-a", command.user);
    try std.testing.expectEqualStrings("jwt", command.auth);
    try std.testing.expectEqualStrings("{}", command.payload);
}

test "required mode rejects a command before it is queued" {
    const allocator = std.testing.allocator;
    var policy: Policy = undefined;
    var hub = Hub.init(allocator, &policy, 4096, true);
    defer hub.deinit();
    const client = try hub.addClient(undefined, "tenant-a");
    try std.testing.expectError(
        error.Unauthenticated,
        hub.queueWebSocketCommand(client, "{\"type\":\"command\",\"target\":\"resonus\",\"requestId\":\"req-1\",\"name\":\"call.offer\",\"payload\":{}}"),
    );
    try std.testing.expect(hub.takePending() == null);
}

test "event audience keeps tenant and user events in their session" {
    const client = Hub.Client{ .id = 1, .user = @constCast("alice"), .scope = @constCast("club"), .auth = @constCast("jwt"), .stream = undefined };
    try std.testing.expect(matchesAudience(&client, .{}));
    try std.testing.expect(matchesAudience(&client, .{ .scope = "club" }));
    try std.testing.expect(matchesAudience(&client, .{ .scope = "club", .user = "alice" }));
    try std.testing.expect(!matchesAudience(&client, .{ .scope = "other" }));
    try std.testing.expect(!matchesAudience(&client, .{ .user = "bob" }));
}
