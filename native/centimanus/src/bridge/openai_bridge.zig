// Full WebRTC bridge to OpenAI Realtime API.
// Establishes a peer connection, streams Opus audio bidirectionally.
const std = @import("std");
const dc_mod = @import("../native/datachannel_client.zig");
const openai_sig = @import("../signaling/openai.zig");
const http_util = @import("../util/http.zig");
const clock = @import("../util/clock.zig");
const rtp = @import("../sip/rtp.zig");

pub const AudioCallback = *const fn (data: []const u8, ctx: ?*anyopaque) void;
pub const EventCallback = *const fn (json: []const u8, ctx: ?*anyopaque) void;

// ICE state values from libdatachannel
const ICE_STATE_CONNECTED: i32 = 2;
const ICE_STATE_COMPLETED: i32 = 3;

pub const SessionKind = enum {
    /// Full conversation: the model listens AND speaks (instructions + voice).
    realtime,
    /// Transcription-only: the model just turns the inbound track into text
    /// (instructions/voice/model unused; empty transcription_language = auto).
    transcription,
};

pub const Config = struct {
    api_key: []const u8,
    calls_url: []const u8,
    session_kind: SessionKind = .realtime,
    model: []const u8,
    voice: []const u8,
    instructions: []const u8,
    transcription_model: []const u8,
    transcription_language: []const u8,
    noise_reduction: []const u8,
    vad_threshold: f32 = 0.8,
    vad_silence_ms: u32 = 600,
    vad_prefix_ms: u32 = 200,
    vad_interrupt: bool = true,
    tools_json: ?[]const u8 = null,
    safety_identifier: ?[]const u8 = null,
    stun_url: ?[]const u8 = null,
    ice_port_range_begin: u16 = 0,
    ice_port_range_end: u16 = 0,
};

/// Everything in Config except the per-call context (instructions + language).
/// Built once at startup; SIP/web assemble a full Config per call by pairing it
/// with the resolved context, so a call without a context can never be built.
pub const BaseConfig = struct {
    api_key: []const u8,
    calls_url: []const u8,
    model: []const u8,
    voice: []const u8,
    transcription_model: []const u8,
    noise_reduction: []const u8,
    vad_threshold: f32 = 0.8,
    vad_silence_ms: u32 = 600,
    vad_prefix_ms: u32 = 200,
    vad_interrupt: bool = true,
    tools_json: ?[]const u8 = null,
    safety_identifier: ?[]const u8 = null,
    stun_url: ?[]const u8 = null,
    ice_port_range_begin: u16 = 0,
    ice_port_range_end: u16 = 0,

    pub fn withContext(self: BaseConfig, instructions: []const u8, language: []const u8) Config {
        return .{
            .api_key = self.api_key,
            .calls_url = self.calls_url,
            .model = self.model,
            .voice = self.voice,
            .instructions = instructions,
            .transcription_model = self.transcription_model,
            .transcription_language = language,
            .noise_reduction = self.noise_reduction,
            .vad_threshold = self.vad_threshold,
            .vad_silence_ms = self.vad_silence_ms,
            .vad_prefix_ms = self.vad_prefix_ms,
            .vad_interrupt = self.vad_interrupt,
            .tools_json = self.tools_json,
            .safety_identifier = self.safety_identifier,
            .stun_url = self.stun_url,
            .ice_port_range_begin = self.ice_port_range_begin,
            .ice_port_range_end = self.ice_port_range_end,
        };
    }
};

pub const OpenAIBridge = struct {
    allocator: std.mem.Allocator,
    dc: *dc_mod.Client,
    cfg: Config,

    pc: i32 = -1,
    track: i32 = -1,
    dc_id: i32 = -1,

    ice_connected: std.atomic.Value(bool),
    dc_open: std.atomic.Value(bool),
    closed: std.atomic.Value(bool),

    send_seq: std.atomic.Value(u16),
    send_ts: std.atomic.Value(u32),
    send_ssrc: u32,

    on_audio: ?AudioCallback = null,
    on_audio_ctx: ?*anyopaque = null,
    on_event: ?EventCallback = null,
    on_event_ctx: ?*anyopaque = null,

    pub fn init(allocator: std.mem.Allocator, dc: *dc_mod.Client, cfg: Config) OpenAIBridge {
        return .{
            .allocator = allocator,
            .dc = dc,
            .cfg = cfg,
            .ice_connected = std.atomic.Value(bool).init(false),
            .dc_open = std.atomic.Value(bool).init(false),
            .closed = std.atomic.Value(bool).init(false),
            .send_seq = std.atomic.Value(u16).init(0),
            .send_ts = std.atomic.Value(u32).init(0),
            .send_ssrc = 12345,
        };
    }

    /// Connect to OpenAI. Blocks until ICE connected + DC open, or returns error.
    pub fn connect(self: *OpenAIBridge) !void {
        const pc = try self.dc.createPeerConnection(
            self.cfg.stun_url,
            self.cfg.ice_port_range_begin,
            self.cfg.ice_port_range_end,
        );
        self.pc = pc;
        errdefer {
            self.dc.closePeerConnection(pc);
            self.dc.deletePeerConnection(pc);
        }

        const track = try self.dc.addOpusTrack(pc, .sendrecv, 12345, 111, "0", "audio", "openai-audio", "audio-track");
        self.track = track;

        const dc_id = try self.dc.createDataChannel(pc, "oai-events");
        self.dc_id = dc_id;

        // Register callbacks — pass self as user pointer
        const user: ?*anyopaque = self;
        try self.dc.setMessageCallback(track, audioCb, user);
        try self.dc.setMessageCallback(dc_id, eventCb, user);
        try self.dc.setOpenCallback(dc_id, dcOpenCb, user);
        try self.dc.setClosedCallback(dc_id, dcClosedCb, user);
        try self.dc.setIceStateCallback(pc, iceStateCb, user);

        try self.dc.setLocalDescription(pc, "offer");

        const offer_sdp = try self.dc.getLocalDescription(self.allocator, pc, 5000);
        defer self.allocator.free(offer_sdp);

        std.log.warn("bridge: posting to OpenAI", .{});
        const answer_sdp = try self.postToOpenAI(offer_sdp);
        defer self.allocator.free(answer_sdp);

        std.log.warn("bridge: answer SDP:\n{s}", .{answer_sdp});
        try self.dc.setRemoteDescription(pc, answer_sdp, "answer");
        std.log.warn("bridge: remote description set", .{});

        try self.waitForIce(10_000);
        std.log.warn("bridge: ICE connected", .{});
        try self.waitForTrack(5_000);
        std.log.warn("bridge: track open (isOpen={})", .{self.dc.isOpen(self.track)});
        try self.waitForDc(5_000);
        std.log.warn("bridge: DC open", .{});

        // NOTE: the assistant's opening response is NOT triggered here anymore.
        // It must fire only once the LISTENER's audio path is open (browser
        // DTLS up / SIP RTP ready), otherwise the first frames are produced
        // before anyone can hear them and get dropped — the caller hears the
        // greeting mid-sentence. Callers invoke requestGreeting() at that point.
    }

    /// Send raw Opus audio to OpenAI via the RTP track (builds RTP packet manually).
    pub fn sendAudio(self: *OpenAIBridge, data: []const u8) void {
        if (self.closed.load(.acquire)) return;
        if (self.track < 0) return;
        const seq = self.send_seq.fetchAdd(1, .acq_rel);
        const ts = self.send_ts.fetchAdd(rtp.SAMPLES_PER_FRAME, .acq_rel);
        const packet = rtp.buildPacket(self.allocator, data, seq, ts, self.send_ssrc) catch return;
        defer self.allocator.free(packet);
        self.dc.sendMessage(self.track, packet) catch |err| {
            if (seq < 5) {
                std.log.warn("bridge: sendAudio failed (seq={d} isOpen={}): {s}", .{ seq, self.dc.isOpen(self.track), @errorName(err) });
            }
        };
    }

    /// Send a JSON event on the data channel.
    pub fn sendEvent(self: *OpenAIBridge, json: []const u8) void {
        if (self.closed.load(.acquire)) return;
        if (self.dc_id < 0) return;
        self.dc.sendMessage(self.dc_id, json) catch |err| {
            std.log.warn("bridge: sendEvent failed: {s}", .{@errorName(err)});
        };
    }

    pub fn close(self: *OpenAIBridge) void {
        if (self.closed.swap(true, .acq_rel)) return;
        if (self.track >= 0) self.dc.deleteId(self.track);
        if (self.dc_id >= 0) self.dc.deleteId(self.dc_id);
        if (self.pc >= 0) {
            self.dc.closePeerConnection(self.pc);
            self.dc.deletePeerConnection(self.pc);
        }
    }

    // --- Private ---

    fn postToOpenAI(self: *OpenAIBridge, offer_sdp: []const u8) ![]u8 {
        const session = switch (self.cfg.session_kind) {
            .realtime => try openai_sig.buildSessionConfig(
                self.allocator,
                self.cfg.model,
                self.cfg.voice,
                self.cfg.transcription_model,
                self.cfg.transcription_language,
                self.cfg.noise_reduction,
                self.cfg.instructions,
                self.cfg.vad_threshold,
                self.cfg.vad_silence_ms,
                self.cfg.vad_prefix_ms,
                self.cfg.vad_interrupt,
                self.cfg.tools_json,
            ),
            .transcription => try openai_sig.buildTranscriptionSessionConfig(
                self.allocator,
                self.cfg.transcription_model,
                if (self.cfg.transcription_language.len == 0) null else self.cfg.transcription_language,
                self.cfg.noise_reduction,
                self.cfg.vad_threshold,
                self.cfg.vad_silence_ms,
                self.cfg.vad_prefix_ms,
            ),
        };
        defer self.allocator.free(session);

        var multipart = try openai_sig.buildRealtimeCallBody(self.allocator, offer_sdp, session);
        defer multipart.deinit(self.allocator);

        const auth = try std.fmt.allocPrint(self.allocator, "Bearer {s}", .{self.cfg.api_key});
        defer self.allocator.free(auth);

        var safety_storage: [1]http_util.SimpleHeader = undefined;
        var extra_headers: []const http_util.SimpleHeader = &.{};
        var safety_val: ?[]const u8 = null;
        var safety_owned: ?[]u8 = null;
        defer if (safety_owned) |v| self.allocator.free(v);

        if (self.cfg.safety_identifier) |raw| {
            const trimmed = std.mem.trim(u8, raw, " \t\r\n");
            if (trimmed.len > 0) {
                var digest: [std.crypto.hash.sha2.Sha256.digest_length]u8 = undefined;
                std.crypto.hash.sha2.Sha256.hash(trimmed, &digest, .{});
                const encoded = std.fmt.bytesToHex(digest, .lower);
                safety_owned = try self.allocator.dupe(u8, &encoded);
                safety_val = safety_owned.?;
            }
        }
        if (safety_val) |v| {
            safety_storage[0] = .{ .name = "OpenAI-Safety-Identifier", .value = v };
            extra_headers = safety_storage[0..1];
        }

        var resp = try http_util.post(
            self.allocator,
            self.cfg.calls_url,
            multipart.body,
            multipart.content_type,
            auth,
            extra_headers,
        );
        if (resp.status < 200 or resp.status >= 300) {
            defer resp.deinit(self.allocator);
            std.log.err("bridge: OpenAI SDP exchange failed, status={d}", .{resp.status});
            return error.OpenAISdpExchangeFailed;
        }
        return resp.body; // caller owns
    }

    fn waitForIce(self: *OpenAIBridge, timeout_ms: u64) !void {
        const step_ms: u64 = 50;
        var elapsed: u64 = 0;
        while (elapsed < timeout_ms) : (elapsed += step_ms) {
            if (self.ice_connected.load(.acquire)) return;
            clock.sleepMs(step_ms);
        }
        return error.IceConnectionTimeout;
    }

    fn waitForTrack(self: *OpenAIBridge, timeout_ms: u64) !void {
        const step_ms: u64 = 20;
        var elapsed: u64 = 0;
        while (elapsed < timeout_ms) : (elapsed += step_ms) {
            if (self.track >= 0 and self.dc.isOpen(self.track)) return;
            clock.sleepMs(step_ms);
        }
        return error.TrackOpenTimeout;
    }

    fn waitForDc(self: *OpenAIBridge, timeout_ms: u64) !void {
        const step_ms: u64 = 20;
        var elapsed: u64 = 0;
        while (elapsed < timeout_ms) : (elapsed += step_ms) {
            if (self.dc_open.load(.acquire)) return;
            clock.sleepMs(step_ms);
        }
        return error.DataChannelOpenTimeout;
    }

    fn sendResponseCreate(self: *OpenAIBridge) !void {
        const msg = "{\"type\":\"response.create\",\"response\":{\"output_modalities\":[\"audio\"]}}";
        if (!self.dc.isOpen(self.dc_id)) return error.DataChannelNotOpen;
        try self.dc.sendMessage(self.dc_id, msg);
    }

    /// Trigger the assistant's opening response (greeting). Call this only once
    /// the listener can actually receive audio (browser track open / SIP RTP up)
    /// so the opening words aren't dropped. Non-fatal: logs on failure.
    pub fn requestGreeting(self: *OpenAIBridge) void {
        self.sendResponseCreate() catch |err| {
            std.log.warn("bridge: requestGreeting failed: {s}", .{@errorName(err)});
        };
    }
};

// --- C-compatible callbacks (called from libdatachannel C++ threads) ---

fn audioCb(id: i32, data: [*]const u8, len: usize, user: ?*anyopaque) callconv(.c) void {
    _ = id;
    const self: *OpenAIBridge = @ptrCast(@alignCast(user.?));
    if (self.closed.load(.acquire)) return;
    if (self.on_audio) |cb| {
        cb(data[0..len], self.on_audio_ctx);
    }
}

fn eventCb(id: i32, data: [*]const u8, len: usize, user: ?*anyopaque) callconv(.c) void {
    _ = id;
    const self: *OpenAIBridge = @ptrCast(@alignCast(user.?));
    if (self.closed.load(.acquire)) return;
    if (self.on_event) |cb| {
        cb(data[0..len], self.on_event_ctx);
    }
}

fn dcOpenCb(id: i32, user: ?*anyopaque) callconv(.c) void {
    _ = id;
    const self: *OpenAIBridge = @ptrCast(@alignCast(user.?));
    self.dc_open.store(true, .release);
}

fn dcClosedCb(id: i32, user: ?*anyopaque) callconv(.c) void {
    _ = id;
    const self: *OpenAIBridge = @ptrCast(@alignCast(user.?));
    self.dc_open.store(false, .release);
}

fn iceStateCb(pc: i32, state: i32, user: ?*anyopaque) callconv(.c) void {
    _ = pc;
    const self: *OpenAIBridge = @ptrCast(@alignCast(user.?));
    if (state == ICE_STATE_CONNECTED or state == ICE_STATE_COMPLETED) {
        self.ice_connected.store(true, .release);
    }
}
