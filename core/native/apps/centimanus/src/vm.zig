//! The step-driven DAG core, independent of any transport.
//!
//! It embeds QuickJS, loads a workflow's program once and calls its entry
//! point (see prelude.js): the script runs top to bottom, and a node is an
//! ordinary function call that blocks until its service answers. Where the
//! script's host calls go is decided
//! by a `Transport` vtable: production wires it to nrpc-over-HTTP + Valkey; the
//! bun test harness wires it to in-process TS handlers. The VM itself never
//! knows the difference, so a workflow runs identically in a test and in prod.

const std = @import("std");
const qjs = @import("qjs.zig");

const prelude_js = @embedFile("prelude.js");
const c_allocator = std.heap.c_allocator;

/// Result of a microservice call: `body` is owned by the allocator passed to
/// `call` (the per-step arena).
pub const Reply = struct {
    ok: bool,
    status: u16,
    body: []const u8,
};

/// Result of an `rt.llm` call: `body` is the uniform response JSON when ok,
/// or a human-readable error line otherwise (surfaced to the script as-is).
pub const LlmReply = struct {
    ok: bool,
    body: []const u8,
};

/// Everything the VM needs from the outside world. The primitives mirror the
/// `rt` prelude surface; `on_node` is an optional per-node observability hook
/// (production logs to the dag microservice; tests ignore it); `llm` is the
/// provider hub (optional — a transport without it rejects `rt.llm` loudly).
pub const Transport = struct {
    ctx: *anyopaque,
    /// `target` is the Fujin peer the service answers behind, empty when the
    /// caller does not name one — a microservice shares the engine's own peer.
    call: *const fn (ctx: *anyopaque, a: std.mem.Allocator, target: []const u8, service: []const u8, method: []const u8, body: []const u8) anyerror!Reply,
    get: *const fn (ctx: *anyopaque, a: std.mem.Allocator, key: []const u8) anyerror!?[]const u8,
    set: *const fn (ctx: *anyopaque, a: std.mem.Allocator, key: []const u8, value: []const u8) anyerror!void,
    log: *const fn (ctx: *anyopaque, msg: []const u8) void,
    on_node: ?*const fn (ctx: *anyopaque, a: std.mem.Allocator, exec_id: []const u8, node: []const u8, ok: bool, err: []const u8) void = null,
    llm: ?*const fn (ctx: *anyopaque, a: std.mem.Allocator, request_json: []const u8) anyerror!LlmReply = null,
    /// Runs another workflow to completion and returns its result as `body`.
    /// The child gets its own QuickJS runtime, so running it while the parent
    /// is blocked in a host call re-enters nothing.
    run_workflow: ?*const fn (ctx: *anyopaque, a: std.mem.Allocator, script_path: []const u8, params_json: []const u8) anyerror!Reply = null,
    /// Drop a state key. Used to clear a finished run's node cache.
    del: ?*const fn (ctx: *anyopaque, a: std.mem.Allocator, key: []const u8) anyerror!void = null,
};

pub const RunResult = struct {
    ok: bool,
    /// JSON: workflow return value on success, error text on failure. Owned by
    /// the `out_alloc` passed to `run`.
    output: []const u8,
};

/// Cap on nodes per execution — a guard against a workflow that never ends.
/// The JS budget below cannot catch that on its own: a loop that calls a
/// service every turn spends its time waiting, not computing, and that wait is
/// deliberately not charged to the script.
const max_nodes: usize = 100_000;

/// Budget for the workflow call. It covers the script's own execution only:
/// the wrapper credits back whatever a `__host` call spent waiting on a
/// service, so a slow unpack or a slow store read cannot exhaust it. What is
/// left to bound is flow code — branching and bookkeeping between calls — so
/// what this catches is a tight loop that never touches the host at all.
const run_timeout_ms: u32 = 5_000;

/// Cap on rt.sub nesting. It lives here, not in a transport: the recursion is
/// the VM's own, so every transport (production, tests, anything later) is held
/// to the same limit and a self-delegating workflow always terminates.
pub const max_sub_depth: u8 = 8;

/// Run a workflow to completion: load its program once, call its entry point.
pub fn run(
    out_alloc: std.mem.Allocator,
    scratch_gpa: std.mem.Allocator,
    transport: Transport,
    exec_id: []const u8,
    source: []const u8,
    params_json: []const u8,
) !RunResult {
    const id_json = try jsonStr(out_alloc, exec_id);
    // Compiled once: the program installs `rt`, `__run` and the workflow's
    // entry point on the global object, and the run is one call into what is
    // already there.
    const program = try std.fmt.allocPrint(
        out_alloc,
        "globalThis.__execId={s};globalThis.__params={s};\n{s}\n{s}\n",
        .{ id_json, params_json, prelude_js, source },
    );

    // Outlives the call: the node-key list is read again during cleanup.
    var run_arena = std.heap.ArenaAllocator.init(scratch_gpa);
    defer run_arena.deinit();

    var ctx = ExecContext{
        .transport = transport,
        .alloc = undefined,
        .exec_id = exec_id,
        .run_alloc = run_arena.allocator(),
        // A delegated child runs inside its parent's host call, so the parent
        // is still the installed context when we get here.
        .depth = if (g_ctx) |parent| parent.depth + 1 else 0,
    };
    // Runs on every exit — done, failed, or budget exhausted.
    defer clearTaskCache(&ctx, scratch_gpa);
    // Save/restore rather than clear: a delegated child runs its own `run`
    // between two host calls of the parent, and the parent needs its context
    // back afterwards.
    const parent_ctx = g_ctx;
    g_ctx = &ctx;
    defer g_ctx = parent_ctx;

    // A child gets its own runtime. It is created while the parent is blocked
    // inside a host call, so the two are never the same runtime and QuickJS is
    // never re-entered on one.
    const runtime = try qjs.Runtime.init();
    defer runtime.deinit();
    runtime.setTimeoutMs(run_timeout_ms);
    runtime.setHostFn(&hostBridge, null);

    var call_arena = std.heap.ArenaAllocator.init(scratch_gpa);
    defer call_arena.deinit();
    const ca = call_arena.allocator();
    ctx.alloc = ca;

    if (try runtime.load(ca, program, "<workflow>")) |exception| {
        return .{ .ok = false, .output = try out_alloc.dupe(u8, exception) };
    }

    const result = try runtime.call(ca, "__run", "");
    if (result.is_exception) {
        return .{ .ok = false, .output = try out_alloc.dupe(u8, result.output) };
    }

    const obj = parseObject(ca, result.output) orelse
        return .{ .ok = false, .output = try out_alloc.dupe(u8, "bad workflow signal") };
    if (std.mem.eql(u8, getStr(obj, "status") orelse "failed", "done")) {
        const value = obj.get("result") orelse std.json.Value{ .null = {} };
        const out = try std.json.Stringify.valueAlloc(ca, value, .{});
        return .{ .ok = true, .output = try out_alloc.dupe(u8, out) };
    }
    const err_text = getStr(obj, "error") orelse "workflow failed";
    return .{ .ok = false, .output = try out_alloc.dupe(u8, err_text) };
}

const SubOutcome = struct {
    /// `{ ok: true, value } | { ok: false, error }` — what the parent replays.
    json: []const u8,
    ok: bool,
    err: []const u8,
};

/// Run the delegated workflow and shape its result the way runOrReplay stores a
/// node outcome. A child failure is data, not a crash: the parent decides via
/// rt.sub (throws) or rt.subAttempt (returns the error).
fn runSub(
    a: std.mem.Allocator,
    transport: Transport,
    script_path: []const u8,
    params_json: []const u8,
) !SubOutcome {
    const runner = transport.run_workflow orelse
        return failedSub(a, "rt.sub: no sub-workflow transport wired");
    const reply = runner(transport.ctx, a, script_path, params_json) catch |e|
        return failedSub(a, try std.fmt.allocPrint(a, "sub transport: {s}", .{@errorName(e)}));
    if (!reply.ok) return failedSub(a, reply.body);
    const value = if (reply.body.len == 0) "null" else reply.body;
    return .{
        .json = try std.fmt.allocPrint(a, "{{\"ok\":true,\"value\":{s}}}", .{value}),
        .ok = true,
        .err = "",
    };
}

/// Charge one node against the run's budget. Returns the reply to hand back
/// when it is spent — the script sees a failing host call and stops.
fn budgetSpent(ctx: *ExecContext, a: std.mem.Allocator) !?[]u8 {
    if (ctx.nodes_run >= max_nodes)
        return try cReply(try errReplyFmt(a, "rt: more than {d} nodes in one run", .{max_nodes}));
    ctx.nodes_run += 1;
    return null;
}

fn failedSub(a: std.mem.Allocator, message: []const u8) !SubOutcome {
    const ejson = try jsonStr(a, message);
    return .{
        .json = try std.fmt.allocPrint(a, "{{\"ok\":false,\"error\":{s}}}", .{ejson}),
        .ok = false,
        .err = message,
    };
}

// ---- host bridge (qjs -> transport) ----------------------------------------

const ExecContext = struct {
    transport: Transport,
    alloc: std.mem.Allocator,
    exec_id: []const u8,
    /// Node keys this run wrote. The cache spares a replay the cost of calling
    /// microservices again; rp-dag keeps the durable record, so when the run
    /// ends these entries are dropped instead of living in Valkey forever.
    task_keys: std.ArrayListUnmanaged([]const u8) = .empty,
    run_alloc: std.mem.Allocator,
    /// How many rt.sub hops deep this run is; 0 for a top-level workflow.
    depth: u8 = 0,
    /// Nodes and delegations this run has executed, against `max_nodes`.
    nodes_run: usize = 0,
};

/// The state key a node's outcome lives under. The host owns this shape: the
/// script names a node, the engine decides where it is kept.
fn taskKey(a: std.mem.Allocator, exec_id: []const u8, node: []const u8) ![]const u8 {
    return std.fmt.allocPrint(a, "rt:task:{s}:{s}", .{ exec_id, node });
}

/// Node outcome keys are `rt:task:<execId>:<node>` (see prelude.js taskKey).
fn isTaskKey(key: []const u8) bool {
    return std.mem.startsWith(u8, key, "rt:task:");
}

/// Clear the finished run's node cache. Best effort: a key that will not go
/// away must not turn a completed workflow into a failed one.
fn clearTaskCache(ctx: *ExecContext, gpa: std.mem.Allocator) void {
    const del = ctx.transport.del orelse return;
    var arena = std.heap.ArenaAllocator.init(gpa);
    defer arena.deinit();
    for (ctx.task_keys.items) |key| {
        del(ctx.transport.ctx, arena.allocator(), key) catch |err|
            std.log.warn("rt: could not clear {s}: {s}", .{ key, @errorName(err) });
    }
}

/// Set for the duration of one `run`, saved/restored around a delegated child.
var g_ctx: ?*ExecContext = null;

fn hostBridge(
    user: ?*anyopaque,
    arg: [*]const u8,
    arg_len: usize,
    out_ptr: *?[*]u8,
    out_len: *usize,
) callconv(.c) c_int {
    // The run in progress is `g_ctx`, saved and restored around a delegated
    // child, so the bridge needs no per-runtime pointer of its own.
    _ = user;
    const ctx = g_ctx orelse return -1;
    const reply = dispatch(ctx, arg[0..arg_len]) catch |e|
        (std.fmt.allocPrint(c_allocator, "{{\"ok\":false,\"error\":\"rt: {s}\"}}", .{@errorName(e)}) catch return -1);
    out_ptr.* = reply.ptr;
    out_len.* = reply.len;
    return 0;
}

/// One `__host` request. Values (params/results/state) stay opaque — passed
/// through verbatim; only the flat envelope is parsed.
fn dispatch(ctx: *ExecContext, request: []const u8) ![]u8 {
    const a = ctx.alloc;
    const t = ctx.transport;

    const obj = parseObject(a, request) orelse return cdupe("{\"ok\":false,\"error\":\"bad host request\"}");
    const op = getStr(obj, "op") orelse return cdupe("{\"ok\":false,\"error\":\"missing op\"}");

    if (std.mem.eql(u8, op, "call")) {
        const service = getStr(obj, "service") orelse return cdupe("{\"ok\":false,\"error\":\"call: missing service\"}");
        const method = getStr(obj, "method") orelse return cdupe("{\"ok\":false,\"error\":\"call: missing method\"}");
        const body = getStr(obj, "body") orelse "{}";
        const target = getStr(obj, "target") orelse "";
        const reply = t.call(t.ctx, a, target, service, method, body) catch |e|
            return cReply(try errReplyFmt(a, "call transport: {s}", .{@errorName(e)}));
        const resp_body = if (reply.body.len == 0) "null" else reply.body;
        return cReply(try std.fmt.allocPrint(a, "{{\"ok\":{},\"status\":{d},\"body\":{s}}}", .{ reply.ok, reply.status, resp_body }));
    } else if (std.mem.eql(u8, op, "get")) {
        const key = getStr(obj, "key") orelse return cdupe("{\"ok\":false,\"error\":\"get: missing key\"}");
        const val = try t.get(t.ctx, a, key);
        return cReply(try std.fmt.allocPrint(a, "{{\"ok\":true,\"value\":{s}}}", .{val orelse "null"}));
    } else if (std.mem.eql(u8, op, "set")) {
        const key = getStr(obj, "key") orelse return cdupe("{\"ok\":false,\"error\":\"set: missing key\"}");
        const json = getStr(obj, "json") orelse "null";
        try t.set(t.ctx, a, key, json);
        // `a` is the step arena and is reset every evaluation, so keep our own copy.
        if (isTaskKey(key))
            try ctx.task_keys.append(ctx.run_alloc, try ctx.run_alloc.dupe(u8, key));
        return cdupe("{\"ok\":true}");
    } else if (std.mem.eql(u8, op, "log")) {
        const msg = getStr(obj, "message") orelse "";
        t.log(t.ctx, msg);
        return cdupe("{\"ok\":true}");
    } else if (std.mem.eql(u8, op, "nodeGet")) {
        const node = getStr(obj, "node") orelse return cdupe("{\"ok\":false,\"error\":\"nodeGet: missing node\"}");
        const val = try t.get(t.ctx, a, try taskKey(a, ctx.exec_id, node));
        return cReply(try std.fmt.allocPrint(a, "{{\"ok\":true,\"value\":{s}}}", .{val orelse "null"}));
    } else if (std.mem.eql(u8, op, "nodeSet")) {
        const node = getStr(obj, "node") orelse return cdupe("{\"ok\":false,\"error\":\"nodeSet: missing node\"}");
        const json = getStr(obj, "json") orelse "null";
        if (try budgetSpent(ctx, a)) |denial| return denial;
        const key = try taskKey(a, ctx.exec_id, node);
        try t.set(t.ctx, a, key, json);
        try ctx.task_keys.append(ctx.run_alloc, try ctx.run_alloc.dupe(u8, key));
        if (t.on_node) |hook| {
            const outcome = parseObject(a, json);
            const node_ok = if (outcome) |o| (if (o.get("ok")) |v| (v == .bool and v.bool) else false) else false;
            const err_text = if (outcome) |o| (getStr(o, "error") orelse "") else "";
            hook(t.ctx, a, ctx.exec_id, node, node_ok, err_text);
        }
        return cdupe("{\"ok\":true}");
    } else if (std.mem.eql(u8, op, "sub")) {
        const node = getStr(obj, "node") orelse return cdupe("{\"ok\":false,\"error\":\"rt.sub: missing node\"}");
        const script_path = getStr(obj, "script") orelse return cdupe("{\"ok\":false,\"error\":\"rt.sub: missing script\"}");
        const params_value = obj.get("params") orelse std.json.Value{ .null = {} };
        const child_params = try std.json.Stringify.valueAlloc(a, params_value, .{});
        if (try budgetSpent(ctx, a)) |denial| return denial;
        // The child runs on its own runtime while this call is blocked, so the
        // parent's own evaluation is untouched by whatever the child does.
        const outcome = if (ctx.depth >= max_sub_depth)
            try failedSub(a, try std.fmt.allocPrint(a, "rt.sub: delegation deeper than {d}", .{max_sub_depth}))
        else
            try runSub(a, t, script_path, child_params);
        const key = try taskKey(a, ctx.exec_id, node);
        try t.set(t.ctx, a, key, outcome.json);
        try ctx.task_keys.append(ctx.run_alloc, try ctx.run_alloc.dupe(u8, key));
        if (t.on_node) |hook| hook(t.ctx, a, ctx.exec_id, node, outcome.ok, outcome.err);
        return cReply(outcome.json);
    } else if (std.mem.eql(u8, op, "llm")) {
        const json = getStr(obj, "json") orelse return cdupe("{\"ok\":false,\"error\":\"llm: missing json\"}");
        const lfn = t.llm orelse return cdupe("{\"ok\":false,\"error\":\"rt.llm: no llm transport wired\"}");
        const reply = lfn(t.ctx, a, json) catch |e|
            return cReply(try errReplyFmt(a, "llm transport: {s}", .{@errorName(e)}));
        if (reply.ok)
            return cReply(try std.fmt.allocPrint(a, "{{\"ok\":true,\"value\":{s}}}", .{reply.body}));
        return cReply(try errReplyFmt(a, "{s}", .{reply.body}));
    }

    return cReply(try errReplyFmt(a, "unknown op '{s}'", .{op}));
}

// ---- helpers ---------------------------------------------------------------

fn parseObject(a: std.mem.Allocator, text: []const u8) ?std.json.ObjectMap {
    const parsed = std.json.parseFromSliceLeaky(std.json.Value, a, text, .{}) catch return null;
    return switch (parsed) {
        .object => |o| o,
        else => null,
    };
}

fn cReply(arena_reply: []const u8) ![]u8 {
    return c_allocator.dupe(u8, arena_reply);
}

fn cdupe(comptime s: []const u8) ![]u8 {
    return c_allocator.dupe(u8, s);
}

fn errReplyFmt(a: std.mem.Allocator, comptime fmt: []const u8, args: anytype) ![]u8 {
    const message = try std.fmt.allocPrint(a, fmt, args);
    const ejson = try jsonStr(a, message);
    return std.fmt.allocPrint(a, "{{\"ok\":false,\"error\":{s}}}", .{ejson});
}

pub fn jsonStr(a: std.mem.Allocator, s: []const u8) ![]u8 {
    return std.json.Stringify.valueAlloc(a, std.json.Value{ .string = s }, .{});
}

pub fn getStr(obj: std.json.ObjectMap, key: []const u8) ?[]const u8 {
    const v = obj.get(key) orelse return null;
    return switch (v) {
        .string => |s| s,
        else => null,
    };
}
