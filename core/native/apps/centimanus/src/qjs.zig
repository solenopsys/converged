//! Thin Zig view of libqjs.so (the QuickJS-ng wrapper under native/wrapers/qjs).
//!
//! The wrapper gives us exactly three primitives: evaluate a script, free its
//! result, and install one host callback reachable from JS as `globalThis.__host`.
//! That is all the VM needs — JS owns flow, Zig owns every host primitive.

const std = @import("std");

/// Native callback exposed to JS as `globalThis.__host(arg) -> string`. It must
/// publish its UTF-8 reply via (out_ptr,out_len) allocated with the C allocator;
/// the wrapper copies it into a JS string and frees it.
pub const HostFn = *const fn (
    arg: [*]const u8,
    arg_len: usize,
    out_ptr: *?[*]u8,
    out_len: *usize,
) callconv(.c) c_int;

pub extern fn qjs_eval(
    input: [*]const u8,
    input_len: usize,
    output_ptr: *?[*]u8,
    output_len: *usize,
) c_int;
pub extern fn qjs_free(ptr: ?[*]u8, len: usize) void;
pub extern fn qjs_set_host_fn(f: ?HostFn) void;

pub const EvalResult = struct {
    /// true when JS raised an exception (output holds the exception text).
    is_exception: bool,
    /// Caller-owned copy of the script result (or exception text).
    output: []u8,
};

/// Evaluate `script`, copying the engine-owned result into `alloc` so the
/// library buffer can be released immediately.
pub fn eval(alloc: std.mem.Allocator, script: []const u8) !EvalResult {
    var out_ptr: ?[*]u8 = null;
    var out_len: usize = 0;
    const rc = qjs_eval(script.ptr, script.len, &out_ptr, &out_len);
    defer qjs_free(out_ptr, out_len);

    const copy = if (out_ptr) |p| try alloc.dupe(u8, p[0..out_len]) else try alloc.dupe(u8, "");
    return .{ .is_exception = rc != 0, .output = copy };
}

pub fn setHostFn(f: ?HostFn) void {
    qjs_set_host_fn(f);
}

// ---- persistent runtime -----------------------------------------------------

/// Same contract as `HostFn` plus the opaque pointer registered beside it, so
/// one process can serve several runtimes without routing through a global.
pub const RuntimeHostFn = *const fn (
    user: ?*anyopaque,
    arg: [*]const u8,
    arg_len: usize,
    out_ptr: *?[*]u8,
    out_len: *usize,
) callconv(.c) c_int;

const RuntimeHandle = opaque {};

extern fn qjs_rt_new() ?*RuntimeHandle;
extern fn qjs_rt_free(handle: ?*RuntimeHandle) void;
extern fn qjs_rt_set_host_fn(handle: ?*RuntimeHandle, f: ?RuntimeHostFn, user: ?*anyopaque) void;
extern fn qjs_rt_set_timeout_ms(handle: ?*RuntimeHandle, ms: u32) void;
extern fn qjs_rt_load(
    handle: ?*RuntimeHandle,
    src: [*]const u8,
    src_len: usize,
    filename: [*]const u8,
    filename_len: usize,
    output_ptr: *?[*]u8,
    output_len: *usize,
) c_int;
extern fn qjs_rt_call(
    handle: ?*RuntimeHandle,
    name: [*]const u8,
    name_len: usize,
    arg: [*]const u8,
    arg_len: usize,
    output_ptr: *?[*]u8,
    output_len: *usize,
) c_int;

/// One QuickJS runtime kept alive across calls: the program is compiled once
/// and its globals stay installed, so calling an entry point again costs a
/// function call instead of a full parse of the source.
pub const Runtime = struct {
    handle: *RuntimeHandle,

    pub fn init() !Runtime {
        return .{ .handle = qjs_rt_new() orelse return error.QjsRuntimeUnavailable };
    }

    pub fn deinit(self: Runtime) void {
        qjs_rt_free(self.handle);
    }

    pub fn setHostFn(self: Runtime, f: ?RuntimeHostFn, user: ?*anyopaque) void {
        qjs_rt_set_host_fn(self.handle, f, user);
    }

    /// Per-call execution budget. Time spent blocked in `__host` does not count
    /// against it, so this bounds the script's own compute only.
    pub fn setTimeoutMs(self: Runtime, ms: u32) void {
        qjs_rt_set_timeout_ms(self.handle, ms);
    }

    /// Evaluate `source` in the global scope, keeping everything it defines.
    /// Returns null on success, or the exception text copied into `alloc`.
    pub fn load(self: Runtime, alloc: std.mem.Allocator, source: []const u8, name: []const u8) !?[]u8 {
        var out_ptr: ?[*]u8 = null;
        var out_len: usize = 0;
        const rc = qjs_rt_load(self.handle, source.ptr, source.len, name.ptr, name.len, &out_ptr, &out_len);
        defer qjs_free(out_ptr, out_len);
        if (rc == 0) return null;
        if (out_ptr) |p| return try alloc.dupe(u8, p[0..out_len]);
        return try alloc.dupe(u8, "qjs: load failed");
    }

    /// Call `globalThis[name](arg)` and copy its result out of the library.
    pub fn call(self: Runtime, alloc: std.mem.Allocator, name: []const u8, arg: []const u8) !EvalResult {
        var out_ptr: ?[*]u8 = null;
        var out_len: usize = 0;
        const rc = qjs_rt_call(self.handle, name.ptr, name.len, arg.ptr, arg.len, &out_ptr, &out_len);
        defer qjs_free(out_ptr, out_len);
        const copy = if (out_ptr) |p| try alloc.dupe(u8, p[0..out_len]) else try alloc.dupe(u8, "");
        return .{ .is_exception = rc != 0, .output = copy };
    }
};
