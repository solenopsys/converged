//! Production wiring of the step-driven DAG (vm.zig): the transport is
//! nrpc-over-HTTP for `call`, Valkey for state, and the dag microservice for
//! per-node logging. The VM is transport-agnostic; this file only supplies the
//! real backends and brackets a run with execution-level bookkeeping.

const std = @import("std");
const env = @import("env.zig");
const mscall = @import("mscall.zig");
const vm = @import("vm.zig");
const StateStore = @import("state.zig").StateStore;
const LlmHub = @import("llm/hub.zig").Hub;

pub const Engine = struct {
    gpa: std.mem.Allocator,
    io: std.Io,
    store: *StateStore,
    /// Service gateway base URL (nrpc: `<base>/<service>/<method>`).
    services_base: []const u8,
    /// LLM provider hub (providers appear per available API key).
    llm: LlmHub,
    run_mutex: std.Io.Mutex = .init,

    pub fn init(gpa: std.mem.Allocator, io: std.Io, store: *StateStore) !Engine {
        return .{
            .gpa = gpa,
            .io = io,
            .store = store,
            .services_base = try env.require("SERVICES_BASE"),
            .llm = try LlmHub.init(gpa, io),
        };
    }

    pub const RunResult = struct {
        exec_id: []const u8,
        ok: bool,
        output: []const u8,
    };

    fn transport(self: *Engine) vm.Transport {
        return .{ .ctx = self, .call = tCall, .get = tGet, .set = tSet, .log = tLog, .on_node = tOnNode, .llm = tLlm };
    }

    /// Fetch `script_path` from the scripts microservice and run it as a
    /// step-driven DAG. `alloc` (a per-request arena) owns the returned result.
    pub fn runWorkflow(
        self: *Engine,
        alloc: std.mem.Allocator,
        script_path: []const u8,
        params_json: []const u8,
    ) !RunResult {
        const t = self.transport();
        const source = try fetchSource(alloc, t, script_path);
        const exec_id = try newExecId(alloc, self.io);

        self.run_mutex.lockUncancelable(self.io);
        defer self.run_mutex.unlock(self.io);

        self.dagOpen(alloc, exec_id, script_path, params_json);
        const result = try vm.run(alloc, self.gpa, t, exec_id, source, params_json);
        self.dagSetStatus(alloc, exec_id, if (result.ok) "done" else "failed");

        return .{ .exec_id = exec_id, .ok = result.ok, .output = result.output };
    }

    fn fetchSource(alloc: std.mem.Allocator, t: vm.Transport, script_path: []const u8) ![]const u8 {
        const path_json = try vm.jsonStr(alloc, script_path);
        const body = try std.fmt.allocPrint(alloc, "{{\"path\":{s}}}", .{path_json});
        const reply = try t.call(t.ctx, alloc, "scripts", "readScript", body);
        if (!reply.ok) return error.WorkflowNotFound;

        const parsed = std.json.parseFromSliceLeaky(std.json.Value, alloc, reply.body, .{}) catch
            return error.WorkflowSourceInvalid;
        const content = switch (parsed) {
            .object => |o| o.get("content") orelse return error.WorkflowSourceInvalid,
            else => return error.WorkflowSourceInvalid,
        };
        return switch (content) {
            .string => |s| s,
            else => error.WorkflowSourceInvalid,
        };
    }

    // ---- transport vtable: production backends -----------------------------

    fn tCall(ctx: *anyopaque, a: std.mem.Allocator, service: []const u8, method: []const u8, body: []const u8) anyerror!vm.Reply {
        const self: *Engine = @ptrCast(@alignCast(ctx));
        const res = try mscall.call(self.io, a, self.services_base, service, method, body);
        return .{ .ok = res.status >= 200 and res.status < 300, .status = res.status, .body = res.body };
    }

    fn tGet(ctx: *anyopaque, a: std.mem.Allocator, key: []const u8) anyerror!?[]const u8 {
        const self: *Engine = @ptrCast(@alignCast(ctx));
        return self.store.get(self.io, a, key);
    }

    fn tSet(ctx: *anyopaque, a: std.mem.Allocator, key: []const u8, value: []const u8) anyerror!void {
        const self: *Engine = @ptrCast(@alignCast(ctx));
        return self.store.set(self.io, a, key, value);
    }

    fn tLog(ctx: *anyopaque, msg: []const u8) void {
        _ = ctx;
        std.debug.print("[wf] {s}\n", .{msg});
    }

    fn tLlm(ctx: *anyopaque, a: std.mem.Allocator, request_json: []const u8) anyerror!vm.LlmReply {
        const self: *Engine = @ptrCast(@alignCast(ctx));
        const reply = try self.llm.complete(a, request_json);
        return .{ .ok = reply.ok, .body = reply.body };
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
        _ = mscall.call(self.io, a, self.services_base, "dag", "openExecution", body) catch return;
    }

    fn dagSetStatus(self: *Engine, a: std.mem.Allocator, exec_id: []const u8, status: []const u8) void {
        const body = std.fmt.allocPrint(a, "{{\"id\":{s},\"status\":\"{s}\"}}", .{ vm.jsonStr(a, exec_id) catch return, status }) catch return;
        _ = mscall.call(self.io, a, self.services_base, "dag", "setExecutionStatus", body) catch return;
    }

    /// Record one executed node as a numbered task: createTask -> setTaskDone /
    /// setTaskFailed. Nodes run in a loop simply get successive task ids.
    fn dagLogNode(self: *Engine, a: std.mem.Allocator, exec_id: []const u8, node: []const u8, ok: bool, err_text: []const u8) void {
        const ct_body = std.fmt.allocPrint(a, "{{\"executionId\":{s},\"nodeId\":{s}}}", .{
            vm.jsonStr(a, exec_id) catch return, vm.jsonStr(a, node) catch return,
        }) catch return;
        const res = mscall.call(self.io, a, self.services_base, "dag", "createTask", ct_body) catch return;
        if (res.status < 200 or res.status >= 300) return;

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
            _ = mscall.call(self.io, a, self.services_base, "dag", "setTaskDone", body) catch return;
        } else {
            const body = std.fmt.allocPrint(a, "{{\"taskId\":{d},\"completedAt\":{d},\"errorMessage\":{s}}}", .{
                task_id, now, vm.jsonStr(a, err_text) catch return,
            }) catch return;
            _ = mscall.call(self.io, a, self.services_base, "dag", "setTaskFailed", body) catch return;
        }
    }
};

var g_exec_seq: std.atomic.Value(u64) = .init(0);

fn newExecId(a: std.mem.Allocator, io: std.Io) ![]u8 {
    const ts: u64 = @intCast(std.Io.Timestamp.now(io, .real).toMilliseconds());
    const seq = g_exec_seq.fetchAdd(1, .monotonic);
    return std.fmt.allocPrint(a, "exec-{x}-{x}", .{ ts, seq });
}
