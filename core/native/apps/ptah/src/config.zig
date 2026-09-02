//! Controller settings, resolved once at start-up.
//!
//! Nothing here falls back to a guessed value. An operator that quietly
//! defaults its apiserver, namespace or identity will happily reconcile the
//! wrong cluster, so every setting is either derived from the in-cluster
//! service account (which is unambiguous) or demanded explicitly.

const std = @import("std");

pub const sa_dir = "/var/run/secrets/kubernetes.io/serviceaccount";
pub const sa_token = sa_dir ++ "/token";
pub const sa_ca = sa_dir ++ "/ca.crt";
pub const sa_namespace = sa_dir ++ "/namespace";
pub const ENV_REGISTRY_INDEX_URL = "REGISTRY_INDEX_URL";

/// In-cluster apiserver address. See the note in `load`: the cluster IP is
/// only an IP SAN on the serving certificate, so the DNS name is what TLS
/// verification can actually match.
pub const api_dns_name = "kubernetes.default.svc";

pub const Config = struct {
    /// Base URL of the apiserver, no trailing slash.
    server: []const u8,
    /// Bearer token, or null when talking to a local `kubectl proxy`.
    token: ?[]const u8,
    /// PEM bundle to verify the apiserver, or null for plain HTTP.
    ca_path: ?[]const u8,
    /// Namespace holding ptah's own Lease.
    namespace: []const u8,
    /// Unique holder id for leader election; the pod name in a cluster.
    identity: []const u8,
    /// Optional URL of the published registry.json mapping.
    registry_index_url: ?[]const u8,
    resync_ms: u64,
    leader_election: bool,

    pub fn deinit(self: *Config, gpa: std.mem.Allocator) void {
        gpa.free(self.server);
        if (self.token) |t| gpa.free(t);
        gpa.free(self.namespace);
        gpa.free(self.identity);
        if (self.registry_index_url) |url| gpa.free(url);
        self.* = undefined;
    }
};

pub const Environ = std.process.Environ.Map;

fn env(environ: *Environ, name: []const u8) ?[]const u8 {
    const value = environ.get(name) orelse return null;
    return if (value.len == 0) null else value;
}

fn required(environ: *Environ, name: []const u8) ![]const u8 {
    return env(environ, name) orelse {
        std.log.err("{s} is required", .{name});
        return error.MissingSetting;
    };
}

fn readTrimmed(gpa: std.mem.Allocator, io: std.Io, path: []const u8) ![]u8 {
    const raw = try std.Io.Dir.cwd().readFileAlloc(io, path, gpa, .limited(64 * 1024));
    defer gpa.free(raw);
    return gpa.dupe(u8, std.mem.trim(u8, raw, " \t\r\n"));
}

/// In-cluster wins when the kubelet injected a service account, because that
/// is the only configuration where the apiserver address is not a guess.
/// Otherwise PTAH_KUBE_SERVER must be set — a `kubectl proxy` URL locally.
pub fn load(gpa: std.mem.Allocator, io: std.Io, environ: *Environ) !Config {
    const registry_index_url = if (env(environ, ENV_REGISTRY_INDEX_URL)) |url|
        try gpa.dupe(u8, url)
    else
        null;
    errdefer if (registry_index_url) |url| gpa.free(url);
    const resync_raw = try required(environ, "PTAH_RESYNC_MS");
    const resync_ms = std.fmt.parseInt(u64, resync_raw, 10) catch {
        std.log.err("PTAH_RESYNC_MS is not a number: {s}", .{resync_raw});
        return error.InvalidSetting;
    };
    if (resync_ms == 0) {
        std.log.err("PTAH_RESYNC_MS must be greater than zero", .{});
        return error.InvalidSetting;
    }

    const election_raw = try required(environ, "PTAH_LEADER_ELECTION");
    const leader_election = std.mem.eql(u8, election_raw, "on");
    if (!leader_election and !std.mem.eql(u8, election_raw, "off")) {
        std.log.err("PTAH_LEADER_ELECTION must be 'on' or 'off', got {s}", .{election_raw});
        return error.InvalidSetting;
    }

    // An explicit address wins over autodetection. In-cluster the kubelet
    // always injects KUBERNETES_SERVICE_HOST, so without this check there is
    // no way to point ptah at a local apiserver proxy from inside a pod — and
    // that proxy is currently the only way it can reach the apiserver at all
    // (see the TLS note in kube.zig).
    if (env(environ, "PTAH_KUBE_SERVER") == null and
        env(environ, "KUBERNETES_SERVICE_HOST") != null)
    {
        const port = try required(environ, "KUBERNETES_SERVICE_PORT");
        // By DNS name, not by KUBERNETES_SERVICE_HOST.
        //
        // That variable holds the service IP, and the apiserver's certificate
        // carries the cluster IP only as an IP SAN. The TLS client matches the
        // host string against DNS SANs, so dialing the IP fails verification
        // with TlsInitializationFailed even though the CA is correct.
        // `kubernetes.default.svc` is a DNS SAN on every conformant cluster
        // and resolves to that same service IP.
        return .{
            .server = try std.fmt.allocPrint(gpa, "https://{s}:{s}", .{ api_dns_name, port }),
            .token = try readTrimmed(gpa, io, sa_token),
            .ca_path = sa_ca,
            .namespace = try readTrimmed(gpa, io, sa_namespace),
            .identity = try gpa.dupe(u8, try required(environ, "PTAH_IDENTITY")),
            .registry_index_url = registry_index_url,
            .resync_ms = resync_ms,
            .leader_election = leader_election,
        };
    }

    const server = try required(environ, "PTAH_KUBE_SERVER");
    const token = env(environ, "PTAH_KUBE_TOKEN");
    // Out of cluster the CA is optional: a `kubectl proxy` URL is plain HTTP
    // and needs none. Pointing PTAH_KUBE_CA at a cluster's CA bundle is what
    // lets the same TLS path be exercised from a workstation instead of only
    // from inside a pod.
    return .{
        .server = try gpa.dupe(u8, std.mem.trimEnd(u8, server, "/")),
        .token = if (token) |t| try gpa.dupe(u8, t) else null,
        .ca_path = env(environ, "PTAH_KUBE_CA"),
        .namespace = if (env(environ, "PTAH_NAMESPACE")) |ns|
            try gpa.dupe(u8, ns)
        else
            try readTrimmed(gpa, io, sa_namespace),
        .identity = try gpa.dupe(u8, try required(environ, "PTAH_IDENTITY")),
        .registry_index_url = registry_index_url,
        .resync_ms = resync_ms,
        .leader_election = leader_election,
    };
}
