const std = @import("std");

pub const SimpleHeader = struct {
    name: []const u8,
    value: []const u8,
};

pub const Response = struct {
    status: u16,
    body: []u8,

    pub fn deinit(self: *Response, allocator: std.mem.Allocator) void {
        allocator.free(self.body);
        self.* = undefined;
    }
};

pub fn post(
    allocator: std.mem.Allocator,
    url: []const u8,
    body: []const u8,
    content_type: ?[]const u8,
    authorization: ?[]const u8,
    extra_headers: []const SimpleHeader,
) !Response {
    var client = std.http.Client{ .allocator = allocator, .io = std.Options.debug_io };
    defer client.deinit();

    const uri = try std.Uri.parse(url);

    var headers: std.http.Client.Request.Headers = .{};
    if (content_type) |ct| headers.content_type = .{ .override = ct };
    if (authorization) |auth| headers.authorization = .{ .override = auth };

    const raw_extra = try allocator.alloc(std.http.Header, extra_headers.len);
    defer allocator.free(raw_extra);
    for (extra_headers, 0..) |h, i| {
        raw_extra[i] = .{ .name = h.name, .value = h.value };
    }

    var req = try client.request(.POST, uri, .{
        .headers = headers,
        .extra_headers = raw_extra,
    });
    defer req.deinit();

    req.transfer_encoding = .{ .content_length = body.len };
    var body_writer = try req.sendBodyUnflushed(&.{});
    if (body.len > 0) {
        try body_writer.writer.writeAll(body);
    }
    try body_writer.end();
    try req.connection.?.flush();

    var redirect_buffer: [8192]u8 = undefined;
    var response = try req.receiveHead(&redirect_buffer);
    var reader = response.reader(&.{});
    const response_body = try reader.allocRemaining(allocator, .limited(8 * 1024 * 1024));

    return .{
        .status = @intFromEnum(response.head.status),
        .body = response_body,
    };
}
