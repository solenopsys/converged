//! nrpc-over-HTTP transport. Matches the convention the generated `g-*` clients
//! use (nrpc/runtime/http-client.ts):
//!
//!   POST  <baseUrl>/<service>/<method>
//!   Content-Type: application/json
//!   [authorization: Bearer <RT_SERVICE_TOKEN>]   (service-to-service auth)
//!   [workspace / scope headers]                  (multi-tenant routing)
//!   body: <params JSON>
//!
//! Non-2xx replies carry `{ "error": "..." }`; we surface that text.

const std = @import("std");
const env = @import("env.zig");

pub const CallResult = struct {
    status: u16,
    /// `alloc`-owned response body (the method's JSON result, or an error doc).
    body: []u8,
};

pub fn call(
    io: std.Io,
    alloc: std.mem.Allocator,
    base_url: []const u8,
    service: []const u8,
    method: []const u8,
    body_json: []const u8,
    scope: []const u8,
) !CallResult {
    const url = try std.fmt.allocPrint(alloc, "{s}/{s}/{s}", .{ base_url, service, method });
    defer alloc.free(url);

    var client: std.http.Client = .{ .allocator = alloc, .io = io };
    defer client.deinit();

    var resp = std.Io.Writer.Allocating.init(alloc);
    defer resp.deinit();

    // Optional service-to-service + tenant headers, populated only when present.
    var headers_buf: [3]std.http.Header = undefined;
    var n: usize = 0;
    headers_buf[n] = .{ .name = "content-type", .value = "application/json" };
    n += 1;
    var auth_value: ?[]u8 = null;
    defer if (auth_value) |v| alloc.free(v);
    if (env.opt("RT_SERVICE_TOKEN")) |tok| {
        auth_value = try std.fmt.allocPrint(alloc, "Bearer {s}", .{tok});
        headers_buf[n] = .{ .name = "authorization", .value = auth_value.? };
        n += 1;
    }
    if (scope.len > 0) {
        headers_buf[n] = .{ .name = "scope", .value = scope };
        n += 1;
    }

    const result = try client.fetch(.{
        .location = .{ .url = url },
        .method = .POST,
        .payload = body_json,
        .extra_headers = headers_buf[0..n],
        .response_writer = &resp.writer,
    });

    const body = try alloc.dupe(u8, resp.written());
    return .{ .status = @intFromEnum(result.status), .body = body };
}
