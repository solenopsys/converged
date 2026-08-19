const std = @import("std");
const jwt = @import("jwt.zig");

/// Bounded positive cache for verified JWT claims. Entries are valid only
/// until their JWT expiration; a malformed or rejected token is never cached.
pub const Cache = struct {
    allocator: std.mem.Allocator,
    capacity: usize,
    entries: std.ArrayList(Entry) = .empty,
    mutex: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,

    const Entry = struct {
        raw_token: []u8,
        token: jwt.VerifiedToken,

        fn deinit(self: *Entry, allocator: std.mem.Allocator) void {
            allocator.free(self.raw_token);
            self.token.deinit(allocator);
            self.* = undefined;
        }
    };

    pub fn init(allocator: std.mem.Allocator, capacity: usize) Cache {
        return .{ .allocator = allocator, .capacity = @max(capacity, 1) };
    }

    pub fn deinit(self: *Cache) void {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        for (self.entries.items) |*entry| entry.deinit(self.allocator);
        self.entries.deinit(self.allocator);
        self.* = undefined;
    }

    pub fn get(self: *Cache, raw_token: []const u8, now_unix: i64) !?jwt.VerifiedToken {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        var index: usize = 0;
        while (index < self.entries.items.len) {
            const entry = &self.entries.items[index];
            if (entry.token.expires_at <= now_unix) {
                var expired = self.entries.orderedRemove(index);
                expired.deinit(self.allocator);
                continue;
            }
            if (std.mem.eql(u8, entry.raw_token, raw_token)) return try entry.token.clone(self.allocator);
            index += 1;
        }
        return null;
    }

    pub fn put(self: *Cache, raw_token: []const u8, token: *const jwt.VerifiedToken) !void {
        const raw_copy = try self.allocator.dupe(u8, raw_token);
        errdefer self.allocator.free(raw_copy);
        const token_copy = try token.clone(self.allocator);
        errdefer {
            var owned = token_copy;
            owned.deinit(self.allocator);
        }

        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        while (self.entries.items.len >= self.capacity) {
            var evicted = self.entries.orderedRemove(0);
            evicted.deinit(self.allocator);
        }
        try self.entries.append(self.allocator, .{ .raw_token = raw_copy, .token = token_copy });
    }
};

test "positive cache expires entries and returns independent claims" {
    var cache = Cache.init(std.testing.allocator, 1);
    defer cache.deinit();
    const permissions = try std.testing.allocator.dupe([]const u8, &[_][]const u8{try std.testing.allocator.dupe(u8, "fujin/state(r)")});
    var token = jwt.VerifiedToken{
        .raw_token = "token",
        .token_type = .user,
        .subject = try std.testing.allocator.dupe(u8, "admin"),
        .scope = try std.testing.allocator.dupe(u8, "club"),
        .permissions = permissions,
        .expires_at = 20,
    };
    defer token.deinit(std.testing.allocator);
    try cache.put("token", &token);

    var cached = (try cache.get("token", 10)).?;
    defer cached.deinit(std.testing.allocator);
    try std.testing.expectEqualStrings("admin", cached.subject);
    cached.subject[0] = 'A';
    var second = (try cache.get("token", 10)).?;
    defer second.deinit(std.testing.allocator);
    try std.testing.expectEqualStrings("admin", second.subject);
    try std.testing.expect(try cache.get("token", 20) == null);
}
