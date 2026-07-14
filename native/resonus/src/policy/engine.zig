const std = @import("std");
const qjs_mod = @import("../native/qjs_client.zig");
const types = @import("types.zig");
const json_util = @import("../util/json.zig");

pub const Engine = struct {
    allocator: std.mem.Allocator,
    qjs: qjs_mod.Client,
    script: []u8,
    script_path: []u8,

    pub fn init(allocator: std.mem.Allocator, lib_path: []const u8, script_path: []const u8) !Engine {
        var qjs = try qjs_mod.Client.init(allocator, lib_path);
        errdefer qjs.deinit();
        const script = try std.Io.Dir.cwd().readFileAlloc(
            std.Options.debug_io,
            script_path,
            allocator,
            .limited(1024 * 1024),
        );
        errdefer allocator.free(script);
        return .{
            .allocator = allocator,
            .qjs = qjs,
            .script = script,
            .script_path = try allocator.dupe(u8, script_path),
        };
    }

    pub fn deinit(self: *Engine) void {
        self.qjs.deinit();
        self.allocator.free(self.script);
        self.allocator.free(self.script_path);
        self.* = undefined;
    }

    pub fn planIncoming(self: *Engine, call: types.IncomingCall) !types.CallPlan {
        const event_json = try encodeIncoming(self.allocator, call);
        defer self.allocator.free(event_json);
        const source = try buildInvocation(self.allocator, self.script, event_json);
        defer self.allocator.free(source);

        var result = try self.qjs.eval(source);
        defer result.deinit(self.allocator);
        if (result.code != 0) {
            std.log.err("policy {s} failed: {s}", .{ self.script_path, result.text });
            return error.PolicyScriptFailed;
        }
        return types.parseCallPlan(self.allocator, result.text);
    }
};

fn encodeIncoming(allocator: std.mem.Allocator, call: types.IncomingCall) ![]u8 {
    var out = try std.ArrayList(u8).initCapacity(allocator, 384);
    defer out.deinit(allocator);
    try out.appendSlice(allocator, "{\"type\":\"incoming_call\",\"callId\":");
    try json_util.appendQuoted(&out, allocator, call.call_id);
    try out.appendSlice(allocator, ",\"caller\":");
    try json_util.appendQuoted(&out, allocator, call.caller);
    try out.appendSlice(allocator, ",\"dialed\":");
    try json_util.appendQuoted(&out, allocator, call.dialed);
    try out.appendSlice(allocator, ",\"route\":{\"contextId\":");
    try appendQuotedOrNull(&out, allocator, call.route_context_id);
    try out.appendSlice(allocator, ",\"transferUri\":");
    try appendQuotedOrNull(&out, allocator, call.route_transfer_uri);
    try out.appendSlice(allocator, ",\"language\":");
    try appendQuotedOrNull(&out, allocator, call.route_transfer_language);
    try out.appendSlice(allocator, "}}");
    return try out.toOwnedSlice(allocator);
}

fn buildInvocation(allocator: std.mem.Allocator, script: []const u8, event_json: []const u8) ![]u8 {
    var out = try std.ArrayList(u8).initCapacity(allocator, script.len + event_json.len + 1400);
    defer out.deinit(allocator);
    try out.appendSlice(allocator, script);
    try out.appendSlice(allocator,
        \\;(() => {
        \\  "use strict";
        \\  const gateway = Object.freeze({
        \\    ai(options = {}) { return { action: "ai", provider: "openai", ...options }; },
        \\    human(transferUri, options = {}) { return { action: "human", transferUri, ...options }; },
        \\    reject(status = 403) { return { action: "reject", status }; },
        \\    transferToHuman(humanTransferUri) { return { humanTransferUri }; },
        \\    fromRoute(call, options = {}) {
        \\      if (call.route.transferUri) return this.human(call.route.transferUri, { language: call.route.language, ...options });
        \\      if (call.route.contextId) return this.ai({ contextId: call.route.contextId, ...options });
        \\      return this.reject(404);
        \\    }
        \\  });
        \\  if (typeof onIncomingCall !== "function") throw new Error("policy must define onIncomingCall(call, gateway)");
        \\  return JSON.stringify(onIncomingCall(
    );
    try out.appendSlice(allocator, event_json);
    try out.appendSlice(allocator, ", gateway));\n})()");
    return try out.toOwnedSlice(allocator);
}

fn appendQuotedOrNull(out: *std.ArrayList(u8), allocator: std.mem.Allocator, value: ?[]const u8) !void {
    if (value) |v| return json_util.appendQuoted(out, allocator, v);
    try out.appendSlice(allocator, "null");
}
