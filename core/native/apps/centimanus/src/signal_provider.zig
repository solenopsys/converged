const std = @import("std");
const transport = @import("transport");
const Engine = @import("engine.zig").Engine;
const centimanus_nrpc = @import("generated/centimanus_nrpc.zig");

/// Browser/CLI gateway for the `centimanus:dag` transport service: runs
/// workflows in this process. Chat/LLM traffic is served by resonus now —
/// centimanus only orchestrates workflow execution.
pub const Provider = struct {
    engine: *Engine,
    gpa: std.mem.Allocator,
    auth: *transport.auth.receiver.Receiver,

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

        if (!std.mem.eql(u8, request.envelope.to.target, "centimanus:dag")) return error.ServiceUnsupported;
        if (!std.mem.eql(u8, request.envelope.to.service, "dag")) return error.ServiceUnsupported;
        if (!std.mem.eql(u8, request.envelope.method, "runWorkflow")) return error.CommandUnsupported;
        const policy = centimanus_nrpc.policy(request.envelope.method) orelse return error.CommandUnsupported;
        const now = std.Io.Timestamp.now(std.Options.debug_io, .real).toSeconds();
        var verified = try self.auth.authorize(request.envelope.auth, request.envelope.user, request.envelope.scope, policy, now);
        defer if (verified) |*token| token.deinit(self.auth.allocator);
        return self.handleRunWorkflow(allocator, request);
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
            script_path,
            params_json,
        );
        return .{ .payload = try workflowResponseJson(allocator, result) };
    }
};

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
