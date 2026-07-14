const std = @import("std");
const Config = @import("config.zig").Config;
const Policy = @import("qjs_policy.zig").Policy;
const Hub = @import("hub.zig").Hub;
const Zimq = @import("zimq.zig").Server;
const FluentBit = @import("fluentbit.zig").Receiver;
const WebSocket = @import("websocket.zig").Server;

const ZmqPeers = struct {
    allocator: std.mem.Allocator,
    identities: std.ArrayList([]u8) = .empty,

    fn deinit(self: *ZmqPeers) void {
        for (self.identities.items) |identity| self.allocator.free(identity);
        self.identities.deinit(self.allocator);
        self.* = undefined;
    }

    fn remember(self: *ZmqPeers, identity: []const u8) !void {
        for (self.identities.items) |known| {
            if (std.mem.eql(u8, known, identity)) return;
        }
        const copy = try self.allocator.dupe(u8, identity);
        errdefer self.allocator.free(copy);
        try self.identities.append(self.allocator, copy);
    }

    fn broadcast(self: *ZmqPeers, zimq: *Zimq, source: []const u8, payload: []const u8) void {
        var index: usize = 0;
        while (index < self.identities.items.len) {
            const identity = self.identities.items[index];
            if (std.mem.eql(u8, identity, source)) {
                index += 1;
                continue;
            }
            zimq.reply(identity, payload) catch {
                self.allocator.free(identity);
                _ = self.identities.orderedRemove(index);
                continue;
            };
            index += 1;
        }
    }
};

pub fn main(init: std.process.Init) !void {
    const allocator = init.gpa;
    var config = try Config.init(allocator, init.environ_map);
    defer config.deinit();

    var policy = try Policy.init(allocator, config.qjs_lib, config.event_policy_path);
    defer policy.deinit();
    var hub = Hub.init(allocator, &policy, config.max_control_bytes);
    defer hub.deinit();

    var fluentbit: ?FluentBit = null;
    if (config.fluentbit_enabled) {
        fluentbit = try FluentBit.init(allocator, config.fluentbit_lib, config.fluentbit_listen, config.fluentbit_port);
        std.log.info("Fluent Bit forward receiver listening on {s}:{d}", .{ config.fluentbit_listen, config.fluentbit_port });
    }
    defer if (fluentbit) |*receiver| receiver.deinit();

    const endpoint = try allocator.dupeZ(u8, config.zmq_endpoint);
    defer allocator.free(endpoint);
    var zimq = try Zimq.init(config.zimq_lib, endpoint);
    defer zimq.deinit();
    var peers = ZmqPeers{ .allocator = allocator };
    defer peers.deinit();
    const worker = try std.Thread.spawn(.{}, zimqLoop, .{ &zimq, &hub, &peers, config.max_control_bytes });
    worker.detach();

    var websocket = WebSocket{ .hub = &hub, .host = config.ws_host, .port = config.ws_port };
    try websocket.serve();
}

fn zimqLoop(zimq: *Zimq, hub: *Hub, peers: *ZmqPeers, max_control_bytes: usize) void {
    const allocator = hub.allocator;
    const frame_limit = @max(max_control_bytes, 1024);
    const identity = allocator.alloc(u8, frame_limit) catch return;
    defer allocator.free(identity);
    const payload = allocator.alloc(u8, frame_limit) catch return;
    defer allocator.free(payload);

    while (true) {
        const route = zimq.recv(identity) catch |err| {
            std.log.err("zimq identity receive failed: {s}", .{@errorName(err)});
            return;
        };
        if (route.truncated) continue;
        const identity_copy = allocator.dupe(u8, route.bytes) catch continue;
        defer allocator.free(identity_copy);
        peers.remember(identity_copy) catch |err| {
            std.log.warn("zimq client identity rejected: {s}", .{@errorName(err)});
            continue;
        };
        if (!(zimq.hasMore() catch false)) continue;

        const body = zimq.recv(payload) catch |err| {
            std.log.warn("zimq payload rejected: {s}", .{@errorName(err)});
            continue;
        };
        while (zimq.hasMore() catch false) {
            _ = zimq.recv(payload) catch break;
        }
        if (body.truncated or body.wire_len > max_control_bytes) {
            hub.announceBulk(body.wire_len);
            zimq.reply(identity_copy, "{\"ok\":true,\"route\":\"bulk\"}") catch {};
            continue;
        }
        var result = hub.onZmqControl(body.bytes) catch |err| {
            const reply = std.fmt.allocPrint(allocator, "{{\"ok\":false,\"error\":\"{s}\"}}", .{@errorName(err)}) catch continue;
            defer allocator.free(reply);
            zimq.reply(identity_copy, reply) catch |send_err| std.log.warn("zimq reply failed: {s}", .{@errorName(send_err)});
            continue;
        };
        defer result.deinit();
        if (result.signal) |signal| peers.broadcast(zimq, identity_copy, signal);
        zimq.reply(identity_copy, result.reply) catch |err| std.log.warn("zimq reply failed: {s}", .{@errorName(err)});
    }
}
