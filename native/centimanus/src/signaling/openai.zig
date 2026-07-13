const std = @import("std");
const types = @import("types.zig");
const http_util = @import("../util/http.zig");
const json_util = @import("../util/json.zig");

pub const Adapter = struct {
    api_key: []const u8,
    default_model: []const u8,
    default_voice: []const u8,
    default_transcription_model: []const u8,
    default_noise_reduction: []const u8,
    realtime_calls_url: []const u8,
    safety_identifier_override: ?[]const u8,
    vad_threshold: f32 = 0.8,
    vad_silence_ms: u32 = 600,
    vad_prefix_ms: u32 = 200,
    vad_interrupt: bool = true,

    pub fn negotiate(self: *const Adapter, allocator: std.mem.Allocator, req: types.NegotiationRequest) !types.NegotiationResult {
        const offer = req.offer_sdp orelse return error.MissingOfferSdp;
        const model = req.model orelse self.default_model;
        const voice = req.voice orelse self.default_voice;
        // Instructions + language are mandatory and carried by the call context;
        // refuse rather than fall back to any default.
        const instructions = req.instructions orelse return error.ContextRequired;
        const language = req.language orelse return error.ContextRequired;
        if (instructions.len == 0 or language.len == 0) return error.ContextRequired;

        const session = try buildSessionConfig(
            allocator,
            model,
            voice,
            self.default_transcription_model,
            language,
            self.default_noise_reduction,
            instructions,
            self.vad_threshold,
            self.vad_silence_ms,
            self.vad_prefix_ms,
            self.vad_interrupt,
            null,
        );
        defer allocator.free(session);

        var multipart = try buildRealtimeCallBody(allocator, offer, session);
        defer multipart.deinit(allocator);

        const auth = try std.fmt.allocPrint(allocator, "Bearer {s}", .{self.api_key});
        defer allocator.free(auth);

        var safety = try self.resolveSafetyIdentifier(allocator, req.safety_identifier);
        defer safety.deinit(allocator);

        var extra_storage: [1]http_util.SimpleHeader = undefined;
        var extra_headers: []const http_util.SimpleHeader = &.{};
        if (safety.value) |value| {
            extra_storage[0] = .{ .name = "OpenAI-Safety-Identifier", .value = value };
            extra_headers = extra_storage[0..1];
        }

        var resp = try http_util.post(
            allocator,
            self.realtime_calls_url,
            multipart.body,
            multipart.content_type,
            auth,
            extra_headers,
        );

        if (resp.status < 200 or resp.status >= 300) {
            defer resp.deinit(allocator);
            std.log.err("openai realtime/calls failed: status={d} url={s} model={s} body={s}", .{ resp.status, self.realtime_calls_url, model, resp.body });
            return error.OpenAISdpExchangeFailed;
        }

        return .{ .sdp_answer = resp.body };
    }

    fn resolveSafetyIdentifier(
        self: *const Adapter,
        allocator: std.mem.Allocator,
        raw_identifier: ?[]const u8,
    ) !ResolvedSafetyIdentifier {
        if (self.safety_identifier_override) |value| {
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

pub const MultipartBody = struct {
    body: []u8,
    content_type: []u8,

    pub fn deinit(self: *MultipartBody, allocator: std.mem.Allocator) void {
        allocator.free(self.body);
        allocator.free(self.content_type);
        self.* = undefined;
    }
};

pub fn buildSessionConfig(
    allocator: std.mem.Allocator,
    model: []const u8,
    voice: []const u8,
    transcription_model: []const u8,
    transcription_language: []const u8,
    noise_reduction: []const u8,
    instructions: []const u8,
    vad_threshold: f32,
    vad_silence_ms: u32,
    vad_prefix_ms: u32,
    vad_interrupt: bool,
    tools_json: ?[]const u8,
) ![]u8 {
    var body = try std.ArrayList(u8).initCapacity(allocator, 512);
    defer body.deinit(allocator);

    try body.appendSlice(allocator, "{\"type\":\"realtime\",\"model\":");
    try json_util.appendQuoted(&body, allocator, model);
    try body.appendSlice(allocator, ",\"instructions\":");
    try json_util.appendQuoted(&body, allocator, instructions);
    try body.appendSlice(allocator, ",\"output_modalities\":[\"audio\"],\"audio\":{\"input\":{\"noise_reduction\":");
    const nr = std.mem.trim(u8, noise_reduction, " \t");
    if (nr.len == 0 or std.mem.eql(u8, nr, "null") or std.mem.eql(u8, nr, "none") or std.mem.eql(u8, nr, "off")) {
        try body.appendSlice(allocator, "null");
    } else {
        try body.appendSlice(allocator, "{\"type\":");
        try json_util.appendQuoted(&body, allocator, nr);
        try body.appendSlice(allocator, "}");
    }
    const turn_detection = try std.fmt.allocPrint(
        allocator,
        ",\"turn_detection\":{{\"type\":\"server_vad\",\"threshold\":{d:.2},\"prefix_padding_ms\":{d},\"silence_duration_ms\":{d},\"create_response\":true,\"interrupt_response\":{s}}},\"transcription\":{{\"model\":",
        .{ vad_threshold, vad_prefix_ms, vad_silence_ms, if (vad_interrupt) "true" else "false" },
    );
    defer allocator.free(turn_detection);
    try body.appendSlice(allocator, turn_detection);
    try json_util.appendQuoted(&body, allocator, transcription_model);
    try body.appendSlice(allocator, ",\"language\":");
    try json_util.appendQuoted(&body, allocator, transcription_language);
    try body.appendSlice(allocator, "}},\"output\":{\"voice\":");
    try json_util.appendQuoted(&body, allocator, voice);
    try body.appendSlice(allocator, "}}");
    if (tools_json) |tools| {
        try body.appendSlice(allocator, ",\"tools\":");
        try body.appendSlice(allocator, tools);
        try body.appendSlice(allocator, ",\"tool_choice\":\"auto\"");
    }
    try body.appendSlice(allocator, "}");

    return try body.toOwnedSlice(allocator);
}

/// Session config for a transcription-only Realtime session (`type:
/// "transcription"`): no model instructions, no voice, no responses — the
/// server only runs input transcription on the media track. Audio stays Opus
/// on the WebRTC track; `language` null lets the model auto-detect.
pub fn buildTranscriptionSessionConfig(
    allocator: std.mem.Allocator,
    transcription_model: []const u8,
    transcription_language: ?[]const u8,
    noise_reduction: []const u8,
    vad_threshold: f32,
    vad_silence_ms: u32,
    vad_prefix_ms: u32,
) ![]u8 {
    var body = try std.ArrayList(u8).initCapacity(allocator, 512);
    defer body.deinit(allocator);

    try body.appendSlice(allocator, "{\"type\":\"transcription\",\"audio\":{\"input\":{\"noise_reduction\":");
    const nr = std.mem.trim(u8, noise_reduction, " \t");
    if (nr.len == 0 or std.mem.eql(u8, nr, "null") or std.mem.eql(u8, nr, "none") or std.mem.eql(u8, nr, "off")) {
        try body.appendSlice(allocator, "null");
    } else {
        try body.appendSlice(allocator, "{\"type\":");
        try json_util.appendQuoted(&body, allocator, nr);
        try body.appendSlice(allocator, "}");
    }
    const turn_detection = try std.fmt.allocPrint(
        allocator,
        ",\"turn_detection\":{{\"type\":\"server_vad\",\"threshold\":{d:.2},\"prefix_padding_ms\":{d},\"silence_duration_ms\":{d}}},\"transcription\":{{\"model\":",
        .{ vad_threshold, vad_prefix_ms, vad_silence_ms },
    );
    defer allocator.free(turn_detection);
    try body.appendSlice(allocator, turn_detection);
    try json_util.appendQuoted(&body, allocator, transcription_model);
    if (transcription_language) |language| {
        try body.appendSlice(allocator, ",\"language\":");
        try json_util.appendQuoted(&body, allocator, language);
    }
    try body.appendSlice(allocator, "}}}}");

    return try body.toOwnedSlice(allocator);
}

pub fn buildRealtimeCallBody(
    allocator: std.mem.Allocator,
    offer_sdp: []const u8,
    session_json: []const u8,
) !MultipartBody {
    const boundary = try buildBoundary(allocator, offer_sdp, session_json);
    defer allocator.free(boundary);

    return buildRealtimeCallBodyWithBoundary(allocator, offer_sdp, session_json, boundary);
}

fn buildBoundary(allocator: std.mem.Allocator, offer_sdp: []const u8, session_json: []const u8) ![]u8 {
    var hasher = std.crypto.hash.sha2.Sha256.init(.{});
    hasher.update(offer_sdp);
    hasher.update("\x00");
    hasher.update(session_json);

    var digest: [std.crypto.hash.sha2.Sha256.digest_length]u8 = undefined;
    hasher.final(&digest);

    const encoded = std.fmt.bytesToHex(digest, .lower);
    return try std.fmt.allocPrint(allocator, "centimanus-{s}", .{encoded[0..32]});
}

fn buildRealtimeCallBodyWithBoundary(
    allocator: std.mem.Allocator,
    offer_sdp: []const u8,
    session_json: []const u8,
    boundary: []const u8,
) !MultipartBody {
    var body = try std.ArrayList(u8).initCapacity(
        allocator,
        offer_sdp.len + session_json.len + boundary.len * 3 + 256,
    );
    errdefer body.deinit(allocator);

    try appendFormField(&body, allocator, boundary, "sdp", offer_sdp);
    try appendFormField(&body, allocator, boundary, "session", session_json);
    try body.appendSlice(allocator, "--");
    try body.appendSlice(allocator, boundary);
    try body.appendSlice(allocator, "--\r\n");

    const content_type = try std.fmt.allocPrint(allocator, "multipart/form-data; boundary={s}", .{boundary});
    errdefer allocator.free(content_type);

    return .{
        .body = try body.toOwnedSlice(allocator),
        .content_type = content_type,
    };
}

fn appendFormField(
    body: *std.ArrayList(u8),
    allocator: std.mem.Allocator,
    boundary: []const u8,
    name: []const u8,
    value: []const u8,
) !void {
    try body.appendSlice(allocator, "--");
    try body.appendSlice(allocator, boundary);
    try body.appendSlice(allocator, "\r\nContent-Disposition: form-data; name=\"");
    try body.appendSlice(allocator, name);
    try body.appendSlice(allocator, "\"\r\n\r\n");
    try body.appendSlice(allocator, value);
    try body.appendSlice(allocator, "\r\n");
}

test "OpenAI Realtime v2 session config shape" {
    const allocator = std.testing.allocator;

    const session = try buildSessionConfig(
        allocator,
        "gpt-realtime-2",
        "marin",
        "gpt-4o-transcribe",
        "ru",
        "far_field",
        "short answers",
        0.8,
        600,
        200,
        true,
        null,
    );
    defer allocator.free(session);

    var parsed = try std.json.parseFromSlice(std.json.Value, allocator, session, .{});
    defer parsed.deinit();

    const root = parsed.value.object;
    try std.testing.expectEqualStrings("realtime", root.get("type").?.string);
    try std.testing.expectEqualStrings("gpt-realtime-2", root.get("model").?.string);
    try std.testing.expectEqualStrings("short answers", root.get("instructions").?.string);
    try std.testing.expectEqualStrings("audio", root.get("output_modalities").?.array.items[0].string);

    const audio = root.get("audio").?.object;
    const input = audio.get("input").?.object;
    try std.testing.expectEqualStrings(
        "far_field",
        input.get("noise_reduction").?.object.get("type").?.string,
    );
    const turn_detection = input.get("turn_detection").?.object;
    try std.testing.expectEqualStrings("server_vad", turn_detection.get("type").?.string);
    try std.testing.expectEqual(@as(i64, 200), turn_detection.get("prefix_padding_ms").?.integer);
    try std.testing.expect(turn_detection.get("create_response").?.bool);
    try std.testing.expect(turn_detection.get("interrupt_response").?.bool);
    try std.testing.expectEqualStrings(
        "gpt-4o-transcribe",
        input.get("transcription").?.object.get("model").?.string,
    );
    try std.testing.expectEqualStrings(
        "ru",
        input.get("transcription").?.object.get("language").?.string,
    );
    try std.testing.expectEqualStrings("marin", audio.get("output").?.object.get("voice").?.string);
}

test "OpenAI transcription session config shape" {
    const allocator = std.testing.allocator;

    const session = try buildTranscriptionSessionConfig(
        allocator,
        "gpt-4o-transcribe",
        "ru",
        "far_field",
        0.8,
        600,
        200,
    );
    defer allocator.free(session);

    var parsed = try std.json.parseFromSlice(std.json.Value, allocator, session, .{});
    defer parsed.deinit();

    const root = parsed.value.object;
    try std.testing.expectEqualStrings("transcription", root.get("type").?.string);
    try std.testing.expect(root.get("instructions") == null);
    try std.testing.expect(root.get("output_modalities") == null);

    const input = root.get("audio").?.object.get("input").?.object;
    try std.testing.expectEqualStrings(
        "gpt-4o-transcribe",
        input.get("transcription").?.object.get("model").?.string,
    );
    try std.testing.expectEqualStrings(
        "ru",
        input.get("transcription").?.object.get("language").?.string,
    );
    try std.testing.expectEqualStrings("server_vad", input.get("turn_detection").?.object.get("type").?.string);

    // Auto-detect variant: no language key at all.
    const auto = try buildTranscriptionSessionConfig(allocator, "whisper-1", null, "none", 0.8, 600, 200);
    defer allocator.free(auto);
    var parsed_auto = try std.json.parseFromSlice(std.json.Value, allocator, auto, .{});
    defer parsed_auto.deinit();
    const auto_input = parsed_auto.value.object.get("audio").?.object.get("input").?.object;
    try std.testing.expect(auto_input.get("transcription").?.object.get("language") == null);
    try std.testing.expect(auto_input.get("noise_reduction").? == .null);
}

test "OpenAI Realtime session exposes policy tools" {
    const allocator = std.testing.allocator;
    const tools =
        \\[{"type":"function","name":"transfer_to_human","parameters":{"type":"object","properties":{}}}]
    ;
    const session = try buildSessionConfig(
        allocator,
        "gpt-realtime-2.1",
        "marin",
        "gpt-realtime-whisper",
        "en",
        "far_field",
        "help the caller",
        0.8,
        600,
        200,
        true,
        tools,
    );
    defer allocator.free(session);

    var parsed = try std.json.parseFromSlice(std.json.Value, allocator, session, .{});
    defer parsed.deinit();
    const root = parsed.value.object;
    try std.testing.expectEqualStrings("auto", root.get("tool_choice").?.string);
    try std.testing.expectEqualStrings(
        "transfer_to_human",
        root.get("tools").?.array.items[0].object.get("name").?.string,
    );
}

test "OpenAI Realtime v2 multipart body uses calls fields" {
    const allocator = std.testing.allocator;

    var multipart = try buildRealtimeCallBodyWithBoundary(
        allocator,
        "v=0\r\no=- test",
        "{\"type\":\"realtime\"}",
        "test-boundary",
    );
    defer multipart.deinit(allocator);

    try std.testing.expectEqualStrings("multipart/form-data; boundary=test-boundary", multipart.content_type);
    try std.testing.expect(std.mem.indexOf(u8, multipart.body, "name=\"sdp\"\r\n\r\nv=0\r\no=- test\r\n") != null);
    try std.testing.expect(std.mem.indexOf(u8, multipart.body, "name=\"session\"\r\n\r\n{\"type\":\"realtime\"}\r\n") != null);
    try std.testing.expect(std.mem.endsWith(u8, multipart.body, "--test-boundary--\r\n"));
}

test "OpenAI Realtime v2 generated multipart body is valid" {
    const allocator = std.testing.allocator;

    var multipart = try buildRealtimeCallBody(
        allocator,
        "v=0\r\no=- generated",
        "{\"type\":\"realtime\",\"model\":\"gpt-realtime-2\"}",
    );
    defer multipart.deinit(allocator);

    try std.testing.expect(std.mem.startsWith(u8, multipart.content_type, "multipart/form-data; boundary=centimanus-"));
    try std.testing.expect(std.mem.indexOf(u8, multipart.body, "name=\"sdp\"") != null);
    try std.testing.expect(std.mem.indexOf(u8, multipart.body, "name=\"session\"") != null);
}
