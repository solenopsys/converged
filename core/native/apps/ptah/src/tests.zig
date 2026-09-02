//! Unit tests for the native side. The policy's own rules are tested in
//! `policy/test` with bun; what matters here is that the Zig/QuickJS boundary
//! carries a real reconcile across intact.

const std = @import("std");
const config_mod = @import("config.zig");
const kube = @import("kube.zig");
const policy = @import("policy.zig");
const tls = @import("tls.zig");
const module_cache = @import("module_cache.zig");

comptime {
    // The HTTPS transport carries its own unit tests; pull them in.
    _ = tls;
    _ = module_cache;
}

const testing = std.testing;

fn testConfig() config_mod.Config {
    return .{
        .server = "https://api.test:6443",
        .token = null,
        .ca_path = null,
        .namespace = "ptah",
        .identity = "ptah-0",
        .registry_index_url = null,
        .resync_ms = 30_000,
        .leader_election = false,
    };
}

test "core group and named groups use different path prefixes" {
    const gpa = testing.allocator;
    var config = testConfig();
    var client = try kube.Client.init(gpa, std.Options.debug_io, &config);
    defer client.deinit();

    const core = try client.path(gpa, kube.lookup("v1", "Service").?, "converged", "converged-ui");
    defer gpa.free(core);
    try testing.expectEqualStrings(
        "https://api.test:6443/api/v1/namespaces/converged/services/converged-ui",
        core,
    );

    const apps = try client.path(gpa, kube.lookup("apps/v1", "Deployment").?, "converged", "converged-ui");
    defer gpa.free(apps);
    try testing.expectEqualStrings(
        "https://api.test:6443/apis/apps/v1/namespaces/converged/deployments/converged-ui",
        apps,
    );
}

test "cluster-scoped kinds drop the namespace segment" {
    const gpa = testing.allocator;
    var config = testConfig();
    var client = try kube.Client.init(gpa, std.Options.debug_io, &config);
    defer client.deinit();

    const url = try client.path(gpa, kube.lookup("ptah.io/v1alpha1", "Tenant").?, "ignored", "democnc");
    defer gpa.free(url);
    try testing.expectEqualStrings(
        "https://api.test:6443/apis/ptah.io/v1alpha1/tenants/democnc",
        url,
    );
}

test "the custom resources ptah reads are never prune candidates" {
    for (kube.resources) |resource| {
        if (std.mem.eql(u8, resource.api_version, "ptah.io/v1alpha1")) {
            try testing.expect(!resource.prunable);
        }
    }
}

test "an unlisted kind has no client path at all" {
    try testing.expect(kube.lookup("batch/v1", "Job") == null);
    try testing.expect(kube.lookup("v1", "Pod") == null);
    // Traefik was replaced by Gateway API; the old kinds must be gone so a
    // stale policy cannot keep writing them.
    try testing.expect(kube.lookup("traefik.io/v1alpha1", "IngressRoute") == null);
    try testing.expect(kube.lookup("gateway.networking.k8s.io/v1", "HTTPRoute") != null);
}

test "volumes are data-bearing and cluster-scoped where they should be" {
    const pv = kube.lookup("v1", "PersistentVolume").?;
    try testing.expect(pv.data_bearing);
    try testing.expect(!pv.namespaced);

    const pvc = kube.lookup("v1", "PersistentVolumeClaim").?;
    try testing.expect(pvc.data_bearing);
    try testing.expect(pvc.namespaced);

    // Everything else is safe to prune outright.
    for (kube.resources) |resource| {
        if (resource.data_bearing) {
            try testing.expect(std.mem.indexOf(u8, resource.kind, "PersistentVolume") != null);
        }
    }
}

// The end-to-end boundary check: a real ReconcileInput goes through QuickJS
// and comes back as the objects the policy promised.
test "policy round-trips a platform reconcile through QuickJS" {
    const gpa = testing.allocator;
    const input =
        \\{"kind":"Platform","solutions":[],"tenants":[],"object":{
        \\"apiVersion":"ptah.io/v1alpha1","kind":"Platform",
        \\"metadata":{"name":"converged","generation":7},
        \\"spec":{"profile":"mono","namespace":"converged","domainBase":"4ir.club",
        \\"secretName":"converged-secrets","images":{"ui":"reg/ui:1","ms":"reg/ms:1"},
        \\"cache":{"image":"valkey:8.1-alpine","port":6379},
        \\"storage":{"image":"reg/behemoth:1","size":"5Gi","port":9000,"mountBase":"/app/data","storageClassName":"local-path"},
        \\"apps":{"fujin":{"image":"reg/fujin:1","ports":{"ws":8087,"zmq":5557}}},
        \\"gateway":{"className":"traefik","hosts":["*.4ir.club"]}}}}
    ;

    var err: ?[]const u8 = null;
    var output = policy.run(gpa, input, &err) catch |e| {
        defer if (err) |m| gpa.free(m);
        std.debug.print("policy failed: {s} {s}\n", .{ @errorName(e), err orelse "" });
        return e;
    };
    defer output.deinit();

    try testing.expect(output.prune);
    try testing.expect(output.resources.len > 0);

    var saw_ui = false;
    for (output.resources) |resource| {
        const object = resource.object;
        const kind = object.get("kind").?.string;
        const meta = object.get("metadata").?.object;
        const name = meta.get("name").?.string;
        // Everything applied must be a kind the client is allowed to touch,
        // and must carry the label prune keys off.
        const api_version = object.get("apiVersion").?.string;
        try testing.expect(kube.lookup(api_version, kind) != null);
        const labels = meta.get("labels").?.object;
        try testing.expectEqualStrings("platform.converged", labels.get("ptah.io/owner").?.string);
        if (std.mem.eql(u8, kind, "Deployment") and std.mem.eql(u8, name, "converged-ui")) saw_ui = true;
    }
    try testing.expect(saw_ui);
}

test "a policy rejection surfaces as data, not as a crash" {
    const gpa = testing.allocator;
    const input =
        \\{"kind":"Solution","solutions":[],"tenants":[],
        \\"object":{"apiVersion":"ptah.io/v1alpha1","kind":"Solution",
        \\"metadata":{"name":"broken"},"spec":{}}}
    ;

    var err: ?[]const u8 = null;
    const result = policy.run(gpa, input, &err);
    defer if (err) |m| gpa.free(m);

    try testing.expectError(policy.Error.PolicyRejected, result);
    try testing.expect(err != null);
    try testing.expect(std.mem.indexOf(u8, err.?, "spec.platform") != null);
}

test "a tenant without its platform asks not to be pruned" {
    const gpa = testing.allocator;
    const input =
        \\{"kind":"Tenant","solutions":[],"tenants":[],
        \\"object":{"apiVersion":"ptah.io/v1alpha1","kind":"Tenant",
        \\"metadata":{"name":"democnc"},"spec":{"platform":"missing"}}}
    ;

    var err: ?[]const u8 = null;
    var output = try policy.run(gpa, input, &err);
    defer output.deinit();

    // An empty desired set plus prune would delete the tenant's storage while
    // it waits for its platform to appear.
    try testing.expectEqual(@as(usize, 0), output.resources.len);
    try testing.expect(!output.prune);
    try testing.expect(output.requeue_after_ms > 0);
}
