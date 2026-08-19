//! The native side of the policy boundary.
//!
//! JS receives one JSON document and returns one JSON document. It gets no
//! `kube.*`, no `fetch`, no timer: the single host call it can make returns
//! the reconcile input, and everything else it needs must already be in that
//! input. That is deliberate — it makes the policy a pure function, which is
//! what lets us run the same code in `ptah render` with no cluster at all.

const std = @import("std");
const qjs = @import("qjs.zig");

const bundle = @embedFile("policy.js");

/// Set for the duration of one `run` call so the `__host` bridge, which is a
/// C callback with no context pointer, can find the input. Reconciles are
/// serialised by the caller; the assertion in `hostBridge` guards that.
var g_input: ?[]const u8 = null;

fn hostBridge(
    arg: [*]const u8,
    arg_len: usize,
    out_ptr: *?[*]u8,
    out_len: *usize,
) callconv(.c) c_int {
    _ = arg;
    _ = arg_len;
    const input = g_input orelse {
        out_ptr.* = null;
        out_len.* = 0;
        return -1;
    };
    // The wrapper frees this with the C allocator, so it must come from there.
    const copy = std.heap.c_allocator.dupe(u8, input) catch {
        out_ptr.* = null;
        out_len.* = 0;
        return -1;
    };
    out_ptr.* = copy.ptr;
    out_len.* = copy.len;
    return 0;
}

pub const Output = struct {
    arena: std.heap.ArenaAllocator,
    /// Desired objects, in apply order.
    resources: []const std.json.Value,
    status: ?std.json.Value,
    requeue_after_ms: u64,
    /// False when the policy says its resource list is not the full desired
    /// state; the caller must then apply without pruning.
    prune: bool,

    pub fn deinit(self: *Output) void {
        self.arena.deinit();
    }
};

pub const Error = error{
    PolicyThrew,
    PolicyMalformedResult,
    PolicyRejected,
};

/// Run one reconcile. `input_json` is the serialised ReconcileInput; the
/// returned Output owns its own arena because the parsed JSON tree outlives
/// the evaluation buffer.
pub fn run(
    gpa: std.mem.Allocator,
    input_json: []const u8,
    err_out: *?[]const u8,
) !Output {
    err_out.* = null;

    // `__host` hands the input across instead of interpolating it into the
    // source: a 100 KB Tenant list would otherwise be re-parsed as JS source
    // text on every pass, and any escaping slip would be a syntax error.
    const script = try std.fmt.allocPrint(
        gpa,
        "{s}\n;globalThis.__ptah_reconcile(globalThis.__host(\"\"));",
        .{bundle},
    );
    defer gpa.free(script);

    g_input = input_json;
    defer g_input = null;
    qjs.setHostFn(&hostBridge);
    defer qjs.setHostFn(null);

    const result = try qjs.eval(gpa, script);
    defer gpa.free(result.output);

    if (result.is_exception) {
        err_out.* = try gpa.dupe(u8, result.output);
        return Error.PolicyThrew;
    }

    var arena = std.heap.ArenaAllocator.init(gpa);
    errdefer arena.deinit();
    const alloc = arena.allocator();

    const parsed = std.json.parseFromSliceLeaky(
        std.json.Value,
        alloc,
        result.output,
        .{},
    ) catch {
        err_out.* = try gpa.dupe(u8, result.output);
        return Error.PolicyMalformedResult;
    };

    const object = switch (parsed) {
        .object => |o| o,
        else => return Error.PolicyMalformedResult,
    };

    // The policy reports its own errors as data so a rule bug lands in a
    // status condition rather than crashing the controller.
    const ok = object.get("ok") orelse return Error.PolicyMalformedResult;
    if (ok != .bool or !ok.bool) {
        const message = object.get("error");
        err_out.* = try gpa.dupe(u8, if (message != null and message.? == .string)
            message.?.string
        else
            "policy rejected the input");
        return Error.PolicyRejected;
    }

    const empty: []const std.json.Value = &.{};
    const resources = if (object.get("resources")) |value| switch (value) {
        .array => |a| a.items,
        else => return Error.PolicyMalformedResult,
    } else empty;

    const requeue: u64 = if (object.get("requeueAfter")) |value| switch (value) {
        .integer => |i| if (i > 0) @intCast(i) else 0,
        .float => |f| if (f > 0) @intFromFloat(f) else 0,
        else => 0,
    } else 0;

    const prune = if (object.get("prune")) |value| switch (value) {
        .bool => |b| b,
        else => true,
    } else true;

    return .{
        .arena = arena,
        .resources = resources,
        .status = object.get("status"),
        .requeue_after_ms = requeue,
        .prune = prune,
    };
}
