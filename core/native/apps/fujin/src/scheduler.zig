//! The schedule ticker.
//!
//! It runs inside the Fujin process for one reason only: Fujin is the component
//! there is exactly one of, and a schedule needs a single clock. Everything else
//! about it is an ordinary participant of the cluster — it opens its own DEALER
//! connection to Fujin like any other peer, registers a target of its own and
//! speaks plain NRPC:
//!
//!     sheduller.schedule()  →  when things are due
//!     bus.publish()         →  the event, once one is
//!
//! Nothing here reaches into the router's internals, and the broker gained no
//! request/response machinery to support it: the messaging layer already has
//! all of that, and the business layer sits on top of it. The practical payoff
//! is that moving this thread into its own process later — which is what a
//! Raft-elected leader among several Fujin nodes would want — changes where it
//! runs and nothing about what it does.
//!
//! Cron expressions never arrive here. `rp-sheduller` interprets them with a
//! real cron library and answers with absolute instants; this file compares
//! numbers.

const std = @import("std");
const transport = @import("transport");

/// How often the plan is re-read. The horizon asked for is twice this, so a
/// poll that fails still leaves the next one time to catch the same occurrence.
const default_refresh_ms: i64 = 30_000;
const tick_ms: i64 = 1_000;

/// Fired occurrences remembered, so overlapping plans do not double-fire. One
/// entry per firing; a few hundred covers any sane schedule density.
const dedup_capacity: usize = 512;

pub const Config = struct {
    /// Where this client connects. Fujin's own bind address is a listen
    /// address, which is not necessarily connectable, so it is derived (or
    /// stated) separately.
    endpoint: [:0]const u8,
    target: []const u8,
    scope: []const u8,
    auth: []const u8,
    refresh_ms: i64 = default_refresh_ms,
};

const Occurrence = struct {
    cron_id: []const u8,
    name: []const u8,
    topic: []const u8,
    provider: []const u8,
    action: []const u8,
    payload_json: []const u8,
    at: i64,
};

pub const Scheduler = struct {
    gpa: std.mem.Allocator,
    runtime: *transport.Runtime,
    config: Config,
    fired: std.ArrayList([]u8) = .empty,

    pub fn init(gpa: std.mem.Allocator, runtime: *transport.Runtime, config: Config) Scheduler {
        return .{ .gpa = gpa, .runtime = runtime, .config = config };
    }

    pub fn deinit(self: *Scheduler) void {
        for (self.fired.items) |key| self.gpa.free(key);
        self.fired.deinit(self.gpa);
        self.* = undefined;
    }

    /// Background loop: read the plan, tick through the window, repeat.
    pub fn run(self: *Scheduler) void {
        // The reactor has to be armed before the first call, or the frame races
        // the socket during startup.
        while (!self.runtime.isRunning()) sleepMs(50);
        std.log.info("scheduler started target={s} endpoint={s}", .{ self.config.target, self.config.endpoint });

        while (true) {
            var arena = std.heap.ArenaAllocator.init(self.gpa);
            defer arena.deinit();

            const plan = self.fetch(arena.allocator()) catch |err| {
                std.log.warn("scheduler plan unavailable: {s} (retrying)", .{@errorName(err)});
                sleepMs(self.config.refresh_ms);
                continue;
            };

            const window_end = milliTimestamp() + self.config.refresh_ms;
            while (milliTimestamp() < window_end) {
                const now = milliTimestamp();
                for (plan) |occurrence| {
                    if (occurrence.at > now) continue;
                    // Already past when the plan arrived, or already fired from
                    // an earlier overlapping window: either way, not again.
                    if (self.alreadyFired(occurrence)) continue;
                    self.fire(occurrence);
                }
                sleepMs(tick_ms);
            }
        }
    }

    fn fetch(self: *Scheduler, allocator: std.mem.Allocator) ![]Occurrence {
        const body = try std.fmt.allocPrint(allocator, "{{\"params\":{{\"horizonMs\":{d}}}}}", .{self.config.refresh_ms * 2});
        var reply = try self.runtime.call(allocator, .{
            .service = "sheduller",
            .method = "schedule",
            .scope = self.config.scope,
            .auth = self.config.auth,
            .body = body,
        });
        defer reply.deinit(allocator);
        if (!reply.ok()) return error.ScheduleUnavailable;
        return parse(allocator, reply.body);
    }

    fn fire(self: *Scheduler, occurrence: Occurrence) void {
        var arena = std.heap.ArenaAllocator.init(self.gpa);
        defer arena.deinit();
        const allocator = arena.allocator();

        // `dedupKey` travels with the event rather than staying in this
        // process: a consumer can then drop a repeat on its own, which is what
        // keeps a future two-leader moment from turning into two invoices.
        const body = std.fmt.allocPrint(
            allocator,
            "{{\"event\":{{\"name\":{s},\"source\":\"cron\",\"dedupKey\":\"{s}:{d}\",\"scope\":{s},\"payload\":{s}}}}}",
            .{
                quote(allocator, occurrence.topic) catch return,
                occurrence.cron_id,
                occurrence.at,
                quote(allocator, self.config.scope) catch return,
                occurrence.payload_json,
            },
        ) catch return;

        var reply = self.runtime.call(allocator, .{
            .target = "fujin",
            .service = "bus",
            .method = "publish",
            .scope = self.config.scope,
            .auth = self.config.auth,
            .body = body,
        }) catch |err| {
            std.log.warn("scheduler could not publish {s}: {s}", .{ occurrence.topic, @errorName(err) });
            return;
        };
        defer reply.deinit(allocator);

        const ok = reply.ok();
        std.log.info("scheduled {s} at={d} -> {s}", .{ occurrence.topic, occurrence.at, if (ok) "published" else reply.error_code });
        self.remember(occurrence);
        self.record(allocator, occurrence, ok, if (ok) reply.body else reply.error_code);
    }

    /// History is observability, not state: a failure to write it is logged and
    /// the schedule carries on.
    fn record(self: *Scheduler, allocator: std.mem.Allocator, occurrence: Occurrence, ok: bool, message: []const u8) void {
        const body = std.fmt.allocPrint(
            allocator,
            "{{\"entry\":{{\"cronId\":{s},\"cronName\":{s},\"provider\":{s},\"action\":{s},\"success\":{},\"message\":{s}}}}}",
            .{
                quote(allocator, occurrence.cron_id) catch return,
                quote(allocator, occurrence.name) catch return,
                quote(allocator, occurrence.provider) catch return,
                quote(allocator, occurrence.action) catch return,
                ok,
                quote(allocator, message) catch return,
            },
        ) catch return;
        var reply = self.runtime.call(allocator, .{
            .service = "sheduller",
            .method = "recordHistory",
            .scope = self.config.scope,
            .auth = self.config.auth,
            .body = body,
        }) catch |err| {
            std.log.debug("scheduler history not recorded: {s}", .{@errorName(err)});
            return;
        };
        reply.deinit(allocator);
    }

    fn alreadyFired(self: *Scheduler, occurrence: Occurrence) bool {
        var buffer: [128]u8 = undefined;
        const key = dedupKey(&buffer, occurrence) orelse return false;
        for (self.fired.items) |seen| {
            if (std.mem.eql(u8, seen, key)) return true;
        }
        return false;
    }

    fn remember(self: *Scheduler, occurrence: Occurrence) void {
        var buffer: [128]u8 = undefined;
        const key = dedupKey(&buffer, occurrence) orelse return;
        const owned = self.gpa.dupe(u8, key) catch return;
        if (self.fired.items.len >= dedup_capacity) {
            const oldest = self.fired.orderedRemove(0);
            self.gpa.free(oldest);
        }
        self.fired.append(self.gpa, owned) catch self.gpa.free(owned);
    }
};

fn dedupKey(buffer: *[128]u8, occurrence: Occurrence) ?[]const u8 {
    return std.fmt.bufPrint(buffer, "{s}:{d}", .{ occurrence.cron_id, occurrence.at }) catch null;
}

fn parse(allocator: std.mem.Allocator, body: []const u8) ![]Occurrence {
    const parsed = try std.json.parseFromSliceLeaky(std.json.Value, allocator, body, .{});
    const items = switch (parsed) {
        .object => |object| switch (object.get("items") orelse return error.ScheduleInvalid) {
            .array => |value| value.items,
            else => return error.ScheduleInvalid,
        },
        .array => |value| value.items,
        else => return error.ScheduleInvalid,
    };

    var list: std.ArrayList(Occurrence) = .empty;
    for (items) |item| {
        const object = switch (item) {
            .object => |value| value,
            else => continue,
        };
        const topic = stringField(object, "topic") orelse continue;
        const cron_id = stringField(object, "cronId") orelse continue;
        const payload = object.get("payload") orelse std.json.Value{ .object = .empty };
        const payload_object: std.json.ObjectMap = if (payload == .object) payload.object else .empty;
        const payload_json = try std.json.Stringify.valueAlloc(allocator, payload, .{});
        const occurrences = switch (object.get("occurrences") orelse continue) {
            .array => |value| value.items,
            else => continue,
        };
        for (occurrences) |moment| {
            const at = switch (moment) {
                .integer => |number| number,
                .float => |number| @as(i64, @intFromFloat(number)),
                else => continue,
            };
            try list.append(allocator, .{
                .cron_id = cron_id,
                .name = stringField(object, "name") orelse topic,
                .topic = topic,
                // Kept for the history row: what the schedule was configured as
                // before it became a plain event source.
                .provider = stringField(payload_object, "provider") orelse "bus",
                .action = stringField(payload_object, "action") orelse "publish",
                .payload_json = payload_json,
                .at = at,
            });
        }
    }
    return list.toOwnedSlice(allocator);
}

fn stringField(object: std.json.ObjectMap, key: []const u8) ?[]const u8 {
    const value = object.get(key) orelse return null;
    return switch (value) {
        .string => |text| text,
        else => null,
    };
}

fn quote(allocator: std.mem.Allocator, value: []const u8) ![]u8 {
    return std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = value }, .{});
}

fn milliTimestamp() i64 {
    var ts: std.c.timespec = undefined;
    _ = std.c.clock_gettime(.REALTIME, &ts);
    return ts.sec * std.time.ms_per_s + @divFloor(ts.nsec, std.time.ns_per_ms);
}

fn sleepMs(ms: i64) void {
    std.Options.debug_io.sleep(std.Io.Duration.fromMilliseconds(ms), .awake) catch {};
}

test "a plan becomes one occurrence per instant" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const body =
        \\{"items":[
        \\{"cronId":"c1","name":"Nightly","topic":"cron.nightly","payload":{"provider":"dag","action":"runWorkflow"},"occurrences":[1000,2000]},
        \\{"cronId":"c2","name":"Broken"},
        \\{"cronId":"c3","name":"Hourly","topic":"cron.hourly","occurrences":[5000]}
        \\],"horizonMs":60000}
    ;
    const plan = try parse(arena.allocator(), body);
    try std.testing.expectEqual(@as(usize, 3), plan.len);
    try std.testing.expectEqualStrings("cron.nightly", plan[0].topic);
    try std.testing.expectEqual(@as(i64, 1000), plan[0].at);
    try std.testing.expectEqual(@as(i64, 2000), plan[1].at);
    try std.testing.expectEqualStrings("dag", plan[0].provider);
    // No configured provider: the history row still says something true.
    try std.testing.expectEqualStrings("bus", plan[2].provider);
    try std.testing.expectEqualStrings("cron.hourly", plan[2].topic);
}

test "an occurrence fires once even when it appears in several plans" {
    var scheduler = Scheduler.init(std.testing.allocator, undefined, .{
        .endpoint = "tcp://127.0.0.1:5557",
        .target = "scheduler",
        .scope = "club",
        .auth = "",
    });
    defer scheduler.deinit();
    const occurrence = Occurrence{
        .cron_id = "c1",
        .name = "Nightly",
        .topic = "cron.nightly",
        .provider = "dag",
        .action = "runWorkflow",
        .payload_json = "{}",
        .at = 1000,
    };
    try std.testing.expect(!scheduler.alreadyFired(occurrence));
    scheduler.remember(occurrence);
    try std.testing.expect(scheduler.alreadyFired(occurrence));

    var later = occurrence;
    later.at = 2000;
    try std.testing.expect(!scheduler.alreadyFired(later));
}
