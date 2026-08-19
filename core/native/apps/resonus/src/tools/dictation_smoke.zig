// Isolated integration diagnostic for the OpenAI dictation media path.
//
// It intentionally bypasses Gateway, SIP, HTTP, signaling and the browser:
// Ogg/Opus fixture -> OpenAIBridge RTP -> OpenAI transcription events.
const std = @import("std");
const config_mod = @import("../config.zig");
const dc_mod = @import("../native/datachannel_client.zig");
const bridge_mod = @import("../bridge/openai_bridge.zig");
const clock = @import("../util/clock.zig");

const FRAME_MS: u64 = 20;
// Must be longer than server VAD's silence threshold; an equal duration races
// packet scheduling and can test the timeout rather than transcription.
const END_SILENCE_MS: u64 = 2_000;
const RESULT_TIMEOUT_MS: u64 = 12_000;

const Mutex = struct {
    raw: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,

    fn lock(self: *Mutex) void {
        _ = std.c.pthread_mutex_lock(&self.raw);
    }

    fn unlock(self: *Mutex) void {
        _ = std.c.pthread_mutex_unlock(&self.raw);
    }
};

const TranscriptCollector = struct {
    allocator: std.mem.Allocator,
    completed: std.ArrayList(u8) = .empty,
    delta: std.ArrayList(u8) = .empty,
    mutex: Mutex = .{},
    completed_count: std.atomic.Value(u32) = std.atomic.Value(u32).init(0),

    fn deinit(self: *TranscriptCollector) void {
        self.completed.deinit(self.allocator);
        self.delta.deinit(self.allocator);
    }

    fn onEvent(json: []const u8, ctx: ?*anyopaque) void {
        const self: *TranscriptCollector = @ptrCast(@alignCast(ctx.?));
        var parsed = std.json.parseFromSlice(std.json.Value, self.allocator, json, .{}) catch return;
        defer parsed.deinit();
        if (parsed.value != .object) return;
        const obj = &parsed.value.object;
        const type_value = obj.get("type") orelse return;
        if (type_value != .string) return;

        if (std.mem.eql(u8, type_value.string, "conversation.item.input_audio_transcription.delta")) {
            const value = obj.get("delta") orelse return;
            if (value != .string) return;
            self.mutex.lock();
            defer self.mutex.unlock();
            self.delta.appendSlice(self.allocator, value.string) catch {};
            return;
        }

        if (std.mem.eql(u8, type_value.string, "conversation.item.input_audio_transcription.completed")) {
            const value = obj.get("transcript") orelse return;
            if (value != .string or value.string.len == 0) return;
            self.mutex.lock();
            defer self.mutex.unlock();
            if (self.completed.items.len > 0) self.completed.append(self.allocator, ' ') catch return;
            self.completed.appendSlice(self.allocator, value.string) catch {};
            self.delta.clearRetainingCapacity();
            _ = self.completed_count.fetchAdd(1, .release);
            return;
        }

        if (std.mem.eql(u8, type_value.string, "error") or
            std.mem.eql(u8, type_value.string, "conversation.item.input_audio_transcription.failed"))
        {
            std.debug.print("openai_event={s}\n", .{json});
        }
    }

    fn snapshot(self: *TranscriptCollector, allocator: std.mem.Allocator) ![]u8 {
        self.mutex.lock();
        defer self.mutex.unlock();
        const source = if (self.completed.items.len > 0) self.completed.items else self.delta.items;
        return allocator.dupe(u8, source);
    }
};

const OpusPackets = struct {
    allocator: std.mem.Allocator,
    items: std.ArrayList([]u8) = .empty,

    fn deinit(self: *OpusPackets) void {
        for (self.items.items) |packet| self.allocator.free(packet);
        self.items.deinit(self.allocator);
    }
};

/// Read Ogg packets without decoding/re-encoding Opus. The first two packets
/// are OpusHead and OpusTags; every following packet is RTP payload material.
fn readOggOpus(io: std.Io, allocator: std.mem.Allocator, path: []const u8) !OpusPackets {
    const data = try std.Io.Dir.cwd().readFileAlloc(io, path, allocator, .limited(16 * 1024 * 1024));
    defer allocator.free(data);

    var result = OpusPackets{ .allocator = allocator };
    errdefer result.deinit();
    var packet = std.ArrayList(u8).empty;
    defer packet.deinit(allocator);
    var packet_index: usize = 0;
    var cursor: usize = 0;

    while (cursor < data.len) {
        if (cursor + 27 > data.len or !std.mem.eql(u8, data[cursor .. cursor + 4], "OggS")) return error.InvalidOggOpus;
        const segments_len = @as(usize, data[cursor + 26]);
        const laces_begin = cursor + 27;
        const payload_begin = laces_begin + segments_len;
        if (payload_begin > data.len) return error.InvalidOggOpus;

        var payload_cursor = payload_begin;
        for (data[laces_begin..payload_begin]) |lace| {
            const part_len = @as(usize, lace);
            if (payload_cursor + part_len > data.len) return error.InvalidOggOpus;
            try packet.appendSlice(allocator, data[payload_cursor .. payload_cursor + part_len]);
            payload_cursor += part_len;
            if (lace == 255) continue;

            if (packet_index >= 2 and packet.items.len > 0) {
                try result.items.append(allocator, try packet.toOwnedSlice(allocator));
            } else {
                packet.clearRetainingCapacity();
            }
            packet_index += 1;
        }
        cursor = payload_cursor;
    }

    if (result.items.items.len == 0) return error.NoOpusPackets;
    return result;
}

fn normalizedContains(haystack: []const u8, needle: []const u8) bool {
    var h: [2048]u8 = undefined;
    var n: [256]u8 = undefined;
    if (haystack.len > h.len or needle.len > n.len) return false;
    for (haystack, 0..) |byte, i| h[i] = if (byte >= 'A' and byte <= 'Z') byte + ('a' - 'A') else byte;
    for (needle, 0..) |byte, i| n[i] = if (byte >= 'A' and byte <= 'Z') byte + ('a' - 'A') else byte;
    return std.mem.indexOf(u8, h[0..haystack.len], n[0..needle.len]) != null;
}

fn waitForTranscript(collector: *TranscriptCollector) bool {
    var waited: u64 = 0;
    var previous_count: u32 = 0;
    var quiet_ms: u64 = 0;
    while (waited < RESULT_TIMEOUT_MS) : (waited += 100) {
        const count = collector.completed_count.load(.acquire);
        if (count > 0) {
            if (count != previous_count) {
                previous_count = count;
                quiet_ms = 0;
            } else {
                quiet_ms += 100;
                // A completed transcript can arrive in multiple VAD segments.
                // Do not declare success until no new segment appeared for a
                // full VAD window plus transport jitter.
                if (quiet_ms >= 3_000) return true;
            }
        }
        clock.sleepMs(100);
    }
    return collector.completed_count.load(.acquire) > 0;
}

fn initDataChannel(allocator: std.mem.Allocator, cfg: *const config_mod.Config) !dc_mod.Client {
    return dc_mod.Client.init(
        allocator,
        cfg.libdatachannel_wrapper_lib_path,
        cfg.libdatachannel_lib_path,
    ) catch |err| switch (err) {
        // `zig build dictation-smoke` produces these libraries itself. The
        // production config points at container paths, which are intentionally
        // not required for this isolated utility.
        error.FileNotFound => dc_mod.Client.init(
            allocator,
            ".zig-cache/realtime-wrapper/x86_64-linux-gnu/lib/libdatachannel_wrapper.so",
            ".zig-cache/realtime-wrapper/x86_64-linux-gnu/lib/libdatachannel.so",
        ),
        else => return err,
    };
}

pub fn main(init: std.process.Init) !void {
    const allocator = init.gpa;
    var args = try std.process.Args.Iterator.initAllocator(init.minimal.args, allocator);
    defer args.deinit();
    _ = args.next();
    const fixture_path = args.next() orelse "tests/fixtures/dictation-ru.opus";
    if (args.next() != null) return error.InvalidArguments;

    var cfg = try config_mod.Config.init(allocator, init.environ_map);
    defer cfg.deinit();
    const api_key = cfg.openai_api_key orelse return error.MissingOpenAIApiKey;

    var packets = try readOggOpus(init.io, allocator, fixture_path);
    defer packets.deinit();
    std.debug.print("fixture={s} opus_packets={d}\n", .{ fixture_path, packets.items.items.len });

    var dc = try initDataChannel(allocator, &cfg);
    defer dc.deinit();

    var collector = TranscriptCollector{ .allocator = allocator };
    defer collector.deinit();
    var bridge = bridge_mod.OpenAIBridge.init(allocator, &dc, .{
        .api_key = api_key,
        .calls_url = cfg.openai_realtime_calls_url,
        .session_kind = .transcription,
        .model = cfg.openai_model,
        .voice = cfg.openai_voice,
        .instructions = "",
        .transcription_model = cfg.dictation_transcription_model,
        .transcription_languages = "ru",
        .transcription_prompt = cfg.dictation_transcription_prompt,
        .transcription_keywords = cfg.dictation_transcription_keywords,
        .transcription_delay = cfg.dictation_transcription_delay,
        .noise_reduction = "near_field",
        .vad_threshold = 0.3,
        .vad_silence_ms = 1_000,
        .vad_prefix_ms = 1_000,
        .vad_interrupt = false,
        .stun_url = if (cfg.stun_url.len > 0) cfg.stun_url else null,
        .ice_port_range_begin = cfg.ice_port_range_begin,
        .ice_port_range_end = cfg.ice_port_range_end,
    });
    defer bridge.close();
    bridge.on_event = TranscriptCollector.onEvent;
    bridge.on_event_ctx = &collector;
    try bridge.connect();

    for (packets.items.items) |packet| {
        bridge.sendAudio(packet);
        clock.sleepMs(FRAME_MS);
    }
    const silence = [_]u8{0xF8};
    var elapsed: u64 = 0;
    while (elapsed < END_SILENCE_MS) : (elapsed += FRAME_MS) {
        bridge.sendAudio(&silence);
        clock.sleepMs(FRAME_MS);
    }

    if (!waitForTranscript(&collector)) return error.TranscriptionTimeout;
    const transcript = try collector.snapshot(allocator);
    defer allocator.free(transcript);
    std.debug.print("transcript={s}\n", .{transcript});

    // Numbers can be returned as digits or words. These three distant phrases
    // prove that the beginning, middle and end of the controlled utterance all
    // crossed SDP, RTP/Opus, VAD and the transcription event handler.
    // Russian, because the fixture is: GPT-Transcribe transcribes in the spoken
    // language and never translates. Only lowercase fragments are matched — the
    // comparison folds ASCII case only, and sentence capitalisation is the
    // model's choice.
    const required = [_][]const u8{
        "диктовки",
        "поле ввода",
        "весь этот текст целиком",
    };
    for (required) |phrase| {
        if (!normalizedContains(transcript, phrase)) {
            std.debug.print("missing_phrase={s}\n", .{phrase});
            return error.TranscriptMismatch;
        }
    }
    std.debug.print("dictation_smoke=ok\n", .{});
}
