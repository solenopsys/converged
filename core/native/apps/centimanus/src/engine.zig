//! Production wiring of the step-driven DAG (vm.zig): the transport is
//! Fujin/ZMQ NRPC for `call`, Valkey for state, and the dag microservice for
//! per-node logging. The VM is transport-agnostic; this file only supplies the
//! real backends and brackets a run with execution-level bookkeeping.

const std = @import("std");
const fujin_transport = @import("transport");
const vm = @import("vm.zig");
const StateStore = @import("state.zig").StateStore;
const dag_log = @import("dag_log.zig");
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
    /// Where log entries go. Set after construction, because the logger needs
    /// the engine to make its own calls. Null means nothing is recorded.
    log: ?*dag_log.Logger = null,
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
        return .{ .ctx = self, .call = tCall, .get = tGet, .set = tSet, .log = tLog, .on_node_open = tOnNodeOpen, .on_node = tOnNode, .llm = tLlm, .run_workflow = tRunWorkflow, .del = tDel, .now_ms = tNowMs };
    }

    /// Resolve `script_path` through rp-dag, fetch it from Ptah's proxy, and
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

        return self.execute(alloc, script_path, params_json, "", "");
    }

    /// One workflow run under the scope already established by the caller. The
    /// mutex and scope belong to `runWorkflowScoped`; a delegated child reuses
    /// both, so it must go through here and never through the entry point.
    fn execute(
        self: *Engine,
        alloc: std.mem.Allocator,
        script_path: []const u8,
        params_json: []const u8,
        parent_exec_id: []const u8,
        parent_node: []const u8,
    ) !RunResult {
        const t = self.transport();
        const source = try self.fetchSource(alloc, t, script_path);
        const exec_id = try newExecId(alloc, self.io);
        const started_ms = std.Io.Timestamp.now(self.io, .real).toMilliseconds();

        self.dagRecordExecution(alloc, exec_id, script_path, params_json, parent_exec_id, parent_node, "running", started_ms, 0, "");
        const result = try vm.run(alloc, self.gpa, t, exec_id, source, params_json);
        self.dagRecordExecution(
            alloc,
            exec_id,
            script_path,
            params_json,
            parent_exec_id,
            parent_node,
            if (result.ok) "done" else "failed",
            started_ms,
            std.Io.Timestamp.now(self.io, .real).toMilliseconds(),
            if (result.ok) "" else result.output,
        );

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
        parent_exec_id: []const u8,
        parent_node: []const u8,
    ) anyerror!vm.SubReply {
        const self: *Engine = @ptrCast(@alignCast(ctx));
        const result = self.execute(a, script_path, params_json, parent_exec_id, parent_node) catch |err| {
            // The run never opened, so there is no child id to point at.
            return .{
                .ok = false,
                .body = try std.fmt.allocPrint(a, "rt.sub {s}: {s}", .{ script_path, @errorName(err) }),
                .exec_id = "",
            };
        };
        return .{ .ok = result.ok, .body = result.output, .exec_id = result.exec_id };
    }

    fn fetchSource(self: *Engine, alloc: std.mem.Allocator, t: vm.Transport, script_path: []const u8) ![]const u8 {
        _ = self;
        const reply = try t.call(t.ctx, alloc, "", "dag", "listAvailableWorkflows", "{}");
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

    fn tCall(ctx: *anyopaque, a: std.mem.Allocator, target: []const u8, service: []const u8, method: []const u8, body: []const u8) anyerror!vm.Reply {
        const self: *Engine = @ptrCast(@alignCast(ctx));
        const res = try self.callServiceAt(a, target, service, method, body, self.current_scope);
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

    fn tOnNodeOpen(ctx: *anyopaque, a: std.mem.Allocator, exec_id: []const u8, node: []const u8, kind: []const u8, seq: u32, started_ms: i64) void {
        const self: *Engine = @ptrCast(@alignCast(ctx));
        self.dagRecordNodeOpen(a, exec_id, node, kind, seq, started_ms);
    }

    fn tOnNode(ctx: *anyopaque, a: std.mem.Allocator, report: vm.NodeReport) void {
        const self: *Engine = @ptrCast(@alignCast(ctx));
        self.dagRecordNode(a, report);
    }

    fn tNowMs(ctx: *anyopaque) i64 {
        const self: *Engine = @ptrCast(@alignCast(ctx));
        return std.Io.Timestamp.now(self.io, .real).toMilliseconds();
    }

    // ---- dag microservice logging (best-effort: observability, never fatal) -

    /// Queue the run's own record. Written on open and again on close: the key
    /// is the same both times, so the second write replaces the first and a run
    /// that finishes between two flushes costs one entry rather than two.
    fn dagRecordExecution(
        self: *Engine,
        a: std.mem.Allocator,
        exec_id: []const u8,
        workflow: []const u8,
        params_json: []const u8,
        parent_exec_id: []const u8,
        parent_node: []const u8,
        status: []const u8,
        started_ms: i64,
        ended_ms: i64,
        err: []const u8,
    ) void {
        const log = self.log orelse return;
        const key = dag_log.executionKey(a, exec_id) catch return;
        var body: std.Io.Writer.Allocating = .init(a);
        const w = &body.writer;
        w.print("{s}{{\"id\":{s},\"workflow\":{s},\"status\":\"{s}\",\"params\":{s},\"startedAt\":{d},\"endedAt\":", .{
            kv_json_header,
            vm.jsonStr(a, exec_id) catch return,
            vm.jsonStr(a, workflow) catch return,
            status,
            params_json,
            started_ms,
        }) catch return;
        if (ended_ms == 0) w.writeAll("null") catch return else w.print("{d}", .{ended_ms}) catch return;
        if (err.len > 0)
            w.print(",\"error\":{s}", .{vm.jsonStr(a, err) catch return}) catch return;
        if (parent_exec_id.len > 0)
            w.print(",\"parentExecutionId\":{s},\"parentNode\":{s}", .{
                vm.jsonStr(a, parent_exec_id) catch return,
                vm.jsonStr(a, parent_node) catch return,
            }) catch return;
        w.writeByte('}') catch return;

        log.push(self.current_scope, key, body.written());
    }

    fn dagRecordNodeOpen(self: *Engine, a: std.mem.Allocator, exec_id: []const u8, node: []const u8, kind: []const u8, seq: u32, started_ms: i64) void {
        const log = self.log orelse return;
        const key = dag_log.nodeKey(a, exec_id, seq) catch return;
        const body = std.fmt.allocPrint(
            a,
            "{s}{{\"seq\":{d},\"node\":{s},\"kind\":\"{s}\",\"state\":\"running\",\"startedAt\":{d},\"endedAt\":null}}",
            .{ kv_json_header, seq, vm.jsonStr(a, node) catch return, kind, started_ms },
        ) catch return;
        log.push(self.current_scope, key, body);
    }

    /// Queue one node. Called when it opens and again when it closes, under the
    /// same key — so a node still running shows as `running`, and its finished
    /// record replaces that rather than adding to it.
    fn dagRecordNode(self: *Engine, a: std.mem.Allocator, report: vm.NodeReport) void {
        const log = self.log orelse return;
        if (report.seq == 0) return;
        const key = dag_log.nodeKey(a, report.exec_id, @intCast(report.seq)) catch return;

        var body: std.Io.Writer.Allocating = .init(a);
        const w = &body.writer;
        w.print("{s}{{\"seq\":{d},\"node\":{s},\"kind\":\"{s}\",\"state\":\"{s}\",\"startedAt\":{d},\"endedAt\":", .{
            kv_json_header,
            report.seq,
            vm.jsonStr(a, report.node) catch return,
            report.kind,
            if (report.ok) "done" else "failed",
            report.started_ms,
        }) catch return;
        if (report.completed_ms == 0)
            w.writeAll("null") catch return
        else
            w.print("{d}", .{report.completed_ms}) catch return;
        if (report.input.len > 0) w.print(",\"input\":{s}", .{report.input}) catch return;
        if (report.result.len > 0) w.print(",\"result\":{s}", .{report.result}) catch return;
        if (report.err.len > 0)
            w.print(",\"error\":{s}", .{vm.jsonStr(a, report.err) catch return}) catch return;
        if (report.child_exec_id.len > 0)
            w.print(",\"childExecutionId\":{s}", .{vm.jsonStr(a, report.child_exec_id) catch return}) catch return;
        w.writeByte('}') catch return;

        log.push(self.current_scope, key, body.written());
    }

    pub fn callService(self: *Engine, allocator: std.mem.Allocator, service: []const u8, method: []const u8, body: []const u8, scope: []const u8) !fujin_transport.RuntimeReply {
        return self.callServiceAt(allocator, "", service, method, body, scope);
    }

    /// A call made outside any workflow — by the log writer on its own thread.
    /// It reads none of the `current_*` fields, which belong to whatever run
    /// happens to hold the engine at that moment and would otherwise be a race.
    pub fn callServiceUnattended(self: *Engine, allocator: std.mem.Allocator, service: []const u8, method: []const u8, body: []const u8, scope: []const u8) !fujin_transport.RuntimeReply {
        return self.runtime.call(allocator, .{
            .service = service,
            .method = method,
            .scope = scope,
            .user = "",
            .auth = self.service_token,
            .body = body,
            .deadline_ms = call_deadline_ms,
        });
    }

    /// `target` names the Fujin peer to route to; empty keeps the transport's
    /// default (`services`), which is where every microservice answers.
    pub fn callServiceAt(self: *Engine, allocator: std.mem.Allocator, target: []const u8, service: []const u8, method: []const u8, body: []const u8, scope: []const u8) !fujin_transport.RuntimeReply {
        const base: fujin_transport.RuntimeOutgoing = .{
            .service = service,
            .method = method,
            .scope = scope,
            .user = self.current_user,
            // The caller's JWT authorizes runWorkflow at the edge. Every downstream
            // service call is made by this trusted runtime principal instead.
            .auth = self.service_token,
            .body = body,
            .deadline_ms = call_deadline_ms,
        };
        if (target.len == 0) return self.runtime.call(allocator, base);
        var outgoing = base;
        outgoing.target = target;
        return self.runtime.call(allocator, outgoing);
    }
};

/// A workflow call is not a UI call. The transport's 5s default is sized for a
/// request a browser is waiting on; a workflow waits on a native slice or a CAM
/// pass, which the CLI already budgets 180s for (modules/commands/ptah.ts).
/// The workflow's own JS budget is unaffected — vm.zig credits back whatever a
/// host call spends waiting, so this bounds the service, not the script.
const call_deadline_ms: u32 = 600_000;

/// back-core frames a JSON value in its KV stores with this marker. The runtime
/// writes the cached entry in the store's own format, because `commitLog` moves
/// the bytes across untouched — nothing re-encodes them on the way in.
const kv_json_header = "KVJ0";

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
