const std = @import("std");
const Policy = @import("qjs_policy.zig").Policy;

pub const Hub = struct {
    allocator: std.mem.Allocator,
    policy: *Policy,
    max_control_bytes: usize,
    clients: std.ArrayList(*Client) = .empty,
    mutex: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,
    sequence: u64 = 0,

    pub const Client = struct {
        id: u64,
        stream: std.Io.net.Stream,
        write_mutex: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,
    };

    pub fn init(allocator: std.mem.Allocator, policy: *Policy, max_control_bytes: usize) Hub {
        return .{ .allocator = allocator, .policy = policy, .max_control_bytes = max_control_bytes };
    }

    pub fn deinit(self: *Hub) void {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        for (self.clients.items) |client| self.allocator.destroy(client);
        self.clients.deinit(self.allocator);
        self.* = undefined;
    }

    pub fn addClient(self: *Hub, stream: std.Io.net.Stream) !*Client {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        self.sequence += 1;
        const client = try self.allocator.create(Client);
        client.* = .{ .id = self.sequence, .stream = stream };
        try self.clients.append(self.allocator, client);
        return client;
    }

    pub fn removeClient(self: *Hub, client: *Client) void {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        for (self.clients.items, 0..) |item, index| {
            if (item == client) {
                _ = self.clients.orderedRemove(index);
                self.allocator.destroy(client);
                return;
            }
        }
    }

    pub fn onWebSocketEvent(self: *Hub, client: *Client, payload: []const u8) void {
        self.route(.websocket, payload) catch |err| {
            self.send(client, "{\"type\":\"error\",\"error\":\"invalid_event\"}", .text) catch {};
            std.log.warn("websocket event rejected: {s}", .{@errorName(err)});
        };
    }

    pub const ZmqControlResult = struct {
        allocator: std.mem.Allocator,
        reply: []u8,
        signal: ?[]u8,

        pub fn deinit(self: *ZmqControlResult) void {
            self.allocator.free(self.reply);
            if (self.signal) |signal| self.allocator.free(signal);
            self.* = undefined;
        }
    };

    pub fn onZmqControl(self: *Hub, payload: []const u8) !ZmqControlResult {
        if (payload.len > self.max_control_bytes) {
            return .{
                .allocator = self.allocator,
                .reply = try self.allocator.dupe(u8, "{\"ok\":true,\"route\":\"bulk\"}"),
                .signal = null,
            };
        }

        const signal = try self.transform(payload);
        errdefer self.allocator.free(signal);
        self.broadcast(signal);
        std.log.info("signal routed source=zimq bytes={d} clients={d}", .{ signal.len, self.clientCount() });
        return .{
            .allocator = self.allocator,
            .reply = try self.allocator.dupe(u8, "{\"ok\":true,\"route\":\"signal\"}"),
            .signal = signal,
        };
    }

    const Source = enum { zimq, websocket };

    fn route(self: *Hub, source: Source, payload: []const u8) !void {
        if (payload.len == 0 or payload.len > self.max_control_bytes) return error.ControlFrameInvalid;
        const signal = try self.transform(payload);
        defer self.allocator.free(signal);

        self.broadcast(signal);
        std.log.info("signal routed source={s} bytes={d} clients={d}", .{ @tagName(source), signal.len, self.clientCount() });
    }

    fn transform(self: *Hub, payload: []const u8) ![]u8 {
        if (payload.len == 0 or payload.len > self.max_control_bytes) return error.ControlFrameInvalid;
        var parsed = try std.json.parseFromSlice(std.json.Value, self.allocator, payload, .{});
        defer parsed.deinit();
        if (parsed.value != .object) return error.ControlFrameInvalid;

        const event_type = stringField(parsed.value.object, "type") orelse return error.EventTypeMissing;
        const signal = if (std.mem.eql(u8, event_type, "user_event"))
            try self.policy.transform(payload)
        else
            try self.allocator.dupe(u8, payload);
        return signal;
    }

    pub fn announceBulk(self: *Hub, bytes: usize) void {
        var message: [128]u8 = undefined;
        const signal = std.fmt.bufPrint(&message, "{{\"type\":\"bulk_available\",\"transport\":\"zimq\",\"bytes\":{d}}}", .{bytes}) catch return;
        self.broadcast(signal);
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
    }

    pub fn send(self: *Hub, client: *Client, payload: []const u8, opcode: Opcode) !void {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        try self.sendLocked(client, payload, opcode);
    }

    const Opcode = enum(u8) { text = 0x1, pong = 0xA };

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

test "control event type is read only from a JSON string" {
    var parsed = try std.json.parseFromSlice(std.json.Value, std.testing.allocator, "{\"type\":\"user_event\"}", .{});
    defer parsed.deinit();
    try std.testing.expectEqualStrings("user_event", stringField(parsed.value.object, "type").?);
}
