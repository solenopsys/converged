//! Zig view of libqjs.so, the QuickJS-ng wrapper under navite/wrappers/rt/qjs.
//!
//! The wrapper exposes exactly three symbols. Each `qjs_eval` builds a fresh
//! runtime bounded to 16 MiB and 100 ms, which is why the policy is evaluated
//! per reconcile rather than kept resident: isolation is the wrapper's whole
//! point, and a leaked global between two reconciles would be a correctness
//! bug we could not see.

const std = @import("std");

/// Reachable from JS as `globalThis.__host(arg) -> string`. The reply must be
/// allocated with the C allocator; the wrapper copies and frees it.
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

pub const Result = struct {
    /// true when JS raised; `output` then holds the exception text.
    is_exception: bool,
    output: []u8,
};

pub fn eval(gpa: std.mem.Allocator, script: []const u8) !Result {
    var out_ptr: ?[*]u8 = null;
    var out_len: usize = 0;
    const rc = qjs_eval(script.ptr, script.len, &out_ptr, &out_len);
    defer qjs_free(out_ptr, out_len);
    if (rc < 0) return error.QjsHostFailure;

    const copy = if (out_ptr) |p| try gpa.dupe(u8, p[0..out_len]) else try gpa.dupe(u8, "");
    return .{ .is_exception = rc != 0, .output = copy };
}

pub fn setHostFn(f: ?HostFn) void {
    qjs_set_host_fn(f);
}
