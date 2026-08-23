//! One reconcile pass and the loop around it.
//!
//! The MVP resyncs on a timer instead of watching. A watch is strictly better
//! for latency, but it brings resourceVersion bookkeeping, 410 Gone recovery
//! and reconnect backoff — about as much code as everything here — while
//! server-side apply already makes a repeated pass free when nothing changed.
//! The watch belongs in the next iteration, not this one.

const std = @import("std");
const kube = @import("kube.zig");
const lease = @import("lease.zig");
const policy = @import("policy.zig");
const Config = @import("config.zig").Config;
const access_keys = @import("access_keys.zig");
const module_cache = @import("module_cache.zig");

const label_managed_by = "app.kubernetes.io/managed-by";
const label_owner = "ptah.io/owner";

/// Order matters: platforms publish the module map and the shared services a
/// tenant's routes point at, so they are reconciled first.
const kinds = [_][]const u8{ "Platform", "Solution", "Tenant" };

fn stringify(gpa: std.mem.Allocator, value: std.json.Value) ![]u8 {
    return std.json.Stringify.valueAlloc(gpa, value, .{});
}

fn objectField(value: std.json.Value, name: []const u8) ?std.json.Value {
    return switch (value) {
        .object => |o| o.get(name),
        else => null,
    };
}

fn stringField(value: std.json.Value, name: []const u8) ?[]const u8 {
    const field = objectField(value, name) orelse return null;
    return switch (field) {
        .string => |s| s,
        else => null,
    };
}

fn metaName(object: std.json.Value) ?[]const u8 {
    const meta = objectField(object, "metadata") orelse return null;
    return stringField(meta, "name");
}

fn metaNamespace(object: std.json.Value) ?[]const u8 {
    const meta = objectField(object, "metadata") orelse return null;
    return stringField(meta, "namespace");
}

fn metaLabel(object: std.json.Value, key: []const u8) ?[]const u8 {
    const meta = objectField(object, "metadata") orelse return null;
    const labels = objectField(meta, "labels") orelse return null;
    return stringField(labels, key);
}

fn metaAnnotation(object: std.json.Value, key: []const u8) ?[]const u8 {
    const meta = objectField(object, "metadata") orelse return null;
    const annotations = objectField(meta, "annotations") orelse return null;
    return stringField(annotations, key);
}

/// Identity of an applied object, used to decide what prune may delete.
fn refKey(gpa: std.mem.Allocator, kind: []const u8, namespace: ?[]const u8, name: []const u8) ![]u8 {
    return std.fmt.allocPrint(gpa, "{s}/{s}/{s}", .{ kind, namespace orelse "-", name });
}

fn ownerFor(gpa: std.mem.Allocator, kind: []const u8, name: []const u8) ![]u8 {
    const lower = try std.ascii.allocLowerString(gpa, kind);
    defer gpa.free(lower);
    return std.fmt.allocPrint(gpa, "{s}.{s}", .{ lower, name });
}

pub const Stats = struct {
    applied: usize = 0,
    pruned: usize = 0,
    failed: usize = 0,
    /// Smallest non-zero requeue any policy asked for, in ms.
    requeue_ms: u64 = 0,

    fn requestRequeue(self: *Stats, ms: u64) void {
        if (ms == 0) return;
        if (self.requeue_ms == 0 or ms < self.requeue_ms) self.requeue_ms = ms;
    }
};

/// Wall clock in seconds. std.time.timestamp is gone in Zig 0.16; lease.zig
/// reaches for clock_gettime the same way.
fn nowSeconds() i64 {
    var ts: std.c.timespec = undefined;
    _ = std.c.clock_gettime(.REALTIME, &ts);
    return @as(i64, ts.sec);
}

pub const Reconciler = struct {
    gpa: std.mem.Allocator,
    client: *kube.Client,
    config: *const Config,
    registry: *module_cache.Registry,
    /// When set, nothing is written to the cluster; used by `ptah apply --dry`.
    dry_run: bool = false,

    /// Fetch every object of a custom kind. Returns the parsed list; the
    /// caller owns it.
    fn listCustom(
        self: *Reconciler,
        arena: std.mem.Allocator,
        kind: []const u8,
    ) ![]const std.json.Value {
        const resource = kube.lookup("ptah.io/v1alpha1", kind) orelse return error.UnknownKind;
        var response = try self.client.list(arena, resource, "");
        defer response.deinit(arena);
        if (!response.ok()) {
            std.log.err("list {s} failed: {d} {s}", .{ kind, response.status, response.body });
            return error.ListFailed;
        }
        const parsed = try std.json.parseFromSliceLeaky(std.json.Value, arena, response.body, .{});
        const items = objectField(parsed, "items") orelse return &.{};
        return switch (items) {
            .array => |a| a.items,
            else => &.{},
        };
    }

    /// Serialise the ReconcileInput the policy expects. Everything the policy
    /// could possibly need is assembled here, because it has no way to ask.
    fn buildInput(
        self: *Reconciler,
        arena: std.mem.Allocator,
        kind: []const u8,
        object: std.json.Value,
        solutions: []const std.json.Value,
        tenants: []const std.json.Value,
        platforms: []const std.json.Value,
    ) ![]u8 {
        var out = std.Io.Writer.Allocating.init(arena);
        const w = &out.writer;

        const object_json = try stringify(arena, object);
        // The controller's own namespace travels with the input: the module
        // proxy is a Service there, while the pods that fetch from it run in
        // the platform's namespace, so the policy cannot name it without this.
        try w.print(
            "{{\"kind\":\"{s}\",\"controllerNamespace\":\"{s}\",\"object\":{s},\"solutions\":[",
            .{ kind, self.config.namespace, object_json },
        );
        for (solutions, 0..) |solution, i| {
            if (i > 0) try w.writeAll(",");
            try w.writeAll(try stringify(arena, solution));
        }
        try w.writeAll("],\"tenants\":[");
        for (tenants, 0..) |tenant, i| {
            if (i > 0) try w.writeAll(",");
            try w.writeAll(try stringify(arena, tenant));
        }
        try w.writeAll("]");

        // A Solution or Tenant names the platform it belongs to; resolving it
        // here keeps the policy free of lookups.
        if (!std.mem.eql(u8, kind, "Platform")) {
            const spec = objectField(object, "spec");
            const wanted = if (spec) |s| stringField(s, "platform") else null;
            if (wanted) |name| {
                for (platforms) |platform| {
                    if (metaName(platform)) |candidate| {
                        if (std.mem.eql(u8, candidate, name)) {
                            try w.print(",\"platform\":{s}", .{try stringify(arena, platform)});
                            break;
                        }
                    }
                }
            }
        }
        try w.writeAll("}");
        return out.toOwnedSlice();
    }

    /// Apply the desired set, then delete anything we own that is not in it.
    fn applyAndPrune(
        self: *Reconciler,
        arena: std.mem.Allocator,
        owner: []const u8,
        desired: []const std.json.Value,
        allow_prune: bool,
        stats: *Stats,
    ) !void {
        var applied = std.StringHashMap(void).init(arena);

        for (desired) |object| {
            const api_version = stringField(object, "apiVersion") orelse return error.ResourceMissingApiVersion;
            const kind = stringField(object, "kind") orelse return error.ResourceMissingKind;
            const name = metaName(object) orelse return error.ResourceMissingName;
            const resource = kube.lookup(api_version, kind) orelse {
                std.log.err("policy emitted unmanaged kind {s}/{s}", .{ api_version, kind });
                return error.UnmanagedKind;
            };
            const namespace = metaNamespace(object);
            if (resource.namespaced and namespace == null) return error.ResourceMissingNamespace;

            // Prune keys off these labels, so an object without them would be
            // applied and then never tracked again. Refusing the whole pass is
            // safer than leaking an untracked object into the cluster.
            const stamped = metaLabel(object, label_owner) orelse return error.ResourceMissingOwnerLabel;
            if (!std.mem.eql(u8, stamped, owner)) {
                std.log.err("resource {s}/{s} claims owner {s}, expected {s}", .{ kind, name, stamped, owner });
                return error.ResourceOwnerMismatch;
            }
            const manager = metaLabel(object, label_managed_by) orelse return error.ResourceMissingManagedByLabel;
            if (!std.mem.eql(u8, manager, kube.field_manager)) return error.ResourceManagedByMismatch;

            try applied.put(try refKey(arena, kind, namespace, name), {});
            if (self.dry_run) {
                stats.applied += 1;
                continue;
            }

            const body = try stringify(arena, object);
            var response = try self.client.apply(arena, resource, namespace, name, body);
            defer response.deinit(arena);
            if (!response.ok()) {
                std.log.err("apply {s}/{s} failed: {d} {s}", .{ kind, name, response.status, response.body });
                return error.ApplyFailed;
            }
            stats.applied += 1;
        }

        if (!allow_prune) return;

        const selector = try std.fmt.allocPrint(arena, "{s}%3D{s}", .{ label_owner, owner });
        for (kube.resources) |resource| {
            if (!resource.prunable) continue;
            var response = try self.client.list(arena, resource, selector);
            defer response.deinit(arena);
            if (!response.ok()) {
                // A kind whose CRD is not installed (Traefik on a bare
                // cluster) is a 404, not a failure of this pass.
                if (response.status == 404) continue;
                std.log.err("list {s} for prune failed: {d}", .{ resource.kind, response.status });
                return error.ListFailed;
            }
            const parsed = try std.json.parseFromSliceLeaky(std.json.Value, arena, response.body, .{});
            const items = switch (objectField(parsed, "items") orelse continue) {
                .array => |a| a.items,
                else => continue,
            };
            for (items) |item| {
                const name = metaName(item) orelse continue;
                const namespace = metaNamespace(item);
                const key = try refKey(arena, resource.kind, namespace, name);
                if (applied.contains(key)) continue;

                // A volume that dropped out of the desired set is far more
                // likely to be a policy edit than an intent to erase data, so
                // deletion has to be asked for on the object itself.
                if (resource.data_bearing) {
                    const reclaim = metaAnnotation(item, kube.reclaim_annotation) orelse "";
                    if (!std.mem.eql(u8, reclaim, kube.reclaim_delete)) {
                        std.log.info(
                            "orphaned {s}/{s}: kept ({s} is not {s})",
                            .{ resource.kind, name, kube.reclaim_annotation, kube.reclaim_delete },
                        );
                        continue;
                    }
                }
                if (self.dry_run) {
                    std.log.info("would prune {s}/{s}", .{ resource.kind, name });
                    stats.pruned += 1;
                    continue;
                }
                var deleted = try self.client.remove(arena, resource, namespace, name);
                defer deleted.deinit(arena);
                if (deleted.ok() or deleted.status == 404) {
                    std.log.info("pruned {s}/{s}", .{ resource.kind, name });
                    stats.pruned += 1;
                } else {
                    std.log.err("prune {s}/{s} failed: {d}", .{ resource.kind, name, deleted.status });
                }
            }
        }
    }

    fn writeStatus(
        self: *Reconciler,
        arena: std.mem.Allocator,
        kind: []const u8,
        name: []const u8,
        status: std.json.Value,
    ) !void {
        if (self.dry_run) return;
        const resource = kube.lookup("ptah.io/v1alpha1", kind) orelse return error.UnknownKind;
        const body = try std.fmt.allocPrint(arena, "{{\"status\":{s}}}", .{try stringify(arena, status)});
        var response = try self.client.patchStatus(arena, resource, null, name, body);
        defer response.deinit(arena);
        if (!response.ok()) {
            std.log.warn("status patch {s}/{s} failed: {d} {s}", .{ kind, name, response.status, response.body });
        }
    }

    fn failureStatus(
        self: *Reconciler,
        arena: std.mem.Allocator,
        kind: []const u8,
        name: []const u8,
        reason: []const u8,
    ) void {
        var escaped = std.Io.Writer.Allocating.init(arena);
        std.json.Stringify.value(reason, .{}, &escaped.writer) catch return;
        const body = std.fmt.allocPrint(
            arena,
            "{{\"status\":{{\"ready\":false,\"reason\":{s}}}}}",
            .{escaped.written()},
        ) catch return;
        if (self.dry_run) return;
        const resource = kube.lookup("ptah.io/v1alpha1", kind) orelse return;
        var response = self.client.patchStatus(arena, resource, null, name, body) catch return;
        response.deinit(arena);
    }

    /// The 32 bytes every one of a platform's keys comes from.
    ///
    /// Written on first sight and never rewritten. The key is derived rather
    /// than stored so that only one thing has to be kept secret, and derivation
    /// is deterministic so that the policy — re-evaluated on every pass — is
    /// handed the same material every time instead of rotating the platform's
    /// identity once every resync.
    fn accessSeed(
        self: *Reconciler,
        arena: std.mem.Allocator,
        platform: []const u8,
        namespace: []const u8,
    ) ![32]u8 {
        const resource = kube.lookup("v1", "Secret") orelse return error.UnknownKind;
        const secret_name = try std.fmt.allocPrint(arena, "{s}-access-seed", .{platform});

        var existing = try self.client.get(arena, resource, namespace, secret_name);
        defer existing.deinit(arena);
        if (existing.ok()) {
            const parsed = try std.json.parseFromSlice(std.json.Value, arena, existing.body, .{});
            const data = parsed.value.object.get("data") orelse return error.SeedMalformed;
            const encoded = data.object.get("seed") orelse return error.SeedMalformed;
            if (encoded != .string) return error.SeedMalformed;
            var raw: [64]u8 = undefined;
            const decoder = std.base64.standard.Decoder;
            const len = try decoder.calcSizeForSlice(encoded.string);
            if (len != 32) return error.SeedMalformed;
            try decoder.decode(raw[0..len], encoded.string);
            var seed: [32]u8 = undefined;
            @memcpy(&seed, raw[0..32]);
            return seed;
        }

        // std.crypto.random is gone in Zig 0.16; entropy comes through Io.
        var seed: [32]u8 = undefined;
        std.Options.debug_io.random(&seed);
        if (self.dry_run) return seed;

        var encoded: [std.base64.standard.Encoder.calcSize(32)]u8 = undefined;
        _ = std.base64.standard.Encoder.encode(&encoded, &seed);
        const body = try std.fmt.allocPrint(
            arena,
            "{{\"apiVersion\":\"v1\",\"kind\":\"Secret\",\"metadata\":{{\"name\":\"{s}\",\"namespace\":\"{s}\"}},\"type\":\"Opaque\",\"data\":{{\"seed\":\"{s}\"}}}}",
            .{ secret_name, namespace, encoded },
        );
        var created = try self.client.create(arena, resource, namespace, body);
        defer created.deinit(arena);
        // A second replica racing to the same conclusion is fine: whoever lost
        // re-reads the winner's seed rather than overwriting it.
        if (!created.ok() and created.status != 409) return error.SeedWriteFailed;
        if (created.status == 409) return self.accessSeed(arena, platform, namespace);
        return seed;
    }

    /// The platform's signing material, as the policy receives it.
    fn accessMaterial(
        self: *Reconciler,
        arena: std.mem.Allocator,
        platform: []const u8,
        object: std.json.Value,
    ) !?[]const u8 {
        const spec = object.object.get("spec") orelse return null;
        const namespace_value = spec.object.get("namespace") orelse return null;
        if (namespace_value != .string) return null;

        const seed = try self.accessSeed(arena, platform, namespace_value.string);
        const subject = try std.fmt.allocPrint(arena, "{s}-runtime", .{platform});
        var material = try access_keys.derive(arena, seed, subject, nowSeconds());
        defer material.deinit(arena);

        return try std.fmt.allocPrint(
            arena,
            "{{\"issuer\":\"{s}\",\"audience\":\"{s}\",\"kid\":\"{s}\",\"privateJwk\":{s},\"publicJwks\":{s},\"serviceToken\":\"{s}\"}}",
            .{
                access_keys.issuer,
                access_keys.audience,
                material.kid,
                material.private_jwk,
                material.public_jwks,
                material.service_token,
            },
        );
    }

    /// Reconcile every custom resource once.
    pub fn pass(self: *Reconciler) !Stats {
        var arena_state = std.heap.ArenaAllocator.init(self.gpa);
        defer arena_state.deinit();
        const arena = arena_state.allocator();

        const platforms = try self.listCustom(arena, "Platform");
        const solutions = try self.listCustom(arena, "Solution");
        const tenants = try self.listCustom(arena, "Tenant");

        // Publish the digest-to-upstream map before reconciling workloads.
        // Consumers can now make their first request through ptah immediately
        // after the ConfigMap and Deployment are applied.
        try self.registry.replace(platforms);

        var stats = Stats{};
        for (kinds) |kind| {
            const objects = if (std.mem.eql(u8, kind, "Platform"))
                platforms
            else if (std.mem.eql(u8, kind, "Solution"))
                solutions
            else
                tenants;

            for (objects) |object| {
                const name = metaName(object) orelse continue;
                self.reconcileOne(arena, kind, name, object, solutions, tenants, platforms, &stats) catch |err| {
                    stats.failed += 1;
                    const reason = std.fmt.allocPrint(arena, "{s}", .{@errorName(err)}) catch "reconcile failed";
                    std.log.err("{s}/{s}: {s}", .{ kind, name, reason });
                    self.failureStatus(arena, kind, name, reason);
                };
            }
        }
        return stats;
    }

    fn reconcileOne(
        self: *Reconciler,
        parent: std.mem.Allocator,
        kind: []const u8,
        name: []const u8,
        object: std.json.Value,
        solutions: []const std.json.Value,
        tenants: []const std.json.Value,
        platforms: []const std.json.Value,
        stats: *Stats,
    ) !void {
        var arena_state = std.heap.ArenaAllocator.init(parent);
        defer arena_state.deinit();
        const arena = arena_state.allocator();

        const input = try self.buildInput(arena, kind, object, solutions, tenants, platforms);

        // Only a Platform owns a signing key; a Solution is an overlay and a
        // Tenant borrows its platform's. Failing to reach the seed is not fatal
        // here: the policy is told there is none and leaves the env unset,
        // which is a clearer failure than a platform signed with a key that
        // changed under it.
        const access_json = if (std.mem.eql(u8, kind, "Platform"))
            self.accessMaterial(arena, name, object) catch |err| blk: {
                std.log.warn("{s}: access key unavailable: {s}", .{ name, @errorName(err) });
                break :blk null;
            }
        else
            null;

        var policy_error: ?[]const u8 = null;
        var output = policy.runWithAccess(self.gpa, input, access_json, &policy_error) catch |err| {
            defer if (policy_error) |message| self.gpa.free(message);
            const detail = policy_error orelse @errorName(err);
            std.log.err("policy {s}/{s}: {s}", .{ kind, name, detail });
            self.failureStatus(arena, kind, name, detail);
            stats.failed += 1;
            return;
        };
        defer output.deinit();

        const owner = try ownerFor(arena, kind, name);
        try self.applyAndPrune(arena, owner, output.resources, output.prune, stats);
        stats.requestRequeue(output.requeue_after_ms);

        if (output.status) |status| try self.writeStatus(arena, kind, name, status);
    }

    /// clock_nanosleep resumes itself after EINTR with the time it had left,
    /// so a SIGTERM landing at the start of a resync would go unnoticed for a
    /// whole period — longer than the grace a rolling update waits out before
    /// it reaches for SIGKILL. Sleeping in slices re-reads the flag often
    /// enough that the pod leaves within a slice of the signal.
    fn sleep(self: *Reconciler, ms: u64, running: *const std.atomic.Value(bool)) void {
        const slice_ms = 100;
        var remaining = ms;
        while (remaining > 0 and running.load(.acquire)) {
            const step = @min(remaining, slice_ms);
            std.Io.sleep(self.client.io, .fromMilliseconds(@intCast(step)), .awake) catch {};
            remaining -= step;
        }
    }

    /// Reconcile forever, holding the lease if elections are enabled.
    pub fn loop(self: *Reconciler, running: *const std.atomic.Value(bool)) !void {
        while (running.load(.acquire)) {
            var sleep_ms = self.config.resync_ms;

            const leader = if (self.config.leader_election)
                lease.acquire(self.gpa, self.client, self.config.namespace, self.config.identity) catch false
            else
                true;

            if (!leader) {
                // Poll at half the lease duration so a dead leader is picked
                // up roughly one period after it stops renewing.
                self.sleep(lease.duration_seconds * 500, running);
                continue;
            }

            const stats = self.pass() catch |err| blk: {
                std.log.err("reconcile pass failed: {s}", .{@errorName(err)});
                break :blk Stats{ .failed = 1 };
            };
            std.log.info(
                "pass: applied={d} pruned={d} failed={d}",
                .{ stats.applied, stats.pruned, stats.failed },
            );
            if (stats.requeue_ms != 0 and stats.requeue_ms < sleep_ms) sleep_ms = stats.requeue_ms;

            self.sleep(sleep_ms, running);
        }
    }
};
