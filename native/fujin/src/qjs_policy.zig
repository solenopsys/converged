const std = @import("std");

const EvalFn = *const fn ([*]const u8, usize, *?[*]u8, *usize) callconv(.c) c_int;
const FreeFn = *const fn (?[*]u8, usize) callconv(.c) void;

pub const Policy = struct {
    allocator: std.mem.Allocator,
    lib: std.DynLib,
    eval_fn: EvalFn,
    free_fn: FreeFn,
    source: []u8,
    mutex: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,

    pub fn init(allocator: std.mem.Allocator, path: []const u8, source_path: ?[]const u8) !Policy {
        var lib = try std.DynLib.open(path);
        errdefer lib.close();
        const source = if (source_path) |file|
            try std.Io.Dir.cwd().readFileAlloc(std.Options.debug_io, file, allocator, .limited(256 * 1024))
        else
            try allocator.dupe(u8, @embedFile("event_policy.js"));
        errdefer allocator.free(source);
        return .{
            .allocator = allocator,
            .lib = lib,
            .eval_fn = lib.lookup(EvalFn, "qjs_eval") orelse return error.QjsEvalSymbolMissing,
            .free_fn = lib.lookup(FreeFn, "qjs_free") orelse return error.QjsFreeSymbolMissing,
            .source = source,
        };
    }

    pub fn deinit(self: *Policy) void {
        self.lib.close();
        self.allocator.free(self.source);
        self.* = undefined;
    }

    /// QJS only receives a small JSON control event and returns a JSON signal.
    /// It never receives bulk ZMQ frames or socket handles.
    pub fn transform(self: *Policy, event_json: []const u8) ![]u8 {
        const script = try std.fmt.allocPrint(
            self.allocator,
            "{s}\n;(() => {{ const event = JSON.parse({f}); return JSON.stringify(onEvent(event)); }})()",
            .{ self.source, std.json.fmt(event_json, .{}) },
        );
        defer self.allocator.free(script);

        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        var out: ?[*]u8 = null;
        var out_len: usize = 0;
        const rc = self.eval_fn(script.ptr, script.len, &out, &out_len);
        defer self.free_fn(out, out_len);
        if (rc != 0) return error.PolicyEvaluationFailed;
        if (out) |value| return self.allocator.dupe(u8, value[0..out_len]);
        return self.allocator.dupe(u8, "");
    }
};
