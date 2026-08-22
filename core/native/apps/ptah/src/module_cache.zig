//! Content-addressed module cache.  A filename is a SHA-256 digest and never
//! contains a registry path, extension, or version.

const std = @import("std");
const tls = @import("tls.zig");

pub const max_module_bytes = 64 * 1024 * 1024;

pub const Error = error{ InvalidDigest, DigestMismatch, UpstreamFailed };

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
    return std.fmt.allocPrint(gpa, "{s}/{s}", .{ std.mem.trimRight(u8, directory, "/"), digest });
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

    const cached = std.Io.Dir.cwd().readFileAlloc(io, path, gpa, .limited(max_module_bytes)) catch null;
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

/// Serve already verified entries by digest. The reconciler fills this cache
/// from registry mappings; an unrecognised or absent digest is deliberately a
/// 404 rather than a path lookup.
pub fn serve(io: std.Io, directory: []const u8) void {
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
        const body = if (request.head.method == .GET and validDigest(digest)) blk: {
            const path = pathFor(std.heap.page_allocator, directory, digest) catch break :blk null;
            defer std.heap.page_allocator.free(path);
            const bytes = std.Io.Dir.cwd().readFileAlloc(io, path, std.heap.page_allocator, .limited(max_module_bytes)) catch break :blk null;
            if (!matchesDigest(bytes, digest)) {
                std.heap.page_allocator.free(bytes);
                break :blk null;
            }
            break :blk bytes;
        } else null;
        if (body) |bytes| {
            defer std.heap.page_allocator.free(bytes);
            request.respond(bytes, .{ .keep_alive = false, .extra_headers = &.{.{ .name = "content-type", .value = "application/javascript" }} }) catch {};
        } else request.respond("", .{ .status = .not_found, .keep_alive = false }) catch {};
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
