//! A narrow Kubernetes client: the five verbs this controller needs and
//! nothing more.
//!
//! There is no diff engine here on purpose. Server-side apply makes the
//! apiserver compute the delta and track field ownership under our field
//! manager, so a reconcile is "send the desired object" and the cluster works
//! out what changed. The only comparison we do ourselves is prune, which asks
//! a different question: what do we own that is no longer wanted.

const std = @import("std");
const Config = @import("config.zig").Config;
const tls = @import("tls.zig");

pub const field_manager = "ptah";

/// The apply patch content type. JSON is valid YAML, so we send JSON bodies.
const apply_content_type = "application/apply-patch+yaml";
const merge_content_type = "application/merge-patch+json";

/// Every kind ptah is allowed to touch. Discovery would let us skip this
/// table, but an explicit list is also the blast radius: a policy bug cannot
/// make the controller delete a kind that is not written here.
pub const Resource = struct {
    api_version: []const u8,
    kind: []const u8,
    plural: []const u8,
    namespaced: bool,
    /// Prune candidates are listed and deleted; the custom resources ptah
    /// reads but never owns are excluded.
    prunable: bool = true,
    /// Holds data that outlives the declaration. Prune skips these unless the
    /// live object opts in with `ptah.io/reclaim: delete`, so removing a claim
    /// from a policy orphans a volume instead of destroying it.
    data_bearing: bool = false,
};

/// Annotation that lets prune delete a data-bearing object.
pub const reclaim_annotation = "ptah.io/reclaim";
pub const reclaim_delete = "delete";

pub const resources = [_]Resource{
    .{ .api_version = "v1", .kind = "ConfigMap", .plural = "configmaps", .namespaced = true },
    .{ .api_version = "v1", .kind = "Secret", .plural = "secrets", .namespaced = true },
    .{ .api_version = "v1", .kind = "Service", .plural = "services", .namespaced = true },
    .{ .api_version = "v1", .kind = "PersistentVolumeClaim", .plural = "persistentvolumeclaims", .namespaced = true, .data_bearing = true },
    .{ .api_version = "v1", .kind = "PersistentVolume", .plural = "persistentvolumes", .namespaced = false, .data_bearing = true },
    .{ .api_version = "apps/v1", .kind = "Deployment", .plural = "deployments", .namespaced = true },
    .{ .api_version = "apps/v1", .kind = "StatefulSet", .plural = "statefulsets", .namespaced = true },
    .{ .api_version = "gateway.networking.k8s.io/v1", .kind = "Gateway", .plural = "gateways", .namespaced = true },
    .{ .api_version = "gateway.networking.k8s.io/v1", .kind = "HTTPRoute", .plural = "httproutes", .namespaced = true },
    .{ .api_version = "cert-manager.io/v1", .kind = "Certificate", .plural = "certificates", .namespaced = true },
    .{ .api_version = "coordination.k8s.io/v1", .kind = "Lease", .plural = "leases", .namespaced = true, .prunable = false },
    .{ .api_version = "ptah.io/v1alpha1", .kind = "Platform", .plural = "platforms", .namespaced = false, .prunable = false },
    .{ .api_version = "ptah.io/v1alpha1", .kind = "Solution", .plural = "solutions", .namespaced = false, .prunable = false },
    .{ .api_version = "ptah.io/v1alpha1", .kind = "Tenant", .plural = "tenants", .namespaced = false, .prunable = false },
};

pub fn lookup(api_version: []const u8, kind: []const u8) ?Resource {
    for (resources) |r| {
        if (std.mem.eql(u8, r.api_version, api_version) and std.mem.eql(u8, r.kind, kind)) return r;
    }
    return null;
}

pub const Response = struct {
    status: u16,
    body: []u8,

    pub fn ok(self: Response) bool {
        return self.status >= 200 and self.status < 300;
    }

    pub fn deinit(self: *Response, gpa: std.mem.Allocator) void {
        gpa.free(self.body);
        self.* = undefined;
    }
};

pub const Client = struct {
    gpa: std.mem.Allocator,
    io: std.Io,
    config: *const Config,
    tls_ctx: tls.Context,
    auth_header: ?[]u8,

    pub fn init(gpa: std.mem.Allocator, io: std.Io, config: *const Config) !Client {
        var client: Client = .{
            .gpa = gpa,
            .io = io,
            .config = config,
            .tls_ctx = undefined,
            .auth_header = null,
        };
        // The cluster CA is in no system trust store, so it is loaded from the
        // service account rather than rescanned from the host. A plain-HTTP
        // server — a local apiserver proxy — has none, and verification is off.
        try client.tls_ctx.init(config.ca_path);
        errdefer client.tls_ctx.deinit();

        if (config.token) |token| {
            client.auth_header = try std.fmt.allocPrint(gpa, "authorization: Bearer {s}", .{token});
        }
        return client;
    }

    pub fn deinit(self: *Client) void {
        if (self.auth_header) |h| self.gpa.free(h);
        self.tls_ctx.deinit();
        self.* = undefined;
    }

    /// `/api/v1/...` for the core group, `/apis/<group>/<version>/...` for the
    /// rest. Cluster-scoped kinds drop the namespace segment entirely.
    pub fn path(
        self: *Client,
        gpa: std.mem.Allocator,
        resource: Resource,
        namespace: ?[]const u8,
        name: ?[]const u8,
    ) ![]u8 {
        var out = std.Io.Writer.Allocating.init(gpa);
        errdefer out.deinit();
        const w = &out.writer;

        try w.writeAll(self.config.server);
        if (std.mem.indexOfScalar(u8, resource.api_version, '/')) |_| {
            try w.print("/apis/{s}", .{resource.api_version});
        } else {
            try w.print("/api/{s}", .{resource.api_version});
        }
        if (resource.namespaced) {
            if (namespace) |ns| try w.print("/namespaces/{s}", .{ns});
        }
        try w.print("/{s}", .{resource.plural});
        if (name) |n| try w.print("/{s}", .{n});
        return out.toOwnedSlice();
    }

    fn send(
        self: *Client,
        gpa: std.mem.Allocator,
        method: []const u8,
        url: []const u8,
        content_type: ?[]const u8,
        body: ?[]const u8,
    ) !Response {
        var headers: std.ArrayList([]const u8) = .empty;
        defer headers.deinit(gpa);
        try headers.append(gpa, "accept: application/json");
        if (self.auth_header) |h| try headers.append(gpa, h);

        var content_type_buf: [128]u8 = undefined;
        if (content_type) |ct| {
            try headers.append(gpa, try std.fmt.bufPrint(&content_type_buf, "content-type: {s}", .{ct}));
        }

        const response = try tls.fetch(gpa, &self.tls_ctx, .{
            .method = method,
            .url = url,
            .headers = headers.items,
            .body = body,
        });
        return .{ .status = response.status, .body = response.body };
    }

    pub fn get(
        self: *Client,
        gpa: std.mem.Allocator,
        resource: Resource,
        namespace: ?[]const u8,
        name: []const u8,
    ) !Response {
        const url = try self.path(gpa, resource, namespace, name);
        defer gpa.free(url);
        return self.send(gpa, "GET", url, null, null);
    }

    /// List across all namespaces; `selector` is a label selector or "".
    pub fn list(
        self: *Client,
        gpa: std.mem.Allocator,
        resource: Resource,
        selector: []const u8,
    ) !Response {
        const base = try self.path(gpa, resource, null, null);
        defer gpa.free(base);
        const url = if (selector.len == 0)
            try gpa.dupe(u8, base)
        else
            try std.fmt.allocPrint(gpa, "{s}?labelSelector={s}", .{ base, selector });
        defer gpa.free(url);
        return self.send(gpa, "GET", url, null, null);
    }

    /// Server-side apply. `force` takes ownership of fields another manager
    /// claimed, which is what we want: a hand-edited Deployment must converge
    /// back to the declared state instead of deadlocking on a conflict.
    pub fn apply(
        self: *Client,
        gpa: std.mem.Allocator,
        resource: Resource,
        namespace: ?[]const u8,
        name: []const u8,
        body: []const u8,
    ) !Response {
        const base = try self.path(gpa, resource, namespace, name);
        defer gpa.free(base);
        const url = try std.fmt.allocPrint(
            gpa,
            "{s}?fieldManager={s}&force=true",
            .{ base, field_manager },
        );
        defer gpa.free(url);
        return self.send(gpa, "PATCH", url, apply_content_type, body);
    }

    /// Status lives on its own subresource, so it is a separate merge patch;
    /// folding it into the apply above would make the controller fight the
    /// very status it just wrote.
    pub fn patchStatus(
        self: *Client,
        gpa: std.mem.Allocator,
        resource: Resource,
        namespace: ?[]const u8,
        name: []const u8,
        body: []const u8,
    ) !Response {
        const base = try self.path(gpa, resource, namespace, name);
        defer gpa.free(base);
        const url = try std.fmt.allocPrint(gpa, "{s}/status?fieldManager={s}", .{ base, field_manager });
        defer gpa.free(url);
        return self.send(gpa, "PATCH", url, merge_content_type, body);
    }

    pub fn remove(
        self: *Client,
        gpa: std.mem.Allocator,
        resource: Resource,
        namespace: ?[]const u8,
        name: []const u8,
    ) !Response {
        const url = try self.path(gpa, resource, namespace, name);
        defer gpa.free(url);
        return self.send(gpa, "DELETE", url, null, null);
    }

    pub fn create(
        self: *Client,
        gpa: std.mem.Allocator,
        resource: Resource,
        namespace: ?[]const u8,
        body: []const u8,
    ) !Response {
        const url = try self.path(gpa, resource, namespace, null);
        defer gpa.free(url);
        return self.send(gpa, "POST", url, "application/json", body);
    }
};
