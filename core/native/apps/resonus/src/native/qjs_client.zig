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

// ---- persistent runtime -----------------------------------------------------

/// Opaque handle to a wrapper-owned JSRuntime + JSContext.
const RuntimeHandle = opaque {};

const RtNewFn = *const fn () callconv(.c) ?*RuntimeHandle;
const RtFreeFn = *const fn (handle: ?*RuntimeHandle) callconv(.c) void;
const RtSetHostFn = *const fn (handle: ?*RuntimeHandle, f: ?HostFn, user: ?*anyopaque) callconv(.c) void;
const RtSetTimeoutFn = *const fn (handle: ?*RuntimeHandle, ms: u32) callconv(.c) void;
const RtLoadFn = *const fn (
    handle: ?*RuntimeHandle,
    src: [*]const u8,
    src_len: usize,
    filename: [*]const u8,
    filename_len: usize,
    output_ptr: *?[*]u8,
    output_len: *usize,
) callconv(.c) c_int;
const RtLoadBytecodeFn = *const fn (
    handle: ?*RuntimeHandle,
    bytecode: [*]const u8,
    bytecode_len: usize,
    output_ptr: *?[*]u8,
    output_len: *usize,
) callconv(.c) c_int;
const RtHasFnFn = *const fn (handle: ?*RuntimeHandle, name: [*]const u8, name_len: usize) callconv(.c) c_int;
const RtCallFn = *const fn (
    handle: ?*RuntimeHandle,
    name: [*]const u8,
    name_len: usize,
    arg: [*]const u8,
    arg_len: usize,
    output_ptr: *?[*]u8,
    output_len: *usize,
) callconv(.c) c_int;

/// Native callback reachable from JS as `globalThis.__host(arg)`. The reply must
/// be allocated with the C allocator; the wrapper copies it into a JS string and
/// frees it.
pub const HostFn = *const fn (
    user: ?*anyopaque,
    arg: [*]const u8,
    arg_len: usize,
    output_ptr: *?[*]u8,
    output_len: *usize,
) callconv(.c) c_int;

/// A long-lived JS runtime: the script is loaded once and its functions are
/// called per event, instead of recompiling the source on every evaluation the
/// way `Client` does.
///
/// **Thread affinity is a hard requirement.** QuickJS runtimes are not
/// thread-safe and neither this type nor the wrapper locks anything: a Runtime
/// belongs to the thread that created it, for its whole life. Concurrency comes
/// from one Runtime per worker thread — they share nothing, so nothing
/// serializes. This is exactly why `Client` cannot be reused here: its process
/// wide mutex would funnel every session through a single lock.
pub const Runtime = struct {
    allocator: std.mem.Allocator,
    lib: std.DynLib,
    handle: *RuntimeHandle,
    rt_free: RtFreeFn,
    rt_set_host_fn: RtSetHostFn,
    rt_set_timeout_ms: RtSetTimeoutFn,
    rt_load: RtLoadFn,
    rt_load_bytecode: RtLoadBytecodeFn,
    rt_has_fn: RtHasFnFn,
    rt_call: RtCallFn,
    free_fn: FreeFn,

    /// Opens the wrapper and creates one runtime. The library is dlopen'd per
    /// Runtime; the loader refcounts the mapping, so N worker threads share one
    /// copy of the .so while each keeps its own JSRuntime.
    pub fn open(allocator: std.mem.Allocator, path: []const u8) !Runtime {
        var lib = try std.DynLib.open(path);
        errdefer lib.close();

        // Resolve every symbol before creating the runtime: a handle allocated
        // ahead of a failed lookup would have no way back to `qjs_rt_free`.
        const rt_new = lib.lookup(RtNewFn, "qjs_rt_new") orelse return error.QjsRuntimeSymbolMissing;
        const rt_free = lib.lookup(RtFreeFn, "qjs_rt_free") orelse return error.QjsRuntimeSymbolMissing;

        const handle = rt_new() orelse return error.QjsRuntimeCreateFailed;
        errdefer rt_free(handle);

        return .{
            .allocator = allocator,
            .lib = lib,
            .handle = handle,
            .rt_free = rt_free,
            .rt_set_host_fn = lib.lookup(RtSetHostFn, "qjs_rt_set_host_fn") orelse return error.QjsRuntimeSymbolMissing,
            .rt_set_timeout_ms = lib.lookup(RtSetTimeoutFn, "qjs_rt_set_timeout_ms") orelse return error.QjsRuntimeSymbolMissing,
            .rt_load = lib.lookup(RtLoadFn, "qjs_rt_load") orelse return error.QjsRuntimeSymbolMissing,
            .rt_load_bytecode = lib.lookup(RtLoadBytecodeFn, "qjs_rt_load_bytecode") orelse return error.QjsRuntimeSymbolMissing,
            .rt_has_fn = lib.lookup(RtHasFnFn, "qjs_rt_has_fn") orelse return error.QjsRuntimeSymbolMissing,
            .rt_call = lib.lookup(RtCallFn, "qjs_rt_call") orelse return error.QjsRuntimeSymbolMissing,
            .free_fn = lib.lookup(FreeFn, "qjs_free") orelse return error.QjsFreeSymbolMissing,
        };
    }

    pub fn deinit(self: *Runtime) void {
        self.rt_free(self.handle);
        self.lib.close();
        self.* = undefined;
    }

    /// Install the `__host` callback for this runtime only.
    pub fn setHostFn(self: *Runtime, f: ?HostFn, user: ?*anyopaque) void {
        self.rt_set_host_fn(self.handle, f, user);
    }

    /// Per-call execution budget; `0` restores the wrapper default (100 ms).
    pub fn setTimeoutMs(self: *Runtime, ms: u32) void {
        self.rt_set_timeout_ms(self.handle, ms);
    }

    /// Evaluate source once, keeping every definition it installs.
    pub fn load(self: *Runtime, source: []const u8, filename: []const u8) !void {
        var out_ptr: ?[*]u8 = null;
        var out_len: usize = 0;
        const code = self.rt_load(self.handle, source.ptr, source.len, filename.ptr, filename.len, &out_ptr, &out_len);
        defer self.free_fn(out_ptr, out_len);
        return self.checkLoad(code, out_ptr, out_len, filename);
    }

    /// Load bytecode produced by `qjs_rt_compile` against this same wrapper
    /// build. Bytecode from a different QuickJS build is not loadable.
    pub fn loadBytecode(self: *Runtime, bytecode: []const u8, label: []const u8) !void {
        var out_ptr: ?[*]u8 = null;
        var out_len: usize = 0;
        const code = self.rt_load_bytecode(self.handle, bytecode.ptr, bytecode.len, &out_ptr, &out_len);
        defer self.free_fn(out_ptr, out_len);
        return self.checkLoad(code, out_ptr, out_len, label);
    }

    fn checkLoad(self: *Runtime, code: c_int, out_ptr: ?[*]u8, out_len: usize, label: []const u8) !void {
        _ = self;
        if (code == 0) return;
        const detail = if (out_ptr) |p| p[0..out_len] else "no detail reported";
        if (code < 0) {
            std.log.err("qjs: host failure loading {s}", .{label});
            return error.QjsHostFailure;
        }
        std.log.err("qjs: {s} failed to load: {s}", .{ label, detail });
        return error.QjsScriptFailed;
    }

    /// Reports whether `globalThis[name]` is callable — used to validate a
    /// module's shape at load time rather than on the first event.
    pub fn hasFn(self: *Runtime, name: []const u8) bool {
        return self.rt_has_fn(self.handle, name.ptr, name.len) == 1;
    }

    /// Call `globalThis[name](arg)`. Argument and result are opaque UTF-8: the
    /// script owns any JSON encoding. The returned text is caller-owned.
    pub fn call(self: *Runtime, name: []const u8, arg: []const u8) !EvalResult {
        var out_ptr: ?[*]u8 = null;
        var out_len: usize = 0;
        const code = self.rt_call(self.handle, name.ptr, name.len, arg.ptr, arg.len, &out_ptr, &out_len);
        defer self.free_fn(out_ptr, out_len);

        if (code < 0) return error.QjsHostFailure;
        const text = if (out_ptr) |ptr|
            try self.allocator.dupe(u8, ptr[0..out_len])
        else
            try self.allocator.dupe(u8, "");
        return .{ .code = code, .text = text };
    }
};
