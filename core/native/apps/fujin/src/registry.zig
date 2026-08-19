const std = @import("std");

/// Fujin routes only connection targets. A peer registers exactly one target
/// and services inside that process are selected by `Envelope.to.service`.
pub const Registry = struct {
    allocator: std.mem.Allocator,
    peers: std.ArrayList(Peer) = .empty,
    mutex: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,
    churn_joined: u32 = 0,
    churn_left: u32 = 0,
    churn_reported_s: i64 = 0,

    const churn_report_interval_s: i64 = 60;

    pub const Peer = struct {
        identity: []u8,
        target: []u8,
    };

    pub fn init(allocator: std.mem.Allocator) Registry {
        return .{ .allocator = allocator };
    }

    pub fn deinit(self: *Registry) void {
        for (self.peers.items) |peer| self.freePeer(peer);
        self.peers.deinit(self.allocator);
        self.* = undefined;
    }

    fn isEphemeral(target: []const u8) bool {
        return std.mem.indexOf(u8, target, "-health-") != null;
    }

    fn noteChurn(self: *Registry, joined: bool) void {
        if (joined) self.churn_joined += 1 else self.churn_left += 1;
        const now = std.Io.Timestamp.now(std.Options.debug_io, .real).toSeconds();
        if (self.churn_reported_s == 0) {
            self.churn_reported_s = now;
            return;
        }
        const elapsed = now - self.churn_reported_s;
        if (elapsed < churn_report_interval_s) return;
        std.log.info("peer churn +{d}/-{d} in {d}s (health probes)", .{
            self.churn_joined,
            self.churn_left,
            elapsed,
        });
        self.churn_joined = 0;
        self.churn_left = 0;
        self.churn_reported_s = now;
    }

    fn findIdentity(self: *const Registry, identity: []const u8) ?usize {
        for (self.peers.items, 0..) |peer, index| {
            if (std.mem.eql(u8, peer.identity, identity)) return index;
        }
        return null;
    }

    fn findTarget(self: *const Registry, target: []const u8) ?usize {
        for (self.peers.items, 0..) |peer, index| {
            if (std.mem.eql(u8, peer.target, target)) return index;
        }
        return null;
    }

    fn freePeer(self: *Registry, peer: Peer) void {
        self.allocator.free(peer.identity);
        self.allocator.free(peer.target);
    }

    fn removeAt(self: *Registry, index: usize, log_down: bool) void {
        const peer = self.peers.orderedRemove(index);
        if (isEphemeral(peer.target)) {
            self.noteChurn(false);
        } else if (log_down) {
            std.log.info("peer down {s} (targets={d})", .{ peer.target, self.peers.items.len });
        }
        self.freePeer(peer);
    }

    fn appendPeer(self: *Registry, identity: []const u8, target: []const u8) !void {
        const owned_identity = try self.allocator.dupe(u8, identity);
        errdefer self.allocator.free(owned_identity);
        const owned_target = try self.allocator.dupe(u8, target);
        errdefer self.allocator.free(owned_target);
        try self.peers.append(self.allocator, .{ .identity = owned_identity, .target = owned_target });
        if (isEphemeral(target)) {
            self.noteChurn(true);
        } else {
            std.log.info("peer up {s} (targets={d})", .{ target, self.peers.items.len });
        }
    }

    /// Atomically binds `target` to `identity`. Latest connection wins. The old
    /// peer is removed before the new mapping is visible, so a late disconnect
    /// notification for the old identity cannot erase the replacement.
    pub fn registerPeer(self: *Registry, identity: []const u8, target: []const u8) !void {
        if (identity.len == 0) return error.IdentityRequired;
        if (target.len == 0) return error.TargetRequired;

        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);

        if (self.findIdentity(identity)) |identity_index| {
            const current = &self.peers.items[identity_index];
            if (std.mem.eql(u8, current.target, target)) return;
            const replacement = try self.allocator.dupe(u8, target);
            self.allocator.free(current.target);
            current.target = replacement;
        }

        var index: usize = 0;
        var moved = false;
        while (index < self.peers.items.len) {
            const peer = self.peers.items[index];
            if (std.mem.eql(u8, peer.target, target) and !std.mem.eql(u8, peer.identity, identity)) {
                self.removeAt(index, false);
                moved = true;
                continue;
            }
            index += 1;
        }
        if (moved) std.log.info("target moved {s}", .{target});

        if (self.findIdentity(identity) == null) {
            try self.appendPeer(identity, target);
        }
    }

    /// Restores an absent mapping after a Fujin restart without allowing an
    /// old connection's heartbeat to steal a target from its replacement.
    pub fn refreshPeer(self: *Registry, identity: []const u8, target: []const u8) !bool {
        if (identity.len == 0 or target.len == 0) return false;
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);

        if (self.findIdentity(identity)) |index| {
            return std.mem.eql(u8, self.peers.items[index].target, target);
        }
        if (self.findTarget(target) != null) return false;
        try self.appendPeer(identity, target);
        return true;
    }

    pub fn removePeer(self: *Registry, identity: []const u8) void {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        const index = self.findIdentity(identity) orelse return;
        self.removeAt(index, true);
    }

    pub fn identityFor(self: *Registry, target: []const u8) ?[]const u8 {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        const index = self.findTarget(target) orelse return null;
        return self.peers.items[index].identity;
    }

    pub fn peerCount(self: *Registry) usize {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        return self.peers.items.len;
    }

    /// Keep the existing admin JSON shape while exposing only connection
    /// targets: `{ "services": ["services"], "behemoth": ["behemoth"] }`.
    pub fn snapshotJson(self: *Registry) ![]u8 {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);

        var out: std.Io.Writer.Allocating = .init(self.allocator);
        defer out.deinit();
        var json: std.json.Stringify = .{ .writer = &out.writer };
        try json.beginObject();
        for (self.peers.items) |peer| {
            try json.objectField(peer.target);
            try json.beginArray();
            try json.write(peer.target);
            try json.endArray();
        }
        try json.endObject();
        return out.toOwnedSlice();
    }
};

test "registered target is immediately routable" {
    var registry = Registry.init(std.testing.allocator);
    defer registry.deinit();
    try registry.registerPeer("identity-1", "services");
    try std.testing.expectEqualStrings("identity-1", registry.identityFor("services").?);
    try std.testing.expectEqual(@as(?[]const u8, null), registry.identityFor("ms:auth"));
}

test "disconnect removes the target" {
    var registry = Registry.init(std.testing.allocator);
    defer registry.deinit();
    try registry.registerPeer("identity-1", "services");
    registry.removePeer("identity-1");
    try std.testing.expectEqual(@as(?[]const u8, null), registry.identityFor("services"));
}

test "reconnect moves target and late old disconnect is harmless" {
    var registry = Registry.init(std.testing.allocator);
    defer registry.deinit();
    try registry.registerPeer("identity-old", "services");
    try registry.registerPeer("identity-new", "services");
    try std.testing.expectEqualStrings("identity-new", registry.identityFor("services").?);
    registry.removePeer("identity-old");
    try std.testing.expectEqualStrings("identity-new", registry.identityFor("services").?);
    try std.testing.expectEqual(@as(usize, 1), registry.peerCount());
}

test "one identity owns one target" {
    var registry = Registry.init(std.testing.allocator);
    defer registry.deinit();
    try registry.registerPeer("identity-1", "old-target");
    try registry.registerPeer("identity-1", "new-target");
    try std.testing.expectEqual(@as(?[]const u8, null), registry.identityFor("old-target"));
    try std.testing.expectEqualStrings("identity-1", registry.identityFor("new-target").?);
}

test "moving an identity onto an occupied target removes the old owner" {
    var registry = Registry.init(std.testing.allocator);
    defer registry.deinit();
    try registry.registerPeer("identity-1", "first");
    try registry.registerPeer("identity-2", "second");
    try registry.registerPeer("identity-1", "second");
    try std.testing.expectEqualStrings("identity-1", registry.identityFor("second").?);
    try std.testing.expectEqual(@as(usize, 1), registry.peerCount());
}

test "ordinary traffic cannot steal a target from a replacement connection" {
    var registry = Registry.init(std.testing.allocator);
    defer registry.deinit();
    try registry.registerPeer("identity-old", "services");
    try registry.registerPeer("identity-new", "services");
    try std.testing.expect(!try registry.refreshPeer("identity-old", "services"));
    try std.testing.expectEqualStrings("identity-new", registry.identityFor("services").?);
}

test "snapshot contains targets but not transport identities" {
    var registry = Registry.init(std.testing.allocator);
    defer registry.deinit();
    try registry.registerPeer("opaque-identity", "services");
    const json = try registry.snapshotJson();
    defer std.testing.allocator.free(json);
    try std.testing.expectEqualStrings("{\"services\":[\"services\"]}", json);
    try std.testing.expect(std.mem.indexOf(u8, json, "opaque-identity") == null);
}
