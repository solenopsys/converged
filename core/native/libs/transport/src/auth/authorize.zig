const std = @import("std");
const access = @import("access.zig");
const claims = @import("claims.zig");

pub const Level = enum {
    public,
    user,
    internal,
};

/// Generated from the NRPC method declaration. Transport deliberately does not
/// know generated contracts or application handlers.
pub const MethodPolicy = struct {
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
    }

    const required = policy.mode orelse access.resolveMode(policy.method);
    const matcher = access.Matcher{ .permissions = token.permissions };
    if (!matcher.can(policy.service, policy.method, required)) return error.PermissionDenied;
}

test "authorization enforces token kind and method policy" {
    const permissions = [_][]const u8{"fujin/state(r)"};
    const service_permissions = [_][]const u8{"fujin/reload(w)"};
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
