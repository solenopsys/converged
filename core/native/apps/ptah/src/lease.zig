//! Leader election over a coordination.k8s.io Lease.
//!
//! Two ptah pods applying the same desired state would be harmless most of
//! the time — server-side apply is idempotent — but not during a prune, where
//! a stale pod could delete what a fresh one just created. So the loop only
//! runs while we hold the lease.

const std = @import("std");
const kube = @import("kube.zig");

pub const lease_name = "ptah";
pub const duration_seconds: u64 = 30;
const duration_ms: i64 = duration_seconds * 1000;

/// Renewal deadline in epoch milliseconds.
///
/// `spec.renewTime` is written too, because that is what kubectl and every
/// other tool reads, but we compare against this annotation instead: parsing
/// RFC3339 back into an instant is the kind of code that is quietly wrong for
/// a year, and an integer cannot be misread.
const renewed_at = "ptah.io/renewed-at-ms";

fn nowMs() i64 {
    var ts: std.c.timespec = undefined;
    _ = std.c.clock_gettime(.REALTIME, &ts);
    return @as(i64, ts.sec) * 1000 + @divTrunc(ts.nsec, std.time.ns_per_ms);
}

/// RFC3339 with microseconds, the format the Lease type expects.
fn formatRenewTime(gpa: std.mem.Allocator, ms: i64) ![]u8 {
    const secs: u64 = @intCast(@divFloor(ms, 1000));
    const epoch = std.time.epoch.EpochSeconds{ .secs = secs };
    const day = epoch.getEpochDay();
    const year_day = day.calculateYearDay();
    const month_day = year_day.calculateMonthDay();
    const time = epoch.getDaySeconds();
    return std.fmt.allocPrint(
        gpa,
        "{d:0>4}-{d:0>2}-{d:0>2}T{d:0>2}:{d:0>2}:{d:0>2}.000000Z",
        .{
            year_day.year,
            month_day.month.numeric(),
            month_day.day_index + 1,
            time.getHoursIntoDay(),
            time.getMinutesIntoHour(),
            time.getSecondsIntoMinute(),
        },
    );
}

fn resource() kube.Resource {
    return kube.lookup("coordination.k8s.io/v1", "Lease").?;
}

/// Inspect the current holder. Returns true when the lease is ours to take:
/// either nobody holds it, we already do, or the holder's deadline has passed.
fn available(gpa: std.mem.Allocator, body: []const u8, identity: []const u8) bool {
    const parsed = std.json.parseFromSlice(std.json.Value, gpa, body, .{}) catch return false;
    defer parsed.deinit();

    const object = switch (parsed.value) {
        .object => |o| o,
        else => return false,
    };
    const spec = switch (object.get("spec") orelse return true) {
        .object => |o| o,
        else => return true,
    };
    const holder = switch (spec.get("holderIdentity") orelse return true) {
        .string => |s| s,
        else => return true,
    };
    if (std.mem.eql(u8, holder, identity)) return true;

    const meta = switch (object.get("metadata") orelse return false) {
        .object => |o| o,
        else => return false,
    };
    const annotations = switch (meta.get("annotations") orelse return false) {
        .object => |o| o,
        else => return false,
    };
    const stamp = switch (annotations.get(renewed_at) orelse return false) {
        .string => |s| s,
        else => return false,
    };
    const last = std.fmt.parseInt(i64, stamp, 10) catch return false;
    // An expired holder is a crashed holder. Taking over after the full
    // duration is the whole point of the deadline.
    return nowMs() - last > duration_ms;
}

/// Try to hold the lease for another period. Returns true when we are leader.
pub fn acquire(
    gpa: std.mem.Allocator,
    client: *kube.Client,
    namespace: []const u8,
    identity: []const u8,
) !bool {
    const res = resource();

    var current = try client.get(gpa, res, namespace, lease_name);
    defer current.deinit(gpa);
    if (current.ok() and !available(gpa, current.body, identity)) return false;
    if (!current.ok() and current.status != 404) {
        std.log.warn("lease read failed: {d} {s}", .{ current.status, current.body });
        return false;
    }

    const now = nowMs();
    const renew_time = try formatRenewTime(gpa, now);
    defer gpa.free(renew_time);

    const body = try std.fmt.allocPrint(gpa,
        \\{{"apiVersion":"coordination.k8s.io/v1","kind":"Lease",
        \\"metadata":{{"name":"{s}","namespace":"{s}","annotations":{{"{s}":"{d}"}}}},
        \\"spec":{{"holderIdentity":"{s}","leaseDurationSeconds":{d},"renewTime":"{s}"}}}}
    , .{ lease_name, namespace, renewed_at, now, identity, duration_seconds, renew_time });
    defer gpa.free(body);

    var applied = try client.apply(gpa, res, namespace, lease_name, body);
    defer applied.deinit(gpa);
    if (!applied.ok()) {
        std.log.warn("lease apply failed: {d} {s}", .{ applied.status, applied.body });
        return false;
    }
    return true;
}

/// Best-effort hand-off on shutdown so a restart does not wait out the full
/// deadline. Failure is not worth reporting: the deadline covers it.
pub fn release(
    gpa: std.mem.Allocator,
    client: *kube.Client,
    namespace: []const u8,
) void {
    var response = client.remove(gpa, resource(), namespace, lease_name) catch return;
    response.deinit(gpa);
}
