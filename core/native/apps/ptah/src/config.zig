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
    resync_ms: u64,
    leader_election: bool,

    pub fn deinit(self: *Config, gpa: std.mem.Allocator) void {
        gpa.free(self.server);
        if (self.token) |t| gpa.free(t);
        gpa.free(self.namespace);
        gpa.free(self.identity);
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

    if (env(environ, "KUBERNETES_SERVICE_HOST")) |host| {
        const port = try required(environ, "KUBERNETES_SERVICE_PORT");
        return .{
            .server = try std.fmt.allocPrint(gpa, "https://{s}:{s}", .{ host, port }),
            .token = try readTrimmed(gpa, io, sa_token),
            .ca_path = sa_ca,
            .namespace = try readTrimmed(gpa, io, sa_namespace),
            .identity = try gpa.dupe(u8, try required(environ, "PTAH_IDENTITY")),
            .resync_ms = resync_ms,
            .leader_election = leader_election,
        };
    }

    const server = try required(environ, "PTAH_KUBE_SERVER");
    const token = env(environ, "PTAH_KUBE_TOKEN");
    return .{
        .server = try gpa.dupe(u8, std.mem.trimEnd(u8, server, "/")),
        .token = if (token) |t| try gpa.dupe(u8, t) else null,
        .ca_path = null,
        .namespace = try gpa.dupe(u8, try required(environ, "PTAH_NAMESPACE")),
        .identity = try gpa.dupe(u8, try required(environ, "PTAH_IDENTITY")),
        .resync_ms = resync_ms,
        .leader_election = leader_election,
    };
}
