//! The RT virtual machine — a thin, fast, reliable executor.
//!
//! It embeds QuickJS and runs a *flow-only* workflow script (the branching /
//! finite-state-machine layer). It owns no business logic: the script's host
//! calls are serviced by exactly four dumb primitives — call a microservice
//! (nrpc HTTP), read state, write state (Valkey), log. Workflow source itself is
//! fetched from the scripts microservice; nothing is parsed or decided in Zig.
//!
//! One run lock serialises executions, which also protects the single qjs
//! runtime and the global "current execution" pointer the C callback reaches.

const std = @import("std");
const qjs = @import("qjs.zig");
const env = @import("env.zig");
const mscall = @import("mscall.zig");
const StateStore = @import("state.zig").StateStore;

const prelude_js = @embedFile("prelude.js");
const c_allocator = std.heap.c_allocator;

pub const Engine = struct {
    gpa: std.mem.Allocator,
    io: std.Io,
    store: *StateStore,
    /// Service gateway base URL (nrpc: `<base>/<service>/<method>`).
    services_base: []const u8,
    run_mutex: std.Io.Mutex = .init,

    pub fn init(gpa: std.mem.Allocator, io: std.Io, store: *StateStore) !Engine {
        return .{
            .gpa = gpa,
            .io = io,
            .store = store,
            .services_base = try env.require("SERVICES_BASE"),
        };
    }

    pub const RunResult = struct {
        exec_id: []const u8,
        ok: bool,
        /// JSON: workflow return value on success, exception text on failure.
        output: []const u8,
    };

    /// Cap on steps per execution — a guard against a non-terminating workflow.
    const max_steps: usize = 100_000;

    /// Run `script_path` as a *step-driven DAG*: the script is re-evaluated once
    /// per node. Each evaluation replays finished nodes from the state store,
    /// executes exactly one new node, persists it, and yields; the engine logs
    /// that node to the dag microservice and re-enters. This gives a clean break
    /// between nodes — atomic, resumable, no long-lived JS process — instead of
    /// running the whole workflow inside one evaluation.
    ///
    /// `alloc` owns the returned result; per-step allocations use a scratch arena.
    pub fn runWorkflow(
        self: *Engine,
        alloc: std.mem.Allocator,
        script_path: []const u8,
        params_json: []const u8,
    ) !RunResult {
        const source = try self.fetchSource(alloc, script_path);
        const exec_id = try newExecId(alloc, self.io);

        self.run_mutex.lockUncancelable(self.io);
        defer self.run_mutex.unlock(self.io);

        var ctx = ExecContext{ .engine = self, .alloc = alloc, .exec_id = exec_id };
        g_ctx = &ctx;
        defer g_ctx = null;
        qjs.setHostFn(&hostBridge);

        // The script is identical every step; only the state store changes.
        const id_json = try jsonStr(alloc, exec_id);
        const script = try std.fmt.allocPrint(
            alloc,
            "globalThis.__execId={s};globalThis.__params={s};\n{s}\n{s}\n;__step();",
            .{ id_json, params_json, prelude_js, source },
        );

        self.dagOpen(alloc, exec_id, script_path, params_json);

        var step_arena = std.heap.ArenaAllocator.init(self.gpa);
        defer step_arena.deinit();

        var step: usize = 0;
        while (step < max_steps) : (step += 1) {
            _ = step_arena.reset(.retain_capacity);
            const sa = step_arena.allocator();
            ctx.alloc = sa;

            const eval = try qjs.eval(sa, script);
            if (eval.is_exception) {
                self.dagSetStatus(sa, exec_id, "failed");
                return .{ .exec_id = exec_id, .ok = false, .output = try alloc.dupe(u8, eval.output) };
            }

            const signal = std.json.parseFromSliceLeaky(std.json.Value, sa, eval.output, .{}) catch
                return .{ .exec_id = exec_id, .ok = false, .output = try alloc.dupe(u8, "bad step signal") };
            const obj = switch (signal) {
                .object => |o| o,
                else => return .{ .exec_id = exec_id, .ok = false, .output = try alloc.dupe(u8, "bad step signal") },
            };
            const status = getStr(obj, "status") orelse "failed";

            if (std.mem.eql(u8, status, "yielded")) {
                const node = getStr(obj, "node") orelse "?";
                const node_ok = if (obj.get("ok")) |v| (v == .bool and v.bool) else true;
                const err_text = getStr(obj, "error") orelse "";
                self.dagLogNode(sa, exec_id, node, node_ok, err_text);
                continue;
            }
            if (std.mem.eql(u8, status, "done")) {
                self.dagSetStatus(sa, exec_id, "done");
                const result = obj.get("result") orelse std.json.Value{ .null = {} };
                const out = try std.json.Stringify.valueAlloc(sa, result, .{});
                return .{ .exec_id = exec_id, .ok = true, .output = try alloc.dupe(u8, out) };
            }
            // failed
            const err_text = getStr(obj, "error") orelse "workflow failed";
            self.dagSetStatus(sa, exec_id, "failed");
            return .{ .exec_id = exec_id, .ok = false, .output = try alloc.dupe(u8, err_text) };
        }

        self.dagSetStatus(alloc, exec_id, "failed");
        return .{ .exec_id = exec_id, .ok = false, .output = try alloc.dupe(u8, "max steps exceeded") };
    }

    // ---- dag microservice logging (best-effort: observability, never fatal) --

    fn dagOpen(self: *Engine, a: std.mem.Allocator, exec_id: []const u8, workflow: []const u8, params_json: []const u8) void {
        const body = std.fmt.allocPrint(a, "{{\"id\":{s},\"workflowName\":{s},\"params\":{s}}}", .{
            jsonStr(a, exec_id) catch return, jsonStr(a, workflow) catch return, params_json,
        }) catch return;
        _ = mscall.call(self.io, a, self.services_base, "dag", "openExecution", body) catch return;
    }

    fn dagSetStatus(self: *Engine, a: std.mem.Allocator, exec_id: []const u8, status: []const u8) void {
        const body = std.fmt.allocPrint(a, "{{\"id\":{s},\"status\":\"{s}\"}}", .{ jsonStr(a, exec_id) catch return, status }) catch return;
        _ = mscall.call(self.io, a, self.services_base, "dag", "setExecutionStatus", body) catch return;
    }

    /// Record one executed node as a numbered task: createTask -> setTaskDone /
    /// setTaskFailed. Nodes run in a loop simply get successive task ids.
    fn dagLogNode(self: *Engine, a: std.mem.Allocator, exec_id: []const u8, node: []const u8, ok: bool, err_text: []const u8) void {
        const ct_body = std.fmt.allocPrint(a, "{{\"executionId\":{s},\"nodeId\":{s}}}", .{
            jsonStr(a, exec_id) catch return, jsonStr(a, node) catch return,
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
                task_id, jsonStr(a, exec_id) catch return, jsonStr(a, node) catch return, now,
            }) catch return;
            _ = mscall.call(self.io, a, self.services_base, "dag", "setTaskDone", body) catch return;
        } else {
            const body = std.fmt.allocPrint(a, "{{\"taskId\":{d},\"completedAt\":{d},\"errorMessage\":{s}}}", .{
                task_id, now, jsonStr(a, err_text) catch return,
            }) catch return;
            _ = mscall.call(self.io, a, self.services_base, "dag", "setTaskFailed", body) catch return;
        }
    }

    /// Dumb fetch of workflow source: scripts.readScript(path) -> { content }.
    fn fetchSource(self: *Engine, alloc: std.mem.Allocator, script_path: []const u8) ![]const u8 {
        const path_json = try jsonStr(alloc, script_path);
        const body = try std.fmt.allocPrint(alloc, "{{\"path\":{s}}}", .{path_json});
        const res = try mscall.call(self.io, alloc, self.services_base, "scripts", "readScript", body);
        if (res.status < 200 or res.status >= 300) return error.WorkflowNotFound;

        const parsed = std.json.parseFromSliceLeaky(std.json.Value, alloc, res.body, .{}) catch
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
};

// ---- per-execution context reachable from the C callback -------------------

const ExecContext = struct {
    engine: *Engine,
    alloc: std.mem.Allocator,
    exec_id: []const u8,
};

/// Set under `run_mutex` for the duration of one qjs evaluation.
var g_ctx: ?*ExecContext = null;

fn hostBridge(
    arg: [*]const u8,
    arg_len: usize,
    out_ptr: *?[*]u8,
    out_len: *usize,
) callconv(.c) c_int {
    const ctx = g_ctx orelse return -1;
    const reply = dispatch(ctx, arg[0..arg_len]) catch |e|
        (std.fmt.allocPrint(c_allocator, "{{\"ok\":false,\"error\":\"rt: {s}\"}}", .{@errorName(e)}) catch return -1);
    out_ptr.* = reply.ptr;
    out_len.* = reply.len;
    return 0;
}

/// One `__host` request. Returns a c_allocator-owned reply (qjs frees it). The
/// four primitives never interpret business data: params/results/state values
/// are opaque, passed through verbatim.
fn dispatch(ctx: *ExecContext, request: []const u8) ![]u8 {
    const a = ctx.alloc;
    const eng = ctx.engine;

    const parsed = std.json.parseFromSliceLeaky(std.json.Value, a, request, .{}) catch
        return cdupe("{\"ok\":false,\"error\":\"bad host request\"}");
    const obj = switch (parsed) {
        .object => |o| o,
        else => return cdupe("{\"ok\":false,\"error\":\"host request not object\"}"),
    };
    const op = getStr(obj, "op") orelse return cdupe("{\"ok\":false,\"error\":\"missing op\"}");

    if (std.mem.eql(u8, op, "call")) {
        const service = getStr(obj, "service") orelse return cdupe("{\"ok\":false,\"error\":\"call: missing service\"}");
        const method = getStr(obj, "method") orelse return cdupe("{\"ok\":false,\"error\":\"call: missing method\"}");
        const body = getStr(obj, "body") orelse "{}";
        const res = mscall.call(eng.io, a, eng.services_base, service, method, body) catch |e| {
            const m = try std.fmt.allocPrint(a, "call transport: {s}", .{@errorName(e)});
            return cReply(try errReply(a, m));
        };
        const ok = res.status >= 200 and res.status < 300;
        const resp_body = if (res.body.len == 0) "null" else res.body;
        return cReply(try std.fmt.allocPrint(a, "{{\"ok\":{},\"status\":{d},\"body\":{s}}}", .{ ok, res.status, resp_body }));
    } else if (std.mem.eql(u8, op, "get")) {
        const key = getStr(obj, "key") orelse return cdupe("{\"ok\":false,\"error\":\"get: missing key\"}");
        const val = try eng.store.get(eng.io, a, key);
        return cReply(try std.fmt.allocPrint(a, "{{\"ok\":true,\"value\":{s}}}", .{val orelse "null"}));
    } else if (std.mem.eql(u8, op, "set")) {
        const key = getStr(obj, "key") orelse return cdupe("{\"ok\":false,\"error\":\"set: missing key\"}");
        const json = getStr(obj, "json") orelse "null";
        try eng.store.set(eng.io, a, key, json);
        return cdupe("{\"ok\":true}");
    } else if (std.mem.eql(u8, op, "log")) {
        const msg = getStr(obj, "message") orelse "";
        std.debug.print("[wf {s}] {s}\n", .{ ctx.exec_id, msg });
        return cdupe("{\"ok\":true}");
    }

    return cReply(try errReply(a, try std.fmt.allocPrint(a, "unknown op '{s}'", .{op})));
}

// ---- helpers ---------------------------------------------------------------

/// Copy an arena-built reply into a c_allocator buffer (qjs frees it).
fn cReply(arena_reply: []const u8) ![]u8 {
    return c_allocator.dupe(u8, arena_reply);
}

fn cdupe(comptime s: []const u8) ![]u8 {
    return c_allocator.dupe(u8, s);
}

fn errReply(a: std.mem.Allocator, message: []const u8) ![]u8 {
    const ejson = try jsonStr(a, message);
    return std.fmt.allocPrint(a, "{{\"ok\":false,\"error\":{s}}}", .{ejson});
}

fn jsonStr(a: std.mem.Allocator, s: []const u8) ![]u8 {
    return std.json.Stringify.valueAlloc(a, std.json.Value{ .string = s }, .{});
}

fn getStr(obj: std.json.ObjectMap, key: []const u8) ?[]const u8 {
    const v = obj.get(key) orelse return null;
    return switch (v) {
        .string => |s| s,
        else => null,
    };
}

var g_exec_seq: std.atomic.Value(u64) = .init(0);

fn newExecId(a: std.mem.Allocator, io: std.Io) ![]u8 {
    const ts: u64 = @intCast(std.Io.Timestamp.now(io, .real).toMilliseconds());
    const seq = g_exec_seq.fetchAdd(1, .monotonic);
    return std.fmt.allocPrint(a, "exec-{x}-{x}", .{ ts, seq });
}
