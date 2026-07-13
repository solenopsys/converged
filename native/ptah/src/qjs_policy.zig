const std = @import("std");
const Mutex = @import("sync.zig").Mutex;
const json_util = @import("json.zig");

const EvalFn = *const fn (
    input: [*]const u8,
    input_len: usize,
    output_ptr: *?[*]u8,
    output_len: *usize,
) callconv(.c) c_int;
const FreeFn = *const fn (ptr: ?[*]u8, len: usize) callconv(.c) void;

pub const TaskAction = enum { start, @"defer", cancel };
pub const IdleAction = enum { keep, unload };

/// A policy is deliberately a control plane. It receives task metadata and a
/// JSON payload string, then returns a small declarative action. It never sees
/// wrapper pointers or can call C/C++ code directly.
pub const Policy = struct {
    allocator: std.mem.Allocator,
    source: []u8,
    lib: ?std.DynLib = null,
    eval_fn: ?EvalFn = null,
    free_fn: ?FreeFn = null,
    mutex: Mutex = .{},

    pub fn init(
        allocator: std.mem.Allocator,
        source: []const u8,
        qjs_path: ?[]const u8,
    ) !Policy {
        var policy = Policy{
            .allocator = allocator,
            .source = try allocator.dupe(u8, source),
        };
        errdefer allocator.free(policy.source);

        if (qjs_path) |path| {
            var lib = try std.DynLib.open(path);
            errdefer lib.close();
            policy.eval_fn = lib.lookup(EvalFn, "qjs_eval") orelse return error.QjsEvalSymbolMissing;
            policy.free_fn = lib.lookup(FreeFn, "qjs_free") orelse return error.QjsFreeSymbolMissing;
            policy.lib = lib;
        }
        return policy;
    }

    pub fn deinit(self: *Policy) void {
        if (self.lib) |*lib| lib.close();
        self.allocator.free(self.source);
        self.* = undefined;
    }

    pub fn decideTask(self: *Policy, id: u64, plugin_name: []const u8, payload: []const u8) !TaskAction {
        if (self.eval_fn == null) return .start;
        const name_json = try json_util.jsonString(self.allocator, plugin_name);
        defer self.allocator.free(name_json);
        const payload_json = try json_util.jsonString(self.allocator, payload);
        defer self.allocator.free(payload_json);
        const event = try std.fmt.allocPrint(self.allocator,
            "{{\"id\":{d},\"plugin\":{s},\"payload\":{s}}}",
            .{ id, name_json, payload_json },
        );
        defer self.allocator.free(event);
        const result = try self.invoke("onTask", event);
        defer self.allocator.free(result);
        return parseTaskAction(self.allocator, result);
    }

    pub fn decideIdle(self: *Policy, plugin_name: []const u8, idle_ms: u64) !IdleAction {
        if (self.eval_fn == null) return .unload;
        const name_json = try json_util.jsonString(self.allocator, plugin_name);
        defer self.allocator.free(name_json);
        const event = try std.fmt.allocPrint(self.allocator,
            "{{\"plugin\":{s},\"idleMs\":{d}}}",
            .{ name_json, idle_ms },
        );
        defer self.allocator.free(event);
        const result = try self.invoke("onIdle", event);
        defer self.allocator.free(result);
        return parseIdleAction(self.allocator, result);
    }

    fn invoke(self: *Policy, function_name: []const u8, event_json: []const u8) ![]u8 {
        const source = try std.fmt.allocPrint(self.allocator,
            "{s}\n;(() => {{ if (typeof {s} !== 'function') throw new Error('missing {s}'); return JSON.stringify({s}({s})); }})()",
            .{ self.source, function_name, function_name, function_name, event_json },
        );
        defer self.allocator.free(source);

        self.mutex.lock();
        defer self.mutex.unlock();
        var out_ptr: ?[*]u8 = null;
        var out_len: usize = 0;
        const code = self.eval_fn.?(source.ptr, source.len, &out_ptr, &out_len);
        defer self.free_fn.?(out_ptr, out_len);
        if (code != 0) return error.PolicyEvaluationFailed;
        if (out_ptr) |ptr| return self.allocator.dupe(u8, ptr[0..out_len]);
        return self.allocator.dupe(u8, "");
    }
};

fn parseTaskAction(allocator: std.mem.Allocator, input: []const u8) !TaskAction {
    var parsed = try std.json.parseFromSlice(std.json.Value, allocator, input, .{});
    defer parsed.deinit();
    const object = switch (parsed.value) {
        .object => |value| value,
        else => return error.InvalidJsonObject,
    };
    const action = json_util.stringField(object, "action") orelse return error.PolicyActionMissing;
    if (std.mem.eql(u8, action, "start")) return .start;
    if (std.mem.eql(u8, action, "defer")) return .@"defer";
    if (std.mem.eql(u8, action, "cancel")) return .cancel;
    return error.PolicyActionInvalid;
}

fn parseIdleAction(allocator: std.mem.Allocator, input: []const u8) !IdleAction {
    var parsed = try std.json.parseFromSlice(std.json.Value, allocator, input, .{});
    defer parsed.deinit();
    const object = switch (parsed.value) {
        .object => |value| value,
        else => return error.InvalidJsonObject,
    };
    const action = json_util.stringField(object, "action") orelse return error.PolicyActionMissing;
    if (std.mem.eql(u8, action, "unload")) return .unload;
    if (std.mem.eql(u8, action, "keep")) return .keep;
    return error.PolicyActionInvalid;
}
