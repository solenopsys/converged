//! Content-addressed module cache.  A filename is a SHA-256 digest and never
//! contains a registry path, extension, or version.

const std = @import("std");
const tls = @import("tls.zig");

pub const max_module_bytes = 64 * 1024 * 1024;

pub const Error = error{ InvalidDigest, DigestMismatch, UpstreamFailed };

/// Registry locations are learned from Platform objects by the reconciler.
/// The proxy thread reads this index while the reconcile thread replaces it,
/// so URLs are copied out while holding the lock rather than borrowing the
/// map's storage across a reconciliation.
pub const Registry = struct {
    gpa: std.mem.Allocator,
    mutex: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,
    locations: std.StringHashMap([]u8),

    pub fn init(gpa: std.mem.Allocator) Registry {
        return .{ .gpa = gpa, .locations = std.StringHashMap([]u8).init(gpa) };
    }

    pub fn deinit(self: *Registry) void {
        self.lock();
        defer self.unlock();
        self.deinitMap(&self.locations);
    }

    /// Replace the allowed upstream objects with the registry maps currently
    /// declared by Platforms. The digest is the only public proxy path; a
    /// module name never crosses the proxy boundary.
    pub fn replace(self: *Registry, platforms: []const std.json.Value) !void {
        var next = std.StringHashMap([]u8).init(self.gpa);
        errdefer self.deinitMap(&next);

        for (platforms) |platform| {
            const spec = objectField(platform, "spec") orelse continue;
            const registry = objectField(spec, "registry") orelse continue;
            const base_url = stringField(registry, "url") orelse continue;
            try addMap(self.gpa, &next, base_url, objectField(registry, "modules"));
            try addMap(self.gpa, &next, base_url, objectField(registry, "workflows"));
        }

        self.lock();
        defer self.unlock();
        self.deinitMap(&self.locations);
        self.locations = next;
    }

    /// Return an owned upstream URL for a currently registered digest.
    pub fn urlFor(self: *Registry, digest: []const u8) !?[]u8 {
        self.lock();
        defer self.unlock();
        const url = self.locations.get(digest) orelse return null;
        return try self.gpa.dupe(u8, url);
    }

    fn lock(self: *Registry) void {
        _ = std.c.pthread_mutex_lock(&self.mutex);
    }

    fn unlock(self: *Registry) void {
        _ = std.c.pthread_mutex_unlock(&self.mutex);
    }

    fn deinitMap(self: *Registry, map: *std.StringHashMap([]u8)) void {
        var entries = map.iterator();
        while (entries.next()) |entry| {
            self.gpa.free(entry.key_ptr.*);
            self.gpa.free(entry.value_ptr.*);
        }
        map.deinit();
    }
};

fn addMap(gpa: std.mem.Allocator, next: *std.StringHashMap([]u8), base_url: []const u8, value: ?std.json.Value) !void {
    const map = value orelse return;
    if (map != .object) return;
    var entries = map.object.iterator();
    while (entries.next()) |entry| {
        const digest = switch (entry.value_ptr.*) {
            .string => |item| item,
            else => continue,
        };
        if (!validDigest(digest) or next.contains(digest)) continue;
        const owned_digest = try gpa.dupe(u8, digest);
        errdefer gpa.free(owned_digest);
        const fetch_url = try fetchUrl(gpa, base_url, digest);
        errdefer gpa.free(fetch_url);
        try next.put(owned_digest, fetch_url);
    }
}

fn objectField(value: std.json.Value, name: []const u8) ?std.json.Value {
    return switch (value) {
        .object => |object| object.get(name),
        else => null,
    };
}

fn stringField(value: std.json.Value, name: []const u8) ?[]const u8 {
    const field = objectField(value, name) orelse return null;
    return switch (field) {
        .string => |string| string,
        else => null,
    };
}

fn fetchUrl(gpa: std.mem.Allocator, base_url: []const u8, digest: []const u8) ![]u8 {
    return std.fmt.allocPrint(gpa, "{s}/{s}", .{ std.mem.trimEnd(u8, base_url, "/"), digest });
}

pub fn validDigest(digest: []const u8) bool {
    if (digest.len != 64) return false;
    for (digest) |c| if (!std.ascii.isHex(c)) return false;
    return true;
}

fn matchesDigest(bytes: []const u8, digest: []const u8) bool {
    var actual: [std.crypto.hash.sha2.Sha256.digest_length]u8 = undefined;
    std.crypto.hash.sha2.Sha256.hash(bytes, &actual, .{});
    for (actual, 0..) |byte, i| {
        const expected = std.fmt.parseInt(u8, digest[i * 2 .. i * 2 + 2], 16) catch return false;
        if (byte != expected) return false;
    }
    return true;
}

fn pathFor(gpa: std.mem.Allocator, directory: []const u8, digest: []const u8) ![]u8 {
    if (!validDigest(digest)) return Error.InvalidDigest;
    return std.fmt.allocPrint(gpa, "{s}/{s}", .{ std.mem.trimEnd(u8, directory, "/"), digest });
}

/// Return a verified object, fetching it only when the immutable cache misses.
/// The single proxy process handles requests serially, so direct creation is
/// sufficient: a partially written entry can never be observed by another
/// request.
pub fn get(
    gpa: std.mem.Allocator,
    io: std.Io,
    tls_ctx: *tls.Context,
    directory: []const u8,
    digest: []const u8,
    fetch_url: []const u8,
) ![]u8 {
    const path = try pathFor(gpa, directory, digest);
    defer gpa.free(path);

    const cached = read(io, gpa, directory, digest);
    if (cached) |bytes| {
        if (matchesDigest(bytes, digest)) return bytes;
        gpa.free(bytes);
        std.Io.Dir.cwd().deleteFile(io, path) catch {};
    }

    var response = try tls.fetch(gpa, tls_ctx, .{ .method = "GET", .url = fetch_url, .headers = &.{}, .body = null });
    defer response.deinit(gpa);
    if (response.status != 200) return Error.UpstreamFailed;
    if (response.body.len > max_module_bytes or !matchesDigest(response.body, digest)) return Error.DigestMismatch;

    try std.Io.Dir.cwd().createDirPath(io, directory);
    try std.Io.Dir.cwd().writeFile(io, .{ .sub_path = path, .data = response.body, .flags = .{ .truncate = true } });
    return gpa.dupe(u8, response.body);
}

/// Return a verified cached object without consulting an upstream registry.
/// This lets a running pod finish requests against the revision it started
/// with even after the Platform has advanced to a newer digest map.
pub fn read(
    io: std.Io,
    gpa: std.mem.Allocator,
    directory: []const u8,
    digest: []const u8,
) ?[]u8 {
    const path = pathFor(gpa, directory, digest) catch return null;
    defer gpa.free(path);
    const bytes = std.Io.Dir.cwd().readFileAlloc(io, path, gpa, .limited(max_module_bytes)) catch return null;
    if (matchesDigest(bytes, digest)) return bytes;
    gpa.free(bytes);
    std.Io.Dir.cwd().deleteFile(io, path) catch {};
    return null;
}

/// Serve verified entries by digest. A cache miss is fetched on demand from
/// the URL registered by the reconciler, then retained in the shared PVC.
pub fn serve(
    gpa: std.mem.Allocator,
    io: std.Io,
    tls_ctx: *tls.Context,
    directory: []const u8,
    registry: *Registry,
) void {
    const address = std.Io.net.IpAddress.parse("0.0.0.0", 8080) catch return;
    var listener = std.Io.net.IpAddress.listen(&address, io, .{ .reuse_address = true }) catch return;
    defer listener.deinit(io);
    while (true) {
        var stream = listener.accept(io) catch continue;
        defer stream.close(io);
        var in: [8192]u8 = undefined;
        var out: [8192]u8 = undefined;
        var reader = stream.reader(io, &in);
        var writer = stream.writer(io, &out);
        var server = std.http.Server.init(&reader.interface, &writer.interface);
        var request = server.receiveHead() catch continue;
        const digest = if (request.head.target.len == 65 and request.head.target[0] == '/') request.head.target[1..] else "";
        const result: union(enum) { body: []u8, not_found, upstream_failed } = blk: {
            if (request.head.method != .GET or !validDigest(digest)) break :blk .not_found;
            if (read(io, gpa, directory, digest)) |cached| break :blk .{ .body = cached };

            const fetch_url = registry.urlFor(digest) catch break :blk .upstream_failed;
            if (fetch_url == null) break :blk .not_found;
            defer gpa.free(fetch_url.?);
            const bytes = get(gpa, io, tls_ctx, directory, digest, fetch_url.?) catch |err| {
                std.log.warn("module {s} fetch failed: {s}", .{ digest, @errorName(err) });
                break :blk .upstream_failed;
            };
            break :blk .{ .body = bytes };
        };
        if (result == .body) {
            const bytes = result.body;
            defer gpa.free(bytes);
            request.respond(bytes, .{ .keep_alive = false, .extra_headers = &.{.{ .name = "content-type", .value = "application/javascript" }} }) catch {};
        } else if (result == .not_found) {
            request.respond("", .{ .status = .not_found, .keep_alive = false }) catch {};
        } else request.respond("", .{ .status = .bad_gateway, .keep_alive = false }) catch {};
    }
}

test "a digest accepts exactly lowercase or uppercase SHA-256 text" {
    try std.testing.expect(validDigest("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"));
    try std.testing.expect(!validDigest("../etc/passwd"));
    try std.testing.expect(!validDigest("abcd"));
}

test "digest is calculated from bytes, not the registry name" {
    try std.testing.expect(matchesDigest("abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"));
    try std.testing.expect(!matchesDigest("abd", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"));
}

test "registry maps declared module digests to their immutable URLs" {
    const gpa = std.testing.allocator;
    const digest = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    const json =
        \\[{"spec":{"registry":{"url":"https://modules.example.test/","modules":{"ms-struct.js":"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"}}}}]
    ;
    var parsed = try std.json.parseFromSlice(std.json.Value, gpa, json, .{});
    defer parsed.deinit();
    var registry = Registry.init(gpa);
    defer registry.deinit();
    try registry.replace(parsed.value.array.items);

    const url = (try registry.urlFor(digest)).?;
    defer gpa.free(url);
    try std.testing.expectEqualStrings("https://modules.example.test/ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", url);
    try std.testing.expect((try registry.urlFor("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")) == null);
}
