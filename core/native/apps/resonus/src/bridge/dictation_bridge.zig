// Dictation: browser microphone → gate → OpenAI transcription-only session.
//
// This is the voice-to-text path for the chat composer, NOT a call: the model
// never answers, nothing is sent back to the browser over media, and no call /
// thread / recording rows are written. The only output is text, delivered over
// signaling as it is recognised.
//
// The browser leg is set up the same way as in web_bridge.zig, and the ordering
// constraints documented there apply verbatim (register the track callback
// before applying the remote offer, never add a track manually as the answerer,
// register the gathering callback before setLocalDescription, wait for
// gathering COMPLETE before reading the answer because we do not trickle).
const std = @import("std");
const dc_mod = @import("../native/datachannel_client.zig");
const openai_mod = @import("openai_bridge.zig");
const clock = @import("../util/clock.zig");
const audio_stats_mod = @import("../util/audio_stats.zig");
const rtp = @import("../sip/rtp.zig");

/// Recognised text on its way to the browser. `delta` is a partial phrase that
/// may still change, `segment` is a phrase the model considers final.
pub const TextKind = enum { delta, segment };

pub const TextCallback = *const fn (kind: TextKind, text: []const u8, ctx: ?*anyopaque) void;
pub const FinishCallback = *const fn (text: []const u8, ctx: ?*anyopaque) void;

/// Stop must outlive the VAD boundary. A disabled browser track continues to
/// deliver silence, which lets OpenAI close the current phrase; this deadline
/// only bounds a broken or silent transport.
const STOP_GRACE_NS: i64 = 3 * std.time.ns_per_s;

/// Browser audio diagnostic kept separate from the generic transport counter:
/// packet rate alone cannot distinguish packet loss from Opus DTX/silence.
const BrowserOpusStats = struct {
    frames: std.atomic.Value(u64) = .init(0),
    bytes: std.atomic.Value(u64) = .init(0),
    tiny_frames: std.atomic.Value(u64) = .init(0),
    sequence_gaps: std.atomic.Value(u64) = .init(0),
    last_sequence: std.atomic.Value(u32) = .init(0),
    have_sequence: std.atomic.Value(bool) = .init(false),
    window_start_ns: std.atomic.Value(i64) = .init(0),

    fn add(self: *BrowserOpusStats, session_id: []const u8, sequence: u16, opus: []const u8) void {
        _ = self.frames.fetchAdd(1, .monotonic);
        _ = self.bytes.fetchAdd(opus.len, .monotonic);
        // Opus comfort-noise/DTX packets are normally 1-3 bytes. They are
        // valid media, but a stream dominated by them did not carry speech.
        if (opus.len <= 3) _ = self.tiny_frames.fetchAdd(1, .monotonic);

        if (self.have_sequence.swap(true, .acq_rel)) {
            const previous: u16 = @truncate(self.last_sequence.swap(sequence, .acq_rel));
            const expected: u16 = previous +% 1;
            if (sequence != expected) _ = self.sequence_gaps.fetchAdd(1, .monotonic);
        } else {
            self.last_sequence.store(sequence, .release);
        }

        const now = clock.nanoTimestamp();
        const start = self.window_start_ns.load(.monotonic);
        if (start == 0) {
            _ = self.window_start_ns.cmpxchgStrong(0, now, .monotonic, .monotonic);
            return;
        }
        const elapsed = now - start;
        if (elapsed < std.time.ns_per_s) return;
        if (self.window_start_ns.cmpxchgStrong(start, now, .monotonic, .monotonic) != null) return;

        const frames = self.frames.swap(0, .monotonic);
        const bytes = self.bytes.swap(0, .monotonic);
        const tiny = self.tiny_frames.swap(0, .monotonic);
        const gaps = self.sequence_gaps.swap(0, .monotonic);
        const avg_bytes = if (frames > 0) bytes / frames else 0;
        std.log.info("dictation-audio [{s}]: frames={d}, avg_opus={d} B, dtx={d}, seq_gaps={d}", .{
            session_id,
            frames,
            avg_bytes,
            tiny,
            gaps,
        });
    }
};

const Mutex = struct {
    raw: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,

    fn lock(self: *Mutex) void {
        _ = std.c.pthread_mutex_lock(&self.raw);
    }

    fn unlock(self: *Mutex) void {
        _ = std.c.pthread_mutex_unlock(&self.raw);
    }
};

/// The transcription API has two representations of the same phrase: deltas
/// while it is still being decoded and one completed transcript after VAD. Keep
/// both. Dropping the delta buffer at stop was the source of lost last words.
const TranscriptBuffer = struct {
    committed: std.ArrayList(u8) = .empty,
    pending: std.ArrayList(u8) = .empty,
    mutex: Mutex = .{},

    fn deinit(self: *TranscriptBuffer, allocator: std.mem.Allocator) void {
        self.committed.deinit(allocator);
        self.pending.deinit(allocator);
    }

    fn appendDelta(self: *TranscriptBuffer, allocator: std.mem.Allocator, text: []const u8) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        self.pending.appendSlice(allocator, text) catch {};
    }

    fn completeSegment(self: *TranscriptBuffer, allocator: std.mem.Allocator, text: []const u8) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        if (self.committed.items.len > 0) self.committed.append(allocator, ' ') catch return;
        self.committed.appendSlice(allocator, text) catch return;
        self.pending.clearRetainingCapacity();
    }

    fn snapshot(self: *TranscriptBuffer, allocator: std.mem.Allocator) ![]u8 {
        self.mutex.lock();
        defer self.mutex.unlock();

        var output = try std.ArrayList(u8).initCapacity(allocator, self.committed.items.len + self.pending.items.len + 1);
        errdefer output.deinit(allocator);
        try output.appendSlice(allocator, self.committed.items);
        if (self.pending.items.len > 0) {
            if (output.items.len > 0) try output.append(allocator, ' ');
            try output.appendSlice(allocator, self.pending.items);
        }
        return output.toOwnedSlice(allocator);
    }
};

/// Keeps graceful user stop separate from a genuinely dead browser transport.
/// The reaper asks this controller whether a session can be destroyed; it never
/// needs to know about VAD, transcript events, or timing details.
const StopController = struct {
    requested: std.atomic.Value(bool),
    segment_completed: std.atomic.Value(bool),
    deadline_ns: std.atomic.Value(i64),

    fn init() StopController {
        return .{
            .requested = std.atomic.Value(bool).init(false),
            .segment_completed = std.atomic.Value(bool).init(false),
            .deadline_ns = std.atomic.Value(i64).init(0),
        };
    }

    fn request(self: *StopController) void {
        if (self.requested.swap(true, .acq_rel)) return;
        self.deadline_ns.store(clock.nanoTimestamp() + STOP_GRACE_NS, .release);
    }

    fn completeSegment(self: *StopController) void {
        if (self.requested.load(.acquire)) self.segment_completed.store(true, .release);
    }

    fn isRequested(self: *const StopController) bool {
        return self.requested.load(.acquire);
    }

    fn isReady(self: *const StopController, now_ns: i64) bool {
        if (!self.requested.load(.acquire)) return false;
        return self.segment_completed.load(.acquire) or now_ns >= self.deadline_ns.load(.acquire);
    }
};

/// Parse the dynamic payload type the browser assigned to Opus in its offer.
fn parseOpusPt(sdp: []const u8) ?u8 {
    var it = std.mem.splitScalar(u8, sdp, '\n');
    const prefix = "a=rtpmap:";
    while (it.next()) |raw| {
        const line = std.mem.trim(u8, raw, " \r\t");
        if (!std.mem.startsWith(u8, line, prefix)) continue;
        const rest = line[prefix.len..];
        const sp = std.mem.indexOfScalar(u8, rest, ' ') orelse continue;
        const codec = rest[sp + 1 ..];
        if (!std.ascii.startsWithIgnoreCase(codec, "opus/")) continue;
        return std.fmt.parseInt(u8, rest[0..sp], 10) catch continue;
    }
    return null;
}

pub const DictationSession = struct {
    allocator: std.mem.Allocator,
    dc: *dc_mod.Client,
    session_id: []u8,

    browser_pc: i32,
    browser_track: i32,
    track_ready: std.atomic.Value(bool),
    gathering_complete: std.atomic.Value(bool),
    browser_opus_pt: u8,

    openai: openai_mod.OpenAIBridge,

    closed: std.atomic.Value(bool),
    /// A real terminal WebRTC state (tab closed or network failure), distinct
    /// from a normal stop that must still wait for VAD to close its phrase.
    transport_disconnected: std.atomic.Value(bool),
    stop: StopController,
    transcript: TranscriptBuffer,

    /// Throughput of the microphone leg. Without it a silent dictation is
    /// indistinguishable from a broken one: both produce no text.
    in_stats: audio_stats_mod.AudioStats,
    /// Opus frames actually handed to OpenAI (post PT filter).
    forwarded: std.atomic.Value(u64),
    browser_opus_stats: BrowserOpusStats,

    on_text: ?TextCallback,
    on_text_ctx: ?*anyopaque,
    /// Called once with a stable transcript snapshot before the session's
    /// buffers are released. It finishes the deferred signaling stream.
    on_finish: ?FinishCallback = null,

    pub fn create(
        allocator: std.mem.Allocator,
        dc: *dc_mod.Client,
        session_id: []const u8,
        openai_cfg: openai_mod.Config,
        on_text: ?TextCallback,
        on_text_ctx: ?*anyopaque,
    ) !*DictationSession {
        const self = try allocator.create(DictationSession);
        errdefer allocator.destroy(self);
        const sid = try allocator.dupe(u8, session_id);
        self.* = .{
            .allocator = allocator,
            .dc = dc,
            .session_id = sid,
            .browser_pc = -1,
            .browser_track = -1,
            .track_ready = std.atomic.Value(bool).init(false),
            .gathering_complete = std.atomic.Value(bool).init(false),
            .browser_opus_pt = rtp.OPUS_PT,
            .openai = openai_mod.OpenAIBridge.init(allocator, dc, openai_cfg),
            .closed = std.atomic.Value(bool).init(false),
            .transport_disconnected = std.atomic.Value(bool).init(false),
            .stop = StopController.init(),
            .transcript = .{},
            .in_stats = .{},
            .forwarded = std.atomic.Value(u64).init(0),
            .browser_opus_stats = .{},
            .on_text = on_text,
            .on_text_ctx = on_text_ctx,
        };
        return self;
    }

    pub fn destroy(self: *DictationSession) void {
        self.close();
        const text = self.transcript.snapshot(std.heap.c_allocator) catch null;
        defer if (text) |value| std.heap.c_allocator.free(value);
        if (self.on_finish) |hook| hook(text orelse &.{}, self.on_text_ctx);
        self.transcript.deinit(self.allocator);
        self.allocator.free(self.session_id);
        self.allocator.destroy(self);
    }

    pub fn close(self: *DictationSession) void {
        if (self.closed.swap(true, .acq_rel)) return;
        self.openai.close();
        if (self.browser_track >= 0) {
            self.dc.deleteId(self.browser_track);
            self.browser_track = -1;
        }
        if (self.browser_pc >= 0) {
            self.dc.closePeerConnection(self.browser_pc);
            self.dc.deletePeerConnection(self.browser_pc);
            self.browser_pc = -1;
        }
    }

    /// Accept the browser's sendonly microphone offer, open the transcription
    /// session, return the SDP answer (caller owns).
    pub fn connect(
        self: *DictationSession,
        browser_offer: []const u8,
        stun_url: ?[]const u8,
        ice_port_range_begin: u16,
        ice_port_range_end: u16,
    ) ![]u8 {
        const sid = self.session_id;
        std.log.info("dictation [{s}]: connect start, offer {d} bytes", .{ sid, browser_offer.len });

        if (parseOpusPt(browser_offer)) |pt| self.browser_opus_pt = pt;

        const pc = try self.dc.createPeerConnection(stun_url, ice_port_range_begin, ice_port_range_end);
        self.browser_pc = pc;
        errdefer {
            if (self.browser_track >= 0) {
                self.dc.deleteId(self.browser_track);
                self.browser_track = -1;
            }
            self.dc.closePeerConnection(pc);
            self.dc.deletePeerConnection(pc);
            self.browser_pc = -1;
        }

        const user_ptr: ?*anyopaque = self;
        try self.dc.setTrackCallback(pc, onBrowserTrack, user_ptr);
        try self.dc.setRemoteDescription(pc, browser_offer, "offer");

        if (!self.waitForTrack(2_000)) {
            std.log.err("dictation [{s}]: no reciprocal track from offer within 2s", .{sid});
            return error.DataChannelCallFailed;
        }
        try self.dc.setMessageCallback(self.browser_track, onBrowserAudio, user_ptr);
        self.dc.setIceStateCallback(pc, onBrowserIceState, user_ptr) catch {};
        self.dc.setStateCallback(pc, onBrowserConnState, user_ptr) catch {};
        try self.dc.setGatheringStateCallback(pc, onBrowserGatheringState, user_ptr);
        try self.dc.setLocalDescription(pc, null);

        self.openai.on_event = onOpenAIEvent;
        self.openai.on_event_ctx = self;
        // No on_audio callback at all: a transcription session produces no
        // audio, and there is no downstream track to play it on if it did.
        try self.openai.connect();

        if (!self.waitForGathering(5_000)) {
            std.log.warn("dictation [{s}]: ICE gathering not complete within 5s", .{sid});
        }

        const answer = try self.dc.getLocalDescription(self.allocator, pc, 10_000);
        std.log.info("dictation [{s}]: connect complete, answer {d} bytes", .{ sid, answer.len });
        // The browser offered sendonly; if our reciprocal m-line comes back with
        // the wrong direction it simply stops sending and the session goes quiet
        // with no error anywhere. Keep the answer visible.
        std.log.info("dictation [{s}]: answer SDP:\n{s}", .{ sid, answer });
        return answer;
    }

    pub fn requestStop(self: *DictationSession) void {
        self.stop.request();
    }

    pub fn isReadyToClose(self: *const DictationSession, now_ns: i64) bool {
        // `RTCPeerConnection.close()` commonly races the explicit stop request.
        // Once stop was accepted, its VAD grace owns teardown; otherwise the
        // terminal browser state would discard the last transcript before
        // OpenAI can emit `completed`.
        if (self.stop.isRequested()) return self.stop.isReady(now_ns);
        return self.transport_disconnected.load(.acquire);
    }

    fn waitForTrack(self: *DictationSession, timeout_ms: u64) bool {
        const step_ms: u64 = 10;
        var elapsed: u64 = 0;
        while (elapsed < timeout_ms) : (elapsed += step_ms) {
            if (self.track_ready.load(.acquire)) return true;
            clock.sleepMs(step_ms);
        }
        return self.track_ready.load(.acquire);
    }

    fn waitForGathering(self: *DictationSession, timeout_ms: u64) bool {
        const step_ms: u64 = 10;
        var elapsed: u64 = 0;
        while (elapsed < timeout_ms) : (elapsed += step_ms) {
            if (self.gathering_complete.load(.acquire)) return true;
            clock.sleepMs(step_ms);
        }
        return self.gathering_complete.load(.acquire);
    }

    // --- C callbacks (libdatachannel internal threads) ---

    fn onBrowserTrack(pc: i32, track_id: i32, ctx: ?*anyopaque) callconv(.c) void {
        _ = pc;
        const self: *DictationSession = @ptrCast(@alignCast(ctx.?));
        self.browser_track = track_id;
        self.track_ready.store(true, .release);
    }

    fn onBrowserGatheringState(pc: i32, state: i32, ctx: ?*anyopaque) callconv(.c) void {
        _ = pc;
        const self: *DictationSession = @ptrCast(@alignCast(ctx.?));
        if (state == 2) self.gathering_complete.store(true, .release);
    }

    fn onBrowserIceState(pc: i32, state: i32, ctx: ?*anyopaque) callconv(.c) void {
        _ = pc;
        const self: *DictationSession = @ptrCast(@alignCast(ctx.?));
        if (state == 4 or state == 6) self.transport_disconnected.store(true, .release);
    }

    fn onBrowserConnState(pc: i32, state: i32, ctx: ?*anyopaque) callconv(.c) void {
        _ = pc;
        const self: *DictationSession = @ptrCast(@alignCast(ctx.?));
        std.log.info("dictation [{s}]: browser CONN state = {d}", .{ self.session_id, state });
        if (state == 4 or state == 5) self.transport_disconnected.store(true, .release);
    }

    fn onBrowserAudio(id: i32, data: [*]const u8, len: usize, ctx: ?*anyopaque) callconv(.c) void {
        _ = id;
        const self: *DictationSession = @ptrCast(@alignCast(ctx.?));
        if (self.closed.load(.acquire)) return;
        const slice = data[0..len];
        self.in_stats.add(self.session_id, "browser->openai", len);
        // RTCP arrives on this same callback; forwarding it would be noise.
        const header = rtp.parseHeader(slice) orelse return;
        if (header.payload_type != self.browser_opus_pt) return;
        // sendAudio re-wraps its input in a fresh RTP header, so hand it the
        // bare Opus payload — see web_bridge.onBrowserAudio.
        const opus = rtp.extractPayload(slice) orelse return;
        self.browser_opus_stats.add(self.session_id, header.seq_num, opus);
        const sent = self.forwarded.fetchAdd(1, .monotonic);
        if (sent == 0) {
            std.log.info("dictation [{s}]: first Opus frame forwarded to OpenAI ({d} bytes)", .{ self.session_id, opus.len });
        }
        self.openai.sendAudio(opus);
    }

    /// Transcription events from the `oai-events` data channel. Only the input
    /// transcription family can appear here: the session has no output.
    fn onOpenAIEvent(json: []const u8, ctx: ?*anyopaque) void {
        const self: *DictationSession = @ptrCast(@alignCast(ctx.?));
        if (self.closed.load(.acquire)) return;

        var parsed = std.json.parseFromSlice(std.json.Value, self.allocator, json, .{}) catch return;
        defer parsed.deinit();
        if (parsed.value != .object) return;
        const obj = &parsed.value.object;

        const type_val = obj.get("type") orelse return;
        if (type_val != .string) return;
        const msg_type = type_val.string;

        // Every non-delta event is traced: a transcription session that stays
        // silent is the hard case, and only the actual event names tell whether
        // the audio never arrived or the transcript came under a name we do not
        // recognise.
        if (std.mem.indexOf(u8, msg_type, ".delta") == null) {
            std.log.info("dictation [{s}]: event: {s}", .{ self.session_id, msg_type });
        }

        var field: []const u8 = undefined;
        var kind: TextKind = undefined;
        if (std.mem.eql(u8, msg_type, "conversation.item.input_audio_transcription.delta")) {
            field = "delta";
            kind = .delta;
        } else if (std.mem.eql(u8, msg_type, "conversation.item.input_audio_transcription.completed")) {
            field = "transcript";
            kind = .segment;
        } else {
            if (std.mem.eql(u8, msg_type, "conversation.item.input_audio_transcription.failed") or
                std.mem.eql(u8, msg_type, "error"))
            {
                std.log.warn("dictation [{s}]: {s}: {s}", .{
                    self.session_id, msg_type, json[0..@min(400, json.len)],
                });
            }
            return;
        }

        // An empty transcription is diagnostic: VAD closed a segment where the
        // model heard no speech. Dropping it would hide an audio-path failure.
        const text_val = obj.get(field) orelse {
            std.log.warn("dictation [{s}]: {s} without \"{s}\": {s}", .{
                self.session_id, msg_type, field, json[0..@min(300, json.len)],
            });
            return;
        };
        if (text_val != .string or text_val.string.len == 0) {
            std.log.warn("dictation [{s}]: empty {s}: {s}", .{
                self.session_id, msg_type, json[0..@min(300, json.len)],
            });
            return;
        }
        const text = text_val.string;

        if (kind == .delta) {
            self.transcript.appendDelta(self.allocator, text);
            if (self.on_text) |cb| cb(kind, text, self.on_text_ctx);
            return;
        }

        std.log.info("dictation [{s}]: segment: {s}", .{ self.session_id, text[0..@min(160, text.len)] });
        self.transcript.completeSegment(self.allocator, text);
        // The reaper can now finish a requested stop. Do this only after the
        // segment callback returns: it owns the emitter the reaper will free.
        if (self.on_text) |cb| cb(kind, text, self.on_text_ctx);
        self.stop.completeSegment();
    }
};

test "Dictation transcript preserves active delta at stop" {
    var transcript: TranscriptBuffer = .{};
    defer transcript.deinit(std.testing.allocator);

    transcript.appendDelta(std.testing.allocator, "hello ");
    transcript.appendDelta(std.testing.allocator, "world");
    const active = try transcript.snapshot(std.testing.allocator);
    defer std.testing.allocator.free(active);
    try std.testing.expectEqualStrings("hello world", active);

    transcript.completeSegment(std.testing.allocator, "Hello, world.");
    transcript.appendDelta(std.testing.allocator, "again");
    const combined = try transcript.snapshot(std.testing.allocator);
    defer std.testing.allocator.free(combined);
    try std.testing.expectEqualStrings("Hello, world. again", combined);
}

test "Dictation stop waits for the VAD segment" {
    var stop = StopController.init();
    stop.request();
    try std.testing.expect(!stop.isReady(clock.nanoTimestamp()));
    stop.completeSegment();
    try std.testing.expect(stop.isReady(clock.nanoTimestamp()));
}
