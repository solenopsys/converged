const std = @import("std");
const types = @import("types.zig");
const http_util = @import("../util/http.zig");
const json_util = @import("../util/json.zig");

pub const Adapter = struct {
    api_key: ?[]const u8,
    default_model: []const u8,
    ws_url: []const u8,
    sdp_url: ?[]const u8,

    pub fn negotiate(self: *const Adapter, allocator: std.mem.Allocator, req: types.NegotiationRequest) !types.NegotiationResult {
        if (req.offer_sdp) |offer| {
            if (self.sdp_url == null) return error.GeminiSdpUrlNotConfigured;

            const model = req.model orelse self.default_model;
            const answer = try self.exchangeSdp(allocator, model, offer);
            return .{ .sdp_answer = answer };
        }

        const descriptor = try self.buildSessionDescriptor(allocator, req.model orelse self.default_model);
        return .{ .session_descriptor = descriptor };
    }

    fn exchangeSdp(self: *const Adapter, allocator: std.mem.Allocator, model: []const u8, offer_sdp: []const u8) ![]u8 {
        const endpoint = self.sdp_url orelse return error.GeminiSdpUrlNotConfigured;
        const api_key = self.api_key orelse return error.MissingGeminiApiKey;

        const url = try std.fmt.allocPrint(allocator, "{s}?model={s}", .{ endpoint, model });
        defer allocator.free(url);

        const extra = [_]http_util.SimpleHeader{
            .{ .name = "x-goog-api-key", .value = api_key },
        };

        var resp = try http_util.post(
            allocator,
            url,
            offer_sdp,
            "application/sdp",
            null,
            &extra,
        );

        if (resp.status < 200 or resp.status >= 300) {
            defer resp.deinit(allocator);
            return error.GeminiSdpExchangeFailed;
        }

        const answer = resp.body;
        return answer;
    }

    fn buildSessionDescriptor(self: *const Adapter, allocator: std.mem.Allocator, model: []const u8) ![]u8 {
        const api_key = self.api_key orelse return error.MissingGeminiApiKey;
        const ws_url = try self.buildWsUrl(allocator, api_key);
        defer allocator.free(ws_url);

        var out = try std.ArrayList(u8).initCapacity(allocator, 256);
        defer out.deinit(allocator);

        try out.appendSlice(allocator, "{\"type\":\"gemini-live-websocket\",\"wsUrl\":");
        try json_util.appendQuoted(&out, allocator, ws_url);
        try out.appendSlice(allocator, ",\"setup\":{\"model\":");
        try json_util.appendQuoted(&out, allocator, model);
        try out.appendSlice(allocator, ",\"generationConfig\":{\"responseModalities\":[\"AUDIO\"]}}}");

        return try out.toOwnedSlice(allocator);
    }

    fn buildWsUrl(self: *const Adapter, allocator: std.mem.Allocator, api_key: []const u8) ![]u8 {
        if (std.mem.indexOfScalar(u8, self.ws_url, '?') != null) {
            return try std.fmt.allocPrint(allocator, "{s}&key={s}", .{ self.ws_url, api_key });
        }
        return try std.fmt.allocPrint(allocator, "{s}?key={s}", .{ self.ws_url, api_key });
    }
};
