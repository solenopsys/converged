const std = @import("std");
const fujin_client = @import("fujin-client");
const Engine = @import("engine.zig").Engine;

pub const Provider = struct {
    engine: *Engine,

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
        if (!std.mem.eql(u8, name, "chat.message")) return error.CommandUnsupported;
        const request_id = stringField(message, "requestId") orelse return error.RequestIdMissing;
        const payload = message.get("payload") orelse return error.PayloadMissing;
        if (payload != .object) return error.PayloadInvalid;

        const params = try buildParams(allocator, payload.object);
        const result = try self.engine.runWorkflowScoped(
            allocator,
            command.scope,
            "wf-browser-chat-turn.js",
            params,
        );
        if (!result.ok) return error.WorkflowFailed;
        return event(allocator, request_id, result.output);
    }
};

fn buildParams(allocator: std.mem.Allocator, payload: std.json.ObjectMap) ![]u8 {
    const session_id = stringField(payload, "sessionId") orelse return error.SessionIdMissing;
    const provider = stringField(payload, "provider") orelse "openai";
    const model = stringField(payload, "model") orelse "gpt-5.4-nano";
    const context_name = stringField(payload, "contextName") orelse "";
    const language = stringField(payload, "language") orelse "";
    const options = payload.get("options");
    const empty_array = std.json.Value{ .array = std.json.Array.init(allocator) };
    const messages = payload.get("messages") orelse empty_array;
    const tools = if (options) |value|
        if (value == .object) value.object.get("tools") orelse empty_array else empty_array
    else
        empty_array;
    const max_tokens: i64 = if (options) |value|
        if (value == .object) integerField(value.object, "maxTokens") orelse 4096 else 4096
    else
        4096;

    const session_json = try quote(allocator, session_id);
    const provider_json = try quote(allocator, provider);
    const model_json = try quote(allocator, model);
    const context_json = try quote(allocator, context_name);
    const language_json = try quote(allocator, language);
    const messages_json = try std.json.Stringify.valueAlloc(allocator, messages, .{});
    const tools_json = try std.json.Stringify.valueAlloc(allocator, tools, .{});
    return std.fmt.allocPrint(
        allocator,
        "{{\"sessionId\":{s},\"provider\":{s},\"model\":{s},\"contextName\":{s},\"language\":{s},\"maxTokens\":{d},\"messages\":{s},\"tools\":{s}}}",
        .{ session_json, provider_json, model_json, context_json, language_json, max_tokens, messages_json, tools_json },
    );
}

fn event(allocator: std.mem.Allocator, request_id: []const u8, payload_json: []const u8) ![]u8 {
    const request = try quote(allocator, request_id);
    return std.fmt.allocPrint(
        allocator,
        "{{\"type\":\"event\",\"requestId\":{s},\"name\":\"chat.result\",\"payload\":{s}}}",
        .{ request, payload_json },
    );
}

fn quote(allocator: std.mem.Allocator, value: []const u8) ![]u8 {
    return std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = value }, .{});
}

fn stringField(object: std.json.ObjectMap, key: []const u8) ?[]const u8 {
    const value = object.get(key) orelse return null;
    return if (value == .string) value.string else null;
}

fn integerField(object: std.json.ObjectMap, key: []const u8) ?i64 {
    const value = object.get(key) orelse return null;
    return if (value == .integer) value.integer else null;
}
