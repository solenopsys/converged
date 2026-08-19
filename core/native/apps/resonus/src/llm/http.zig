//! One dumb HTTP helper for the LLM providers: POST a JSON body, read the whole
//! reply. The client is passed in (hub-owned, long-lived) so the connection
//! pool — and with it warm TLS sessions to the vendor — survives across calls.

const std = @import("std");

pub const Result = struct {
    status: u16,
    /// alloc-owned response body.
    body: []u8,
};

pub const LineSink = struct {
    context: *anyopaque,
    on_line: *const fn (context: *anyopaque, line: []const u8) anyerror!void,
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

/// Posts JSON and yields every received HTTP body line as soon as it arrives.
/// OpenAI and Anthropic use SSE, where each data frame is one line. Keeping
/// this low-level helper line-oriented means provider adapters retain control
/// over their event grammar without buffering a full completion.
pub fn postJsonLines(
    client: *std.http.Client,
    alloc: std.mem.Allocator,
    url: []const u8,
    extra_headers: []const std.http.Header,
    body: []const u8,
    sink: LineSink,
) !u16 {
    const uri = try std.Uri.parse(url);
    var request = try client.request(.POST, uri, .{ .extra_headers = extra_headers });
    defer request.deinit();

    try request.sendBodyComplete(@constCast(body));
    var redirect_buffer: [8192]u8 = undefined;
    var response = try request.receiveHead(&redirect_buffer);
    const status: u16 = @intFromEnum(response.head.status);
    var transfer_buffer: [8192]u8 = undefined;
    const reader = response.reader(&transfer_buffer);

    if (status < 200 or status >= 300) {
        const error_body = try reader.allocRemaining(alloc, .limited(256 * 1024));
        defer alloc.free(error_body);
        return error.HttpStatus;
    }

    while (true) {
        const line = reader.takeDelimiterInclusive('\n') catch |err| switch (err) {
            error.EndOfStream => break,
            else => return err,
        };
        try sink.on_line(sink.context, std.mem.trim(u8, line, "\r\n"));
    }
    return status;
}
