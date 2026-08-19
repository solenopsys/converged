const std = @import("std");

pub const ToolCall = struct {
    call_id: []u8,

    pub fn deinit(self: *ToolCall, allocator: std.mem.Allocator) void {
        allocator.free(self.call_id);
        self.* = undefined;
    }
};

/// Extract the only privileged built-in tool currently understood by the
/// gateway. Unknown tools remain ordinary transcript/control events.
pub fn parseHumanTransfer(allocator: std.mem.Allocator, json: []const u8) !?ToolCall {
    var parsed = std.json.parseFromSlice(std.json.Value, allocator, json, .{}) catch return null;
    defer parsed.deinit();
    if (parsed.value != .object) return null;
    const root = &parsed.value.object;
    const event_type = stringField(root, "type") orelse return null;

    var name: ?[]const u8 = null;
    var call_id: ?[]const u8 = null;
    if (std.mem.eql(u8, event_type, "response.function_call_arguments.done")) {
        name = stringField(root, "name");
        call_id = stringField(root, "call_id");
    } else if (std.mem.eql(u8, event_type, "response.output_item.done")) {
        const item = root.get("item") orelse return null;
        if (item != .object) return null;
        name = stringField(&item.object, "name");
        call_id = stringField(&item.object, "call_id");
    } else return null;

    if (!std.mem.eql(u8, name orelse return null, "transfer_to_human")) return null;
    return .{ .call_id = try allocator.dupe(u8, call_id orelse return error.InvalidToolCall) };
}

fn stringField(obj: *const std.json.ObjectMap, key: []const u8) ?[]const u8 {
    const value = obj.get(key) orelse return null;
    return if (value == .string) value.string else null;
}

test "parses transfer function from output item" {
    var call = (try parseHumanTransfer(std.testing.allocator,
        \\{"type":"response.output_item.done","item":{"type":"function_call","name":"transfer_to_human","call_id":"call_42","arguments":"{}"}}
    )).?;
    defer call.deinit(std.testing.allocator);
    try std.testing.expectEqualStrings("call_42", call.call_id);
}
