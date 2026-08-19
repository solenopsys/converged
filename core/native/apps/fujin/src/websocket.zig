const std = @import("std");
const Hub = @import("hub.zig").Hub;
const JwtConfig = @import("config.zig").JwtConfig;
const AccessMode = @import("config.zig").AccessMode;
const transport = @import("transport");

pub const Server = struct {
    hub: *Hub,
    host: []const u8,
    port: u16,
    browser_scope: []const u8,
    jwt: *const JwtConfig,

    pub fn serve(self: *Server) !void {
        const io = std.Options.debug_io;
        const address = try std.Io.net.IpAddress.parse(self.host, self.port);
        var listener = try address.listen(io, .{ .reuse_address = true });
        defer listener.deinit(io);
        std.log.info("websocket listening on {s}:{d}", .{ self.host, self.port });

        while (true) {
            const stream = try listener.accept(io);
            const thread = std.Thread.spawn(.{}, handleConnectionThread, .{ self.hub, self.browser_scope, self.jwt, stream }) catch |err| {
                var fallback = stream;
                defer fallback.close(io);
                std.log.warn("websocket worker unavailable: {s}", .{@errorName(err)});
                handleConnection(self.hub, self.browser_scope, self.jwt, fallback) catch {};
                continue;
            };
            thread.detach();
        }
    }
};

fn handleConnectionThread(hub: *Hub, browser_scope: []const u8, jwt: *const JwtConfig, stream: std.Io.net.Stream) void {
    const io = std.Options.debug_io;
    var owned = stream;
    defer owned.close(io);
    handleConnection(hub, browser_scope, jwt, owned) catch |err| std.log.debug("websocket closed: {s}", .{@errorName(err)});
}

fn handleConnection(hub: *Hub, browser_scope: []const u8, jwt: *const JwtConfig, stream: std.Io.net.Stream) !void {
    const io = std.Options.debug_io;
    var read_buffer: [32 * 1024]u8 = undefined;
    var write_buffer: [32 * 1024]u8 = undefined;
    var reader = stream.reader(io, &read_buffer);
    var writer = stream.writer(io, &write_buffer);
    var http = std.http.Server.init(&reader.interface, &writer.interface);

    var request = try http.receiveHead();
    const path = request.head.target[0 .. std.mem.indexOfScalar(u8, request.head.target, '?') orelse request.head.target.len];
    const handshake_token = bearerToken(requestHeader(&request, "authorization") orelse "");
    if (request.head.method != .GET or !std.mem.eql(u8, path, "/ws")) {
        try request.respond("not found\n", .{ .status = .not_found });
        return;
    }
    const upgrade = request.upgradeRequested();
    const key = switch (upgrade) {
        .websocket => |value| value orelse {
            try request.respond("websocket upgrade required\n", .{ .status = .bad_request });
            return;
        },
        else => {
            try request.respond("websocket upgrade required\n", .{ .status = .upgrade_required });
            return;
        },
    };

    var ws = try request.respondWebSocket(.{ .key = key });
    try ws.flush();
    const scope = connectionScope(requestScope(&request), browser_scope);
    const client = try hub.addClient(stream, scope);
    defer hub.removeClient(client);
    var ready_buffer: [192]u8 = undefined;
    const ready = try std.fmt.bufPrint(
        &ready_buffer,
        "{{\"type\":\"ready\",\"transport\":\"fujin\",\"connectionId\":{d},\"scoped\":{},\"authRequired\":{}}}",
        .{ client.id, scope.len > 0, jwt.mode == .required },
    );
    try hub.send(client, ready, .text);
    if (handshake_token.len > 0) {
        if (authenticateClient(hub, jwt, client, handshake_token)) |_| {} else |err| {
            try sendAuthenticationError(hub, client, err);
            if (jwt.mode == .required) std.log.warn("websocket handshake JWT rejected: {s}", .{@errorName(err)});
            return;
        }
    }

    while (true) {
        const message = ws.readSmallMessage() catch |err| switch (err) {
            error.ConnectionClose, error.EndOfStream => return,
            else => return err,
        };
        switch (message.opcode) {
            .text => switch (parseAuthFrame(hub.allocator, message.data)) {
                .not_auth => hub.onWebSocketEvent(client, message.data),
                .invalid => try sendAuthenticationError(hub, client, error.TokenMalformed),
                .token => |token| {
                    defer hub.allocator.free(token);
                    if (authenticateClient(hub, jwt, client, token)) |_| {} else |err| {
                        try sendAuthenticationError(hub, client, err);
                        if (jwt.mode == .required) std.log.warn("websocket JWT rejected: {s}", .{@errorName(err)});
                        return;
                    }
                },
            },
            .ping => hub.send(client, message.data, .pong) catch return,
            .connection_close => return,
            else => {},
        }
    }
}

fn authenticateClient(hub: *Hub, jwt: *const JwtConfig, client: *Hub.Client, token: []const u8) !bool {
    if (jwt.mode == .off) return false;
    const now = std.Io.Timestamp.now(std.Options.debug_io, .real).toSeconds();
    var verified = try transport.auth.jwt.verify(hub.allocator, token, jwt.verifierConfig() orelse return error.JwtVerifierUnavailable, now);
    defer verified.deinit(hub.allocator);
    if (verified.token_type != .user) return error.UserTokenRequired;
    try hub.setClientAuthentication(client, verified.subject, verified.scope, token);
    try hub.send(client, "{\"type\":\"authenticated\"}", .text);
    return true;
}

fn sendAuthenticationError(hub: *Hub, client: *Hub.Client, err: anyerror) !void {
    const code: []const u8 = switch (err) {
        error.PermissionDenied, error.UserTokenRequired, error.ServiceTokenRequired => "forbidden",
        else => "unauthenticated",
    };
    var buffer: [96]u8 = undefined;
    const message = try std.fmt.bufPrint(&buffer, "{{\"type\":\"auth_error\",\"code\":\"{s}\"}}", .{code});
    try hub.send(client, message, .text);
}

const AuthFrame = union(enum) {
    not_auth,
    invalid,
    token: []const u8,
};

fn parseAuthFrame(allocator: std.mem.Allocator, bytes: []const u8) AuthFrame {
    var document = std.json.parseFromSlice(std.json.Value, allocator, bytes, .{}) catch return .not_auth;
    defer document.deinit();
    if (document.value != .object) return .not_auth;
    const frame_type = jsonStringField(document.value.object, "type") orelse return .not_auth;
    if (!std.mem.eql(u8, frame_type, "auth")) return .not_auth;
    const raw_token = jsonStringField(document.value.object, "token") orelse return .invalid;
    const token = bearerToken(raw_token);
    if (token.len == 0) return .invalid;
    const token_copy = allocator.dupe(u8, token) catch return .invalid;
    return .{ .token = token_copy };
}

fn jsonStringField(object: std.json.ObjectMap, name: []const u8) ?[]const u8 {
    const value = object.get(name) orelse return null;
    return if (value == .string) value.string else null;
}

fn bearerToken(value: []const u8) []const u8 {
    const trimmed = std.mem.trim(u8, value, " \t\r\n");
    const prefix = "Bearer ";
    if (trimmed.len >= prefix.len and std.ascii.startsWithIgnoreCase(trimmed[0..prefix.len], prefix)) {
        return std.mem.trim(u8, trimmed[prefix.len..], " \t\r\n");
    }
    return trimmed;
}

fn connectionScope(header_scope: []const u8, browser_scope: []const u8) []const u8 {
    return if (header_scope.len > 0) header_scope else browser_scope;
}

fn requestScope(request: *std.http.Server.Request) []const u8 {
    const names = [_][]const u8{
        "x-storage-scope",
        "storage-scope",
        "scope",
        "x-scope",
        "workspace",
        "x-workspace",
    };
    for (names) |name| {
        if (requestHeader(request, name)) |value| {
            const normalized = std.mem.trim(u8, value, " \t\r\n");
            if (normalized.len > 0) return normalized;
        }
    }
    return "";
}

fn requestHeader(request: *std.http.Server.Request, name: []const u8) ?[]const u8 {
    var iterator = request.iterateHeaders();
    while (iterator.next()) |header| {
        if (std.ascii.eqlIgnoreCase(header.name, name)) return header.value;
    }
    return null;
}

test "browser connections use the configured scope and native clients retain theirs" {
    try std.testing.expectEqualStrings("converged", connectionScope("", "converged"));
    try std.testing.expectEqualStrings("service-scope", connectionScope("service-scope", "converged"));
}

test "auth frame accepts raw and bearer JWTs without retaining parsed JSON" {
    const allocator = std.testing.allocator;
    const raw = parseAuthFrame(allocator, "{\"type\":\"auth\",\"token\":\"abc.def.ghi\"}");
    defer allocator.free(raw.token);
    try std.testing.expectEqualStrings("abc.def.ghi", raw.token);
    const bearer = parseAuthFrame(allocator, "{\"type\":\"auth\",\"token\":\"Bearer abc.def.ghi\"}");
    defer allocator.free(bearer.token);
    try std.testing.expectEqualStrings("abc.def.ghi", bearer.token);
    try std.testing.expectEqual(AuthFrame.invalid, parseAuthFrame(allocator, "{\"type\":\"auth\"}"));
}
