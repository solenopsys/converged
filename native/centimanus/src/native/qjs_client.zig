const std = @import("std");

const EvalFn = *const fn (
    input: [*]const u8,
    input_len: usize,
    output_ptr: *?[*]u8,
    output_len: *usize,
) callconv(.c) c_int;
const FreeFn = *const fn (ptr: ?[*]u8, len: usize) callconv(.c) void;

const Mutex = struct {
    raw: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,

    fn lock(self: *Mutex) void {
        _ = std.c.pthread_mutex_lock(&self.raw);
    }

    fn unlock(self: *Mutex) void {
        _ = std.c.pthread_mutex_unlock(&self.raw);
    }
};

pub const EvalResult = struct {
    code: c_int,
    text: []u8,

    pub fn deinit(self: *EvalResult, allocator: std.mem.Allocator) void {
        allocator.free(self.text);
        self.* = undefined;
    }
};

/// Thin owner for the qjs wrapper's stable C ABI. Evaluations are serialized:
/// policy execution is control-plane work and must never contend with media
/// callbacks or rely on QuickJS runtime thread-safety.
pub const Client = struct {
    allocator: std.mem.Allocator,
    lib: std.DynLib,
    eval_fn: EvalFn,
    free_fn: FreeFn,
    mutex: Mutex = .{},

    pub fn init(allocator: std.mem.Allocator, path: []const u8) !Client {
        var lib = try std.DynLib.open(path);
        errdefer lib.close();

        return .{
            .allocator = allocator,
            .lib = lib,
            .eval_fn = lib.lookup(EvalFn, "qjs_eval") orelse return error.QjsEvalSymbolMissing,
            .free_fn = lib.lookup(FreeFn, "qjs_free") orelse return error.QjsFreeSymbolMissing,
        };
    }

    pub fn deinit(self: *Client) void {
        self.lib.close();
        self.* = undefined;
    }

    pub fn eval(self: *Client, source: []const u8) !EvalResult {
        self.mutex.lock();
        defer self.mutex.unlock();

        var out_ptr: ?[*]u8 = null;
        var out_len: usize = 0;
        const code = self.eval_fn(source.ptr, source.len, &out_ptr, &out_len);
        defer self.free_fn(out_ptr, out_len);

        if (code < 0) return error.QjsHostFailure;
        const text = if (out_ptr) |ptr|
            try self.allocator.dupe(u8, ptr[0..out_len])
        else
            try self.allocator.dupe(u8, "");
        return .{ .code = code, .text = text };
    }
};
