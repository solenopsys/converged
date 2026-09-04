const std = @import("std");
const authz = @import("authorize.zig");
const cache = @import("cache.zig");
const jwks = @import("jwks.zig");
const jwt = @import("jwt.zig");

pub const Mode = enum { off, audit, required };

/// Common native receiver boundary. Apps own no parser or access matcher: they
/// pass the generated method policy and the untrusted envelope values here.
pub const Receiver = struct {
    allocator: std.mem.Allocator,
    mode: Mode,
    issuer: []u8,
    audience: []u8,
    key_set: ?jwks.KeySet,
    verified_cache: cache.Cache,

    pub fn init(allocator: std.mem.Allocator, environ: *const std.process.Environ.Map) !Receiver {
        const mode = parseMode(environ.get("NRPC_ACCESS_MODE") orelse "off");
        const issuer = try allocator.dupe(u8, environ.get("ACCESS_JWT_ISSUER") orelse "rp-access");
        errdefer allocator.free(issuer);
        const audience = try allocator.dupe(u8, environ.get("ACCESS_JWT_AUDIENCE") orelse "cluster");
        errdefer allocator.free(audience);
        const cache_size = parseCacheSize(environ.get("NRPC_ACCESS_CACHE_SIZE") orelse "1024");
        if (mode == .off) return .{ .allocator = allocator, .mode = mode, .issuer = issuer, .audience = audience, .key_set = null, .verified_cache = cache.Cache.init(allocator, cache_size) };
        const raw_jwks = environ.get("ACCESS_JWT_PUBLIC_JWKS") orelse return error.JwtPublicJwksRequired;
        var key_set = try jwks.KeySet.parse(allocator, raw_jwks);
        errdefer key_set.deinit(allocator);
        return .{ .allocator = allocator, .mode = mode, .issuer = issuer, .audience = audience, .key_set = key_set, .verified_cache = cache.Cache.init(allocator, cache_size) };
    }

    pub fn deinit(self: *Receiver) void {
        self.allocator.free(self.issuer);
        self.allocator.free(self.audience);
        if (self.key_set) |*key_set| key_set.deinit(self.allocator);
        self.verified_cache.deinit();
        self.* = undefined;
    }

    pub fn authorize(self: *Receiver, raw_token: []const u8, envelope_user: []const u8, envelope_scope: []const u8, policy: authz.MethodPolicy, now_unix: i64) !?jwt.VerifiedToken {
        if (self.mode == .off) return null;
        const verifier = jwt.Config{ .issuer = self.issuer, .audience = self.audience, .keys = (self.key_set orelse return error.JwtVerifierUnavailable).keys };
        var token = (try self.verified_cache.get(raw_token, now_unix)) orelse jwt.verify(self.allocator, raw_token, verifier, now_unix) catch |err| {
            // A refusal is an observable event: it is recorded here, at the
            // boundary that made the decision, before the error propagates.
            self.logDenied(policy, envelope_user, envelope_scope, @errorName(err));
            if (self.mode == .audit) return null;
            return err;
        };
        errdefer token.deinit(self.allocator);
        self.verified_cache.put(raw_token, &token) catch |err| {
            std.log.warn("JWT verification cache skipped: {s}", .{@errorName(err)});
        };
        if (!std.mem.eql(u8, token.subject, envelope_user) or !std.mem.eql(u8, token.scope, envelope_scope)) {
            self.logDenied(policy, envelope_user, envelope_scope, "EnvelopeClaimsMismatch");
            if (self.mode == .audit) {
                token.deinit(self.allocator);
                return null;
            }
            return error.EnvelopeClaimsMismatch;
        }
        authz.authorize(token.toClaims(), policy) catch |err| {
            self.logDenied(policy, envelope_user, envelope_scope, @errorName(err));
            if (self.mode == .audit) {
                token.deinit(self.allocator);
                return null;
            }
            return err;
        };
        return token;
    }

    /// `audit` logs the same line as `required` — the whole point of audit mode
    /// is seeing what *would* be refused before turning enforcement on.
    fn logDenied(self: *const Receiver, policy: authz.MethodPolicy, user: []const u8, scope: []const u8, reason: []const u8) void {
        std.log.warn("deny {s}.{s} level={s} user={s} scope={s} reason={s} mode={s}", .{
            policy.service,
            policy.method,
            @tagName(policy.level),
            if (user.len > 0) user else "-",
            if (scope.len > 0) scope else "-",
            reason,
            @tagName(self.mode),
        });
    }
};

fn parseMode(raw: []const u8) Mode {
    if (std.ascii.eqlIgnoreCase(raw, "required") or std.ascii.eqlIgnoreCase(raw, "strict")) return .required;
    if (std.ascii.eqlIgnoreCase(raw, "audit") or std.ascii.eqlIgnoreCase(raw, "optional")) return .audit;
    return .off;
}

fn parseCacheSize(raw: []const u8) usize {
    return std.fmt.parseUnsigned(usize, raw, 10) catch 1024;
}
