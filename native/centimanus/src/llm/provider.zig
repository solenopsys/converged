//! The uniform LLM provider surface. One chat-completion contract, spoken by
//! every pluggable provider (openai/claude/gemini); the shapes mirror the TS
//! ChatLLMProvider layer (rt-assistant/impls/providers/base.ts) so workflows
//! and tests use one dialect regardless of vendor.
//!
//! Uniform request (what `rt.llm({...})` carries — all values explicit, the
//! VM never invents a model, a provider or a token budget):
//!   { provider, model, maxTokens, messages: [...], tools?: [...], temperature? }
//! Uniform message:
//!   { role: "system"|"user"|"assistant"|"tool", content,
//!     toolCalls?: [{id,name,args}], toolCallId?, name? }
//! Uniform response:
//!   { provider, model, text, toolCalls: [{id,name,args}], finishReason,
//!     usage: {input,output} }

const std = @import("std");

/// Outcome of one completion call. `body` is alloc-owned: the uniform response
/// JSON when ok, or a human-readable error line otherwise.
pub const Reply = struct { ok: bool, body: []const u8 };

/// Uniform chat request, parsed once by the hub. Message and tool objects stay
/// opaque json values — each provider re-encodes them into its wire dialect.
pub const ChatRequest = struct {
    model: []const u8,
    max_tokens: i64,
    temperature: ?f64,
    messages: []const std.json.Value,
    tools: []const std.json.Value,
};

/// Everything a provider call may use. The http client is long-lived (owned by
/// the hub), so TLS/keep-alive connections survive across calls.
pub const CallEnv = struct {
    alloc: std.mem.Allocator,
    client: *std.http.Client,
};

/// The provider interface: a name for hub lookup plus one function — take the
/// uniform request, return the uniform response.
pub const Provider = struct {
    name: []const u8,
    ctx: *anyopaque,
    complete: *const fn (ctx: *anyopaque, env: CallEnv, req: ChatRequest) anyerror!Reply,
};

// ---- uniform response assembly ----------------------------------------------

pub const ToolCall = struct {
    id: []const u8,
    name: []const u8,
    /// The call arguments as JSON text (an object), spliced verbatim.
    args_json: []const u8,
};

pub const Completion = struct {
    text: []const u8,
    tool_calls: []const ToolCall,
    finish_reason: []const u8,
    usage_input: i64,
    usage_output: i64,
};

pub fn encodeCompletion(
    a: std.mem.Allocator,
    provider_name: []const u8,
    model: []const u8,
    c: Completion,
) ![]const u8 {
    var out = try std.ArrayList(u8).initCapacity(a, c.text.len + 256);
    defer out.deinit(a);

    try out.appendSlice(a, "{\"provider\":");
    try appendJsonStr(&out, a, provider_name);
    try out.appendSlice(a, ",\"model\":");
    try appendJsonStr(&out, a, model);
    try out.appendSlice(a, ",\"text\":");
    try appendJsonStr(&out, a, c.text);
    try out.appendSlice(a, ",\"toolCalls\":[");
    for (c.tool_calls, 0..) |tc, i| {
        if (i > 0) try out.appendSlice(a, ",");
        try out.appendSlice(a, "{\"id\":");
        try appendJsonStr(&out, a, tc.id);
        try out.appendSlice(a, ",\"name\":");
        try appendJsonStr(&out, a, tc.name);
        try out.appendSlice(a, ",\"args\":");
        try out.appendSlice(a, if (tc.args_json.len == 0) "{}" else tc.args_json);
        try out.appendSlice(a, "}");
    }
    try out.appendSlice(a, "],\"finishReason\":");
    try appendJsonStr(&out, a, c.finish_reason);
    const usage = try std.fmt.allocPrint(a, ",\"usage\":{{\"input\":{d},\"output\":{d}}}}}", .{ c.usage_input, c.usage_output });
    try out.appendSlice(a, usage);

    return try out.toOwnedSlice(a);
}

pub fn errReply(a: std.mem.Allocator, comptime fmt: []const u8, args: anytype) !Reply {
    return .{ .ok = false, .body = try std.fmt.allocPrint(a, fmt, args) };
}

// ---- shared json helpers ------------------------------------------------------

pub fn jsonStr(a: std.mem.Allocator, s: []const u8) ![]u8 {
    return std.json.Stringify.valueAlloc(a, std.json.Value{ .string = s }, .{});
}

pub fn appendJsonStr(out: *std.ArrayList(u8), a: std.mem.Allocator, s: []const u8) !void {
    const quoted = try jsonStr(a, s);
    try out.appendSlice(a, quoted);
}

/// Serialize an opaque json value verbatim (used to pass through tool schemas
/// and tool-call args without interpreting them).
pub fn appendValue(out: *std.ArrayList(u8), a: std.mem.Allocator, v: std.json.Value) !void {
    const text = try std.json.Stringify.valueAlloc(a, v, .{});
    try out.appendSlice(a, text);
}

pub fn field(v: std.json.Value, name: []const u8) ?std.json.Value {
    return switch (v) {
        .object => |o| o.get(name),
        else => null,
    };
}

pub fn strField(v: std.json.Value, name: []const u8) ?[]const u8 {
    const f = field(v, name) orelse return null;
    return switch (f) {
        .string => |s| s,
        else => null,
    };
}

pub fn arrField(v: std.json.Value, name: []const u8) ?[]const std.json.Value {
    const f = field(v, name) orelse return null;
    return switch (f) {
        .array => |items| items.items,
        else => null,
    };
}

pub fn intField(v: std.json.Value, name: []const u8) ?i64 {
    const f = field(v, name) orelse return null;
    return switch (f) {
        .integer => |n| n,
        .float => |n| @intFromFloat(n),
        else => null,
    };
}

/// Collect every system message's content, joined with a blank line — for the
/// providers that carry the system prompt outside the message list.
pub fn joinSystem(a: std.mem.Allocator, messages: []const std.json.Value) !?[]const u8 {
    var out = try std.ArrayList(u8).initCapacity(a, 0);
    defer out.deinit(a);
    var found = false;
    for (messages) |m| {
        const role = strField(m, "role") orelse continue;
        if (!std.mem.eql(u8, role, "system")) continue;
        const content = strField(m, "content") orelse continue;
        if (found) try out.appendSlice(a, "\n\n");
        try out.appendSlice(a, content);
        found = true;
    }
    if (!found) return null;
    return try out.toOwnedSlice(a);
}
