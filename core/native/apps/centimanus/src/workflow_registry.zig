//! Fetch a workflow source from the Ptah proxy URL returned by ms-dag.

const std = @import("std");

pub const max_workflow_bytes = 16 * 1024 * 1024;

pub fn get(allocator: std.mem.Allocator, url: []const u8) ![]u8 {
    var client = std.http.Client{ .allocator = allocator, .io = std.Options.debug_io };
    defer client.deinit();
    const uri = try std.Uri.parse(url);
    // Ptah's proxy and the dev registry are private HTTP endpoints. Rejecting
    // other schemes makes the configuration contract explicit.
    if (!std.mem.eql(u8, uri.scheme, "http")) return error.WorkflowRegistryScheme;
    var request = try client.request(.GET, uri, .{});
    defer request.deinit();
    try request.sendBodiless();
    try request.connection.?.flush();
    var redirect_buffer: [8192]u8 = undefined;
    var response = try request.receiveHead(&redirect_buffer);
    if (response.head.status != .ok) return error.WorkflowNotFound;
    var transfer_buffer: [8192]u8 = undefined;
    var decompress: std.http.Decompress = undefined;
    var decompress_buffer: [std.compress.flate.max_window_len]u8 = undefined;
    var reader = response.readerDecompressing(&transfer_buffer, &decompress, &decompress_buffer);
    return reader.allocRemaining(allocator, .limited(max_workflow_bytes));
}
