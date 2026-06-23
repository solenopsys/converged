//! The step-driven DAG core, independent of any transport.
//!
//! It embeds QuickJS and runs a workflow as a sequence of short evaluations
//! (one node each — see prelude.js). Where the script's host calls go is decided
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

/// Everything the VM needs from the outside world. The four primitives mirror
/// the `rt` prelude surface; `on_node` is an optional per-node observability
/// hook (production logs to the dag microservice; tests ignore it).
pub const Transport = struct {
    ctx: *anyopaque,
    call: *const fn (ctx: *anyopaque, a: std.mem.Allocator, service: []const u8, method: []const u8, body: []const u8) anyerror!Reply,
    get: *const fn (ctx: *anyopaque, a: std.mem.Allocator, key: []const u8) anyerror!?[]const u8,
    set: *const fn (ctx: *anyopaque, a: std.mem.Allocator, key: []const u8, value: []const u8) anyerror!void,
    log: *const fn (ctx: *anyopaque, msg: []const u8) void,
    on_node: ?*const fn (ctx: *anyopaque, a: std.mem.Allocator, exec_id: []const u8, node: []const u8, ok: bool, err: []const u8) void = null,
};

pub const RunResult = struct {
    ok: bool,
    /// JSON: workflow return value on success, error text on failure. Owned by
    /// the `out_alloc` passed to `run`.
    output: []const u8,
};

/// Cap on steps per execution — a guard against a non-terminating workflow.
const max_steps: usize = 100_000;

/// Run a workflow to completion, one node per evaluation.
pub fn run(
    out_alloc: std.mem.Allocator,
    scratch_gpa: std.mem.Allocator,
    transport: Transport,
    exec_id: []const u8,
    source: []const u8,
    params_json: []const u8,
) !RunResult {
    const id_json = try jsonStr(out_alloc, exec_id);
    const script = try std.fmt.allocPrint(
        out_alloc,
        "globalThis.__execId={s};globalThis.__params={s};\n{s}\n{s}\n;__step();",
        .{ id_json, params_json, prelude_js, source },
    );

    var ctx = ExecContext{ .transport = transport, .alloc = undefined, .exec_id = exec_id };
    g_ctx = &ctx;
    defer g_ctx = null;
    qjs.setHostFn(&hostBridge);

    var step_arena = std.heap.ArenaAllocator.init(scratch_gpa);
    defer step_arena.deinit();

    var step: usize = 0;
    while (step < max_steps) : (step += 1) {
        _ = step_arena.reset(.retain_capacity);
        const sa = step_arena.allocator();
        ctx.alloc = sa;

        const eval = try qjs.eval(sa, script);
        if (eval.is_exception) {
            return .{ .ok = false, .output = try out_alloc.dupe(u8, eval.output) };
        }

        const obj = parseObject(sa, eval.output) orelse
            return .{ .ok = false, .output = try out_alloc.dupe(u8, "bad step signal") };
        const status = getStr(obj, "status") orelse "failed";

        if (std.mem.eql(u8, status, "yielded")) {
            if (transport.on_node) |hook| {
                const node = getStr(obj, "node") orelse "?";
                const node_ok = if (obj.get("ok")) |v| (v == .bool and v.bool) else true;
                const err_text = getStr(obj, "error") orelse "";
                hook(transport.ctx, sa, exec_id, node, node_ok, err_text);
            }
            continue;
        }
        if (std.mem.eql(u8, status, "done")) {
            const result = obj.get("result") orelse std.json.Value{ .null = {} };
            const out = try std.json.Stringify.valueAlloc(sa, result, .{});
            return .{ .ok = true, .output = try out_alloc.dupe(u8, out) };
        }
        const err_text = getStr(obj, "error") orelse "workflow failed";
        return .{ .ok = false, .output = try out_alloc.dupe(u8, err_text) };
    }

    return .{ .ok = false, .output = try out_alloc.dupe(u8, "max steps exceeded") };
}

// ---- host bridge (qjs -> transport) ----------------------------------------

const ExecContext = struct {
    transport: Transport,
    alloc: std.mem.Allocator,
    exec_id: []const u8,
};

/// Set for the duration of one `run` (callers serialise runs with a mutex).
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
        const reply = t.call(t.ctx, a, service, method, body) catch |e|
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
        return cdupe("{\"ok\":true}");
    } else if (std.mem.eql(u8, op, "log")) {
        const msg = getStr(obj, "message") orelse "";
        t.log(t.ctx, msg);
        return cdupe("{\"ok\":true}");
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
