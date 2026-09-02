//! Production wiring of the step-driven DAG (vm.zig): the transport is
//! Fujin/ZMQ NRPC for `call`, Valkey for state, and the dag microservice for
//! per-node logging. The VM is transport-agnostic; this file only supplies the
//! real backends and brackets a run with execution-level bookkeeping.

const std = @import("std");
const fujin_transport = @import("transport");
const vm = @import("vm.zig");
const StateStore = @import("state.zig").StateStore;
const workflow_registry = @import("workflow_registry.zig");

pub const Engine = struct {
    gpa: std.mem.Allocator,
    io: std.Io,
    store: *StateStore,
    /// The only internal MS transport: Fujin/ZMQ NRPC envelopes. Outbound
    /// calls funnel through the shared Runtime, which owns the one DEALER
    /// socket; `call()` here always runs on a worker or the scheduler thread,
    /// never on the reactor thread.
    runtime: *fujin_transport.Runtime,
    service_token: []const u8,
    current_scope: []const u8 = "",
    current_user: []const u8 = "",
    run_mutex: std.Io.Mutex = .init,

    pub fn init(gpa: std.mem.Allocator, io: std.Io, store: *StateStore, runtime: *fujin_transport.Runtime, service_token: []const u8) !Engine {
        return .{
            .gpa = gpa,
            .io = io,
            .store = store,
            .runtime = runtime,
            .service_token = service_token,
        };
    }

    pub const RunResult = struct {
        exec_id: []const u8,
        ok: bool,
        output: []const u8,
    };

    fn transport(self: *Engine) vm.Transport {
        return .{ .ctx = self, .call = tCall, .get = tGet, .set = tSet, .log = tLog, .on_node = tOnNode, .llm = tLlm, .run_workflow = tRunWorkflow, .del = tDel };
    }

    /// Resolve `script_path` through ms-dag, fetch it from Ptah's proxy, and
    /// run it as a step-driven DAG. `alloc` (a per-request arena) owns the result.
    pub fn runWorkflow(
        self: *Engine,
        alloc: std.mem.Allocator,
        script_path: []const u8,
        params_json: []const u8,
    ) !RunResult {
        return self.runWorkflowScoped(alloc, "", "", script_path, params_json);
    }

    pub fn runWorkflowScoped(
        self: *Engine,
        alloc: std.mem.Allocator,
        scope: []const u8,
        user: []const u8,
        script_path: []const u8,
        params_json: []const u8,
    ) !RunResult {
        self.run_mutex.lockUncancelable(self.io);
        defer self.run_mutex.unlock(self.io);
        self.current_scope = scope;
        defer self.current_scope = "";
        self.current_user = user;
        defer self.current_user = "";

        return self.execute(alloc, script_path, params_json);
    }

    /// One workflow run under the scope already established by the caller. The
    /// mutex and scope belong to `runWorkflowScoped`; a delegated child reuses
    /// both, so it must go through here and never through the entry point.
    fn execute(
        self: *Engine,
        alloc: std.mem.Allocator,
        script_path: []const u8,
        params_json: []const u8,
    ) !RunResult {
        const t = self.transport();
        const source = try self.fetchSource(alloc, t, script_path);
        const exec_id = try newExecId(alloc, self.io);

        self.dagOpen(alloc, exec_id, script_path, params_json);
        const result = try vm.run(alloc, self.gpa, t, exec_id, source, params_json);
        self.dagSetStatus(alloc, exec_id, if (result.ok) "done" else "failed");

        return .{ .exec_id = exec_id, .ok = result.ok, .output = result.output };
    }

    /// `rt.sub` — run a delegated workflow inline. The child runs on its own
    /// runtime while the parent is blocked in the host call that asked for it,
    /// and the VM caps the nesting depth before it ever calls us.
    /// Deliberately not an NRPC hop back into `centimanus`: the transport has a
    /// single handler thread, so a self-call would park the worker on its own
    /// reply and deadlock, and `run_mutex` is already held by this run.
    fn tRunWorkflow(
        ctx: *anyopaque,
        a: std.mem.Allocator,
        script_path: []const u8,
        params_json: []const u8,
    ) anyerror!vm.Reply {
        const self: *Engine = @ptrCast(@alignCast(ctx));
        const result = self.execute(a, script_path, params_json) catch |err| {
            return .{
                .ok = false,
                .status = 500,
                .body = try std.fmt.allocPrint(a, "rt.sub {s}: {s}", .{ script_path, @errorName(err) }),
            };
        };
        return .{ .ok = result.ok, .status = if (result.ok) 200 else 500, .body = result.output };
    }

    fn fetchSource(self: *Engine, alloc: std.mem.Allocator, t: vm.Transport, script_path: []const u8) ![]const u8 {
        _ = self;
        const reply = try t.call(t.ctx, alloc, "dag", "listAvailableWorkflows", "{}");
        if (!reply.ok) return error.WorkflowNotFound;
        const parsed = std.json.parseFromSliceLeaky(std.json.Value, alloc, reply.body, .{}) catch return error.WorkflowSourceInvalid;
        const items = switch (parsed) {
            .object => |object| switch (object.get("items") orelse return error.WorkflowSourceInvalid) {
                .array => |value| value,
                else => return error.WorkflowSourceInvalid,
            },
            else => return error.WorkflowSourceInvalid,
        };
        for (items.items) |item| {
            const object = switch (item) {
                .object => |value| value,
                else => continue,
            };
            const script = switch (object.get("script") orelse continue) {
                .string => |value| value,
                else => continue,
            };
            if (!std.mem.eql(u8, script, script_path)) continue;
            const source_url = switch (object.get("sourceUrl") orelse return error.WorkflowNotFound) {
                .string => |value| value,
                else => return error.WorkflowSourceInvalid,
            };
            return workflow_registry.get(alloc, source_url);
        }
        return error.WorkflowNotFound;
    }

    // ---- transport vtable: production backends -----------------------------

    fn tCall(ctx: *anyopaque, a: std.mem.Allocator, service: []const u8, method: []const u8, body: []const u8) anyerror!vm.Reply {
        const self: *Engine = @ptrCast(@alignCast(ctx));
        const res = try self.callService(a, service, method, body, self.current_scope);
        return .{ .ok = res.ok(), .status = if (res.ok()) 200 else 502, .body = res.body };
    }

    fn tGet(ctx: *anyopaque, a: std.mem.Allocator, key: []const u8) anyerror!?[]const u8 {
        const self: *Engine = @ptrCast(@alignCast(ctx));
        const scoped_key = try stateKey(a, self.current_scope, key);
        return self.store.get(self.io, a, scoped_key);
    }

    fn tSet(ctx: *anyopaque, a: std.mem.Allocator, key: []const u8, value: []const u8) anyerror!void {
        const self: *Engine = @ptrCast(@alignCast(ctx));
        const scoped_key = try stateKey(a, self.current_scope, key);
        return self.store.set(self.io, a, scoped_key, value);
    }

    fn tDel(ctx: *anyopaque, a: std.mem.Allocator, key: []const u8) anyerror!void {
        const self: *Engine = @ptrCast(@alignCast(ctx));
        const scoped_key = try stateKey(a, self.current_scope, key);
        return self.store.del(self.io, a, scoped_key);
    }

    fn tLog(ctx: *anyopaque, msg: []const u8) void {
        _ = ctx;
        std.debug.print("[wf] {s}\n", .{msg});
    }

    /// `rt.llm()` is served by resonus now: centimanus only orchestrates
    /// workflows, resonus owns every LLM adapter/session behind one RPC method.
    fn tLlm(ctx: *anyopaque, a: std.mem.Allocator, request_json: []const u8) anyerror!vm.LlmReply {
        const self: *Engine = @ptrCast(@alignCast(ctx));
        const reply = try self.callService(a, "resonus", "llm.complete", request_json, self.current_scope);
        return .{ .ok = reply.ok(), .body = reply.body };
    }

    fn tOnNode(ctx: *anyopaque, a: std.mem.Allocator, exec_id: []const u8, node: []const u8, ok: bool, err_text: []const u8) void {
        const self: *Engine = @ptrCast(@alignCast(ctx));
        self.dagLogNode(a, exec_id, node, ok, err_text);
    }

    // ---- dag microservice logging (best-effort: observability, never fatal) -

    fn dagOpen(self: *Engine, a: std.mem.Allocator, exec_id: []const u8, workflow: []const u8, params_json: []const u8) void {
        const body = std.fmt.allocPrint(a, "{{\"id\":{s},\"workflowName\":{s},\"params\":{s}}}", .{
            vm.jsonStr(a, exec_id) catch return, vm.jsonStr(a, workflow) catch return, params_json,
        }) catch return;
        _ = self.callService(a, "dag", "openExecution", body, self.current_scope) catch return;
    }

    fn dagSetStatus(self: *Engine, a: std.mem.Allocator, exec_id: []const u8, status: []const u8) void {
        const body = std.fmt.allocPrint(a, "{{\"id\":{s},\"status\":\"{s}\"}}", .{ vm.jsonStr(a, exec_id) catch return, status }) catch return;
        _ = self.callService(a, "dag", "setExecutionStatus", body, self.current_scope) catch return;
    }

    /// Record one executed node as a numbered task: createTask -> setTaskDone /
    /// setTaskFailed. Nodes run in a loop simply get successive task ids.
    fn dagLogNode(self: *Engine, a: std.mem.Allocator, exec_id: []const u8, node: []const u8, ok: bool, err_text: []const u8) void {
        const ct_body = std.fmt.allocPrint(a, "{{\"executionId\":{s},\"nodeId\":{s}}}", .{
            vm.jsonStr(a, exec_id) catch return, vm.jsonStr(a, node) catch return,
        }) catch return;
        const res = self.callService(a, "dag", "createTask", ct_body, self.current_scope) catch return;
        if (!res.ok()) return;

        const parsed = std.json.parseFromSliceLeaky(std.json.Value, a, res.body, .{}) catch return;
        const task_id = switch (parsed) {
            .object => |o| switch (o.get("id") orelse return) {
                .integer => |n| n,
                else => return,
            },
            else => return,
        };
        const now = std.Io.Timestamp.now(self.io, .real).toMilliseconds();

        if (ok) {
            const body = std.fmt.allocPrint(a, "{{\"taskId\":{d},\"executionId\":{s},\"nodeId\":{s},\"completedAt\":{d},\"result\":null}}", .{
                task_id, vm.jsonStr(a, exec_id) catch return, vm.jsonStr(a, node) catch return, now,
            }) catch return;
            _ = self.callService(a, "dag", "setTaskDone", body, self.current_scope) catch return;
        } else {
            const body = std.fmt.allocPrint(a, "{{\"taskId\":{d},\"completedAt\":{d},\"errorMessage\":{s}}}", .{
                task_id, now, vm.jsonStr(a, err_text) catch return,
            }) catch return;
            _ = self.callService(a, "dag", "setTaskFailed", body, self.current_scope) catch return;
        }
    }

    pub fn callService(self: *Engine, allocator: std.mem.Allocator, service: []const u8, method: []const u8, body: []const u8, scope: []const u8) !fujin_transport.RuntimeReply {
        return self.runtime.call(allocator, .{
            .service = service,
            .method = method,
            .scope = scope,
            .user = self.current_user,
            // The caller's JWT authorizes runWorkflow at the edge. Every downstream
            // service call is made by this trusted runtime principal instead.
            .auth = self.service_token,
            .body = body,
        });
    }
};

fn stateKey(allocator: std.mem.Allocator, scope: []const u8, key: []const u8) ![]const u8 {
    if (scope.len == 0) return allocator.dupe(u8, key);
    return std.fmt.allocPrint(allocator, "scope:{s}:{s}", .{ scope, key });
}

var g_exec_seq: std.atomic.Value(u64) = .init(0);

fn newExecId(a: std.mem.Allocator, io: std.Io) ![]u8 {
    const ts: u64 = @intCast(std.Io.Timestamp.now(io, .real).toMilliseconds());
    const seq = g_exec_seq.fetchAdd(1, .monotonic);
    return std.fmt.allocPrint(a, "exec-{x}-{x}", .{ ts, seq });
}
