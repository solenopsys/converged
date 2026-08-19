//! Pure OpenAI Realtime wire-format code.
//!
//! Keeping this separate from sockets makes the vendor protocol testable without
//! a key, a network connection, or libdatachannel.

const std = @import("std");
const provider = @import("../provider.zig");

pub const Event = union(enum) {
    text_delta: []u8,
    tool_arguments_delta: ToolArgumentsDelta,
    tool_call_done: provider.ToolCall,
    completed: Completed,
    api_error,
    ignored,

    pub fn deinit(self: *Event, allocator: std.mem.Allocator) void {
        switch (self.*) {
            .text_delta => |text| allocator.free(text),
            .tool_arguments_delta => |delta| {
                allocator.free(delta.call_id);
                allocator.free(delta.name);
                allocator.free(delta.delta);
            },
            .tool_call_done => |call| freeToolCall(allocator, call),
            .completed => |completed| {
                allocator.free(completed.text);
                for (completed.tool_calls) |call| {
                    allocator.free(call.id);
                    allocator.free(call.name);
                    allocator.free(call.args_json);
                }
                allocator.free(completed.tool_calls);
            },
            .api_error, .ignored => {},
        }
        self.* = .ignored;
    }
};

pub const ToolArgumentsDelta = struct {
    call_id: []u8,
    name: []u8,
    delta: []u8,
};

pub const Completed = struct {
    text: []u8,
    usage_input: i64,
    usage_output: i64,
    tool_calls: []const provider.ToolCall,
};

pub fn responseCreate(allocator: std.mem.Allocator, req: provider.ChatRequest) ![]u8 {
    const instructions = try conversationText(allocator, req.messages);
    defer allocator.free(instructions);
    const instructions_json = try provider.jsonStr(allocator, instructions);
    defer allocator.free(instructions_json);
    const tools_json = try normalizedToolsJson(allocator, req.tools);
    defer allocator.free(tools_json);
    return std.fmt.allocPrint(
        allocator,
        "{{\"type\":\"response.create\",\"response\":{{\"conversation\":\"none\",\"output_modalities\":[\"text\"],\"max_output_tokens\":{d},\"instructions\":{s},\"tools\":{s}{s}}}}}",
        .{ req.max_tokens, instructions_json, tools_json, if (req.require_tool and req.tools.len > 0) ",\"tool_choice\":\"required\"" else "" },
    );
}

/// The UI describes callable actions in the internal tool schema. OpenAI
/// Realtime accepts the same name/description/parameters shape, but requires
/// every item to explicitly declare the function tool type.
fn normalizedToolsJson(allocator: std.mem.Allocator, tools: []const std.json.Value) ![]u8 {
    var output: std.ArrayList(u8) = .empty;
    errdefer output.deinit(allocator);

    try output.append(allocator, '[');
    var first = true;
    for (tools) |tool| {
        const name = provider.strField(tool, "name") orelse continue;
        if (name.len == 0) continue;

        const name_json = try provider.jsonStr(allocator, name);
        defer allocator.free(name_json);
        const description_json = try provider.jsonStr(allocator, provider.strField(tool, "description") orelse "");
        defer allocator.free(description_json);
        const parameters_json = if (provider.field(tool, "parameters")) |parameters|
            try std.json.Stringify.valueAlloc(allocator, parameters, .{})
        else
            try allocator.dupe(u8, "{\"type\":\"object\",\"properties\":{}}");
        defer allocator.free(parameters_json);

        if (!first) try output.append(allocator, ',');
        first = false;
        const item = try std.fmt.allocPrint(
            allocator,
            "{{\"type\":\"function\",\"name\":{s},\"description\":{s},\"parameters\":{s}}}",
            .{ name_json, description_json, parameters_json },
        );
        defer allocator.free(item);
        try output.appendSlice(allocator, item);
    }
    try output.append(allocator, ']');
    return output.toOwnedSlice(allocator);
}

/// Sessions default to `output_modalities:["audio"]` with server VAD +
/// `create_response:true` (see `session.created`). We only ever talk text,
/// out-of-band, so pin the session itself to that shape once at connect time
/// instead of relying solely on the per-`response.create` override.
///
/// GA `gpt-realtime` schema note: the `audio.input` object is required to carry
/// `format`/`transcription`/`noise_reduction` alongside `turn_detection` — a
/// partial `audio.input` (just `turn_detection:null`) is what the server
/// rejected with a bare connection close, no `error` event. The GA docs say to
/// OMIT `audio` entirely for text-only rather than poke fields inside it; with
/// `output_modalities:["text"]` there is no audio leg to configure, and no
/// audio input means server-VAD idle-close no longer applies.
pub fn sessionUpdateText(allocator: std.mem.Allocator) ![]u8 {
    return allocator.dupe(u8,
        \\{"type":"session.update","session":{"type":"realtime","output_modalities":["text"]}}
    );
}

/// The gateway owns canonical history, so each response is intentionally
/// out-of-band. This keeps all providers on the same message contract while a
/// preconnected Realtime socket removes connection latency.
pub fn conversationText(allocator: std.mem.Allocator, messages: []const std.json.Value) ![]u8 {
    var result: std.ArrayList(u8) = .empty;
    for (messages) |message| {
        const role = provider.strField(message, "role") orelse "user";
        const content = provider.strField(message, "content") orelse "";
        const line = try std.fmt.allocPrint(allocator, "[{s}] {s}\n", .{ role, content });
        defer allocator.free(line);
        try result.appendSlice(allocator, line);
    }
    return result.toOwnedSlice(allocator);
}

pub fn parseEvent(allocator: std.mem.Allocator, payload: []const u8) !Event {
    const parsed = try std.json.parseFromSlice(std.json.Value, allocator, payload, .{});
    defer parsed.deinit();
    const event_type = provider.strField(parsed.value, "type") orelse return .ignored;

    if (std.mem.eql(u8, event_type, "response.output_text.delta"))
        return .{ .text_delta = try allocator.dupe(u8, provider.strField(parsed.value, "delta") orelse "") };
    if (std.mem.eql(u8, event_type, "response.function_call_arguments.delta")) {
        return .{ .tool_arguments_delta = try ownedToolArgumentsDelta(allocator, parsed.value) };
    }
    if (std.mem.eql(u8, event_type, "response.function_call_arguments.done")) {
        return .{ .tool_call_done = try ownedToolCall(allocator, parsed.value) };
    }
    if (std.mem.eql(u8, event_type, "response.output_item.done")) {
        const item = provider.field(parsed.value, "item") orelse return .ignored;
        if (!std.mem.eql(u8, provider.strField(item, "type") orelse "", "function_call")) return .ignored;
        return .{ .tool_call_done = try ownedToolCall(allocator, item) };
    }
    if (std.mem.eql(u8, event_type, "response.done"))
        return .{ .completed = try parseCompleted(allocator, parsed.value) };
    if (std.mem.eql(u8, event_type, "error")) return .api_error;
    return .ignored;
}

fn parseCompleted(allocator: std.mem.Allocator, root: std.json.Value) !Completed {
    const response = provider.field(root, "response") orelse return .{
        .text = try allocator.alloc(u8, 0),
        .usage_input = 0,
        .usage_output = 0,
        .tool_calls = try allocator.alloc(provider.ToolCall, 0),
    };
    const usage = provider.field(response, "usage");
    const output = provider.arrField(response, "output") orelse &.{};
    return .{
        .text = try parseOutputText(allocator, output),
        .usage_input = if (usage) |value| provider.intField(value, "input_tokens") orelse 0 else 0,
        .usage_output = if (usage) |value| provider.intField(value, "output_tokens") orelse 0 else 0,
        .tool_calls = try parseToolCalls(allocator, output),
    };
}

fn parseOutputText(allocator: std.mem.Allocator, output: []const std.json.Value) ![]u8 {
    var text: std.ArrayList(u8) = .empty;
    errdefer text.deinit(allocator);
    for (output) |item| {
        if (!std.mem.eql(u8, provider.strField(item, "type") orelse "", "message")) continue;
        const content = provider.arrField(item, "content") orelse continue;
        for (content) |part| {
            if (!std.mem.eql(u8, provider.strField(part, "type") orelse "", "output_text")) continue;
            try text.appendSlice(allocator, provider.strField(part, "text") orelse "");
        }
    }
    return text.toOwnedSlice(allocator);
}

fn parseToolCalls(allocator: std.mem.Allocator, output: []const std.json.Value) ![]const provider.ToolCall {
    var calls: std.ArrayList(provider.ToolCall) = .empty;
    errdefer {
        for (calls.items) |call| freeToolCall(allocator, call);
        calls.deinit(allocator);
    }
    for (output) |item| {
        if (!std.mem.eql(u8, provider.strField(item, "type") orelse "", "function_call")) continue;
        const call = try ownedToolCall(allocator, item);
        calls.append(allocator, call) catch |err| {
            freeToolCall(allocator, call);
            return err;
        };
    }
    return calls.toOwnedSlice(allocator);
}

fn ownedToolArgumentsDelta(allocator: std.mem.Allocator, value: std.json.Value) !ToolArgumentsDelta {
    const call_id = try allocator.dupe(u8, provider.strField(value, "call_id") orelse "");
    errdefer allocator.free(call_id);
    const name = try allocator.dupe(u8, provider.strField(value, "name") orelse "");
    errdefer allocator.free(name);
    return .{
        .call_id = call_id,
        .name = name,
        .delta = try allocator.dupe(u8, provider.strField(value, "delta") orelse ""),
    };
}

fn ownedToolCall(allocator: std.mem.Allocator, value: std.json.Value) !provider.ToolCall {
    const id = try allocator.dupe(u8, provider.strField(value, "call_id") orelse "");
    errdefer allocator.free(id);
    const name = try allocator.dupe(u8, provider.strField(value, "name") orelse "");
    errdefer allocator.free(name);
    return .{
        .id = id,
        .name = name,
        .args_json = try allocator.dupe(u8, provider.strField(value, "arguments") orelse "{}"),
    };
}

fn freeToolCall(allocator: std.mem.Allocator, call: provider.ToolCall) void {
    allocator.free(call.id);
    allocator.free(call.name);
    allocator.free(call.args_json);
}

test "response.create requires a tool only for a structured step" {
    const allocator = std.testing.allocator;
    const request = try std.json.parseFromSlice(
        std.json.Value,
        allocator,
        "{\"messages\":[{\"role\":\"system\",\"content\":\"Be concise\"},{\"role\":\"user\",\"content\":\"hi\"}],\"tools\":[{\"name\":\"clock\"}]}",
        .{},
    );
    defer request.deinit();
    const body = try responseCreate(allocator, .{
        .model = "gpt-realtime-2.1-mini",
        .max_tokens = 64,
        .temperature = null,
        .messages = provider.arrField(request.value, "messages").?,
        .tools = provider.arrField(request.value, "tools").?,
        .require_tool = true,
    });
    defer allocator.free(body);

    const root = try std.json.parseFromSlice(std.json.Value, allocator, body, .{});
    defer root.deinit();
    const response = provider.field(root.value, "response").?;
    try std.testing.expectEqualStrings("none", provider.strField(response, "conversation").?);
    try std.testing.expectEqual(@as(i64, 64), provider.intField(response, "max_output_tokens").?);
    try std.testing.expectEqualStrings("[system] Be concise\n[user] hi\n", provider.strField(response, "instructions").?);
    try std.testing.expectEqual(@as(usize, 1), provider.arrField(response, "tools").?.len);
    const tool = provider.arrField(response, "tools").?[0];
    try std.testing.expectEqualStrings("function", provider.strField(tool, "type").?);
    try std.testing.expectEqualStrings("clock", provider.strField(tool, "name").?);
    try std.testing.expect(provider.field(tool, "parameters") != null);
    try std.testing.expectEqualStrings("required", provider.strField(response, "tool_choice").?);
}

test "response.create leaves ordinary chat tool choice automatic" {
    const allocator = std.testing.allocator;
    const request = try std.json.parseFromSlice(
        std.json.Value,
        allocator,
        "{\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}],\"tools\":[{\"name\":\"checkUploads\"}]}",
        .{},
    );
    defer request.deinit();
    const body = try responseCreate(allocator, .{
        .model = "gpt-realtime-2.1-mini",
        .max_tokens = 64,
        .temperature = null,
        .messages = provider.arrField(request.value, "messages").?,
        .tools = provider.arrField(request.value, "tools").?,
    });
    defer allocator.free(body);

    const root = try std.json.parseFromSlice(std.json.Value, allocator, body, .{});
    defer root.deinit();
    const response = provider.field(root.value, "response").?;
    try std.testing.expect(provider.field(response, "tool_choice") == null);
}

test "parses realtime deltas and completion" {
    const allocator = std.testing.allocator;
    var text = try parseEvent(allocator, "{\"type\":\"response.output_text.delta\",\"delta\":\"Hello\"}");
    defer text.deinit(allocator);
    try std.testing.expectEqualStrings("Hello", text.text_delta);

    var tool_delta = try parseEvent(allocator, "{\"type\":\"response.function_call_arguments.delta\",\"call_id\":\"call_1\",\"name\":\"clock\",\"delta\":\"{\\\"zone\\\":\\\"UTC\\\"}\"}");
    defer tool_delta.deinit(allocator);
    try std.testing.expectEqualStrings("call_1", tool_delta.tool_arguments_delta.call_id);
    try std.testing.expectEqualStrings("clock", tool_delta.tool_arguments_delta.name);

    var tool_done = try parseEvent(
        allocator,
        "{\"type\":\"response.function_call_arguments.done\",\"call_id\":\"call_1\",\"name\":\"clock\",\"arguments\":\"{\\\"zone\\\":\\\"UTC\\\"}\"}",
    );
    defer tool_done.deinit(allocator);
    try std.testing.expectEqualStrings("clock", tool_done.tool_call_done.name);
    try std.testing.expectEqualStrings("{\"zone\":\"UTC\"}", tool_done.tool_call_done.args_json);

    var output_item = try parseEvent(
        allocator,
        "{\"type\":\"response.output_item.done\",\"item\":{\"type\":\"function_call\",\"call_id\":\"call_2\",\"name\":\"calendar\",\"arguments\":\"{}\"}}",
    );
    defer output_item.deinit(allocator);
    try std.testing.expectEqualStrings("calendar", output_item.tool_call_done.name);

    var done = try parseEvent(
        allocator,
        "{\"type\":\"response.done\",\"response\":{\"usage\":{\"input_tokens\":12,\"output_tokens\":4},\"output\":[{\"type\":\"message\",\"content\":[{\"type\":\"output_text\",\"text\":\"Hello\"}]},{\"type\":\"function_call\",\"call_id\":\"call_1\",\"name\":\"clock\",\"arguments\":\"{\\\"zone\\\":\\\"UTC\\\"}\"}]}}",
    );
    defer done.deinit(allocator);
    try std.testing.expectEqual(@as(i64, 12), done.completed.usage_input);
    try std.testing.expectEqual(@as(i64, 4), done.completed.usage_output);
    try std.testing.expectEqualStrings("Hello", done.completed.text);
    try std.testing.expectEqual(@as(usize, 1), done.completed.tool_calls.len);
    try std.testing.expectEqualStrings("clock", done.completed.tool_calls[0].name);
}
