const std = @import("std");
const types = @import("types.zig");
const http_util = @import("../util/http.zig");
const json_util = @import("../util/json.zig");

/// Input-transcription settings of a Realtime session (GPT-Transcribe family).
///
/// The old `whisper-1`/`gpt-4o-transcribe` shape had a single `language`; the
/// GPT-Transcribe models take a `languages` array instead, plus two accuracy
/// hints: a free-form `prompt` describing the recording and `keywords` with
/// literal domain terms. `languages`/`keywords` are comma-separated in
/// configuration and go on the wire as JSON arrays; empty means "let the model
/// decide" and the key is omitted entirely.
pub const TranscriptionOptions = struct {
    model: []const u8,
    /// Comma-separated ISO codes, e.g. "ru" or "ru,en". Empty => auto-detect.
    languages: []const u8 = "",
    /// Free-form context about the recording (topic, setting, participants).
    prompt: ?[]const u8 = null,
    /// Comma-separated literal terms expected in the audio (product names,
    /// part numbers). Hints, not forced insertions.
    keywords: ?[]const u8 = null,
    /// `gpt-live-transcribe` only: latency/accuracy trade-off, e.g. "low".
    delay: ?[]const u8 = null,
};

pub const Adapter = struct {
    api_key: []const u8,
    default_model: []const u8,
    default_voice: []const u8,
    default_transcription_model: []const u8,
    default_transcription_prompt: ?[]const u8 = null,
    default_transcription_keywords: ?[]const u8 = null,
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
            .{
                .model = self.default_transcription_model,
                .languages = language,
                .prompt = self.default_transcription_prompt,
                .keywords = self.default_transcription_keywords,
            },
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
    transcription: TranscriptionOptions,
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
        ",\"turn_detection\":{{\"type\":\"server_vad\",\"threshold\":{d:.2},\"prefix_padding_ms\":{d},\"silence_duration_ms\":{d},\"create_response\":true,\"interrupt_response\":{s}}},",
        .{ vad_threshold, vad_prefix_ms, vad_silence_ms, if (vad_interrupt) "true" else "false" },
    );
    defer allocator.free(turn_detection);
    try body.appendSlice(allocator, turn_detection);
    try appendTranscription(&body, allocator, transcription);
    try body.appendSlice(allocator, "},\"output\":{\"voice\":");
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
/// on the WebRTC track; empty `languages` lets the model auto-detect.
pub fn buildTranscriptionSessionConfig(
    allocator: std.mem.Allocator,
    transcription: TranscriptionOptions,
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
        ",\"turn_detection\":{{\"type\":\"server_vad\",\"threshold\":{d:.2},\"prefix_padding_ms\":{d},\"silence_duration_ms\":{d}}},",
        .{ vad_threshold, vad_prefix_ms, vad_silence_ms },
    );
    defer allocator.free(turn_detection);
    try body.appendSlice(allocator, turn_detection);
    try appendTranscription(&body, allocator, transcription);
    try body.appendSlice(allocator, "}}}");

    return try body.toOwnedSlice(allocator);
}

/// `"transcription":{...}` — the GPT-Transcribe input config. Optional fields
/// are omitted rather than sent empty: an empty array is a different request
/// than an absent one.
fn appendTranscription(
    body: *std.ArrayList(u8),
    allocator: std.mem.Allocator,
    transcription: TranscriptionOptions,
) !void {
    try body.appendSlice(allocator, "\"transcription\":{\"model\":");
    try json_util.appendQuoted(body, allocator, transcription.model);
    if (hasListItems(transcription.languages)) {
        try body.appendSlice(allocator, ",\"languages\":");
        try appendListAsArray(body, allocator, transcription.languages, false);
    }
    if (transcription.prompt) |prompt| {
        if (prompt.len != 0) {
            try body.appendSlice(allocator, ",\"prompt\":");
            try json_util.appendQuoted(body, allocator, prompt);
        }
    }
    if (transcription.keywords) |keywords| {
        if (hasListItems(keywords)) {
            try body.appendSlice(allocator, ",\"keywords\":");
            try appendListAsArray(body, allocator, keywords, true);
        }
    }
    if (transcription.delay) |delay| {
        if (delay.len != 0) {
            try body.appendSlice(allocator, ",\"delay\":");
            try json_util.appendQuoted(body, allocator, delay);
        }
    }
    try body.append(allocator, '}');
}

/// Iterates a comma-separated configuration list, skipping empty items.
/// Keywords carry an API-side format rule (single line, no angle brackets); a
/// violation is a configuration error, not something to sanitise.
const ListIterator = struct {
    inner: std.mem.SplitIterator(u8, .scalar),
    are_keywords: bool,

    fn next(self: *ListIterator) !?[]const u8 {
        while (self.inner.next()) |raw| {
            const item = std.mem.trim(u8, raw, " \t\r\n");
            if (item.len == 0) continue;
            if (self.are_keywords and std.mem.indexOfAny(u8, item, "<>\r\n") != null) {
                return error.InvalidTranscriptionKeyword;
            }
            return item;
        }
        return null;
    }
};

fn listItems(list: []const u8, are_keywords: bool) ListIterator {
    return .{ .inner = std.mem.splitScalar(u8, list, ','), .are_keywords = are_keywords };
}

fn hasListItems(list: []const u8) bool {
    var it = std.mem.splitScalar(u8, list, ',');
    while (it.next()) |raw| {
        if (std.mem.trim(u8, raw, " \t\r\n").len != 0) return true;
    }
    return false;
}

/// Comma-separated config value → JSON array of trimmed, non-empty items.
fn appendListAsArray(
    body: *std.ArrayList(u8),
    allocator: std.mem.Allocator,
    list: []const u8,
    are_keywords: bool,
) !void {
    try body.append(allocator, '[');
    var first = true;
    var items = listItems(list, are_keywords);
    while (try items.next()) |item| {
        if (!first) try body.append(allocator, ',');
        first = false;
        try json_util.appendQuoted(body, allocator, item);
    }
    try body.append(allocator, ']');
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

/// Derived from the payload, so the delimiter cannot collide with the content.
fn buildBoundary(allocator: std.mem.Allocator, first: []const u8, second: []const u8) ![]u8 {
    var hasher = std.crypto.hash.sha2.Sha256.init(.{});
    hasher.update(first);
    hasher.update("\x00");
    hasher.update(second);

    var digest: [std.crypto.hash.sha2.Sha256.digest_length]u8 = undefined;
    hasher.final(&digest);

    const encoded = std.fmt.bytesToHex(digest, .lower);
    return try std.fmt.allocPrint(allocator, "resonus-{s}", .{encoded[0..32]});
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
        .{
            .model = "gpt-transcribe",
            .languages = "ru, en",
            .prompt = "A support call about a CNC order.",
            .keywords = "AC-42, Premium Plus",
        },
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
    const transcription = input.get("transcription").?.object;
    try std.testing.expectEqualStrings("gpt-transcribe", transcription.get("model").?.string);
    // GPT-Transcribe replaced the singular `language` with a `languages` array.
    try std.testing.expect(transcription.get("language") == null);
    const languages = transcription.get("languages").?.array.items;
    try std.testing.expectEqual(@as(usize, 2), languages.len);
    try std.testing.expectEqualStrings("ru", languages[0].string);
    try std.testing.expectEqualStrings("en", languages[1].string);
    try std.testing.expectEqualStrings(
        "A support call about a CNC order.",
        transcription.get("prompt").?.string,
    );
    const keywords = transcription.get("keywords").?.array.items;
    try std.testing.expectEqual(@as(usize, 2), keywords.len);
    try std.testing.expectEqualStrings("AC-42", keywords[0].string);
    try std.testing.expectEqualStrings("Premium Plus", keywords[1].string);
    try std.testing.expectEqualStrings("marin", audio.get("output").?.object.get("voice").?.string);
}

test "OpenAI transcription session config shape" {
    const allocator = std.testing.allocator;

    const session = try buildTranscriptionSessionConfig(
        allocator,
        .{ .model = "gpt-live-transcribe", .languages = "ru", .delay = "low" },
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
    const transcription = input.get("transcription").?.object;
    try std.testing.expectEqualStrings("gpt-live-transcribe", transcription.get("model").?.string);
    try std.testing.expectEqualStrings("ru", transcription.get("languages").?.array.items[0].string);
    try std.testing.expectEqualStrings("low", transcription.get("delay").?.string);
    try std.testing.expectEqualStrings("server_vad", input.get("turn_detection").?.object.get("type").?.string);

    // Auto-detect variant: no languages key at all, and no unset optionals.
    const auto = try buildTranscriptionSessionConfig(
        allocator,
        .{ .model = "gpt-live-transcribe" },
        "none",
        0.8,
        600,
        200,
    );
    defer allocator.free(auto);
    var parsed_auto = try std.json.parseFromSlice(std.json.Value, allocator, auto, .{});
    defer parsed_auto.deinit();
    const auto_input = parsed_auto.value.object.get("audio").?.object.get("input").?.object;
    const auto_transcription = auto_input.get("transcription").?.object;
    try std.testing.expect(auto_transcription.get("languages") == null);
    try std.testing.expect(auto_transcription.get("prompt") == null);
    try std.testing.expect(auto_transcription.get("keywords") == null);
    try std.testing.expect(auto_transcription.get("delay") == null);
    try std.testing.expect(auto_input.get("noise_reduction").? == .null);
}

test "GPT-Transcribe keywords must be single-line literals" {
    const allocator = std.testing.allocator;

    try std.testing.expectError(error.InvalidTranscriptionKeyword, buildTranscriptionSessionConfig(
        allocator,
        .{ .model = "gpt-transcribe", .keywords = "AC-42, <injected>" },
        "none",
        0.8,
        600,
        200,
    ));
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
        .{ .model = "gpt-transcribe", .languages = "en" },
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

    try std.testing.expect(std.mem.startsWith(u8, multipart.content_type, "multipart/form-data; boundary=resonus-"));
    try std.testing.expect(std.mem.indexOf(u8, multipart.body, "name=\"sdp\"") != null);
    try std.testing.expect(std.mem.indexOf(u8, multipart.body, "name=\"session\"") != null);
}
