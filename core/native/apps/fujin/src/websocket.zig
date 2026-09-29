const std = @import("std");
const Hub = @import("hub.zig").Hub;
const JwtConfig = @import("config.zig").JwtConfig;
const transport = @import("transport");

pub fn serve(hub: *Hub, jwt: *const JwtConfig, stream: std.Io.net.Stream, ws: anytype, scope: []const u8, authorization: []const u8) !void {
    const client = try hub.addClient(stream, scope);
    defer hub.removeClient(client);
    var ready_buffer: [192]u8 = undefined;
    const ready = try std.fmt.bufPrint(
        &ready_buffer,
        "{{\"type\":\"ready\",\"transport\":\"fujin\",\"connectionId\":{d},\"scoped\":{},\"authRequired\":{}}}",
        .{ client.id, scope.len > 0, jwt.mode == .required },
    );
    try hub.send(client, ready, .text);
    const token = bearerToken(authorization);
    if (token.len > 0) {
        if (authenticateClient(hub, jwt, client, token)) |_| {} else |err| {
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
                .token => |token_value| {
                    defer hub.allocator.free(token_value);
                    if (authenticateClient(hub, jwt, client, token_value)) |_| {} else |err| {
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
