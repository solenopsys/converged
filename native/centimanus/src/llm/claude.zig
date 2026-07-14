//! Anthropic messages provider (non-streaming). Wire dialect mirrors the TS
//! ClaudeProvider (rt-assistant/impls/providers/claude.ts): system prompt is a
//! top-level field, tool calls/results travel as content blocks.

const std = @import("std");
const provider = @import("provider.zig");
const http = @import("http.zig");

pub const default_base_url = "https://api.anthropic.com/v1";
const anthropic_version = "2023-06-01";

pub const Config = struct {
    api_key: []const u8,
    base_url: []const u8,
};

pub fn make(cfg: *const Config) provider.Provider {
    return .{ .name = "claude", .ctx = @constCast(cfg), .complete = complete };
}

fn complete(ctx: *anyopaque, env: provider.CallEnv, req: provider.ChatRequest) anyerror!provider.Reply {
    const cfg: *const Config = @ptrCast(@alignCast(ctx));
    const a = env.alloc;

    var body = try std.ArrayList(u8).initCapacity(a, 1024);
    defer body.deinit(a);

    try body.appendSlice(a, "{\"model\":");
    try provider.appendJsonStr(&body, a, req.model);
    const budget = try std.fmt.allocPrint(a, ",\"max_tokens\":{d}", .{req.max_tokens});
    try body.appendSlice(a, budget);
    if (req.temperature) |t| {
        const temp = try std.fmt.allocPrint(a, ",\"temperature\":{d}", .{t});
        try body.appendSlice(a, temp);
    }
    if (try provider.joinSystem(a, req.messages)) |system| {
        try body.appendSlice(a, ",\"system\":");
        try provider.appendJsonStr(&body, a, system);
    }

    try body.appendSlice(a, ",\"messages\":[");
    var emitted: usize = 0;
    for (req.messages, 0..) |m, idx| {
        const role = provider.strField(m, "role") orelse
            return provider.errReply(a, "claude: message {d}: missing role", .{idx});
        if (std.mem.eql(u8, role, "system")) continue;
        if (emitted > 0) try body.appendSlice(a, ",");
        emitted += 1;
        try appendMessage(&body, a, m, role);
    }
    try body.appendSlice(a, "]");

    if (req.tools.len > 0) {
        try body.appendSlice(a, ",\"tools\":[");
        for (req.tools, 0..) |t, i| {
            if (i > 0) try body.appendSlice(a, ",");
            const name = provider.strField(t, "name") orelse "";
            const description = provider.strField(t, "description") orelse "";
            try body.appendSlice(a, "{\"name\":");
            try provider.appendJsonStr(&body, a, name);
            try body.appendSlice(a, ",\"description\":");
            try provider.appendJsonStr(&body, a, description);
            try body.appendSlice(a, ",\"input_schema\":");
            if (provider.field(t, "parameters")) |params| {
                try provider.appendValue(&body, a, params);
            } else {
                try body.appendSlice(a, "{\"type\":\"object\",\"properties\":{}}");
            }
            try body.appendSlice(a, "}");
        }
        try body.appendSlice(a, "]");
    }
    try body.appendSlice(a, "}");

    const url = try std.fmt.allocPrint(a, "{s}/messages", .{cfg.base_url});
    const headers = [_]std.http.Header{
        .{ .name = "content-type", .value = "application/json" },
        .{ .name = "x-api-key", .value = cfg.api_key },
        .{ .name = "anthropic-version", .value = anthropic_version },
    };

    const res = try http.postJson(env.client, a, url, &headers, body.items);
    if (res.status < 200 or res.status >= 300)
        return provider.errReply(a, "claude HTTP {d}: {s}", .{ res.status, res.body });

    return parseResponse(a, req.model, res.body);
}

fn appendMessage(body: *std.ArrayList(u8), a: std.mem.Allocator, m: std.json.Value, role: []const u8) !void {
    const content = provider.strField(m, "content") orelse "";

    // Tool result -> a user turn holding one tool_result block.
    if (std.mem.eql(u8, role, "tool")) {
        const call_id = provider.strField(m, "toolCallId") orelse "";
        try body.appendSlice(a, "{\"role\":\"user\",\"content\":[{\"type\":\"tool_result\",\"tool_use_id\":");
        try provider.appendJsonStr(body, a, call_id);
        try body.appendSlice(a, ",\"content\":");
        try provider.appendJsonStr(body, a, content);
        try body.appendSlice(a, "}]}");
        return;
    }

    // Assistant turn with tool calls -> text + tool_use blocks.
    const calls = if (std.mem.eql(u8, role, "assistant")) provider.arrField(m, "toolCalls") else null;
    if (calls != null and calls.?.len > 0) {
        try body.appendSlice(a, "{\"role\":\"assistant\",\"content\":[");
        var first = true;
        if (content.len > 0) {
            try body.appendSlice(a, "{\"type\":\"text\",\"text\":");
            try provider.appendJsonStr(body, a, content);
            try body.appendSlice(a, "}");
            first = false;
        }
        for (calls.?) |tc| {
            if (!first) try body.appendSlice(a, ",");
            first = false;
            try body.appendSlice(a, "{\"type\":\"tool_use\",\"id\":");
            try provider.appendJsonStr(body, a, provider.strField(tc, "id") orelse "");
            try body.appendSlice(a, ",\"name\":");
            try provider.appendJsonStr(body, a, provider.strField(tc, "name") orelse "");
            try body.appendSlice(a, ",\"input\":");
            if (provider.field(tc, "args")) |args| {
                try provider.appendValue(body, a, args);
            } else {
                try body.appendSlice(a, "{}");
            }
            try body.appendSlice(a, "}");
        }
        try body.appendSlice(a, "]}");
        return;
    }

    const wire_role = if (std.mem.eql(u8, role, "assistant")) "assistant" else "user";
    try body.appendSlice(a, "{\"role\":\"");
    try body.appendSlice(a, wire_role);
    try body.appendSlice(a, "\",\"content\":");
    try provider.appendJsonStr(body, a, content);
    try body.appendSlice(a, "}");
}

fn parseResponse(a: std.mem.Allocator, model: []const u8, raw: []const u8) !provider.Reply {
    const root = std.json.parseFromSliceLeaky(std.json.Value, a, raw, .{}) catch
        return provider.errReply(a, "claude: malformed response: {s}", .{raw});

    const blocks = provider.arrField(root, "content") orelse
        return provider.errReply(a, "claude: response without content: {s}", .{raw});

    var text = try std.ArrayList(u8).initCapacity(a, 0);
    defer text.deinit(a);
    var tool_calls = try std.ArrayList(provider.ToolCall).initCapacity(a, 0);
    defer tool_calls.deinit(a);

    for (blocks) |block| {
        const kind = provider.strField(block, "type") orelse continue;
        if (std.mem.eql(u8, kind, "text")) {
            try text.appendSlice(a, provider.strField(block, "text") orelse "");
        } else if (std.mem.eql(u8, kind, "tool_use")) {
            const args_json = if (provider.field(block, "input")) |input|
                try std.json.Stringify.valueAlloc(a, input, .{})
            else
                "{}";
            try tool_calls.append(a, .{
                .id = provider.strField(block, "id") orelse "",
                .name = provider.strField(block, "name") orelse "",
                .args_json = args_json,
            });
        }
    }

    const usage = provider.field(root, "usage");
    const body = try provider.encodeCompletion(a, "claude", model, .{
        .text = text.items,
        .tool_calls = tool_calls.items,
        .finish_reason = provider.strField(root, "stop_reason") orelse "end_turn",
        .usage_input = if (usage) |u| provider.intField(u, "input_tokens") orelse 0 else 0,
        .usage_output = if (usage) |u| provider.intField(u, "output_tokens") orelse 0 else 0,
    });
    return .{ .ok = true, .body = body };
}
