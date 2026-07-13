//! One dumb HTTP helper for the LLM providers: POST a JSON body, read the whole
//! reply. The client is passed in (hub-owned, long-lived) so the connection
//! pool — and with it warm TLS sessions to the vendor — survives across calls.

const std = @import("std");

pub const Result = struct {
    status: u16,
    /// alloc-owned response body.
    body: []u8,
};

pub fn postJson(
    client: *std.http.Client,
    alloc: std.mem.Allocator,
    url: []const u8,
    extra_headers: []const std.http.Header,
    body: []const u8,
) !Result {
    var resp = std.Io.Writer.Allocating.init(alloc);
    defer resp.deinit();

    const result = try client.fetch(.{
        .location = .{ .url = url },
        .method = .POST,
        .payload = body,
        .extra_headers = extra_headers,
        .response_writer = &resp.writer,
    });

    return .{
        .status = @intFromEnum(result.status),
        .body = try alloc.dupe(u8, resp.written()),
    };
}
