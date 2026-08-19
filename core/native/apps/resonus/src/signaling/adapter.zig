const std = @import("std");
const types = @import("types.zig");
const openai = @import("openai.zig");
const gemini = @import("gemini.zig");

pub const Provider = enum {
    openai,
    gemini,
};

pub const Adapter = union(Provider) {
    openai: openai.Adapter,
    gemini: gemini.Adapter,

    pub fn negotiate(self: *const Adapter, allocator: std.mem.Allocator, req: types.NegotiationRequest) !types.NegotiationResult {
        return switch (self.*) {
            .openai => |a| a.negotiate(allocator, req),
            .gemini => |a| a.negotiate(allocator, req),
        };
    }
};
