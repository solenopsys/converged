const std = @import("std");
const Hub = @import("hub.zig").Hub;
const JwtConfig = @import("config.zig").JwtConfig;
const Collector = @import("ingest.zig").Collector;
const WebSocket = @import("websocket.zig");

const max_ingest_bytes = 8 * 1024 * 1024;
const max_analytics_line_bytes = 64 * 1024;
const analytics_cors_headers = [_]std.http.Header{
    .{ .name = "access-control-allow-origin", .value = "*" },
    .{ .name = "access-control-allow-methods", .value = "POST, OPTIONS" },
    .{ .name = "access-control-allow-headers", .value = "Content-Type" },
    .{ .name = "access-control-max-age", .value = "86400" },
};

const Request = std.http.Server.Request;
const Stream = std.Io.net.Stream;

pub const Handler = struct {
    path: []const u8,
    context: *anyopaque,
    handle: *const fn (*anyopaque, *Request, Stream, bool) anyerror!HandlerResult,
};

pub const HandlerResult = enum { keep_alive, close };

pub const Server = struct {
    host: []const u8,
    port: u16,
    handlers: []const Handler,

    pub fn serve(self: *Server) !void {
        const io = std.Options.debug_io;
        const address = try std.Io.net.IpAddress.parse(self.host, self.port);
        var listener = try address.listen(io, .{ .reuse_address = true });
        defer listener.deinit(io);
        std.log.info("http listening on {s}:{d}", .{ self.host, self.port });

        while (true) {
            const stream = try listener.accept(io);
            const thread = std.Thread.spawn(.{}, handleConnectionThread, .{ self, stream }) catch |err| {
                var fallback = stream;
                defer fallback.close(io);
                std.log.warn("http worker unavailable: {s}", .{@errorName(err)});
                handleConnection(self, fallback) catch {};
                continue;
            };
            thread.detach();
        }
    }
};

pub const WebSocketRoute = struct {
    hub: *Hub,
    jwt: *const JwtConfig,
    browser_scope: []const u8,
};

pub const FluentBitRoute = struct {
    collector: *Collector,
    path: []const u8,
    key: []const u8,
};

pub const AnalyticsRoute = struct {
    collector: *Collector,
    path: []const u8,
};

pub fn websocketHandler(context: *anyopaque, request: *Request, stream: Stream, _: bool) !HandlerResult {
    const route: *WebSocketRoute = @ptrCast(@alignCast(context));
    if (request.head.method != .GET) {
        try request.respond("method not allowed\n", .{ .status = .method_not_allowed, .keep_alive = false });
        return .close;
    }

    const key = switch (request.upgradeRequested()) {
        .websocket => |value| value orelse {
            try request.respond("websocket upgrade required\n", .{ .status = .bad_request });
            return .close;
        },
        else => {
            try request.respond("websocket upgrade required\n", .{ .status = .upgrade_required });
            return .close;
        },
    };

    var ws = try request.respondWebSocket(.{ .key = key });
    try ws.flush();
    const scope = connectionScope(requestScope(request), route.browser_scope);
    const authorization = requestHeader(request, "authorization") orelse "";
    try WebSocket.serve(route.hub, route.jwt, stream, &ws, scope, authorization);
    return .close;
}

pub fn fluentBitHandler(context: *anyopaque, request: *Request, _: Stream, keep_alive: bool) !HandlerResult {
    const route: *FluentBitRoute = @ptrCast(@alignCast(context));
    if (request.head.method != .POST) {
        try request.respond("method not allowed\n", .{ .status = .method_not_allowed, .keep_alive = false });
        return .close;
    }

    const presented_key = bearerToken(requestHeader(request, "authorization") orelse "");
    if (route.key.len == 0 or !constantTimeEql(presented_key, route.key)) {
        std.log.warn("ingest rejected: key mismatch", .{});
        try request.respond("forbidden\n", .{ .status = .forbidden, .keep_alive = false });
        return .close;
    }

    var tag_buffer: [128]u8 = undefined;
    const tag = copyInto(&tag_buffer, requestHeader(request, "x-fluentbit-tag") orelse "fluentbit");
    var body_buffer: [64 * 1024]u8 = undefined;
    const reader = request.readerExpectNone(&body_buffer);
    const body = reader.allocRemaining(route.collector.allocator, .limited(max_ingest_bytes)) catch |err| {
        std.log.warn("ingest body rejected: {s}", .{@errorName(err)});
        try request.respond("payload rejected\n", .{ .status = .payload_too_large, .keep_alive = false });
        return .close;
    };
    defer route.collector.allocator.free(body);

    const accepted = route.collector.ingestJson(body, tag) catch |err| {
        std.log.warn("ingest batch rejected tag={s}: {s}", .{ tag, @errorName(err) });
        try request.respond("bad request\n", .{ .status = .bad_request, .keep_alive = keep_alive });
        return if (keep_alive) .keep_alive else .close;
    };
    if (accepted.rejected > 0) {
        std.log.warn("ingest tag={s} logs={d} telemetry={d} rejected={d}", .{ tag, accepted.logs, accepted.telemetry, accepted.rejected });
    }
    var answer: [96]u8 = undefined;
    const summary = try std.fmt.bufPrint(&answer, "{{\"logs\":{d},\"telemetry\":{d},\"rejected\":{d}}}\n", .{
        accepted.logs,
        accepted.telemetry,
        accepted.rejected,
    });
    try request.respond(summary, .{ .status = .ok, .keep_alive = keep_alive });
    return if (keep_alive) .keep_alive else .close;
}

pub fn analyticsHandler(context: *anyopaque, request: *Request, _: Stream, keep_alive: bool) !HandlerResult {
    const route: *AnalyticsRoute = @ptrCast(@alignCast(context));
    if (request.head.method == .OPTIONS) {
        try request.respond("", .{ .status = .no_content, .extra_headers = &analytics_cors_headers, .keep_alive = keep_alive });
        return if (keep_alive) .keep_alive else .close;
    }
    if (request.head.method != .POST) {
        try request.respond("method not allowed\n", .{
            .status = .method_not_allowed,
            .extra_headers = &analytics_cors_headers,
            .keep_alive = false,
        });
        return .close;
    }

    var client_ip_buffer: [64]u8 = undefined;
    const client_ip = copyInto(&client_ip_buffer, forwardedClientIp(request));
    var body_buffer: [max_analytics_line_bytes + 1]u8 = undefined;
    const reader = request.readerExpectNone(&body_buffer);
    var accepted = Collector.Accepted{};

    while (true) {
        const maybe_line = reader.takeDelimiter('\n') catch |err| switch (err) {
            error.StreamTooLong => {
                try request.respond("event too large\n", .{
                    .status = .payload_too_large,
                    .extra_headers = &analytics_cors_headers,
                    .keep_alive = false,
                });
                return .close;
            },
            error.ReadFailed => return .close,
        };
        const line = maybe_line orelse break;
        if (line.len > max_analytics_line_bytes) {
            try request.respond("event too large\n", .{
                .status = .payload_too_large,
                .extra_headers = &analytics_cors_headers,
                .keep_alive = false,
            });
            return .close;
        }
        ingestAnalyticsLine(route.collector, line, client_ip, &accepted);
    }

    if (accepted.analytics == 0 or accepted.rejected > 0) {
        std.log.warn("analytics ingest accepted={d} rejected={d}", .{ accepted.analytics, accepted.rejected });
    }
    var answer: [96]u8 = undefined;
    const summary = try std.fmt.bufPrint(&answer, "{{\"accepted\":{d},\"rejected\":{d}}}\n", .{
        accepted.analytics,
        accepted.rejected,
    });
    try request.respond(summary, .{
        .status = .accepted,
        .extra_headers = &analytics_cors_headers,
        .keep_alive = false,
    });
    return .close;
}

fn ingestAnalyticsLine(collector: *Collector, raw_line: []const u8, client_ip: []const u8, total: *Collector.Accepted) void {
    const line = std.mem.trim(u8, raw_line, " \r\t");
    if (line.len == 0) return;
    const accepted = collector.ingestAnalyticsJson(line, client_ip) catch {
        total.rejected += 1;
        return;
    };
    total.analytics += accepted.analytics;
    total.rejected += accepted.rejected;
}

fn handleConnectionThread(server: *Server, stream: Stream) void {
    const io = std.Options.debug_io;
    var owned = stream;
    defer owned.close(io);
    handleConnection(server, owned) catch |err| std.log.debug("http connection closed: {s}", .{@errorName(err)});
}

fn handleConnection(server: *Server, stream: Stream) !void {
    const io = std.Options.debug_io;
    var read_buffer: [32 * 1024]u8 = undefined;
    var write_buffer: [32 * 1024]u8 = undefined;
    var reader = stream.reader(io, &read_buffer);
    var writer = stream.writer(io, &write_buffer);
    var http = std.http.Server.init(&reader.interface, &writer.interface);

    while (true) {
        var request = try http.receiveHead();
        const keep_alive = request.head.keep_alive;
        const path = request.head.target[0 .. std.mem.indexOfScalar(u8, request.head.target, '?') orelse request.head.target.len];
        var result: ?HandlerResult = null;
        for (server.handlers) |handler| {
            if (!std.mem.eql(u8, path, handler.path)) continue;
            result = try handler.handle(handler.context, &request, stream, keep_alive);
            break;
        }
        const disposition = result orelse {
            try request.respond("not found\n", .{ .status = .not_found, .keep_alive = false });
            return;
        };
        if (disposition == .close) return;
    }
}

fn requestScope(request: *Request) []const u8 {
    const names = [_][]const u8{ "x-storage-scope", "storage-scope", "scope", "x-scope", "workspace", "x-workspace" };
    for (names) |name| {
        if (requestHeader(request, name)) |value| {
            const normalized = std.mem.trim(u8, value, " \t\r\n");
            if (normalized.len > 0) return normalized;
        }
    }
    return "";
}

fn connectionScope(header_scope: []const u8, browser_scope: []const u8) []const u8 {
    return if (header_scope.len > 0) header_scope else browser_scope;
}

fn requestHeader(request: *Request, name: []const u8) ?[]const u8 {
    var iterator = request.iterateHeaders();
    while (iterator.next()) |header| {
        if (std.ascii.eqlIgnoreCase(header.name, name)) return header.value;
    }
    return null;
}

fn forwardedClientIp(request: *Request) []const u8 {
    return firstForwardedIp(requestHeader(request, "x-forwarded-for") orelse "");
}

fn firstForwardedIp(forwarded: []const u8) []const u8 {
    var addresses = std.mem.splitScalar(u8, forwarded, ',');
    while (addresses.next()) |address| {
        const candidate = std.mem.trim(u8, address, " \t\r\n");
        if (candidate.len == 0) continue;
        _ = std.Io.net.IpAddress.parse(candidate, 0) catch continue;
        return candidate;
    }
    return "";
}

fn bearerToken(value: []const u8) []const u8 {
    const trimmed = std.mem.trim(u8, value, " \t\r\n");
    const prefix = "Bearer ";
    if (trimmed.len >= prefix.len and std.ascii.startsWithIgnoreCase(trimmed[0..prefix.len], prefix)) {
        return std.mem.trim(u8, trimmed[prefix.len..], " \t\r\n");
    }
    return trimmed;
}

fn copyInto(buffer: []u8, value: []const u8) []const u8 {
    const length = @min(buffer.len, value.len);
    @memcpy(buffer[0..length], value[0..length]);
    return buffer[0..length];
}

fn constantTimeEql(presented: []const u8, expected: []const u8) bool {
    if (presented.len != expected.len) return false;
    var difference: u8 = 0;
    for (presented, expected) |left, right| difference |= left ^ right;
    return difference == 0;
}

test "ingest key comparison does not reveal where it differs" {
    try std.testing.expect(constantTimeEql("secret", "secret"));
    try std.testing.expect(!constantTimeEql("secret", "secreT"));
    try std.testing.expect(!constantTimeEql("secret", "secret-longer"));
    try std.testing.expect(!constantTimeEql("", "secret"));
}

test "forwarded client IP prefers the original address over proxy hops" {
    try std.testing.expectEqualStrings(
        "58.186.10.213",
        firstForwardedIp("58.186.10.213, 10.42.0.1"),
    );
    try std.testing.expectEqualStrings(
        "58.186.10.213",
        firstForwardedIp("invalid, 58.186.10.213, 10.42.0.1"),
    );
}
