const types = @import("../signaling/types.zig");
const store_mod = @import("../store/store.zig");

pub const SessionInput = struct {
    phone: ?[]const u8 = null,
    context_name: ?[]const u8 = null,
    /// Caller language (e.g. landing i18n locale). Selects the context's
    /// "<lang>/<name>" variant; null falls back to any stored variant.
    language: ?[]const u8 = null,
    /// Workspace domain (landing host) the call came from; routes storage to
    /// the right tenant via the gate's domain→storage resolver.
    domain: ?[]const u8 = null,
    offer_sdp: ?[]const u8 = null,
    model: ?[]const u8 = null,
    voice: ?[]const u8 = null,
    instructions: ?[]const u8 = null,
};

pub const Resolved = struct {
    negotiation: types.NegotiationRequest,
    context_used: bool,
};

pub fn resolve(input: SessionInput, ctx: ?store_mod.Context) Resolved {
    // Instructions may be overridden inline (CLI/tests); language only ever
    // comes from the context. With neither a context nor an inline override the
    // negotiation carries nulls and the adapter refuses the call.
    const instructions = if (input.instructions != null)
        input.instructions
    else if (ctx) |c| c.instructions else null;
    const language = if (ctx) |c| c.language else null;

    return .{
        .negotiation = .{
            .offer_sdp = input.offer_sdp,
            .model = input.model,
            .voice = input.voice,
            .instructions = instructions,
            .language = language,
            .safety_identifier = input.phone,
        },
        .context_used = input.instructions == null and ctx != null,
    };
}
