pub const TokenType = enum {
    user,
    service,
};

/// Verified data that may cross from the auth boundary into a handler.
/// All slices point to the decoded JWT owned by the caller/cache.
pub const Claims = struct {
    token_type: TokenType,
    subject: []const u8,
    scope: []const u8 = "",
    permissions: []const []const u8 = &.{},
    expires_at: i64,
};

pub const Context = struct {
    user: []const u8,
    scope: []const u8,
    auth: []const u8,
};

pub fn context(claims: Claims, raw_token: []const u8) Context {
    return .{
        .user = claims.subject,
        .scope = claims.scope,
        .auth = raw_token,
    };
}
