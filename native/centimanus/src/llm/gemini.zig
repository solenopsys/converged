//! Google Gemini generateContent provider (non-streaming). Wire dialect mirrors
//! the TS GeminiProvider (rt-assistant/impls/providers/gemini.ts): roles are
//! user/model, tool traffic travels as functionCall / functionResponse parts,
//! the system prompt is a top-level systemInstruction.

const std = @import("std");
const provider = @import("provider.zig");
const http = @import("http.zig");

pub const default_base_url = "https://generativelanguage.googleapis.com/v1beta";

pub const Config = struct {
    api_key: []const u8,
    base_url: []const u8,
};

pub fn make(cfg: *const Config) provider.Provider {
    return .{ .name = "gemini", .ctx = @constCast(cfg), .complete = complete };
}

fn complete(ctx: *anyopaque, env: provider.CallEnv, req: provider.ChatRequest) anyerror!provider.Reply {
    const cfg: *const Config = @ptrCast(@alignCast(ctx));
    const a = env.alloc;

    var body = try std.ArrayList(u8).initCapacity(a, 1024);
    defer body.deinit(a);

    try body.appendSlice(a, "{\"contents\":[");
    var emitted: usize = 0;
    for (req.messages, 0..) |m, idx| {
        const role = provider.strField(m, "role") orelse
            return provider.errReply(a, "gemini: message {d}: missing role", .{idx});
        if (std.mem.eql(u8, role, "system")) continue;
        if (emitted > 0) try body.appendSlice(a, ",");
        emitted += 1;
        try appendContent(&body, a, m, role);
    }
    try body.appendSlice(a, "]");

    if (try provider.joinSystem(a, req.messages)) |system| {
        try body.appendSlice(a, ",\"systemInstruction\":{\"parts\":[{\"text\":");
        try provider.appendJsonStr(&body, a, system);
        try body.appendSlice(a, "}]}");
    }

    if (req.tools.len > 0) {
        try body.appendSlice(a, ",\"tools\":[{\"functionDeclarations\":[");
        for (req.tools, 0..) |t, i| {
            if (i > 0) try body.appendSlice(a, ",");
            try provider.appendValue(&body, a, t);
        }
        try body.appendSlice(a, "]}]");
    }

    const budget = try std.fmt.allocPrint(a, ",\"generationConfig\":{{\"maxOutputTokens\":{d}", .{req.max_tokens});
    try body.appendSlice(a, budget);
    if (req.temperature) |t| {
        const temp = try std.fmt.allocPrint(a, ",\"temperature\":{d}", .{t});
        try body.appendSlice(a, temp);
    }
    try body.appendSlice(a, "}}");

    const url = try std.fmt.allocPrint(a, "{s}/models/{s}:generateContent", .{ cfg.base_url, req.model });
    const headers = [_]std.http.Header{
        .{ .name = "content-type", .value = "application/json" },
        .{ .name = "x-goog-api-key", .value = cfg.api_key },
    };

    const res = try http.postJson(env.client, a, url, &headers, body.items);
    if (res.status < 200 or res.status >= 300)
        return provider.errReply(a, "gemini HTTP {d}: {s}", .{ res.status, res.body });

    return parseResponse(a, req.model, res.body);
}

fn appendContent(body: *std.ArrayList(u8), a: std.mem.Allocator, m: std.json.Value, role: []const u8) !void {
    const content = provider.strField(m, "content") orelse "";

    // Tool result -> a user turn with one functionResponse part.
    if (std.mem.eql(u8, role, "tool")) {
        try body.appendSlice(a, "{\"role\":\"user\",\"parts\":[{\"functionResponse\":{\"name\":");
        try provider.appendJsonStr(body, a, provider.strField(m, "name") orelse "");
        try body.appendSlice(a, ",\"response\":{\"result\":");
        try provider.appendJsonStr(body, a, content);
        try body.appendSlice(a, "}}}]}");
        return;
    }

    const wire_role = if (std.mem.eql(u8, role, "assistant")) "model" else "user";
    try body.appendSlice(a, "{\"role\":\"");
    try body.appendSlice(a, wire_role);
    try body.appendSlice(a, "\",\"parts\":[");

    var first = true;
    if (content.len > 0) {
        try body.appendSlice(a, "{\"text\":");
        try provider.appendJsonStr(body, a, content);
        try body.appendSlice(a, "}");
        first = false;
    }
    if (std.mem.eql(u8, role, "assistant")) {
        if (provider.arrField(m, "toolCalls")) |calls| {
            for (calls) |tc| {
                if (!first) try body.appendSlice(a, ",");
                first = false;
                try body.appendSlice(a, "{\"functionCall\":{\"name\":");
                try provider.appendJsonStr(body, a, provider.strField(tc, "name") orelse "");
                try body.appendSlice(a, ",\"args\":");
                if (provider.field(tc, "args")) |args| {
                    try provider.appendValue(body, a, args);
                } else {
                    try body.appendSlice(a, "{}");
                }
                try body.appendSlice(a, "}}");
            }
        }
    }
    // Gemini rejects a content with zero parts — emit an empty text part.
    if (first) try body.appendSlice(a, "{\"text\":\"\"}");
    try body.appendSlice(a, "]}");
}

fn parseResponse(a: std.mem.Allocator, model: []const u8, raw: []const u8) !provider.Reply {
    const root = std.json.parseFromSliceLeaky(std.json.Value, a, raw, .{}) catch
        return provider.errReply(a, "gemini: malformed response: {s}", .{raw});

    const candidates = provider.arrField(root, "candidates") orelse
        return provider.errReply(a, "gemini: response without candidates: {s}", .{raw});
    if (candidates.len == 0)
        return provider.errReply(a, "gemini: empty candidates: {s}", .{raw});

    var text = try std.ArrayList(u8).initCapacity(a, 0);
    defer text.deinit(a);
    var tool_calls = try std.ArrayList(provider.ToolCall).initCapacity(a, 0);
    defer tool_calls.deinit(a);

    if (provider.field(candidates[0], "content")) |content| {
        if (provider.arrField(content, "parts")) |parts| {
            for (parts) |part| {
                if (provider.strField(part, "text")) |t| try text.appendSlice(a, t);
                if (provider.field(part, "functionCall")) |call| {
                    const args_json = if (provider.field(call, "args")) |args|
                        try std.json.Stringify.valueAlloc(a, args, .{})
                    else
                        "{}";
                    // Gemini often omits call ids — synthesize a stable one.
                    const id = provider.strField(call, "id") orelse
                        try std.fmt.allocPrint(a, "call-{d}", .{tool_calls.items.len});
                    try tool_calls.append(a, .{
                        .id = id,
                        .name = provider.strField(call, "name") orelse "",
                        .args_json = args_json,
                    });
                }
            }
        }
    }

    const usage = provider.field(root, "usageMetadata");
    const body = try provider.encodeCompletion(a, "gemini", model, .{
        .text = text.items,
        .tool_calls = tool_calls.items,
        .finish_reason = provider.strField(candidates[0], "finishReason") orelse "STOP",
        .usage_input = if (usage) |u| provider.intField(u, "promptTokenCount") orelse 0 else 0,
        .usage_output = if (usage) |u| provider.intField(u, "candidatesTokenCount") orelse 0 else 0,
    });
    return .{ .ok = true, .body = body };
}
