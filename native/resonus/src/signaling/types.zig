pub const NegotiationRequest = struct {
    offer_sdp: ?[]const u8 = null,
    model: ?[]const u8 = null,
    voice: ?[]const u8 = null,
    // Both required: they come from the call context. A negotiation without
    // instructions + language is refused (error.ContextRequired) — the gate
    // never invents a prompt or a language.
    instructions: ?[]const u8 = null,
    language: ?[]const u8 = null,
    safety_identifier: ?[]const u8 = null,
};

pub const NegotiationResult = union(enum) {
    sdp_answer: []u8,
    session_descriptor: []u8,
};

pub fn deinitResult(allocator: anytype, result: *NegotiationResult) void {
    switch (result.*) {
        .sdp_answer => |value| allocator.free(value),
        .session_descriptor => |value| allocator.free(value),
    }
    result.* = undefined;
}
