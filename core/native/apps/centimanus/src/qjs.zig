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
