//! Generic media signaling: one SDP exchange, driven by a descriptor.
//!
//! This is what `signaling/openai.zig` and `signaling/gemini.zig` used to be.
//! Neither the endpoint, the body framing, the session configuration nor the
//! transcription settings live here any more — a hook builds the request from
//! the call's negotiation context, and this only puts it on the wire.
//!
//! The one thing the core keeps is the safety identifier. Hashing a caller's
//! number is the core's job, so a raw phone number never enters the sandbox.

const std = @import("std");
const http_util = @import("../util/http.zig");
const json_util = @import("../util/json.zig");
const registry_mod = @import("../llm/registry.zig");
const types = @import("types.zig");

/// Deployment-wide media settings. They are configuration, so the core carries
/// them; which of them a given vendor puts on the wire, and under what name, is
/// the descriptor's business.
pub const Settings = struct {
    default_model: []const u8,
    default_voice: []const u8,
    transcription_model: []const u8,
    transcription_prompt: ?[]const u8 = null,
    transcription_keywords: ?[]const u8 = null,
    transcription_delay: ?[]const u8 = null,
    noise_reduction: []const u8,
    safety_identifier_override: ?[]const u8 = null,
    vad_threshold: f32 = 0.8,
    vad_silence_ms: u32 = 600,
    vad_prefix_ms: u32 = 200,
    vad_interrupt: bool = true,
};

pub const SessionKind = enum { realtime, transcription };

pub const Negotiator = struct {
    registry: *registry_mod.Registry,
    secrets: *const registry_mod.Secrets,

    /// Exchange an SDP offer for an answer through `provider_name`.
    pub fn negotiate(
        self: *Negotiator,
        allocator: std.mem.Allocator,
        provider_name: []const u8,
        kind: SessionKind,
        settings: Settings,
        req: types.NegotiationRequest,
        tools_json: ?[]const u8,
    ) !types.NegotiationResult {
        const entry = self.registry.find(provider_name) orelse return error.ProviderNotLoaded;
        const sig = entry.table.signaling orelse return error.ProviderHasNoSignaling;

        const offer = req.offer_sdp orelse return error.MissingOfferSdp;
        const model = req.model orelse settings.default_model;
        // Instructions and language are carried by the call context. A missing
        // one is refused rather than defaulted: the gate never invents a prompt.
        const instructions = if (kind == .realtime) blk: {
            const value = req.instructions orelse return error.ContextRequired;
            if (value.len == 0) return error.ContextRequired;
            break :blk value;
        } else "";
        const language = req.language orelse if (kind == .realtime) return error.ContextRequired else "";

        var safety = try resolveSafetyIdentifier(allocator, settings, req.safety_identifier);
        defer safety.deinit(allocator);

        const context = try encodeContext(
            allocator,
            settings,
            offer,
            model,
            req.voice orelse settings.default_voice,
            instructions,
            language,
            kind,
            tools_json,
            safety.value,
        );
        defer allocator.free(context);

        const args = try std.fmt.allocPrint(allocator, "[{s}]", .{context});
        defer allocator.free(args);
        const encoded = try self.registry.callHook(allocator, provider_name, sig.encode_hook, args);
        defer allocator.free(encoded);

        const wire = std.json.parseFromSliceLeaky(std.json.Value, allocator, encoded, .{}) catch
            return error.NegotiationEncodeInvalid;
        const body = strField(wire, "body") orelse return error.NegotiationEncodeInvalid;
        const content_type = strField(wire, "contentType") orelse "application/json";

        const url = try registry_mod.substitute(allocator, sig.url, model, self.secrets);
        defer allocator.free(url);
        if (url.len == 0) return error.SignalingUrlNotConfigured;

        var headers: std.ArrayList(http_util.SimpleHeader) = .empty;
        defer headers.deinit(allocator);
        var auth: ?[]const u8 = null;
        defer if (auth) |value| allocator.free(value);

        for (sig.header_names, sig.header_values) |name, template| {
            const value = try registry_mod.substitute(allocator, template, model, self.secrets);
            // `authorization` has its own parameter in the HTTP helper.
            if (std.ascii.eqlIgnoreCase(name, "authorization")) {
                auth = value;
            } else {
                try headers.append(allocator, .{ .name = name, .value = value });
            }
        }
        // Headers the hook added for this call only (a safety identifier, say).
        if (wire == .object) {
            if (wire.object.get("headers")) |extra| {
                if (extra == .object) {
                    var it = extra.object.iterator();
                    while (it.next()) |entry_header| {
                        if (entry_header.value_ptr.* != .string) continue;
                        try headers.append(allocator, .{
                            .name = entry_header.key_ptr.*,
                            .value = entry_header.value_ptr.string,
                        });
                    }
                }
            }
        }

        var resp = try http_util.post(allocator, url, body, content_type, auth, headers.items);
        if (resp.status < 200 or resp.status >= 300) {
            defer resp.deinit(allocator);
            // The body carries the actual reason (unknown model, rejected
            // transcription field). Without it a 400 is indistinguishable from a
            // network fault and the caller only sees a session that never opens.
            std.log.err("{s} signaling failed: status={d} url={s} model={s} body={s}", .{
                provider_name, resp.status, url, model, resp.body[0..@min(600, resp.body.len)],
            });
            return error.SdpExchangeFailed;
        }

        return switch (sig.response_kind) {
            .text => .{ .sdp_answer = resp.body },
            .json => .{ .session_descriptor = resp.body },
        };
    }

    /// Build the negotiation context handed to the hook.
    fn encodeContext(
        a: std.mem.Allocator,
        settings: Settings,
        offer: []const u8,
        model: []const u8,
        voice: []const u8,
        instructions: []const u8,
        language: []const u8,
        kind: SessionKind,
        tools_json: ?[]const u8,
        safety_identifier: ?[]const u8,
    ) ![]u8 {
        const s = &settings;
        var out: std.ArrayList(u8) = .empty;
        defer out.deinit(a);

        try out.appendSlice(a, "{\"offerSdp\":");
        try json_util.appendQuoted(&out, a, offer);
        try out.appendSlice(a, ",\"model\":");
        try json_util.appendQuoted(&out, a, model);
        try out.appendSlice(a, ",\"voice\":");
        try json_util.appendQuoted(&out, a, voice);
        try out.appendSlice(a, ",\"instructions\":");
        try json_util.appendQuoted(&out, a, instructions);
        try out.appendSlice(a, ",\"sessionKind\":");
        try json_util.appendQuoted(&out, a, @tagName(kind));
        try out.appendSlice(a, ",\"noiseReduction\":");
        try json_util.appendQuoted(&out, a, s.noise_reduction);

        try out.appendSlice(a, ",\"transcription\":{\"model\":");
        try json_util.appendQuoted(&out, a, s.transcription_model);
        try out.appendSlice(a, ",\"languages\":");
        try json_util.appendQuoted(&out, a, language);
        if (s.transcription_prompt) |prompt| {
            try out.appendSlice(a, ",\"prompt\":");
            try json_util.appendQuoted(&out, a, prompt);
        }
        if (s.transcription_keywords) |keywords| {
            try out.appendSlice(a, ",\"keywords\":");
            try json_util.appendQuoted(&out, a, keywords);
        }
        if (s.transcription_delay) |delay| {
            try out.appendSlice(a, ",\"delay\":");
            try json_util.appendQuoted(&out, a, delay);
        }
        try out.appendSlice(a, "}");

        const vad = try std.fmt.allocPrint(
            a,
            ",\"vad\":{{\"threshold\":{d:.2},\"silenceMs\":{d},\"prefixMs\":{d},\"interrupt\":{}}}",
            .{ s.vad_threshold, s.vad_silence_ms, s.vad_prefix_ms, s.vad_interrupt },
        );
        defer a.free(vad);
        try out.appendSlice(a, vad);

        if (tools_json) |tools| {
            try out.appendSlice(a, ",\"toolsJson\":");
            try json_util.appendQuoted(&out, a, tools);
        }
        if (safety_identifier) |value| {
            try out.appendSlice(a, ",\"safetyIdentifier\":");
            try json_util.appendQuoted(&out, a, value);
        }
        try out.appendSlice(a, "}");

        return out.toOwnedSlice(a);
    }

    /// A caller identifier the vendor can correlate without learning who it is.
    /// Hashed here so the raw value never reaches the descriptor.
    fn resolveSafetyIdentifier(
        allocator: std.mem.Allocator,
        settings: Settings,
        raw_identifier: ?[]const u8,
    ) !ResolvedSafetyIdentifier {
        if (settings.safety_identifier_override) |value| {
            if (value.len != 0) return .{ .value = value };
        }

        const raw = raw_identifier orelse return .{};
        const trimmed = std.mem.trim(u8, raw, " \t\r\n");
        if (trimmed.len == 0) return .{};

        var digest: [std.crypto.hash.sha2.Sha256.digest_length]u8 = undefined;
        std.crypto.hash.sha2.Sha256.hash(trimmed, &digest, .{});
        const encoded = std.fmt.bytesToHex(digest, .lower);
        const owned = try allocator.dupe(u8, &encoded);
        return .{ .value = owned, .owned = owned };
    }
};

const ResolvedSafetyIdentifier = struct {
    value: ?[]const u8 = null,
    owned: ?[]u8 = null,

    fn deinit(self: *ResolvedSafetyIdentifier, allocator: std.mem.Allocator) void {
        if (self.owned) |value| allocator.free(value);
        self.* = undefined;
    }
};

fn strField(v: std.json.Value, key: []const u8) ?[]const u8 {
    if (v != .object) return null;
    const found = v.object.get(key) orelse return null;
    return switch (found) {
        .string => |s| s,
        else => null,
    };
}
