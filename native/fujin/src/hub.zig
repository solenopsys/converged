const std = @import("std");
const Policy = @import("qjs_policy.zig").Policy;

pub const Hub = struct {
    allocator: std.mem.Allocator,
    policy: *Policy,
    max_control_bytes: usize,
    clients: std.ArrayList(*Client) = .empty,
    pending: std.ArrayList(PendingCommand) = .empty,
    mutex: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,
    sequence: u64 = 0,

    pub const Client = struct {
        id: u64,
        scope: []u8,
        stream: std.Io.net.Stream,
        write_mutex: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,
    };

    pub const PendingCommand = struct {
        allocator: std.mem.Allocator,
        client_id: u64,
        target: []u8,
        request_id: []u8,
        payload: []u8,

        pub fn deinit(self: *PendingCommand) void {
            self.allocator.free(self.target);
            self.allocator.free(self.request_id);
            self.allocator.free(self.payload);
            self.* = undefined;
        }
    };

    pub fn init(allocator: std.mem.Allocator, policy: *Policy, max_control_bytes: usize) Hub {
        return .{ .allocator = allocator, .policy = policy, .max_control_bytes = max_control_bytes };
    }

    pub fn deinit(self: *Hub) void {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        for (self.clients.items) |client| {
            self.allocator.free(client.scope);
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
        client.* = .{
            .id = self.sequence,
            .scope = try self.allocator.dupe(u8, scope),
            .stream = stream,
        };
        errdefer self.allocator.free(client.scope);
        try self.clients.append(self.allocator, client);
        return client;
    }

    pub fn removeClient(self: *Hub, client: *Client) void {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        for (self.clients.items, 0..) |item, index| {
            if (item == client) {
                _ = self.clients.orderedRemove(index);
                self.allocator.free(client.scope);
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

        const event_type = stringField(parsed.value.object, "type") orelse return error.EventTypeMissing;
        if (std.mem.eql(u8, event_type, "ping")) {
            try self.send(client, "{\"type\":\"pong\"}", .text);
            return;
        }
        if (!std.mem.eql(u8, event_type, "command")) return error.CommandTypeInvalid;

        const target = stringField(parsed.value.object, "target") orelse return error.CommandTargetMissing;
        const request_id = stringField(parsed.value.object, "requestId") orelse return error.CommandRequestIdMissing;
        if (target.len == 0 or request_id.len == 0) return error.CommandRoutingInvalid;

        const wrapped = try wrapCommand(self.allocator, client.id, client.scope, payload);
        errdefer self.allocator.free(wrapped);

        var command = PendingCommand{
            .allocator = self.allocator,
            .client_id = client.id,
            .target = try self.allocator.dupe(u8, target),
            .request_id = try self.allocator.dupe(u8, request_id),
            .payload = wrapped,
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

    pub fn onZmqControl(self: *Hub, payload: []const u8) !void {
        if (payload.len == 0 or payload.len > self.max_control_bytes) return error.ControlFrameInvalid;
        var parsed = try std.json.parseFromSlice(std.json.Value, self.allocator, payload, .{});
        defer parsed.deinit();
        if (parsed.value != .object) return error.ControlFrameInvalid;

        const event_type = stringField(parsed.value.object, "type") orelse return error.EventTypeMissing;
        if (std.mem.eql(u8, event_type, "service_ready")) return;

        if (std.mem.eql(u8, event_type, "fujin_response")) {
            const connection_id = integerField(parsed.value.object, "connectionId") orelse return error.ConnectionIdMissing;
            const message = parsed.value.object.get("message") orelse return error.ResponseMessageMissing;
            const encoded = try std.json.Stringify.valueAlloc(self.allocator, message, .{});
            defer self.allocator.free(encoded);
            try self.sendToClient(@intCast(connection_id), encoded);
            return;
        }

        const signal = if (std.mem.eql(u8, event_type, "user_event"))
            try self.policy.transform(payload)
        else
            try self.allocator.dupe(u8, payload);
        defer self.allocator.free(signal);
        self.broadcast(signal);
    }

    pub fn announceBulk(self: *Hub, bytes: usize) void {
        var message: [128]u8 = undefined;
        const signal = std.fmt.bufPrint(&message, "{{\"type\":\"bulk_available\",\"transport\":\"zimq\",\"bytes\":{d}}}", .{bytes}) catch return;
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
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        for (self.clients.items) |client| self.sendLocked(client, payload, .text) catch {};
        std.log.info("signal broadcast bytes={d} clients={d}", .{ payload.len, self.clients.items.len });
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
            header[3] = @intCast(payload.len);
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

fn integerField(object: std.json.ObjectMap, key: []const u8) ?i64 {
    const value = object.get(key) orelse return null;
    return switch (value) {
        .integer => |number| number,
        else => null,
    };
}

fn wrapCommand(allocator: std.mem.Allocator, connection_id: u64, scope: []const u8, payload: []const u8) ![]u8 {
    const scope_json = try std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = scope }, .{});
    defer allocator.free(scope_json);
    return std.fmt.allocPrint(
        allocator,
        "{{\"type\":\"fujin_command\",\"connectionId\":{d},\"scope\":{s},\"message\":{s}}}",
        .{ connection_id, scope_json, payload },
    );
}

test "wrapCommand injects trusted route and scope" {
    const allocator = std.testing.allocator;
    const wrapped = try wrapCommand(
        allocator,
        42,
        "tenant-a",
        "{\"type\":\"command\",\"target\":\"resonus\",\"requestId\":\"req-1\",\"name\":\"call.offer\",\"payload\":{}}",
    );
    defer allocator.free(wrapped);

    var parsed = try std.json.parseFromSlice(std.json.Value, allocator, wrapped, .{});
    defer parsed.deinit();
    try std.testing.expectEqualStrings("fujin_command", stringField(parsed.value.object, "type").?);
    try std.testing.expectEqual(@as(i64, 42), integerField(parsed.value.object, "connectionId").?);
    try std.testing.expectEqualStrings("tenant-a", stringField(parsed.value.object, "scope").?);
    const message = parsed.value.object.get("message").?.object;
    try std.testing.expectEqualStrings("resonus", stringField(message, "target").?);
    try std.testing.expectEqualStrings("req-1", stringField(message, "requestId").?);
}
