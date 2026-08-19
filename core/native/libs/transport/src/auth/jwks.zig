const std = @import("std");
const jwt = @import("jwt.zig");

pub const KeySet = struct {
    keys: []jwt.Key,

    pub fn parse(allocator: std.mem.Allocator, encoded: []const u8) !KeySet {
        var document = try std.json.parseFromSlice(std.json.Value, allocator, encoded, .{});
        defer document.deinit();
        if (document.value != .object) return error.InvalidJwks;
        const raw_keys = document.value.object.get("keys") orelse return error.InvalidJwks;
        if (raw_keys != .array or raw_keys.array.items.len == 0) return error.InvalidJwks;

        var result: std.ArrayList(jwt.Key) = .empty;
        errdefer {
            for (result.items) |key| allocator.free(key.kid);
            result.deinit(allocator);
        }
        for (raw_keys.array.items) |raw_key| {
            if (raw_key != .object) return error.InvalidJwks;
            const object = raw_key.object;
            if (!std.mem.eql(u8, stringField(object, "kty") orelse return error.InvalidJwks, "OKP")) return error.InvalidJwks;
            if (!std.mem.eql(u8, stringField(object, "crv") orelse return error.InvalidJwks, "Ed25519")) return error.InvalidJwks;
            const kid = stringField(object, "kid") orelse return error.InvalidJwks;
            if (kid.len == 0) return error.InvalidJwks;
            const raw_public_key = stringField(object, "x") orelse return error.InvalidJwks;
            const public_key = try decodePublicKey(raw_public_key);
            const kid_copy = try allocator.dupe(u8, kid);
            errdefer allocator.free(kid_copy);
            try result.append(allocator, .{ .kid = kid_copy, .public_key = public_key });
        }
        return .{ .keys = try result.toOwnedSlice(allocator) };
    }

    pub fn deinit(self: *KeySet, allocator: std.mem.Allocator) void {
        for (self.keys) |key| allocator.free(key.kid);
        allocator.free(self.keys);
        self.* = undefined;
    }
};

fn stringField(object: std.json.ObjectMap, name: []const u8) ?[]const u8 {
    const value = object.get(name) orelse return null;
    return if (value == .string) value.string else null;
}

fn decodePublicKey(encoded: []const u8) !std.crypto.sign.Ed25519.PublicKey {
    const decoder = std.base64.url_safe_no_pad.Decoder;
    if (try decoder.calcSizeForSlice(encoded) != std.crypto.sign.Ed25519.PublicKey.encoded_length) return error.InvalidJwks;
    var bytes: [std.crypto.sign.Ed25519.PublicKey.encoded_length]u8 = undefined;
    decoder.decode(&bytes, encoded) catch return error.InvalidJwks;
    return std.crypto.sign.Ed25519.PublicKey.fromBytes(bytes) catch return error.InvalidJwks;
}

test "JWKS accepts only Ed25519 public keys" {
    const key_pair = try std.crypto.sign.Ed25519.KeyPair.generateDeterministic([_]u8{13} ** 32);
    const bytes = key_pair.public_key.toBytes();
    const encoded_size = std.base64.url_safe_no_pad.Encoder.calcSize(bytes.len);
    const encoded = try std.testing.allocator.alloc(u8, encoded_size);
    defer std.testing.allocator.free(encoded);
    _ = std.base64.url_safe_no_pad.Encoder.encode(encoded, &bytes);
    const document = try std.fmt.allocPrint(std.testing.allocator, "{{\"keys\":[{{\"kty\":\"OKP\",\"crv\":\"Ed25519\",\"kid\":\"one\",\"x\":\"{s}\"}}]}}", .{encoded});
    defer std.testing.allocator.free(document);

    var key_set = try KeySet.parse(std.testing.allocator, document);
    defer key_set.deinit(std.testing.allocator);
    try std.testing.expectEqual(@as(usize, 1), key_set.keys.len);
    try std.testing.expectEqualStrings("one", key_set.keys[0].kid);
    try std.testing.expectEqualSlices(u8, &bytes, &key_set.keys[0].public_key.toBytes());
}

test "JWKS rejects a symmetric or malformed key" {
    try std.testing.expectError(error.InvalidJwks, KeySet.parse(
        std.testing.allocator,
        "{\"keys\":[{\"kty\":\"oct\",\"kid\":\"bad\",\"x\":\"not-a-key\"}]}",
    ));
}
