const std = @import("std");

pub const Action = enum {
    ai,
    human,
    reject,
};

pub const IncomingCall = struct {
    call_id: []const u8,
    caller: []const u8,
    dialed: []const u8,
    route_context_id: ?[]const u8 = null,
    route_transfer_uri: ?[]const u8 = null,
    route_transfer_language: ?[]const u8 = null,
};

/// Owned, validated result of a JS policy decision.
pub const CallPlan = struct {
    action: Action,
    context_id: ?[]u8 = null,
    transfer_uri: ?[]u8 = null,
    language: ?[]u8 = null,
    provider: ?[]u8 = null,
    model: ?[]u8 = null,
    voice: ?[]u8 = null,
    transcription_model: ?[]u8 = null,
    noise_reduction: ?[]u8 = null,
    vad_threshold: ?f32 = null,
    vad_silence_ms: ?u32 = null,
    vad_prefix_ms: ?u32 = null,
    vad_interrupt: ?bool = null,
    human_transfer_uri: ?[]u8 = null,
    reject_status: u16 = 403,

    pub fn deinit(self: *CallPlan, allocator: std.mem.Allocator) void {
        if (self.context_id) |v| allocator.free(v);
        if (self.transfer_uri) |v| allocator.free(v);
        if (self.language) |v| allocator.free(v);
        if (self.provider) |v| allocator.free(v);
        if (self.model) |v| allocator.free(v);
        if (self.voice) |v| allocator.free(v);
        if (self.transcription_model) |v| allocator.free(v);
        if (self.noise_reduction) |v| allocator.free(v);
        if (self.human_transfer_uri) |v| allocator.free(v);
        self.* = undefined;
    }

    pub fn hasHumanTransferTool(self: *const CallPlan) bool {
        return self.action == .ai and self.human_transfer_uri != null;
    }
};

pub fn parseCallPlan(allocator: std.mem.Allocator, json: []const u8) !CallPlan {
    var parsed = try std.json.parseFromSlice(std.json.Value, allocator, json, .{});
    defer parsed.deinit();
    if (parsed.value != .object) return error.InvalidPolicyResult;
    const obj = &parsed.value.object;

    const action_text = try requiredString(obj, "action");
    const action: Action = if (std.mem.eql(u8, action_text, "ai"))
        .ai
    else if (std.mem.eql(u8, action_text, "human"))
        .human
    else if (std.mem.eql(u8, action_text, "reject"))
        .reject
    else
        return error.InvalidPolicyAction;

    var plan = CallPlan{ .action = action };
    errdefer plan.deinit(allocator);
    plan.context_id = try optionalOwnedString(allocator, obj, "contextId");
    plan.transfer_uri = try optionalOwnedString(allocator, obj, "transferUri");
    plan.language = try optionalOwnedString(allocator, obj, "language");
    plan.provider = try optionalOwnedString(allocator, obj, "provider");
    plan.model = try optionalOwnedString(allocator, obj, "model");
    plan.voice = try optionalOwnedString(allocator, obj, "voice");
    plan.transcription_model = try optionalOwnedString(allocator, obj, "transcriptionModel");
    plan.noise_reduction = try optionalOwnedString(allocator, obj, "noiseReduction");
    plan.vad_threshold = try optionalFloat(obj, "vadThreshold", 0, 1);
    plan.vad_silence_ms = try optionalU32(obj, "vadSilenceMs");
    plan.vad_prefix_ms = try optionalU32(obj, "vadPrefixMs");
    plan.vad_interrupt = try optionalBool(obj, "interruptResponse");
    plan.human_transfer_uri = try optionalOwnedString(allocator, obj, "humanTransferUri");

    if (obj.get("status")) |value| {
        if (value != .integer or value.integer < 400 or value.integer > 699) return error.InvalidPolicyResult;
        plan.reject_status = @intCast(value.integer);
    }

    switch (action) {
        .ai => if (plan.context_id == null) return error.PolicyContextRequired,
        .human => if (plan.transfer_uri == null) return error.PolicyTransferUriRequired,
        .reject => {},
    }
    return plan;
}

fn requiredString(obj: *const std.json.ObjectMap, key: []const u8) ![]const u8 {
    const value = obj.get(key) orelse return error.InvalidPolicyResult;
    if (value != .string or value.string.len == 0) return error.InvalidPolicyResult;
    return value.string;
}

fn optionalOwnedString(allocator: std.mem.Allocator, obj: *const std.json.ObjectMap, key: []const u8) !?[]u8 {
    const value = obj.get(key) orelse return null;
    if (value == .null) return null;
    if (value != .string or value.string.len == 0) return error.InvalidPolicyResult;
    return try allocator.dupe(u8, value.string);
}

fn optionalFloat(obj: *const std.json.ObjectMap, key: []const u8, min: f32, max: f32) !?f32 {
    const value = obj.get(key) orelse return null;
    const number: f32 = switch (value) {
        .float => |v| @floatCast(v),
        .integer => |v| @floatFromInt(v),
        else => return error.InvalidPolicyResult,
    };
    if (number < min or number > max) return error.InvalidPolicyResult;
    return number;
}

fn optionalU32(obj: *const std.json.ObjectMap, key: []const u8) !?u32 {
    const value = obj.get(key) orelse return null;
    if (value != .integer or value.integer < 0 or value.integer > std.math.maxInt(u32)) return error.InvalidPolicyResult;
    return @intCast(value.integer);
}

fn optionalBool(obj: *const std.json.ObjectMap, key: []const u8) !?bool {
    const value = obj.get(key) orelse return null;
    if (value != .bool) return error.InvalidPolicyResult;
    return value.bool;
}

test "parse AI plan with human transfer tool" {
    var plan = try parseCallPlan(std.testing.allocator,
        \\{"action":"ai","contextId":"voice","model":"gpt-realtime-2.1","humanTransferUri":"sip:operator@example.com"}
    );
    defer plan.deinit(std.testing.allocator);
    try std.testing.expect(plan.hasHumanTransferTool());
    try std.testing.expectEqualStrings("voice", plan.context_id.?);
}

test "human plan requires target" {
    try std.testing.expectError(error.PolicyTransferUriRequired, parseCallPlan(std.testing.allocator, "{\"action\":\"human\"}"));
}
