const std = @import("std");
const Hub = @import("hub.zig").Hub;

pub const Server = struct {
    hub: *Hub,
    host: []const u8,
    port: u16,

    pub fn serve(self: *Server) !void {
        const io = std.Options.debug_io;
        const address = try std.Io.net.IpAddress.parse(self.host, self.port);
        var listener = try address.listen(io, .{ .reuse_address = true });
        defer listener.deinit(io);
        std.log.info("websocket listening on {s}:{d}", .{ self.host, self.port });

        while (true) {
            const stream = try listener.accept(io);
            const thread = std.Thread.spawn(.{}, handleConnectionThread, .{ self.hub, stream }) catch |err| {
                var fallback = stream;
                defer fallback.close(io);
                std.log.warn("websocket worker unavailable: {s}", .{@errorName(err)});
                handleConnection(self.hub, fallback) catch {};
                continue;
            };
            thread.detach();
        }
    }
};

fn handleConnectionThread(hub: *Hub, stream: std.Io.net.Stream) void {
    const io = std.Options.debug_io;
    var owned = stream;
    defer owned.close(io);
    handleConnection(hub, owned) catch |err| std.log.debug("websocket closed: {s}", .{@errorName(err)});
}

fn handleConnection(hub: *Hub, stream: std.Io.net.Stream) !void {
    const io = std.Options.debug_io;
    var read_buffer: [32 * 1024]u8 = undefined;
    var write_buffer: [32 * 1024]u8 = undefined;
    var reader = stream.reader(io, &read_buffer);
    var writer = stream.writer(io, &write_buffer);
    var http = std.http.Server.init(&reader.interface, &writer.interface);

    var request = try http.receiveHead();
    if (request.head.method != .GET or !std.mem.eql(u8, request.head.target, "/ws")) {
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
    const client = try hub.addClient(stream);
    defer hub.removeClient(client);
    try hub.send(client, "{\"type\":\"ready\",\"transport\":\"fujin\"}", .text);

    while (true) {
        const message = ws.readSmallMessage() catch |err| switch (err) {
            error.ConnectionClose, error.EndOfStream => return,
            else => return err,
        };
        switch (message.opcode) {
            .text => hub.onWebSocketEvent(client, message.data),
            .ping => hub.send(client, message.data, .pong) catch return,
            .connection_close => return,
            else => {},
        }
    }
}
