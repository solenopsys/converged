const std = @import("std");
const access = @import("access.zig");
const claims = @import("claims.zig");

pub const Level = enum {
    public,
    user,
    internal,
    /// Any authenticated principal, user or service, with its permissions still
    /// checked. `user` and `internal` each exclude one token type, so neither
    /// can describe a method both a browser and a backend service must call.
    any,
};

/// Generated from the NRPC method declaration. Transport deliberately does not
/// know generated contracts or application handlers.
pub const MethodPolicy = struct {
    /// Which kind of thing the service is: `rp` for a repository microservice,
    /// `ap` for a native application. Empty asks about any kind, which is what
    /// a policy written before kinds existed does.
    kind: []const u8 = "",
    service: []const u8,
    method: []const u8,
    level: Level = .user,
    mode: ?access.Mode = null,
};

pub const Error = error{
    UserTokenRequired,
    ServiceTokenRequired,
    PermissionDenied,
};

pub fn authorize(token: claims.Claims, policy: MethodPolicy) Error!void {
    switch (policy.level) {
        .public => return,
        .user => if (token.token_type != .user) return error.UserTokenRequired,
        .internal => if (token.token_type != .service) return error.ServiceTokenRequired,
        .any => {},
    }

    const required = policy.mode orelse access.resolveMode(policy.method);
    const matcher = access.Matcher{ .grants = token.permissions };
    if (!matcher.can(policy.kind, policy.service, policy.method, required)) return error.PermissionDenied;
}

test "authorization enforces token kind and method policy" {
    const permissions = [_]access.Grant{.{ .service = "fujin", .method = "state", .mode = .read }};
    const service_permissions = [_]access.Grant{.{ .service = "fujin", .method = "reload", .mode = .write }};
    const user = claims.Claims{
        .token_type = .user,
        .subject = "admin",
        .scope = "club",
        .permissions = &permissions,
        .expires_at = 1,
    };
    const service = claims.Claims{
        .token_type = .service,
        .subject = "worker",
        .permissions = &service_permissions,
        .expires_at = 1,
    };
    const state = MethodPolicy{ .service = "fujin", .method = "state", .mode = .read };

    try authorize(user, state);
    try std.testing.expectError(error.PermissionDenied, authorize(user, .{ .service = "fujin", .method = "messages", .mode = .read }));
    try std.testing.expectError(error.UserTokenRequired, authorize(service, state));
    try authorize(service, .{ .service = "fujin", .method = "reload", .level = .internal, .mode = .write });
}

test "a kinded policy is answered by a kinded grant" {
    const permissions = [_]access.Grant{.{ .kind = "rp", .service = "files", .method = "save", .mode = .write }};
    const claims_of = claims.Claims{
        .token_type = .user,
        .subject = "alice",
        .scope = "club",
        .permissions = &permissions,
        .expires_at = 1,
    };
    try authorize(claims_of, .{ .kind = "rp", .service = "files", .method = "save", .mode = .write });
    // The same method name reached through a native application is not covered.
    try std.testing.expectError(error.PermissionDenied, authorize(
        claims_of,
        .{ .kind = "ap", .service = "files", .method = "save", .mode = .write },
    ));
}

test "any level admits both token kinds but still enforces permissions" {
    const publish = [_]access.Grant{.{ .service = "pushrouter", .method = "publish", .mode = .write }};
    const unrelated = [_]access.Grant{.{ .service = "logs", .method = "write", .mode = .write }};
    const policy = MethodPolicy{ .service = "pushrouter", .method = "publish", .level = .any, .mode = .write };

    try authorize(.{ .token_type = .user, .subject = "alice", .scope = "club", .permissions = &publish, .expires_at = 1 }, policy);
    try authorize(.{ .token_type = .service, .subject = "orders", .permissions = &publish, .expires_at = 1 }, policy);
    try std.testing.expectError(error.PermissionDenied, authorize(
        .{ .token_type = .service, .subject = "orders", .permissions = &unrelated, .expires_at = 1 },
        policy,
    ));
}
