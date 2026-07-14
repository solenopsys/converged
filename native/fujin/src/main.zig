const std = @import("std");
const Config = @import("config.zig").Config;
const Policy = @import("qjs_policy.zig").Policy;
const Hub = @import("hub.zig").Hub;
const Zimq = @import("zimq.zig").Server;
const FluentBit = @import("fluentbit.zig").Receiver;
const WebSocket = @import("websocket.zig").Server;

const ZmqPeers = struct {
    const Peer = struct {
        service: []u8,
        identity: []u8,
    };

    allocator: std.mem.Allocator,
    peers: std.ArrayList(Peer) = .empty,

    fn deinit(self: *ZmqPeers) void {
        for (self.peers.items) |peer| {
            self.allocator.free(peer.service);
            self.allocator.free(peer.identity);
        }
        self.peers.deinit(self.allocator);
        self.* = undefined;
    }

    fn register(self: *ZmqPeers, service: []const u8, identity: []const u8) !void {
        for (self.peers.items) |*peer| {
            if (std.mem.eql(u8, peer.service, service)) {
                const replacement = try self.allocator.dupe(u8, identity);
                self.allocator.free(peer.identity);
                peer.identity = replacement;
                return;
            }
        }
        try self.peers.append(self.allocator, .{
            .service = try self.allocator.dupe(u8, service),
            .identity = try self.allocator.dupe(u8, identity),
        });
        std.log.info("service registered service={s} identity={s}", .{ service, identity });
    }

    fn identityFor(self: *const ZmqPeers, service: []const u8) ?[]const u8 {
        for (self.peers.items) |peer| {
            if (std.mem.eql(u8, peer.service, service)) return peer.identity;
        }
        return null;
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
    const identity_buffer = allocator.alloc(u8, frame_limit) catch return;
    defer allocator.free(identity_buffer);
    const payload_buffer = allocator.alloc(u8, frame_limit) catch return;
    defer allocator.free(payload_buffer);

    while (true) {
        drainBrowserCommands(zimq, hub, peers);

        const route = (zimq.recv(identity_buffer) catch |err| {
            std.log.err("zimq identity receive failed: {s}", .{@errorName(err)});
            return;
        }) orelse continue;
        const has_payload = zimq.hasMore() catch false;
        if (route.truncated or !has_payload) {
            std.log.warn("zimq route rejected bytes={d} truncated={} more={}", .{ route.wire_len, route.truncated, has_payload });
            continue;
        }

        const body = (zimq.recv(payload_buffer) catch |err| {
            std.log.warn("zimq payload rejected: {s}", .{@errorName(err)});
            continue;
        }) orelse continue;
        while (zimq.hasMore() catch false) {
            _ = zimq.recv(payload_buffer) catch break;
        }
        if (body.truncated or body.wire_len > max_control_bytes) {
            hub.announceBulk(body.wire_len);
            continue;
        }

        if (readyService(allocator, body.bytes)) |service| {
            defer allocator.free(service);
            peers.register(service, route.bytes) catch |err|
                std.log.warn("service registration rejected: {s}", .{@errorName(err)});
            continue;
        }

        hub.onZmqControl(body.bytes) catch |err|
            std.log.warn("zimq control rejected identity={s}: {s}", .{ route.bytes, @errorName(err) });
    }
}

fn drainBrowserCommands(zimq: *Zimq, hub: *Hub, peers: *const ZmqPeers) void {
    while (hub.takePending()) |pending_value| {
        var pending = pending_value;
        defer pending.deinit();
        const identity = peers.identityFor(pending.target) orelse {
            hub.serviceUnavailable(&pending);
            continue;
        };
        zimq.reply(identity, pending.payload) catch |err| {
            std.log.warn("command send failed target={s}: {s}", .{ pending.target, @errorName(err) });
            hub.serviceUnavailable(&pending);
        };
    }
}

fn readyService(allocator: std.mem.Allocator, payload: []const u8) ?[]u8 {
    var parsed = std.json.parseFromSlice(std.json.Value, allocator, payload, .{}) catch return null;
    defer parsed.deinit();
    if (parsed.value != .object) return null;
    const event_type = parsed.value.object.get("type") orelse return null;
    if (event_type != .string or !std.mem.eql(u8, event_type.string, "service_ready")) return null;
    const service = parsed.value.object.get("service") orelse return null;
    return if (service == .string) allocator.dupe(u8, service.string) catch null else null;
}
