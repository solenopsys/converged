const std = @import("std");
const envelope = @import("envelope.zig");

pub const Packet = struct {
    envelope: envelope.Envelope,
    payload: []u8,

    pub fn deinit(self: *Packet, allocator: std.mem.Allocator) void {
        allocator.free(self.payload);
        self.* = undefined;
    }
};

pub const RegisterOptions = struct {
    target: []const u8,
};

pub fn register(allocator: std.mem.Allocator, options: RegisterOptions) !Packet {
    if (options.target.len == 0) return error.TargetRequired;

    return .{
        .envelope = .{
            .kind = .system,
            .method = "register",
            .from = .{ .target = options.target },
            .codec = .json,
        },
        .payload = try allocator.dupe(u8, "{}"),
    };
}

pub fn ping(allocator: std.mem.Allocator, target: []const u8) !Packet {
    return targetControl(allocator, "ping", target);
}

pub fn pong(allocator: std.mem.Allocator, target: []const u8) !Packet {
    return targetControl(allocator, "pong", target);
}

fn targetControl(allocator: std.mem.Allocator, method: []const u8, target: []const u8) !Packet {
    if (target.len == 0) return error.TargetRequired;
    return .{
        .envelope = .{
            .kind = .system,
            .method = method,
            .from = .{ .target = target },
            .codec = .json,
        },
        .payload = try allocator.dupe(u8, "{}"),
    };
}

pub fn cancel(allocator: std.mem.Allocator, request_id: []const u8) !Packet {
    if (request_id.len == 0) return error.RequestIdRequired;
    return .{
        .envelope = .{
            .kind = .event,
            .method = "cancel",
            .request_id = request_id,
            .codec = .json,
        },
        .payload = try std.json.Stringify.valueAlloc(allocator, .{ .requestId = request_id }, .{}),
    };
}

pub fn unregister(allocator: std.mem.Allocator, target: []const u8) !Packet {
    return targetControl(allocator, "unregister", target);
}

test "register builds a system envelope and valid JSON" {
    var packet = try register(std.testing.allocator, .{
        .target = "core",
    });
    defer packet.deinit(std.testing.allocator);

    try std.testing.expectEqual(envelope.Kind.system, packet.envelope.kind);
    try std.testing.expectEqualStrings("register", packet.envelope.method);
    try std.testing.expectEqualStrings("core", packet.envelope.from.target);

    try std.testing.expectEqualStrings("{}", packet.payload);
}

test "cancel carries the request id" {
    var packet = try cancel(std.testing.allocator, "req-42");
    defer packet.deinit(std.testing.allocator);
    try std.testing.expectEqualStrings("cancel", packet.envelope.method);
    try std.testing.expectEqualStrings("req-42", packet.envelope.request_id);
    try std.testing.expectEqualStrings("{\"requestId\":\"req-42\"}", packet.payload);
}
