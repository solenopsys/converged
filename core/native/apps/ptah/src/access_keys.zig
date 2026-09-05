//! The platform's own signing key.
//!
//! The signing key is minted from a persisted seed. Issuer and audience are
//! supplied by the controller environment and are never inferred here.
//!
//! The key is derived from a 32-byte seed the reconciler stores once. Rotating
//! it invalidates every token already issued under it, so the seed is written
//! on first sight and never rewritten: a pass that regenerated it would sign
//! every user out on a resync. Derivation is deterministic, which is what lets
//! the policy stay a pure function — it asks for the material on every pass and
//! is handed the same answer.

const std = @import("std");

const Ed25519 = std.crypto.sign.Ed25519;
const b64 = std.base64.url_safe_no_pad.Encoder;

/// Ten years. A service token is not a session: it is renewed by redeploying,
/// and an expiry short enough to matter would take the platform down with it.
const token_lifetime_seconds = 10 * 365 * 24 * 60 * 60;

pub const Material = struct {
    kid: []u8,
    private_jwk: []u8,
    public_jwks: []u8,
    service_token: []u8,

    pub fn deinit(self: *Material, gpa: std.mem.Allocator) void {
        gpa.free(self.kid);
        gpa.free(self.private_jwk);
        gpa.free(self.public_jwks);
        gpa.free(self.service_token);
    }
};

fn encodeAlloc(gpa: std.mem.Allocator, raw: []const u8) ![]u8 {
    const out = try gpa.alloc(u8, b64.calcSize(raw.len));
    _ = b64.encode(out, raw);
    return out;
}

/// A key id that follows the key rather than the clock, so the same seed always
/// names the same key and a verifier's cache stays valid across restarts.
fn keyId(gpa: std.mem.Allocator, public: [32]u8) ![]u8 {
    var digest: [32]u8 = undefined;
    std.crypto.hash.sha2.Sha256.hash(&public, &digest, .{});
    return std.fmt.allocPrint(gpa, "{x}", .{digest[0..8]});
}

/// Derive everything the platform needs from one seed.
pub fn derive(
    gpa: std.mem.Allocator,
    seed: [32]u8,
    subject: []const u8,
    issuer: []const u8,
    audience: []const u8,
    now_seconds: i64,
) !Material {
    const pair = try Ed25519.KeyPair.generateDeterministic(seed);
    const public = pair.public_key.toBytes();

    const kid = try keyId(gpa, public);
    errdefer gpa.free(kid);

    const d = try encodeAlloc(gpa, &seed);
    defer gpa.free(d);
    const x = try encodeAlloc(gpa, &public);
    defer gpa.free(x);

    const private_jwk = try std.fmt.allocPrint(
        gpa,
        "{{\"kty\":\"OKP\",\"crv\":\"Ed25519\",\"d\":\"{s}\",\"x\":\"{s}\",\"kid\":\"{s}\"}}",
        .{ d, x, kid },
    );
    errdefer gpa.free(private_jwk);

    const public_jwks = try std.fmt.allocPrint(
        gpa,
        "{{\"keys\":[{{\"kty\":\"OKP\",\"crv\":\"Ed25519\",\"x\":\"{s}\",\"kid\":\"{s}\",\"use\":\"sig\",\"alg\":\"EdDSA\"}}]}}",
        .{ x, kid },
    );
    errdefer gpa.free(public_jwks);

    const service_token = try signServiceToken(gpa, pair, kid, subject, issuer, audience, now_seconds);
    errdefer gpa.free(service_token);

    return .{
        .kid = kid,
        .private_jwk = private_jwk,
        .public_jwks = public_jwks,
        .service_token = service_token,
    };
}

/// The bootstrap token internal runtime calls carry. It is signed by the same
/// key the platform publishes, so nothing outside the cluster has to be trusted
/// to mint it, and it never reaches a browser.
fn signServiceToken(
    gpa: std.mem.Allocator,
    pair: Ed25519.KeyPair,
    kid: []const u8,
    subject: []const u8,
    issuer: []const u8,
    audience: []const u8,
    now_seconds: i64,
) ![]u8 {
    const header_json = try std.fmt.allocPrint(
        gpa,
        "{{\"alg\":\"EdDSA\",\"kid\":\"{s}\"}}",
        .{kid},
    );
    defer gpa.free(header_json);

    const payload_json = try std.fmt.allocPrint(
        gpa,
        "{{\"typ\":\"service\",\"perm\":[\"all/all(rw)\"],\"sub\":\"{s}\",\"iss\":\"{s}\",\"aud\":\"{s}\",\"iat\":{d},\"exp\":{d}}}",
        .{ subject, issuer, audience, now_seconds, now_seconds + token_lifetime_seconds },
    );
    defer gpa.free(payload_json);

    const header = try encodeAlloc(gpa, header_json);
    defer gpa.free(header);
    const payload = try encodeAlloc(gpa, payload_json);
    defer gpa.free(payload);

    const signing_input = try std.fmt.allocPrint(gpa, "{s}.{s}", .{ header, payload });
    defer gpa.free(signing_input);

    const signature = try pair.sign(signing_input, null);
    const signature_b64 = try encodeAlloc(gpa, &signature.toBytes());
    defer gpa.free(signature_b64);

    return std.fmt.allocPrint(gpa, "{s}.{s}", .{ signing_input, signature_b64 });
}

test "the same seed derives the same key and token" {
    const gpa = std.testing.allocator;
    const seed = [_]u8{7} ** 32;

    var first = try derive(gpa, seed, "converged-runtime", "test-issuer", "test-audience", 1_700_000_000);
    defer first.deinit(gpa);
    var second = try derive(gpa, seed, "converged-runtime", "test-issuer", "test-audience", 1_700_000_000);
    defer second.deinit(gpa);

    try std.testing.expectEqualStrings(first.kid, second.kid);
    try std.testing.expectEqualStrings(first.public_jwks, second.public_jwks);
    try std.testing.expectEqualStrings(first.service_token, second.service_token);
}

test "a different seed derives a different key" {
    const gpa = std.testing.allocator;
    var a = try derive(gpa, [_]u8{1} ** 32, "x", "test-issuer", "test-audience", 0);
    defer a.deinit(gpa);
    var b = try derive(gpa, [_]u8{2} ** 32, "x", "test-issuer", "test-audience", 0);
    defer b.deinit(gpa);
    try std.testing.expect(!std.mem.eql(u8, a.kid, b.kid));
}

test "the service token verifies under the published key" {
    const gpa = std.testing.allocator;
    const seed = [_]u8{3} ** 32;
    var material = try derive(gpa, seed, "converged-runtime", "test-issuer", "test-audience", 1_700_000_000);
    defer material.deinit(gpa);

    const last_dot = std.mem.lastIndexOfScalar(u8, material.service_token, '.').?;
    const signing_input = material.service_token[0..last_dot];
    const signature_b64 = material.service_token[last_dot + 1 ..];

    var signature_bytes: [64]u8 = undefined;
    try std.base64.url_safe_no_pad.Decoder.decode(&signature_bytes, signature_b64);

    const pair = try Ed25519.KeyPair.generateDeterministic(seed);
    const signature = Ed25519.Signature.fromBytes(signature_bytes);
    try signature.verify(signing_input, pair.public_key);
}
