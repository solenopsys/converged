// Human-to-human call bridge: an inbound trunk call (leg A, the caller) is
// dialed out to an operator over the provider SIP trunk (leg B) and the two
// RTP streams are relayed as-is — Opus never leaves Opus. On top of the relay
// each leg is:
//   * recorded through the existing Recorder (caller = .user, operator =
//     .assistant, so playback/WebM assembly work unchanged), and
//   * transcribed live by its own transcription-only OpenAI Realtime session
//     (one per channel → two independent transcripts).
const std = @import("std");
const net = std.Io.net;

const rtp = @import("rtp.zig");
const sip_msg = @import("sip_msg.zig");
const sip_client = @import("sip_client.zig");
const bridge_mod = @import("../bridge/openai_bridge.zig");
const dc_mod = @import("../native/datachannel_client.zig");
const store_mod = @import("../store/store.zig");
const recorder_mod = @import("../record/recorder.zig");
const transcript_mod = @import("../record/transcript.zig");
const audio_stats_mod = @import("../util/audio_stats.zig");

const nowNs = sip_msg.nowNs;
const sleepMs = sip_msg.sleepMs;

const MAX_UDP: usize = 2048;
const RTP_RECV_TIMEOUT_MS: i64 = 200;

/// Everything a transcription-only OpenAI session needs. Slices must outlive
/// the endpoint (they point into the gateway Config).
pub const TranscriptionParams = struct {
    api_key: []const u8,
    calls_url: []const u8,
    transcription_model: []const u8,
    noise_reduction: []const u8,
    vad_threshold: f32,
    vad_silence_ms: u32,
    vad_prefix_ms: u32,
    stun_url: ?[]const u8,
    ice_port_range_begin: u16,
    ice_port_range_end: u16,
};

pub const Config = struct {
    /// Inbound leg (caller) RTP endpoint from the INVITE SDP.
    caller_ip: []const u8,
    caller_rtp_port: u16,
    caller_addr: ?net.IpAddress = null,
    /// Reuse an already negotiated inbound RTP socket when an AI call invokes
    /// transfer_to_human. Null means bind a fresh socket for a direct route.
    caller_socket: ?net.Socket = null,
    /// Operator target, e.g. sip:+1555...@sip.telnyx.com.
    target_uri: []const u8,
    /// Original caller identity — presented to the operator in From.
    from_user: []const u8,
    public_ip: []const u8,
    /// Local RTP ports pre-allocated by the SIP server (one per leg).
    a_rtp_port: u16,
    b_rtp_port: u16,
    sip_auth: ?sip_client.AuthCreds,
    /// Optional transcription language hint (from the phone-number transfer
    /// config); null → model auto-detects.
    language: ?[]const u8,
    transcription: TranscriptionParams,
    dc_client: *dc_mod.Client,
    recorder: ?*recorder_mod.Recorder,
    transcript: ?*transcript_mod.Transcript,
};

/// One relay direction: reads RTP from `src_sock`, records + transcribes the
/// Opus payload, re-frames it and sends to `dst_addr` via `dst_sock`.
const Relay = struct {
    endpoint: *HumanEndpoint,
    src_sock: net.Socket,
    dst_sock: net.Socket,
    dst_addr: net.IpAddress,
    dst_pt: u7,
    source: store_mod.Source,
    label: []const u8,
    seq: std.atomic.Value(u16),
    ts: std.atomic.Value(u32),
    ssrc: u32,
    stats: audio_stats_mod.AudioStats,
    transcriber: ?*bridge_mod.OpenAIBridge,
    thread: ?std.Thread = null,
};

/// Per-channel context for transcription data-channel events.
const TrCtx = struct {
    endpoint: *HumanEndpoint,
    source: store_mod.Source,
};

pub const HumanEndpoint = struct {
    allocator: std.mem.Allocator,
    call_id: []u8,
    identifier: []u8,
    session_id: []u8,

    a_sock: net.Socket,
    b_sock: net.Socket,
    out_call: *sip_client.OutboundCall,

    a_to_b: Relay,
    b_to_a: Relay,
    tr_ctx_user: TrCtx,
    tr_ctx_operator: TrCtx,
    tr_user: ?*bridge_mod.OpenAIBridge,
    tr_operator: ?*bridge_mod.OpenAIBridge,

    recorder: ?*recorder_mod.Recorder,
    transcript: ?*transcript_mod.Transcript,

    /// Signaling back to the caller when the OPERATOR hangs up first: the SIP
    /// server arms these after answering the caller (its socket, the caller's
    /// signaling address and a prebuilt BYE for the inbound dialog).
    caller_sig_sock: ?net.Socket = null,
    caller_sig_addr: net.IpAddress = undefined,
    caller_bye: ?[]u8 = null,

    running: std.atomic.Value(bool),
    /// Set when either side hung up; the SIP server reaps finished endpoints.
    ended: std.atomic.Value(bool),

    /// Dial the operator and stand up recording + transcription. Blocks until
    /// the operator answers (or fails). The caller's 200 OK must be sent by the
    /// SIP server only after this returns, then start() begins relaying.
    pub fn create(allocator: std.mem.Allocator, call_id: []const u8, cfg: Config) !*HumanEndpoint {
        const io = std.Options.debug_io;

        const self = try allocator.create(HumanEndpoint);
        errdefer allocator.destroy(self);

        const cid = try allocator.dupe(u8, call_id);
        errdefer allocator.free(cid);
        const ident = try allocator.dupe(u8, cfg.from_user);
        errdefer allocator.free(ident);

        var hasher = std.crypto.hash.sha2.Sha256.init(.{});
        hasher.update(call_id);
        var digest: [std.crypto.hash.sha2.Sha256.digest_length]u8 = undefined;
        hasher.final(&digest);
        const hex = std.fmt.bytesToHex(digest, .lower);
        const sid = try allocator.dupe(u8, hex[0..32]);
        errdefer allocator.free(sid);

        // RTP sockets for both legs.
        const a_sock = if (cfg.caller_socket) |existing| existing else blk: {
            const a_addr = try net.IpAddress.parseIp4("0.0.0.0", cfg.a_rtp_port);
            break :blk try net.IpAddress.bind(&a_addr, io, .{ .mode = .dgram });
        };
        errdefer a_sock.close(io);
        const b_addr = try net.IpAddress.parseIp4("0.0.0.0", cfg.b_rtp_port);
        const b_sock = try net.IpAddress.bind(&b_addr, io, .{ .mode = .dgram });
        errdefer b_sock.close(io);

        const caller_addr = if (cfg.caller_addr) |existing|
            existing
        else
            net.IpAddress.parseIp4(cfg.caller_ip, cfg.caller_rtp_port) catch
                try net.IpAddress.parse(cfg.caller_ip, cfg.caller_rtp_port);

        // Transcription sessions — one per channel. A missing/failing session
        // is fatal for the transfer call: per-channel transcription is a core
        // requirement of this mode, not an optional add-on.
        const tr_user = try createTranscriber(allocator, cfg);
        errdefer {
            tr_user.close();
            allocator.destroy(tr_user);
        }
        const tr_operator = try createTranscriber(allocator, cfg);
        errdefer {
            tr_operator.close();
            allocator.destroy(tr_operator);
        }

        // Dial the operator (blocks while ringing).
        const sdp = try sip_msg.buildSdp(allocator, cfg.public_ip, cfg.b_rtp_port);
        defer allocator.free(sdp);
        const out_call = try sip_client.OutboundCall.dial(allocator, .{
            .public_ip = cfg.public_ip,
            .from_user = cfg.from_user,
            .auth = cfg.sip_auth,
        }, cfg.target_uri, sdp);
        errdefer out_call.destroy();
        const answer = out_call.answer.?;

        const operator_addr = net.IpAddress.parseIp4(answer.remote_rtp_ip, answer.remote_rtp_port) catch
            try net.IpAddress.parse(answer.remote_rtp_ip, answer.remote_rtp_port);

        self.* = .{
            .allocator = allocator,
            .call_id = cid,
            .identifier = ident,
            .session_id = sid,
            .a_sock = a_sock,
            .b_sock = b_sock,
            .out_call = out_call,
            .a_to_b = .{
                .endpoint = self,
                .src_sock = a_sock,
                .dst_sock = b_sock,
                .dst_addr = operator_addr,
                .dst_pt = answer.opus_payload_type,
                .source = .user,
                .label = "caller->operator",
                .seq = std.atomic.Value(u16).init(0),
                .ts = std.atomic.Value(u32).init(0),
                .ssrc = @truncate(@as(u64, @bitCast(nowNs()))),
                .stats = .{},
                .transcriber = tr_user,
            },
            .b_to_a = .{
                .endpoint = self,
                .src_sock = b_sock,
                .dst_sock = a_sock,
                .dst_addr = caller_addr,
                .dst_pt = rtp.OPUS_PT,
                .source = .assistant,
                .label = "operator->caller",
                .seq = std.atomic.Value(u16).init(0),
                .ts = std.atomic.Value(u32).init(0),
                .ssrc = @truncate(@as(u64, @bitCast(nowNs() +% 7919))),
                .stats = .{},
                .transcriber = tr_operator,
            },
            .tr_ctx_user = .{ .endpoint = self, .source = .user },
            .tr_ctx_operator = .{ .endpoint = self, .source = .assistant },
            .tr_user = tr_user,
            .tr_operator = tr_operator,
            .recorder = cfg.recorder,
            .transcript = cfg.transcript,
            .running = std.atomic.Value(bool).init(true),
            .ended = std.atomic.Value(bool).init(false),
        };

        tr_user.on_event = onTranscriptionEvent;
        tr_user.on_event_ctx = &self.tr_ctx_user;
        tr_operator.on_event = onTranscriptionEvent;
        tr_operator.on_event_ctx = &self.tr_ctx_operator;

        return self;
    }

    fn createTranscriber(allocator: std.mem.Allocator, cfg: Config) !*bridge_mod.OpenAIBridge {
        const tr = try allocator.create(bridge_mod.OpenAIBridge);
        errdefer allocator.destroy(tr);
        tr.* = bridge_mod.OpenAIBridge.init(allocator, cfg.dc_client, .{
            .session_kind = .transcription,
            .api_key = cfg.transcription.api_key,
            .calls_url = cfg.transcription.calls_url,
            .model = "",
            .voice = "",
            .instructions = "",
            .transcription_model = cfg.transcription.transcription_model,
            .transcription_language = cfg.language orelse "",
            .noise_reduction = cfg.transcription.noise_reduction,
            .vad_threshold = cfg.transcription.vad_threshold,
            .vad_silence_ms = cfg.transcription.vad_silence_ms,
            .vad_prefix_ms = cfg.transcription.vad_prefix_ms,
            .stun_url = cfg.transcription.stun_url,
            .ice_port_range_begin = cfg.transcription.ice_port_range_begin,
            .ice_port_range_end = cfg.transcription.ice_port_range_end,
        });
        errdefer tr.close();
        try tr.connect();
        return tr;
    }

    /// Arm the "operator hung up first" path: `bye` is a prebuilt BYE for the
    /// inbound dialog, sent through the SIP server's signaling socket. Owns `bye`.
    pub fn armCallerBye(self: *HumanEndpoint, sock: net.Socket, caller_addr: net.IpAddress, bye: []u8) void {
        self.caller_sig_sock = sock;
        self.caller_sig_addr = caller_addr;
        self.caller_bye = bye;
    }

    /// Spawn the relay threads and the operator-leg signaling watcher.
    pub fn start(self: *HumanEndpoint) !void {
        self.out_call.on_remote_bye = onOperatorBye;
        self.out_call.on_remote_bye_ctx = self;
        try self.out_call.startRecvLoop();
        self.a_to_b.thread = try std.Thread.spawn(.{}, relayLoop, .{&self.a_to_b});
        self.b_to_a.thread = try std.Thread.spawn(.{}, relayLoop, .{&self.b_to_a});
    }

    /// Stop relaying and flush recording/transcript state. Idempotent; safe
    /// from the operator-leg callback thread (joins only relay threads).
    pub fn finish(self: *HumanEndpoint) void {
        if (self.ended.swap(true, .acq_rel)) return;
        self.running.store(false, .release);
        if (self.a_to_b.thread) |t| {
            t.join();
            self.a_to_b.thread = null;
        }
        if (self.b_to_a.thread) |t| {
            t.join();
            self.b_to_a.thread = null;
        }
        if (self.tr_user) |tr| tr.close();
        if (self.tr_operator) |tr| tr.close();
        if (self.transcript) |tr| _ = tr.flushSession(self.session_id);
        if (self.recorder) |rec| rec.flushPending();
    }

    /// True once finish() ran — the endpoint only awaits destroy().
    pub fn isFinished(self: *const HumanEndpoint) bool {
        return self.ended.load(.acquire);
    }

    /// Full teardown. Never call from the operator-leg callback thread (it
    /// joins that thread); the SIP server thread owns destruction.
    pub fn destroy(self: *HumanEndpoint) void {
        const io = std.Options.debug_io;
        self.finish();
        self.out_call.hangup();
        self.out_call.destroy();
        if (self.tr_user) |tr| self.allocator.destroy(tr);
        if (self.tr_operator) |tr| self.allocator.destroy(tr);
        self.a_sock.close(io);
        self.b_sock.close(io);
        if (self.caller_bye) |b| self.allocator.free(b);
        self.allocator.free(self.call_id);
        self.allocator.free(self.identifier);
        self.allocator.free(self.session_id);
        const allocator = self.allocator;
        self.* = undefined;
        allocator.destroy(self);
    }

    /// Operator side hung up: tell the caller's trunk (BYE) and wind down the
    /// media path. Runs on the outbound-call recv thread — no self-joins here.
    fn onOperatorBye(ctx: ?*anyopaque) void {
        const self: *HumanEndpoint = @ptrCast(@alignCast(ctx.?));
        std.log.info("human-bridge: operator hung up (session={s})", .{self.session_id});
        if (self.caller_sig_sock) |sock| {
            if (self.caller_bye) |bye| {
                const io = std.Options.debug_io;
                sock.send(io, &self.caller_sig_addr, bye) catch |err| {
                    std.log.warn("human-bridge: BYE to caller failed (session={s}): {s}", .{ self.session_id, @errorName(err) });
                };
            }
        }
        self.finish();
    }

    fn onTranscriptionEvent(json: []const u8, ctx: ?*anyopaque) void {
        const tr_ctx: *TrCtx = @ptrCast(@alignCast(ctx.?));
        const self = tr_ctx.endpoint;
        if (self.transcript) |tr| {
            _ = tr.processEventForSource(self.session_id, tr_ctx.source, self.allocator, json);
        }
    }
};

fn relayLoop(relay: *Relay) void {
    const io = std.Options.debug_io;
    const ep = relay.endpoint;
    var buf: [MAX_UDP]u8 = undefined;
    const timeout = std.Io.Timeout{ .duration = .{ .raw = std.Io.Duration.fromMilliseconds(RTP_RECV_TIMEOUT_MS), .clock = .awake } };

    // Punch NAT / prime the path in this direction, as the LLM leg does.
    var i: u8 = 0;
    while (i < 3) : (i += 1) {
        const seq = relay.seq.fetchAdd(1, .acq_rel);
        const ts = relay.ts.fetchAdd(rtp.SAMPLES_PER_FRAME, .acq_rel);
        const pkt = rtp.buildPacketWithPt(ep.allocator, &[_]u8{0xF8}, relay.dst_pt, seq, ts, relay.ssrc) catch continue;
        defer ep.allocator.free(pkt);
        relay.dst_sock.send(io, &relay.dst_addr, pkt) catch {};
        sleepMs(20);
    }

    while (ep.running.load(.acquire)) {
        const msg = relay.src_sock.receiveTimeout(io, &buf, timeout) catch |err| {
            if (err == error.Timeout) continue;
            sleepMs(10);
            continue;
        };

        const payload = rtp.extractOpusPayload(msg.data) orelse continue;
        relay.stats.add(ep.session_id, relay.label, payload.len);

        if (ep.recorder) |rec| {
            rec.recordFrame(ep.session_id, relay.source, nowNs(), payload);
        }
        if (relay.transcriber) |tr| tr.sendAudio(payload);

        const seq = relay.seq.fetchAdd(1, .acq_rel);
        const ts = relay.ts.fetchAdd(rtp.SAMPLES_PER_FRAME, .acq_rel);
        const packet = rtp.buildPacketWithPt(ep.allocator, payload, relay.dst_pt, seq, ts, relay.ssrc) catch continue;
        defer ep.allocator.free(packet);
        relay.dst_sock.send(io, &relay.dst_addr, packet) catch {};
    }
}
