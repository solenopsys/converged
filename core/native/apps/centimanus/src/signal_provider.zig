const std = @import("std");
const transport = @import("transport");
const Engine = @import("engine.zig").Engine;
const triggers = @import("triggers.zig");
const centimanus_nrpc = @import("generated/centimanus_nrpc.zig");

/// Browser/CLI gateway for the `centimanus` transport service: runs
/// workflows in this process. Chat/LLM traffic is served by resonus now —
/// centimanus only orchestrates workflow execution.
pub const Provider = struct {
    engine: *Engine,
    gpa: std.mem.Allocator,
    auth: *transport.auth.receiver.Receiver,
    /// Configured triggers, when the bus listener is on. Absent means events
    /// are accepted and answered with nothing started, which is what a runtime
    /// with no triggers configured should do anyway.
    triggers: ?*triggers.Registry = null,

    pub fn init(gpa: std.mem.Allocator, engine: *Engine, auth: *transport.auth.receiver.Receiver) Provider {
        return .{ .engine = engine, .gpa = gpa, .auth = auth };
    }

    pub fn deinit(self: *Provider) void {
        self.* = undefined;
    }

    pub fn transportHandler(self: *Provider) transport.RuntimeHandler {
        return .{ .context = self, .handle_fn = handleOpaque };
    }

    fn handleOpaque(context: *anyopaque, allocator: std.mem.Allocator, request: transport.RuntimeRequest) !transport.RuntimeResponse {
        const self: *Provider = @ptrCast(@alignCast(context));
        return self.handle(allocator, request);
    }

    fn handle(self: *Provider, allocator: std.mem.Allocator, request: transport.RuntimeRequest) !transport.RuntimeResponse {
        if (request.envelope.scope.len == 0) return error.ScopeRequired;
        if (request.envelope.request_id.len == 0) return error.RequestIdMissing;

        const policy = methodPolicy(request.envelope.method) orelse return error.CommandUnsupported;
        const now = std.Io.Timestamp.now(std.Options.debug_io, .real).toSeconds();
        var verified = try self.auth.authorize(request.envelope.auth, request.envelope.user, request.envelope.scope, policy, now);
        defer if (verified) |*token| token.deinit(self.auth.allocator);
        if (std.mem.eql(u8, request.envelope.method, "onEvent")) {
            return self.handleEvent(allocator, request);
        }
        return self.handleRunWorkflow(allocator, request);
    }

    /// One business event from the bus.
    ///
    /// Fujin delivers this as an ordinary request, so a failure here becomes an
    /// error frame it logs — but nothing retries, and nothing should: the bus
    /// is not a queue. A runtime that was down catches up from the journal on
    /// its own terms, not by making the router wait.
    fn handleEvent(self: *Provider, allocator: std.mem.Allocator, request: transport.RuntimeRequest) !transport.RuntimeResponse {
        const parsed = try std.json.parseFromSlice(std.json.Value, allocator, request.payload, .{});
        if (parsed.value != .object) return error.PayloadInvalid;
        const event = eventArgument(parsed.value) orelse return error.PayloadInvalid;
        const topic = stringField(event, "name") orelse return error.EventNameMissing;

        const registry = self.triggers orelse return .{ .payload = try allocator.dupe(u8, "{\"started\":[]}") };
        const matched = try registry.matching(allocator, topic);
        if (matched.len == 0) return .{ .payload = try allocator.dupe(u8, "{\"started\":[]}") };

        const actor = stringField(event, "actor") orelse request.envelope.user;
        var started: std.ArrayList([]const u8) = .empty;
        for (matched) |trigger| {
            // The workflow sees the event it was started by, its own configured
            // parameters, and which trigger fired — enough to be written once
            // and reused across several topics.
            const params = try std.fmt.allocPrint(
                allocator,
                "{{\"event\":{s},\"params\":{s},\"trigger\":{{\"id\":{s},\"name\":{s},\"topic\":{s}}}}}",
                .{
                    request.payload,
                    trigger.params_json,
                    try quote(allocator, trigger.id),
                    try quote(allocator, trigger.name),
                    try quote(allocator, trigger.topic),
                },
            );
            const result = self.engine.runWorkflowScoped(
                allocator,
                request.envelope.scope,
                actor,
                trigger.script,
                params,
            ) catch |err| {
                // One broken trigger must not stop the others: they are
                // independent automations that happen to share a topic.
                std.debug.print("centimanus: trigger {s} on {s} failed: {s}\n", .{ trigger.name, topic, @errorName(err) });
                continue;
            };
            std.debug.print("centimanus: trigger {s} ran {s} -> {s}\n", .{ trigger.name, trigger.script, if (result.ok) "ok" else "failed" });
            try started.append(allocator, try quote(allocator, result.exec_id));
        }

        const joined = try std.mem.join(allocator, ",", started.items);
        return .{ .payload = try std.fmt.allocPrint(allocator, "{{\"started\":[{s}]}}", .{joined}) };
    }

    fn handleRunWorkflow(self: *Provider, allocator: std.mem.Allocator, request: transport.RuntimeRequest) !transport.RuntimeResponse {
        var parsed = try std.json.parseFromSlice(std.json.Value, allocator, request.payload, .{});
        defer parsed.deinit();
        if (parsed.value != .object) return error.PayloadInvalid;

        const script_path = stringField(parsed.value.object, "scriptPath") orelse return error.ScriptPathMissing;
        const params_value = parsed.value.object.get("params") orelse return error.WorkflowParamsMissing;
        const params_json = try std.json.Stringify.valueAlloc(allocator, params_value, .{});
        const result = try self.engine.runWorkflowScoped(
            allocator,
            request.envelope.scope,
            request.envelope.user,
            script_path,
            params_json,
        );
        return .{ .payload = try workflowResponseJson(allocator, result) };
    }
};

/// The generator emits one uniform `.user` policy per method, and `onEvent` is
/// called by Fujin with the cluster service token — a level that table cannot
/// express. Same reason `pushrouter`'s policies are written by hand.
fn methodPolicy(method: []const u8) ?transport.auth.authorize.MethodPolicy {
    if (std.mem.eql(u8, method, "onEvent")) {
        return .{ .service = centimanus_nrpc.service, .method = "onEvent", .level = .internal, .mode = .write };
    }
    return centimanus_nrpc.policy(method);
}

/// NRPC wraps arguments in an object keyed by parameter name; Fujin posts the
/// event frame itself. Accept both.
fn eventArgument(value: std.json.Value) ?std.json.ObjectMap {
    if (value != .object) return null;
    const event = value.object.get("event") orelse return value.object;
    return if (event == .object) event.object else null;
}

fn workflowResponseJson(allocator: std.mem.Allocator, result: Engine.RunResult) ![]u8 {
    const execution_id = try quote(allocator, result.exec_id);
    if (result.ok) {
        // vm.run guarantees JSON for a successful workflow result.
        return std.fmt.allocPrint(
            allocator,
            "{{\"executionId\":{s},\"ok\":true,\"result\":{s}}}",
            .{ execution_id, result.output },
        );
    }
    const error_text = try quote(allocator, result.output);
    return std.fmt.allocPrint(
        allocator,
        "{{\"executionId\":{s},\"ok\":false,\"error\":{s}}}",
        .{ execution_id, error_text },
    );
}

fn quote(allocator: std.mem.Allocator, value: []const u8) ![]u8 {
    return std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = value }, .{});
}

fn stringField(object: std.json.ObjectMap, key: []const u8) ?[]const u8 {
    const value = object.get(key) orelse return null;
    return if (value == .string) value.string else null;
}
