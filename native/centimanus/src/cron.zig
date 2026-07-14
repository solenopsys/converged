//! Cron, the lean way: the scheduler **microservice** owns all the hard parts —
//! cron-expression parsing, timezones, pause/resume — and hands the RT an
//! already-formalised list of periods. Zig does the one thing it should: run a
//! dumb timer and launch workflows when their period elapses.
//!
//! Contract (scheduler MS): `sheduller.schedule()` returns
//!   { "items": [ { "script": "workflows/wf-markering.js",
//!                  "params": { ... }, "periodMs": 300000 }, ... ] }
//! No expressions reach Zig — only numbers and the script to run.

const std = @import("std");
const mscall = @import("mscall.zig");
const Engine = @import("engine.zig").Engine;

const tick_ms: i64 = 1000;
/// How often to re-pull the formalized schedule from the microservice.
const refresh_ms: i64 = 30_000;

const Entry = struct {
    script: []const u8,
    params_json: []const u8,
    period_ms: i64,
    next_due: i64,
};

pub const Scheduler = struct {
    gpa: std.mem.Allocator,
    engine: *Engine,

    pub fn init(gpa: std.mem.Allocator, engine: *Engine) Scheduler {
        return .{ .gpa = gpa, .engine = engine };
    }

    fn nowMs(self: *Scheduler) i64 {
        return std.Io.Timestamp.now(self.engine.io, .awake).toMilliseconds();
    }

    fn sleepMs(self: *Scheduler, ms: i64) void {
        self.engine.io.sleep(std.Io.Duration.fromMilliseconds(ms), .awake) catch {};
    }

    /// Background loop: pull periods from the scheduler MS, then tick and fire.
    pub fn run(self: *Scheduler) void {
        std.debug.print("centimanus: scheduler loop started\n", .{});
        while (true) {
            var arena = std.heap.ArenaAllocator.init(self.gpa);
            defer arena.deinit();

            const entries = self.fetchSchedule(arena.allocator()) catch |err| {
                std.debug.print("centimanus: scheduler fetch failed: {s} (retrying)\n", .{@errorName(err)});
                self.sleepMs(refresh_ms);
                continue;
            };

            const window_end = self.nowMs() + refresh_ms;
            while (self.nowMs() < window_end) {
                const now = self.nowMs();
                for (entries) |*e| {
                    if (now >= e.next_due) {
                        e.next_due = now + e.period_ms;
                        self.fire(e);
                    }
                }
                self.sleepMs(tick_ms);
            }
        }
    }

    fn fire(self: *Scheduler, e: *const Entry) void {
        var arena = std.heap.ArenaAllocator.init(self.gpa);
        defer arena.deinit();
        const res = self.engine.runWorkflow(arena.allocator(), e.script, e.params_json) catch |err| {
            std.debug.print("centimanus: scheduled {s} failed: {s}\n", .{ e.script, @errorName(err) });
            return;
        };
            std.debug.print("centimanus: scheduled {s} -> {s}\n", .{ e.script, if (res.ok) "ok" else "failed" });
    }

    /// Pull and parse the formalized schedule. Parsing an MS response (numbers +
    /// the script path) is dumb I/O — no scheduling logic lives here.
    fn fetchSchedule(self: *Scheduler, a: std.mem.Allocator) ![]Entry {
        const res = try mscall.call(self.engine.io, a, self.engine.services_base, "sheduller", "schedule", "{}");
        if (res.status < 200 or res.status >= 300) return error.ScheduleUnavailable;

        const parsed = try std.json.parseFromSliceLeaky(std.json.Value, a, res.body, .{});
        const items = switch (parsed) {
            .array => |x| x.items,
            .object => |o| switch (o.get("items") orelse return error.ScheduleInvalid) {
                .array => |x| x.items,
                else => return error.ScheduleInvalid,
            },
            else => return error.ScheduleInvalid,
        };

        const now = self.nowMs();
        var list = std.ArrayList(Entry).empty;
        for (items) |item| {
            const o = switch (item) {
                .object => |x| x,
                else => continue,
            };
            const script = strField(o, "script") orelse continue;
            const period = intField(o, "periodMs") orelse continue;
            if (period <= 0) continue;
            const params_val = o.get("params") orelse std.json.Value{ .object = .{} };
            const params_json = try std.json.Stringify.valueAlloc(a, params_val, .{});
            try list.append(a, .{
                .script = try a.dupe(u8, script),
                .params_json = params_json,
                .period_ms = period,
                .next_due = now + period,
            });
        }
        return list.toOwnedSlice(a);
    }
};

fn strField(o: std.json.ObjectMap, key: []const u8) ?[]const u8 {
    const v = o.get(key) orelse return null;
    return switch (v) {
        .string => |s| s,
        else => null,
    };
}

fn intField(o: std.json.ObjectMap, key: []const u8) ?i64 {
    const v = o.get(key) orelse return null;
    return switch (v) {
        .integer => |n| n,
        .float => |f| @intFromFloat(f),
        else => null,
    };
}
