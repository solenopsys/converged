const std = @import("std");
const claims = @import("claims.zig");

pub const Key = struct {
    kid: []const u8,
    public_key: std.crypto.sign.Ed25519.PublicKey,
};

pub const Config = struct {
    issuer: []const u8,
    audience: []const u8,
    keys: []const Key,
};

pub const VerifiedToken = struct {
    raw_token: []const u8,
    token_type: claims.TokenType,
    subject: []u8,
    scope: []u8,
    permissions: []const []const u8,
    expires_at: i64,

    pub fn toClaims(self: *const VerifiedToken) claims.Claims {
        return .{
            .token_type = self.token_type,
            .subject = self.subject,
            .scope = self.scope,
            .permissions = self.permissions,
            .expires_at = self.expires_at,
        };
    }

    pub fn deinit(self: *VerifiedToken, allocator: std.mem.Allocator) void {
        allocator.free(self.subject);
        allocator.free(self.scope);
        for (self.permissions) |permission| allocator.free(permission);
        allocator.free(self.permissions);
        self.* = undefined;
    }

    /// The receiver cache never lends ownership to a request. Every dispatch
    /// gets its own short-lived copy of the verified claims.
    pub fn clone(self: *const VerifiedToken, allocator: std.mem.Allocator) std.mem.Allocator.Error!VerifiedToken {
        const subject = try allocator.dupe(u8, self.subject);
        errdefer allocator.free(subject);
        const scope = try allocator.dupe(u8, self.scope);
        errdefer allocator.free(scope);
        const permissions = try copyPermissionSlices(allocator, self.permissions);
        errdefer freePermissions(allocator, permissions);
        return .{
            .raw_token = self.raw_token,
            .token_type = self.token_type,
            .subject = subject,
            .scope = scope,
            .permissions = permissions,
            .expires_at = self.expires_at,
        };
    }
};

pub const Error = error{
    TokenMalformed,
    HeaderInvalid,
    AlgorithmRejected,
    KeyNotFound,
    SignatureInvalid,
    ClaimsInvalid,
    TokenExpired,
    IssuerRejected,
    AudienceRejected,
};

pub fn verify(
    allocator: std.mem.Allocator,
    token: []const u8,
    config: Config,
    now_unix: i64,
) (Error || std.mem.Allocator.Error)!VerifiedToken {
    const parts = split(token) orelse return error.TokenMalformed;
    const header_bytes = decode(allocator, parts.header) catch return error.HeaderInvalid;
    defer allocator.free(header_bytes);

    var header_document = std.json.parseFromSlice(std.json.Value, allocator, header_bytes, .{}) catch return error.HeaderInvalid;
    defer header_document.deinit();
    if (header_document.value != .object) return error.HeaderInvalid;
    const header = header_document.value.object;
    const algorithm = stringField(header, "alg") orelse return error.HeaderInvalid;
    if (!std.mem.eql(u8, algorithm, "EdDSA")) return error.AlgorithmRejected;
    const kid = stringField(header, "kid") orelse return error.HeaderInvalid;
    const key = findKey(config.keys, kid) orelse return error.KeyNotFound;

    const signature_bytes = decodeFixed(64, parts.signature) catch return error.TokenMalformed;
    const signature = std.crypto.sign.Ed25519.Signature.fromBytes(signature_bytes);
    signature.verifyStrict(token[0 .. parts.signature_start - 1], key.public_key) catch return error.SignatureInvalid;

    const payload_bytes = decode(allocator, parts.payload) catch return error.ClaimsInvalid;
    errdefer allocator.free(payload_bytes);
    var payload_document = std.json.parseFromSlice(std.json.Value, allocator, payload_bytes, .{}) catch return error.ClaimsInvalid;
    defer payload_document.deinit();
    if (payload_document.value != .object) return error.ClaimsInvalid;
    const payload = payload_document.value.object;

    const token_type = parseTokenType(stringField(payload, "typ") orelse return error.ClaimsInvalid) orelse return error.ClaimsInvalid;
    const subject = stringField(payload, "sub") orelse return error.ClaimsInvalid;
    const issuer = stringField(payload, "iss") orelse return error.ClaimsInvalid;
    if (!std.mem.eql(u8, issuer, config.issuer)) return error.IssuerRejected;
    const audience = stringField(payload, "aud") orelse return error.ClaimsInvalid;
    if (!std.mem.eql(u8, audience, config.audience)) return error.AudienceRejected;
    _ = integerField(payload, "iat") orelse return error.ClaimsInvalid;
    const expires_at = integerField(payload, "exp") orelse return error.ClaimsInvalid;
    if (expires_at <= now_unix) return error.TokenExpired;

    const scope = stringField(payload, "scope") orelse "";
    if (token_type == .user and scope.len == 0) return error.ClaimsInvalid;
    const permission_values = stringArrayField(payload, "perm") orelse return error.ClaimsInvalid;

    const subject_copy = try allocator.dupe(u8, subject);
    errdefer allocator.free(subject_copy);
    const scope_copy = try allocator.dupe(u8, scope);
    errdefer allocator.free(scope_copy);
    const permissions = try copyPermissions(allocator, permission_values);
    errdefer freePermissions(allocator, permissions);

    allocator.free(payload_bytes);
    return .{
        .raw_token = token,
        .token_type = token_type,
        .subject = subject_copy,
        .scope = scope_copy,
        .permissions = permissions,
        .expires_at = expires_at,
    };
}

const Parts = struct {
    header: []const u8,
    payload: []const u8,
    signature: []const u8,
    signature_start: usize,
};

fn split(token: []const u8) ?Parts {
    const first = std.mem.indexOfScalar(u8, token, '.') orelse return null;
    const second_relative = std.mem.indexOfScalar(u8, token[first + 1 ..], '.') orelse return null;
    const second = first + 1 + second_relative;
    if (std.mem.indexOfScalar(u8, token[second + 1 ..], '.') != null) return null;
    if (first == 0 or second == first + 1 or second + 1 == token.len) return null;
    return .{
        .header = token[0..first],
        .payload = token[first + 1 .. second],
        .signature = token[second + 1 ..],
        .signature_start = second + 1,
    };
}

fn decode(allocator: std.mem.Allocator, encoded: []const u8) (std.base64.Error || std.mem.Allocator.Error)![]u8 {
    const decoder = std.base64.url_safe_no_pad.Decoder;
    const size = try decoder.calcSizeForSlice(encoded);
    const result = try allocator.alloc(u8, size);
    errdefer allocator.free(result);
    try decoder.decode(result, encoded);
    return result;
}

fn decodeFixed(comptime len: usize, encoded: []const u8) std.base64.Error![len]u8 {
    const decoder = std.base64.url_safe_no_pad.Decoder;
    if (try decoder.calcSizeForSlice(encoded) != len) return error.NoSpaceLeft;
    var result: [len]u8 = undefined;
    try decoder.decode(&result, encoded);
    return result;
}

fn stringField(object: std.json.ObjectMap, name: []const u8) ?[]const u8 {
    const value = object.get(name) orelse return null;
    return if (value == .string) value.string else null;
}

fn integerField(object: std.json.ObjectMap, name: []const u8) ?i64 {
    const value = object.get(name) orelse return null;
    return if (value == .integer) value.integer else null;
}

fn stringArrayField(object: std.json.ObjectMap, name: []const u8) ?[]const std.json.Value {
    const value = object.get(name) orelse return null;
    if (value != .array) return null;
    for (value.array.items) |item| if (item != .string) return null;
    return value.array.items;
}

fn parseTokenType(value: []const u8) ?claims.TokenType {
    if (std.mem.eql(u8, value, "user")) return .user;
    if (std.mem.eql(u8, value, "service")) return .service;
    return null;
}

fn findKey(keys: []const Key, kid: []const u8) ?Key {
    for (keys) |key| {
        if (std.mem.eql(u8, key.kid, kid)) return key;
    }
    return null;
}

fn copyPermissions(allocator: std.mem.Allocator, values: []const std.json.Value) std.mem.Allocator.Error![]const []const u8 {
    const result = try allocator.alloc([]const u8, values.len);
    var copied: usize = 0;
    errdefer {
        for (result[0..copied]) |value| allocator.free(value);
        allocator.free(result);
    }
    for (values, 0..) |value, index| {
        result[index] = try allocator.dupe(u8, value.string);
        copied += 1;
    }
    return result;
}

fn freePermissions(allocator: std.mem.Allocator, permissions: []const []const u8) void {
    for (permissions) |permission| allocator.free(permission);
    allocator.free(permissions);
}

fn copyPermissionSlices(allocator: std.mem.Allocator, values: []const []const u8) std.mem.Allocator.Error![]const []const u8 {
    const result = try allocator.alloc([]const u8, values.len);
    var copied: usize = 0;
    errdefer {
        for (result[0..copied]) |value| allocator.free(value);
        allocator.free(result);
    }
    for (values, 0..) |value, index| {
        result[index] = try allocator.dupe(u8, value);
        copied += 1;
    }
    return result;
}

fn encode(allocator: std.mem.Allocator, value: []const u8) std.mem.Allocator.Error![]u8 {
    const encoder = std.base64.url_safe_no_pad.Encoder;
    const output = try allocator.alloc(u8, encoder.calcSize(value.len));
    _ = encoder.encode(output, value);
    return output;
}

fn makeToken(
    allocator: std.mem.Allocator,
    key_pair: std.crypto.sign.Ed25519.KeyPair,
    header: []const u8,
    payload: []const u8,
) ![]u8 {
    const header_part = try encode(allocator, header);
    defer allocator.free(header_part);
    const payload_part = try encode(allocator, payload);
    defer allocator.free(payload_part);
    const unsigned = try std.fmt.allocPrint(allocator, "{s}.{s}", .{ header_part, payload_part });
    defer allocator.free(unsigned);
    const signature = try key_pair.sign(unsigned, null);
    const signature_bytes = signature.toBytes();
    const signature_part = try encode(allocator, &signature_bytes);
    defer allocator.free(signature_part);
    return std.fmt.allocPrint(allocator, "{s}.{s}", .{ unsigned, signature_part });
}

test "EdDSA JWT verifies claims and preserves trusted context" {
    const seed = [_]u8{42} ** 32;
    const key_pair = try std.crypto.sign.Ed25519.KeyPair.generateDeterministic(seed);
    const keys = [_]Key{.{ .kid = "current", .public_key = key_pair.public_key }};
    const config = Config{ .issuer = "test-issuer", .audience = "test-audience", .keys = &keys };
    const token = try makeToken(
        std.testing.allocator,
        key_pair,
        "{\"alg\":\"EdDSA\",\"kid\":\"current\"}",
        "{\"typ\":\"user\",\"sub\":\"admin\",\"scope\":\"club\",\"perm\":[\"fujin/state(r)\"],\"iat\":100,\"exp\":200,\"iss\":\"test-issuer\",\"aud\":\"test-audience\"}",
    );
    defer std.testing.allocator.free(token);

    var verified = try verify(std.testing.allocator, token, config, 150);
    defer verified.deinit(std.testing.allocator);
    const result = verified.toClaims();
    try std.testing.expectEqual(claims.TokenType.user, result.token_type);
    try std.testing.expectEqualStrings("admin", result.subject);
    try std.testing.expectEqualStrings("club", result.scope);
    try std.testing.expectEqualStrings("fujin/state(r)", result.permissions[0]);
}

test "EdDSA JWT rejects tampering and invalid mandatory claims" {
    const seed = [_]u8{7} ** 32;
    const key_pair = try std.crypto.sign.Ed25519.KeyPair.generateDeterministic(seed);
    const keys = [_]Key{.{ .kid = "current", .public_key = key_pair.public_key }};
    const config = Config{ .issuer = "test-issuer", .audience = "test-audience", .keys = &keys };
    const token = try makeToken(
        std.testing.allocator,
        key_pair,
        "{\"alg\":\"EdDSA\",\"kid\":\"current\"}",
        "{\"typ\":\"user\",\"sub\":\"admin\",\"scope\":\"club\",\"perm\":[],\"iat\":100,\"exp\":200,\"iss\":\"test-issuer\",\"aud\":\"test-audience\"}",
    );
    defer std.testing.allocator.free(token);

    var tampered = try std.testing.allocator.dupe(u8, token);
    defer std.testing.allocator.free(tampered);
    const payload_start = std.mem.indexOfScalar(u8, tampered, '.').? + 1;
    tampered[payload_start] = if (tampered[payload_start] == 'A') 'B' else 'A';
    try std.testing.expectError(error.SignatureInvalid, verify(std.testing.allocator, tampered, config, 150));
    try std.testing.expectError(error.TokenExpired, verify(std.testing.allocator, token, config, 200));
    try std.testing.expectError(error.AudienceRejected, verify(std.testing.allocator, token, .{ .issuer = "test-issuer", .audience = "other", .keys = &keys }, 150));
}
