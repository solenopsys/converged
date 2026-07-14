//! librt-mock — the RT VM as a C-ABI library for bun (bun:ffi).
//!
//! Same step-driven DAG core (vm.zig), but the transport is mocked in-process:
//!   * `call`  -> a JS handler registered from bun (rt_set_call_handler), so a
//!               test feeds microservice results as plain TS code;
//!   * `get/set` -> an in-process map (the Valkey stand-in);
//!   * `log`   -> stderr.
//! No sockets, no container — a compiled workflow runs on the real engine and
//! the test just answers its calls. See test/bun/.

const std = @import("std");
const vm = @import("vm.zig");

const c_allocator = std.heap.c_allocator;

/// JS handler for `rt.call`: receives NUL-terminated service/method/body and
/// returns a NUL-terminated JSON result (or null to signal a failed call).
pub const CallHandler = *const fn (
    service: [*:0]const u8,
    method: [*:0]const u8,
    body: [*:0]const u8,
) callconv(.c) ?[*:0]const u8;

/// JS-backed cache (the Valkey stand-in). Both the engine's rt.get/set AND the
/// mocked microservices share it, so data passes by reference exactly as in
/// production. Returns the value (NUL-terminated) or null if absent.
pub const StateGetFn = *const fn (key: [*:0]const u8) callconv(.c) ?[*:0]const u8;
pub const StateSetFn = *const fn (key: [*:0]const u8, value: [*:0]const u8) callconv(.c) void;

/// JS handler for `rt.llm`: receives the NUL-terminated uniform request JSON
/// and returns the NUL-terminated uniform response JSON (or null on failure).
pub const LlmHandler = *const fn (request: [*:0]const u8) callconv(.c) ?[*:0]const u8;

var g_handler: ?CallHandler = null;
var g_get: ?StateGetFn = null;
var g_set: ?StateSetFn = null;
var g_llm: ?LlmHandler = null;
var g_state: std.StringHashMapUnmanaged([]u8) = .{};
var g_seq: u64 = 0;

// ---- C-ABI -----------------------------------------------------------------

export fn rt_set_call_handler(handler: ?CallHandler) void {
    g_handler = handler;
}

/// Route the engine's state to a JS-owned cache (a Map). When unset, an
/// in-process map is used instead.
export fn rt_set_cache_handlers(get: ?StateGetFn, set: ?StateSetFn) void {
    g_get = get;
    g_set = set;
}

export fn rt_set_llm_handler(handler: ?LlmHandler) void {
    g_llm = handler;
}

/// Clear the state store between tests.
export fn rt_reset() void {
    var it = g_state.iterator();
    while (it.next()) |e| {
        c_allocator.free(e.key_ptr.*);
        c_allocator.free(e.value_ptr.*);
    }
    g_state.clearAndFree(c_allocator);
}

/// Run a compiled workflow `source` with `params` (JSON). Returns a malloc'd
/// JSON envelope `{ ok, result | error }`; release it with `rt_free`.
export fn rt_run(source: [*:0]const u8, params: [*:0]const u8, out_len: *usize) ?[*]u8 {
    const transport = vm.Transport{ .ctx = undefined, .call = mockCall, .get = mockGet, .set = mockSet, .log = mockLog, .llm = mockLlm };

    g_seq += 1;
    const exec_id = std.fmt.allocPrint(c_allocator, "test-{d}", .{g_seq}) catch return null;
    defer c_allocator.free(exec_id);

    const result = vm.run(c_allocator, c_allocator, transport, exec_id, std.mem.span(source), std.mem.span(params)) catch |e| {
        const env = std.fmt.allocPrint(c_allocator, "{{\"ok\":false,\"error\":\"vm: {s}\"}}", .{@errorName(e)}) catch return null;
        out_len.* = env.len;
        return env.ptr;
    };
    defer c_allocator.free(result.output);

    const envelope = if (result.ok)
        std.fmt.allocPrint(c_allocator, "{{\"ok\":true,\"result\":{s}}}", .{result.output}) catch return null
    else blk: {
        const ejson = vm.jsonStr(c_allocator, result.output) catch return null;
        defer c_allocator.free(ejson);
        break :blk std.fmt.allocPrint(c_allocator, "{{\"ok\":false,\"error\":{s}}}", .{ejson}) catch return null;
    };
    out_len.* = envelope.len;
    return envelope.ptr;
}

export fn rt_free(ptr: ?[*]u8, len: usize) void {
    if (ptr) |p| c_allocator.free(p[0..len]);
}

// ---- mock transport --------------------------------------------------------

fn mockCall(ctx: *anyopaque, a: std.mem.Allocator, service: []const u8, method: []const u8, body: []const u8) anyerror!vm.Reply {
    _ = ctx;
    const handler = g_handler orelse return error.NoCallHandler;
    const s = try a.dupeZ(u8, service);
    const m = try a.dupeZ(u8, method);
    const b = try a.dupeZ(u8, body);

    const ret = handler(s.ptr, m.ptr, b.ptr) orelse
        return .{ .ok = false, .status = 500, .body = try a.dupe(u8, "{\"error\":\"mock call handler threw\"}") };
    return .{ .ok = true, .status = 200, .body = try a.dupe(u8, std.mem.span(ret)) };
}

fn mockGet(ctx: *anyopaque, a: std.mem.Allocator, key: []const u8) anyerror!?[]const u8 {
    _ = ctx;
    if (g_get) |get| {
        const k = try a.dupeZ(u8, key);
        const ret = get(k.ptr) orelse return null;
        return try a.dupe(u8, std.mem.span(ret));
    }
    const v = g_state.get(key) orelse return null;
    return try a.dupe(u8, v);
}

fn mockSet(ctx: *anyopaque, a: std.mem.Allocator, key: []const u8, value: []const u8) anyerror!void {
    _ = ctx;
    if (g_set) |set| {
        const k = try a.dupeZ(u8, key);
        const v = try a.dupeZ(u8, value);
        set(k.ptr, v.ptr);
        return;
    }
    const gop = try g_state.getOrPut(c_allocator, key);
    if (gop.found_existing) {
        c_allocator.free(gop.value_ptr.*);
    } else {
        gop.key_ptr.* = try c_allocator.dupe(u8, key);
    }
    gop.value_ptr.* = try c_allocator.dupe(u8, value);
}

fn mockLog(ctx: *anyopaque, msg: []const u8) void {
    _ = ctx;
    std.debug.print("[wf] {s}\n", .{msg});
}

fn mockLlm(ctx: *anyopaque, a: std.mem.Allocator, request_json: []const u8) anyerror!vm.LlmReply {
    _ = ctx;
    const handler = g_llm orelse
        return .{ .ok = false, .body = try a.dupe(u8, "rt.llm: no mock llm handler registered") };
    const req = try a.dupeZ(u8, request_json);
    const ret = handler(req.ptr) orelse
        return .{ .ok = false, .body = try a.dupe(u8, "mock llm handler threw") };
    return .{ .ok = true, .body = try a.dupe(u8, std.mem.span(ret)) };
}
