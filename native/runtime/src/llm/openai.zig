//! OpenAI chat-completions provider (non-streaming). Wire dialect mirrors the
//! TS OpenAIProvider (rt-assistant/impls/providers/openai.ts).

const std = @import("std");
const provider = @import("provider.zig");
const http = @import("http.zig");

pub const default_base_url = "https://api.openai.com/v1";

pub const Config = struct {
    api_key: []const u8,
    base_url: []const u8,
};

pub fn make(cfg: *const Config) provider.Provider {
    return .{ .name = "openai", .ctx = @constCast(cfg), .complete = complete };
}

fn complete(ctx: *anyopaque, env: provider.CallEnv, req: provider.ChatRequest) anyerror!provider.Reply {
    const cfg: *const Config = @ptrCast(@alignCast(ctx));
    const a = env.alloc;

    var body = try std.ArrayList(u8).initCapacity(a, 1024);
    defer body.deinit(a);

    try body.appendSlice(a, "{\"model\":");
    try provider.appendJsonStr(&body, a, req.model);
    const budget = try std.fmt.allocPrint(a, ",\"max_completion_tokens\":{d}", .{req.max_tokens});
    try body.appendSlice(a, budget);
    if (req.temperature) |t| {
        const temp = try std.fmt.allocPrint(a, ",\"temperature\":{d}", .{t});
        try body.appendSlice(a, temp);
    }

    try body.appendSlice(a, ",\"messages\":[");
    for (req.messages, 0..) |m, i| {
        if (i > 0) try body.appendSlice(a, ",");
        if (try appendMessage(&body, a, m, i)) |err_text|
            return .{ .ok = false, .body = err_text };
    }
    try body.appendSlice(a, "]");

    if (req.tools.len > 0) {
        try body.appendSlice(a, ",\"tools\":[");
        for (req.tools, 0..) |t, i| {
            if (i > 0) try body.appendSlice(a, ",");
            try body.appendSlice(a, "{\"type\":\"function\",\"function\":");
            try provider.appendValue(&body, a, t);
            try body.appendSlice(a, "}");
        }
        try body.appendSlice(a, "]");
    }
    try body.appendSlice(a, "}");

    const url = try std.fmt.allocPrint(a, "{s}/chat/completions", .{cfg.base_url});
    const auth = try std.fmt.allocPrint(a, "Bearer {s}", .{cfg.api_key});
    const headers = [_]std.http.Header{
        .{ .name = "content-type", .value = "application/json" },
        .{ .name = "authorization", .value = auth },
    };

    const res = try http.postJson(env.client, a, url, &headers, body.items);
    if (res.status < 200 or res.status >= 300)
        return provider.errReply(a, "openai HTTP {d}: {s}", .{ res.status, res.body });

    return parseResponse(a, req.model, res.body);
}

/// Emit one uniform message in the OpenAI dialect. Returns an error line on a
/// malformed message (null = emitted fine).
fn appendMessage(body: *std.ArrayList(u8), a: std.mem.Allocator, m: std.json.Value, idx: usize) !?[]const u8 {
    const role = provider.strField(m, "role") orelse
        return try std.fmt.allocPrint(a, "openai: message {d}: missing role", .{idx});
    const content = provider.strField(m, "content") orelse "";

    if (std.mem.eql(u8, role, "tool")) {
        const call_id = provider.strField(m, "toolCallId") orelse
            return try std.fmt.allocPrint(a, "openai: message {d}: tool message without toolCallId", .{idx});
        try body.appendSlice(a, "{\"role\":\"tool\",\"tool_call_id\":");
        try provider.appendJsonStr(body, a, call_id);
        try body.appendSlice(a, ",\"content\":");
        try provider.appendJsonStr(body, a, content);
        try body.appendSlice(a, "}");
        return null;
    }

    try body.appendSlice(a, "{\"role\":");
    try provider.appendJsonStr(body, a, role);
    try body.appendSlice(a, ",\"content\":");
    try provider.appendJsonStr(body, a, content);

    if (std.mem.eql(u8, role, "assistant")) {
        if (provider.arrField(m, "toolCalls")) |calls| {
            if (calls.len > 0) {
                try body.appendSlice(a, ",\"tool_calls\":[");
                for (calls, 0..) |tc, i| {
                    if (i > 0) try body.appendSlice(a, ",");
                    const id = provider.strField(tc, "id") orelse "";
                    const name = provider.strField(tc, "name") orelse "";
                    // OpenAI carries the args as a JSON *string*.
                    const args_text = if (provider.field(tc, "args")) |args|
                        try std.json.Stringify.valueAlloc(a, args, .{})
                    else
                        "{}";
                    try body.appendSlice(a, "{\"id\":");
                    try provider.appendJsonStr(body, a, id);
                    try body.appendSlice(a, ",\"type\":\"function\",\"function\":{\"name\":");
                    try provider.appendJsonStr(body, a, name);
                    try body.appendSlice(a, ",\"arguments\":");
                    try provider.appendJsonStr(body, a, args_text);
                    try body.appendSlice(a, "}}");
                }
                try body.appendSlice(a, "]");
            }
        }
    }
    try body.appendSlice(a, "}");
    return null;
}

fn parseResponse(a: std.mem.Allocator, model: []const u8, raw: []const u8) !provider.Reply {
    const root = std.json.parseFromSliceLeaky(std.json.Value, a, raw, .{}) catch
        return provider.errReply(a, "openai: malformed response: {s}", .{raw});

    const choices = provider.arrField(root, "choices") orelse
        return provider.errReply(a, "openai: response without choices: {s}", .{raw});
    if (choices.len == 0)
        return provider.errReply(a, "openai: empty choices: {s}", .{raw});

    const message = provider.field(choices[0], "message") orelse
        return provider.errReply(a, "openai: choice without message", .{});

    const text = provider.strField(message, "content") orelse "";

    var tool_calls = try std.ArrayList(provider.ToolCall).initCapacity(a, 0);
    defer tool_calls.deinit(a);
    if (provider.arrField(message, "tool_calls")) |calls| {
        for (calls) |tc| {
            const function = provider.field(tc, "function") orelse continue;
            // `arguments` arrives as JSON text — splice it through verbatim.
            const args_text = provider.strField(function, "arguments") orelse "{}";
            try tool_calls.append(a, .{
                .id = provider.strField(tc, "id") orelse "",
                .name = provider.strField(function, "name") orelse "",
                .args_json = args_text,
            });
        }
    }

    const usage = provider.field(root, "usage");
    const body = try provider.encodeCompletion(a, "openai", model, .{
        .text = text,
        .tool_calls = tool_calls.items,
        .finish_reason = provider.strField(choices[0], "finish_reason") orelse "stop",
        .usage_input = if (usage) |u| provider.intField(u, "prompt_tokens") orelse 0 else 0,
        .usage_output = if (usage) |u| provider.intField(u, "completion_tokens") orelse 0 else 0,
    });
    return .{ .ok = true, .body = body };
}
