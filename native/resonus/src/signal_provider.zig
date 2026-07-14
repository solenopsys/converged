const std = @import("std");
const fujin_client = @import("fujin-client");
const gateway_mod = @import("gate/gateway.zig");
const clock = @import("util/clock.zig");

pub const Provider = struct {
    gateway: *gateway_mod.Gateway,

    pub fn fujin(self: *Provider) fujin_client.Client.Provider {
        return .{ .context = self, .handle_fn = handleOpaque };
    }

    fn handleOpaque(context: *anyopaque, allocator: std.mem.Allocator, command: fujin_client.Client.Command) ![]u8 {
        const self: *Provider = @ptrCast(@alignCast(context));
        return self.handle(allocator, command);
    }

    fn handle(self: *Provider, allocator: std.mem.Allocator, command: fujin_client.Client.Command) ![]u8 {
        if (command.scope.len == 0) return error.ScopeRequired;
        if (command.message != .object) return error.MessageInvalid;
        const message = command.message.object;
        const name = stringField(message, "name") orelse return error.CommandNameMissing;
        const request_id = stringField(message, "requestId") orelse return error.RequestIdMissing;
        const payload_value = message.get("payload") orelse std.json.Value{ .object = .empty };
        if (payload_value != .object) return error.PayloadInvalid;
        const payload = payload_value.object;

        if (std.mem.eql(u8, name, "call.offer")) {
            return self.offer(allocator, command.scope, request_id, payload);
        }
        if (std.mem.eql(u8, name, "call.hangup")) {
            const session_id = stringField(payload, "sessionId") orelse return error.SessionIdMissing;
            self.gateway.endWebBridgeSession(session_id);
            return event(allocator, request_id, "call.ended", session_id, "{}");
        }
        if (std.mem.eql(u8, name, "call.ice")) {
            const session_id = stringField(payload, "sessionId") orelse "";
            return event(allocator, request_id, "call.ice_ack", session_id, "{}");
        }
        return error.CommandUnsupported;
    }

    fn offer(
        self: *Provider,
        allocator: std.mem.Allocator,
        scope: []const u8,
        request_id: []const u8,
        payload: std.json.ObjectMap,
    ) ![]u8 {
        const sdp = stringField(payload, "sdp") orelse return error.OfferSdpMissing;
        const context_name = stringField(payload, "contextName") orelse return error.ContextRequired;
        if (context_name.len == 0) return error.ContextRequired;
        const language = stringField(payload, "language");
        const user = stringField(payload, "user") orelse "anonymous";
        const identifier = stringField(payload, "phone") orelse user;
        const timestamp = clock.nanoTimestamp();
        const session_id = try std.fmt.allocPrint(allocator, "ws-{x}", .{@as(u64, @bitCast(timestamp))});

        const answer = try self.gateway.createWebBridgeSession(
            session_id,
            identifier,
            scope,
            context_name,
            language,
            sdp,
        );
        defer self.gateway.allocator.free(answer);

        const answer_json = try std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = answer }, .{});
        const payload_json = try std.fmt.allocPrint(allocator, "{{\"sdp\":{s}}}", .{answer_json});
        return event(allocator, request_id, "call.answer", session_id, payload_json);
    }
};

fn event(
    allocator: std.mem.Allocator,
    request_id: []const u8,
    name: []const u8,
    session_id: []const u8,
    payload_json: []const u8,
) ![]u8 {
    const request = try std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = request_id }, .{});
    const event_name = try std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = name }, .{});
    const session = try std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = session_id }, .{});
    return std.fmt.allocPrint(
        allocator,
        "{{\"type\":\"event\",\"requestId\":{s},\"name\":{s},\"sessionId\":{s},\"payload\":{s}}}",
        .{ request, event_name, session, payload_json },
    );
}

fn stringField(object: std.json.ObjectMap, key: []const u8) ?[]const u8 {
    const value = object.get(key) orelse return null;
    return switch (value) {
        .string => |text| text,
        else => null,
    };
}
