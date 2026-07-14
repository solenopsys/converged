// WebRTC media proxy for browser sessions.
// Browser connects to the gate (not OpenAI directly); gate relays audio
// bidirectionally and captures frames + transcript events.
const std = @import("std");
const dc_mod = @import("../native/datachannel_client.zig");
const openai_mod = @import("openai_bridge.zig");
const recorder_mod = @import("../record/recorder.zig");
const transcript_mod = @import("../record/transcript.zig");
const clock = @import("../util/clock.zig");
const audio_stats_mod = @import("../util/audio_stats.zig");
const rtp = @import("../sip/rtp.zig");

const ICE_STATE_CONNECTED: i32 = 2;
const ICE_STATE_COMPLETED: i32 = 3;

/// Parse the dynamic payload type the browser assigned to Opus from its SDP
/// offer (`a=rtpmap:<pt> opus/48000...`). Returns null if not found.
fn parseOpusPt(sdp: []const u8) ?u8 {
    var it = std.mem.splitScalar(u8, sdp, '\n');
    const prefix = "a=rtpmap:";
    while (it.next()) |raw| {
        const line = std.mem.trim(u8, raw, " \r\t");
        if (!std.mem.startsWith(u8, line, prefix)) continue;
        const rest = line[prefix.len..];
        const sp = std.mem.indexOfScalar(u8, rest, ' ') orelse continue;
        const pt_str = rest[0..sp];
        const codec = rest[sp + 1 ..];
        if (!std.ascii.startsWithIgnoreCase(codec, "opus/")) continue;
        return std.fmt.parseInt(u8, pt_str, 10) catch continue;
    }
    return null;
}

pub const WebBridgeSession = struct {
    allocator: std.mem.Allocator,
    dc: *dc_mod.Client,
    session_id: []u8,

    browser_pc: i32,
    browser_track: i32,
    /// Set true (release) once the answerer track from the browser's offer has
    /// been captured in onBrowserTrack. connect() waits on this before building
    /// the local answer.
    track_ready: std.atomic.Value(bool),
    /// Set true (release) once libdatachannel reports ICE gathering COMPLETE.
    /// connect() waits on this before reading the local answer so the SDP embeds
    /// every candidate — crucially the srflx (public) one discovered via STUN.
    /// We don't trickle to the browser, so a host-only answer (private pod IP)
    /// would leave a remote peer with no reachable candidate (ICE fails).
    gathering_complete: std.atomic.Value(bool),
    /// Opus payload type the browser negotiated (parsed from its offer). OpenAI
    /// sends Opus as PT 111; if the browser uses a different PT we must restamp
    /// forwarded packets or the browser drops them as an unknown payload.
    browser_opus_pt: u8,
    openai: openai_mod.OpenAIBridge,
    /// Ensures the assistant's opening greeting is requested exactly once, and
    /// only after the browser's media transport is up (see onBrowserConnState).
    greeting_sent: std.atomic.Value(bool),

    closed: std.atomic.Value(bool),
    /// Set true once the browser's WebRTC transport drops (PC failed/closed or
    /// ICE closed). The gateway's reaper polls this to end the session and dump
    /// the recording — the signaling WebSocket is proxied and its close does NOT
    /// reliably reach the gate, so the media-layer disconnect is the trigger.
    disconnected: std.atomic.Value(bool),
    recorder: ?*recorder_mod.Recorder,
    transcript: ?*transcript_mod.Transcript,
    in_stats: audio_stats_mod.AudioStats,
    out_stats: audio_stats_mod.AudioStats,

    pub fn create(
        allocator: std.mem.Allocator,
        dc: *dc_mod.Client,
        session_id: []const u8,
        openai_cfg: openai_mod.Config,
        recorder: ?*recorder_mod.Recorder,
        transcript: ?*transcript_mod.Transcript,
    ) !*WebBridgeSession {
        const self = try allocator.create(WebBridgeSession);
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
            .greeting_sent = std.atomic.Value(bool).init(false),
            .closed = std.atomic.Value(bool).init(false),
            .disconnected = std.atomic.Value(bool).init(false),
            .recorder = recorder,
            .transcript = transcript,
            .in_stats = .{},
            .out_stats = .{},
        };
        if (recorder == null or transcript == null) {
            std.log.warn("web-bridge [{s}]: recorder={} transcript={} — recording/transcript persistence disabled", .{
                session_id, recorder != null, transcript != null,
            });
        }
        return self;
    }

    pub fn destroy(self: *WebBridgeSession) void {
        self.close();
        self.allocator.free(self.session_id);
        self.allocator.destroy(self);
    }

    /// Accept the browser's SDP offer, connect to OpenAI, return SDP answer (caller owns).
    /// Blocks until both the browser ICE gathering and OpenAI WebRTC are ready.
    pub fn connect(
        self: *WebBridgeSession,
        browser_offer: []const u8,
        stun_url: ?[]const u8,
        ice_port_range_begin: u16,
        ice_port_range_end: u16,
    ) ![]u8 {
        const sid = self.session_id;
        std.log.info("web-bridge [{s}]: connect start, offer {d} bytes", .{ sid, browser_offer.len });

        // OpenAI emits Opus as PT 111; the browser may negotiate a different PT.
        // Capture it so onOpenAIAudio can restamp forwarded packets.
        if (parseOpusPt(browser_offer)) |pt| {
            self.browser_opus_pt = pt;
            std.log.info("web-bridge [{s}]: browser Opus PT = {d}", .{ sid, pt });
        } else {
            std.log.warn("web-bridge [{s}]: no Opus rtpmap in offer, defaulting PT {d}", .{ sid, self.browser_opus_pt });
        }

        // Create browser-side peer connection
        const pc = self.dc.createPeerConnection(
            stun_url,
            ice_port_range_begin,
            ice_port_range_end,
        ) catch |err| {
            std.log.err("web-bridge [{s}]: createPeerConnection failed: {s}", .{ sid, @errorName(err) });
            return err;
        };
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
        std.log.info("web-bridge [{s}]: peer connection {d} created", .{ sid, pc });

        // Register the track callback BEFORE applying the remote offer. As the
        // answerer we must NOT add a track manually — libdatachannel reciprocates
        // the audio m-line from the browser's offer and surfaces the track here.
        // (Adding a track manually creates an extra, unmatched m-line and makes
        // setLocalDescription(answer) throw RTC_ERR_FAILURE / rc=-2.)
        const user_ptr: ?*anyopaque = self;
        self.dc.setTrackCallback(pc, onBrowserTrack, user_ptr) catch |err| {
            std.log.err("web-bridge [{s}]: setTrackCallback failed: {s}", .{ sid, @errorName(err) });
            return err;
        };

        // Accept the browser's offer — fires onBrowserTrack for the audio m-line.
        self.dc.setRemoteDescription(pc, browser_offer, "offer") catch |err| {
            std.log.err("web-bridge [{s}]: setRemoteDescription(offer) failed: {s}", .{ sid, @errorName(err) });
            return err;
        };
        std.log.info("web-bridge [{s}]: remote offer set", .{sid});

        // The track callback may fire on a libdatachannel thread; wait for it.
        if (!self.waitForTrack(2_000)) {
            std.log.err("web-bridge [{s}]: no reciprocal track from offer within 2s", .{sid});
            return error.DataChannelCallFailed;
        }
        const track = self.browser_track;
        std.log.info("web-bridge [{s}]: reciprocal track {d} captured", .{ sid, track });

        self.dc.setMessageCallback(track, onBrowserAudio, user_ptr) catch |err| {
            std.log.err("web-bridge [{s}]: setMessageCallback failed: {s}", .{ sid, @errorName(err) });
            return err;
        };
        // Log browser-side ICE + overall connection (DTLS) state so we can see
        // whether the browser actually completes its connection back to the gate.
        self.dc.setIceStateCallback(pc, onBrowserIceState, user_ptr) catch {};
        self.dc.setStateCallback(pc, onBrowserConnState, user_ptr) catch {};
        // Register the gathering-state callback BEFORE setLocalDescription (which
        // starts gathering) so we never miss the COMPLETE transition.
        self.dc.setGatheringStateCallback(pc, onBrowserGatheringState, user_ptr) catch |err| {
            std.log.err("web-bridge [{s}]: setGatheringStateCallback failed: {s}", .{ sid, @errorName(err) });
            return err;
        };
        // null type -> libdatachannel auto-selects Answer (state is HaveRemoteOffer).
        self.dc.setLocalDescription(pc, null) catch |err| {
            std.log.err("web-bridge [{s}]: setLocalDescription(answer) failed: {s}", .{ sid, @errorName(err) });
            return err;
        };
        std.log.info("web-bridge [{s}]: local answer set, connecting to OpenAI", .{sid});
        // ICE gathering starts here in background — libdatachannel collects candidates

        // Connect to OpenAI while browser ICE gathers in background
        self.openai.on_audio = onOpenAIAudio;
        self.openai.on_audio_ctx = self;
        self.openai.on_event = onOpenAIEvent;
        self.openai.on_event_ctx = self;
        self.openai.connect() catch |err| {
            std.log.err("web-bridge [{s}]: openai.connect failed: {s}", .{ sid, @errorName(err) });
            return err;
        };

        // Wait for ICE gathering to COMPLETE before reading the answer. Without
        // this the SDP carries only the host candidate gathered so far (the pod's
        // private IP); the srflx candidate discovered via STUN — the only address
        // a remote browser can reach — arrives hundreds of ms later. Since we do
        // not trickle, it must be embedded in the answer or the call never
        // connects (ICE failed). Falls through on timeout with whatever was
        // gathered, so a STUN outage degrades rather than hangs.
        if (!self.waitForGathering(5_000)) {
            std.log.warn("web-bridge [{s}]: ICE gathering not complete within 5s; answer may lack srflx candidate", .{sid});
        }

        const answer = self.dc.getLocalDescription(self.allocator, pc, 10_000) catch |err| {
            std.log.err("web-bridge [{s}]: getLocalDescription failed: {s}", .{ sid, @errorName(err) });
            return err;
        };
        std.log.info("web-bridge [{s}]: connect complete, answer {d} bytes", .{ sid, answer.len });
        std.log.info("web-bridge [{s}]: answer SDP:\n{s}", .{ sid, answer });
        return answer;
    }

    /// Spin-wait until onBrowserTrack captures the reciprocal track id.
    fn waitForTrack(self: *WebBridgeSession, timeout_ms: u64) bool {
        const step_ms: u64 = 10;
        var elapsed: u64 = 0;
        while (elapsed < timeout_ms) : (elapsed += step_ms) {
            if (self.track_ready.load(.acquire)) return true;
            clock.sleepMs(step_ms);
        }
        return self.track_ready.load(.acquire);
    }

    /// Spin-wait until onBrowserGatheringState reports COMPLETE.
    fn waitForGathering(self: *WebBridgeSession, timeout_ms: u64) bool {
        const step_ms: u64 = 10;
        var elapsed: u64 = 0;
        while (elapsed < timeout_ms) : (elapsed += step_ms) {
            if (self.gathering_complete.load(.acquire)) return true;
            clock.sleepMs(step_ms);
        }
        return self.gathering_complete.load(.acquire);
    }

    pub fn close(self: *WebBridgeSession) void {
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

    // --- C callbacks (called from libdatachannel internal threads) ---

    /// Fired when libdatachannel creates the reciprocal track from the browser's
    /// offer. Capture its id so we can pump audio both ways.
    fn onBrowserTrack(pc: i32, track_id: i32, ctx: ?*anyopaque) callconv(.c) void {
        _ = pc;
        const self: *WebBridgeSession = @ptrCast(@alignCast(ctx.?));
        self.browser_track = track_id;
        self.track_ready.store(true, .release);
    }

    /// Fired on ICE gathering-state transitions. libdatachannel states:
    /// 0=new 1=in-progress 2=complete. On COMPLETE the local description holds
    /// every gathered candidate (host + srflx); connect() waits for this.
    fn onBrowserGatheringState(pc: i32, state: i32, ctx: ?*anyopaque) callconv(.c) void {
        _ = pc;
        const self: *WebBridgeSession = @ptrCast(@alignCast(ctx.?));
        std.log.info("web-bridge [{s}]: browser ICE gathering state = {d}", .{ self.session_id, state });
        if (state == 2) self.gathering_complete.store(true, .release);
    }

    fn onBrowserIceState(pc: i32, state: i32, ctx: ?*anyopaque) callconv(.c) void {
        _ = pc;
        const self: *WebBridgeSession = @ptrCast(@alignCast(ctx.?));
        // libdatachannel ICE states: 0=new 1=checking 2=connected 3=completed
        // 4=failed 5=disconnected 6=closed
        std.log.info("web-bridge [{s}]: browser ICE state = {d}", .{ self.session_id, state });
        // failed (4) or closed (6) are terminal — the caller is gone. (5=disconnected
        // can be a transient blip, so it does not end the session on its own.)
        if (state == 4 or state == 6) self.markDisconnected();
    }

    /// Flag the media transport as gone so the gateway reaper ends the session.
    fn markDisconnected(self: *WebBridgeSession) void {
        self.disconnected.store(true, .release);
    }

    pub fn isDisconnected(self: *const WebBridgeSession) bool {
        return self.disconnected.load(.acquire);
    }

    fn onBrowserConnState(pc: i32, state: i32, ctx: ?*anyopaque) callconv(.c) void {
        _ = pc;
        const self: *WebBridgeSession = @ptrCast(@alignCast(ctx.?));
        // libdatachannel PC states: 0=new 1=connecting 2=connected (DTLS up)
        // 3=disconnected 4=failed 5=closed
        std.log.info("web-bridge [{s}]: browser CONN state = {d}", .{ self.session_id, state });

        // failed (4) or closed (5) means the browser hung up / the transport is
        // gone for good — let the reaper tear the session down and dump audio.
        if (state == 4 or state == 5) self.markDisconnected();

        // Now that the browser's media transport is up the listener can receive
        // audio, so request the assistant's opening greeting — once. Triggering
        // it earlier (on OpenAI connect, inside connect()) produced frames while
        // browser_track was still closed; onOpenAIAudio dropped them and the
        // greeting was heard mid-sentence.
        if (state == 2 and !self.closed.load(.acquire)) {
            if (self.greeting_sent.cmpxchgStrong(false, true, .acq_rel, .acquire) == null) {
                std.log.info("web-bridge [{s}]: browser connected — requesting greeting", .{self.session_id});
                self.openai.requestGreeting();
            }
        }
    }

    fn onBrowserAudio(id: i32, data: [*]const u8, len: usize, ctx: ?*anyopaque) callconv(.c) void {
        _ = id;
        const self: *WebBridgeSession = @ptrCast(@alignCast(ctx.?));
        if (self.closed.load(.acquire)) return;
        const slice = data[0..len];
        self.in_stats.add(self.session_id, "browser->openai", len);
        // Drop anything that isn't the negotiated Opus stream. libdatachannel
        // delivers RTCP (SR/RR, ~every 1-2 s) on this same media callback; if we
        // let it through it gets recorded as a bogus "Opus frame" (audible
        // click) and forwarded to OpenAI as noise. The browser's Opus PT is
        // taken from the offer's rtpmap (self.browser_opus_pt).
        if (slice.len < 2 or (slice[1] & 0x7F) != self.browser_opus_pt) return;
        // The browser delivers a full RTP packet. sendAudio re-wraps its input
        // in a fresh RTP header, so we must hand it the BARE Opus payload —
        // otherwise OpenAI receives [RTP header][opus] as "opus" (double-wrapped
        // garbage) and the agent hears noise. Mirror the SIP path which extracts
        // the payload before forwarding.
        const opus = rtp.extractPayload(slice) orelse return;
        if (self.recorder) |rec| rec.recordFrame(self.session_id, .user, clock.nanoTimestamp(), opus);
        self.openai.sendAudio(opus);
    }

    fn onOpenAIAudio(audio: []const u8, ctx: ?*anyopaque) void {
        const self: *WebBridgeSession = @ptrCast(@alignCast(ctx.?));
        if (self.closed.load(.acquire)) return;
        self.out_stats.add(self.session_id, "openai->browser", audio.len);
        // OpenAI delivers Opus RTP (PT 111); RTCP SR/RR arrive on the SAME
        // callback. Drop non-Opus so RTCP isn't recorded as a garbage "frame"
        // (audible click every ~1-2 s) or forwarded to the browser as audio.
        // extractOpusPayload checks the PT (111/96) and returns the bare Opus
        // payload — storing the full RTP packet would prepend a 12-byte header
        // to every frame and play back as noise.
        const opus = rtp.extractOpusPayload(audio) orelse return;
        if (self.recorder) |rec| {
            rec.recordFrame(self.session_id, .assistant, clock.nanoTimestamp(), opus);
        }
        // Only forward once the browser track transport is actually open;
        // otherwise libdatachannel returns rc=-2 for every frame and floods
        // the log. Drop frames silently until the browser side connects.
        if (self.browser_track < 0 or !self.dc.isOpen(self.browser_track)) return;

        // OpenAI's RTP carries PT 111. If the browser negotiated a different
        // Opus PT, restamp byte 1 (keep the marker bit) on a local copy so the
        // browser accepts the packet instead of dropping an unknown payload.
        const hdr = rtp.parseHeader(audio);
        if (hdr != null and hdr.?.payload_type != self.browser_opus_pt) {
            var buf: [2048]u8 = undefined;
            if (audio.len <= buf.len) {
                @memcpy(buf[0..audio.len], audio);
                buf[1] = (audio[1] & 0x80) | (self.browser_opus_pt & 0x7F);
                self.dc.sendMessage(self.browser_track, buf[0..audio.len]) catch {};
                return;
            }
        }
        self.dc.sendMessage(self.browser_track, audio) catch {};
    }

    fn onOpenAIEvent(json: []const u8, ctx: ?*anyopaque) void {
        const self: *WebBridgeSession = @ptrCast(@alignCast(ctx.?));
        if (self.transcript) |tr| _ = tr.processEvent(self.session_id, self.allocator, json);
    }
};
