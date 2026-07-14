// Minimal SIP/UDP server with RTP bridging to OpenAI Realtime API.
// Handles INVITE/ACK/BYE/CANCEL/REGISTER over UDP.
const std = @import("std");
const net = std.Io.net;
const rtp = @import("rtp.zig");
const sip_msg = @import("sip_msg.zig");
const sip_client = @import("sip_client.zig");
const human_bridge = @import("human_bridge.zig");
const bridge_mod = @import("../bridge/openai_bridge.zig");
const dc_mod = @import("../native/datachannel_client.zig");
const store_mod = @import("../store/store.zig");
const transcript_mod = @import("../record/transcript.zig");
const recorder_mod = @import("../record/recorder.zig");
const audio_stats_mod = @import("../util/audio_stats.zig");
const policy_mod = @import("../policy/engine.zig");
const policy_types = @import("../policy/types.zig");
const realtime_event = @import("../policy/realtime_event.zig");
const json_util = @import("../util/json.zig");

const SipMsg = sip_msg.SipMsg;
const extractPhone = sip_msg.extractPhone;
const buildSdp = sip_msg.buildSdp;
const nowNs = sip_msg.nowNs;
const nowSec = sip_msg.nowSec;
const sleepMs = sip_msg.sleepMs;

const MAX_UDP: usize = 2048;
const RTP_RECV_TIMEOUT_MS: i64 = 200;
const SIP_RECV_TIMEOUT_MS: i64 = 200;

const transfer_tool_json =
    \\[{"type":"function","name":"transfer_to_human","description":"Transfer the current caller to a human operator when the caller asks for a person or the task requires human assistance.","parameters":{"type":"object","properties":{"reason":{"type":"string","description":"Short reason for the transfer"}},"additionalProperties":false}}]
;

// Blocking mutex via POSIX pthread (std.Thread.Mutex removed in Zig 0.16)
const Mutex = struct {
    inner: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,
    pub fn lock(self: *Mutex) void {
        _ = std.c.pthread_mutex_lock(&self.inner);
    }
    pub fn unlock(self: *Mutex) void {
        _ = std.c.pthread_mutex_unlock(&self.inner);
    }
};

pub const Config = struct {
    sip_port: u16 = 5060,
    rtp_base_port: u16 = 20000,
    public_ip: []const u8,
    stun_url: ?[]const u8 = null,
    // Static OpenAI bridge params; the per-call context (instructions+language)
    // is paired in per INVITE via bridge_base.withContext(). No context => 404.
    bridge_base: bridge_mod.BaseConfig,
    dc_client: *dc_mod.Client,
    store: ?*store_mod.Store,
    recorder: ?*recorder_mod.Recorder,
    transcript: ?*transcript_mod.Transcript,
    policy: ?*policy_mod.Engine = null,
    threads_service_url: ?[]const u8 = null,
    threads_service_token: ?[]const u8 = null,
    /// Digest credentials for outbound (human-transfer) calls on the trunk.
    /// Absent => IP-auth trunk; a 401/407 then fails the call loudly.
    sip_auth: ?sip_client.AuthCreds = null,
};

/// A live call: either the LLM answers (llm) or the call is bridged to another
/// human over the trunk (human).
const Endpoint = union(enum) {
    llm: *SipEndpoint,
    human: *human_bridge.HumanEndpoint,
};

// ---- SIP Endpoint ----

const SipEndpoint = struct {
    allocator: std.mem.Allocator,
    call_id: []u8,
    identifier: []u8,
    session_id: []u8,

    // RTP
    remote_addr: net.IpAddress,
    local_rtp_port: u16,
    rtp_sock: net.Socket,
    ssrc: u32,
    seq: std.atomic.Value(u16),
    ts: std.atomic.Value(u32),

    bridge: *bridge_mod.OpenAIBridge,
    recorder: ?*recorder_mod.Recorder,
    transcript: ?*transcript_mod.Transcript,
    in_stats: audio_stats_mod.AudioStats,
    out_stats: audio_stats_mod.AudioStats,

    rtp_thread: ?std.Thread,
    running: std.atomic.Value(bool),
    transfer_requested: std.atomic.Value(bool),
    human_transfer_uri: ?[]u8,
    transfer_language: ?[]u8,
    human_transcription_model: ?[]u8,
    caller_signal_addr: net.IpAddress,
    caller_bye: ?[]u8,

    fn init(
        allocator: std.mem.Allocator,
        call_id: []const u8,
        identifier: []const u8,
        remote_ip: []const u8,
        remote_rtp_port: u16,
        local_rtp_port: u16,
        rtp_sock: net.Socket,
        bridge: *bridge_mod.OpenAIBridge,
        recorder: ?*recorder_mod.Recorder,
        transcript: ?*transcript_mod.Transcript,
        human_transfer_uri: ?[]const u8,
        transfer_language: ?[]const u8,
        human_transcription_model: ?[]const u8,
        caller_signal_addr: net.IpAddress,
    ) !SipEndpoint {
        const cid = try allocator.dupe(u8, call_id);
        errdefer allocator.free(cid);
        const ident = try allocator.dupe(u8, identifier);
        errdefer allocator.free(ident);

        var hasher = std.crypto.hash.sha2.Sha256.init(.{});
        hasher.update(call_id);
        var digest: [std.crypto.hash.sha2.Sha256.digest_length]u8 = undefined;
        hasher.final(&digest);
        const hex = std.fmt.bytesToHex(digest, .lower);
        const sid = try allocator.dupe(u8, hex[0..32]);
        errdefer allocator.free(sid);

        const human_uri_owned = if (human_transfer_uri) |v| try allocator.dupe(u8, v) else null;
        errdefer if (human_uri_owned) |v| allocator.free(v);
        const transfer_language_owned = if (transfer_language) |v| try allocator.dupe(u8, v) else null;
        errdefer if (transfer_language_owned) |v| allocator.free(v);
        const human_transcription_owned = if (human_transcription_model) |v| try allocator.dupe(u8, v) else null;
        errdefer if (human_transcription_owned) |v| allocator.free(v);

        const remote_addr = net.IpAddress.parseIp4(remote_ip, remote_rtp_port) catch
            try net.IpAddress.parse(remote_ip, remote_rtp_port);

        return .{
            .allocator = allocator,
            .call_id = cid,
            .identifier = ident,
            .session_id = sid,
            .remote_addr = remote_addr,
            .local_rtp_port = local_rtp_port,
            .rtp_sock = rtp_sock,
            .ssrc = @truncate(@as(u64, @bitCast(nowNs()))),
            .seq = std.atomic.Value(u16).init(0),
            .ts = std.atomic.Value(u32).init(0),
            .bridge = bridge,
            .recorder = recorder,
            .transcript = transcript,
            .in_stats = .{},
            .out_stats = .{},
            .rtp_thread = null,
            .running = std.atomic.Value(bool).init(true),
            .transfer_requested = std.atomic.Value(bool).init(false),
            .human_transfer_uri = human_uri_owned,
            .transfer_language = transfer_language_owned,
            .human_transcription_model = human_transcription_owned,
            .caller_signal_addr = caller_signal_addr,
            .caller_bye = null,
        };
    }

    fn destroy(self: *SipEndpoint, close_rtp_socket: bool) void {
        const io = std.Options.debug_io;
        self.running.store(false, .release);
        self.bridge.close();
        self.allocator.destroy(self.bridge);
        if (close_rtp_socket) self.rtp_sock.close(io);
        if (self.human_transfer_uri) |v| self.allocator.free(v);
        if (self.transfer_language) |v| self.allocator.free(v);
        if (self.human_transcription_model) |v| self.allocator.free(v);
        if (self.caller_bye) |v| self.allocator.free(v);
        self.allocator.free(self.call_id);
        self.allocator.free(self.identifier);
        self.allocator.free(self.session_id);
        const allocator = self.allocator;
        self.* = undefined;
        allocator.destroy(self);
    }

    fn startRtpThread(self: *SipEndpoint) !void {
        self.rtp_thread = try std.Thread.spawn(.{}, rtpRecvLoop, .{self});
    }

    fn joinRtpThread(self: *SipEndpoint) void {
        if (self.rtp_thread) |t| {
            t.join();
            self.rtp_thread = null;
        }
    }

    // Called from OpenAI bridge audio callback (C++ thread) — send RTP to caller.
    pub fn onAudioFromOpenAI(data: []const u8, ctx: ?*anyopaque) void {
        const self: *SipEndpoint = @ptrCast(@alignCast(ctx.?));
        if (!self.running.load(.acquire)) return;
        const io = std.Options.debug_io;

        // Skip non-Opus packets (e.g. RTCP SR/RR delivered on same callback by libdatachannel)
        const opus = rtp.extractOpusPayload(data) orelse return;

        const seq = self.seq.fetchAdd(1, .acq_rel);
        const ts = self.ts.fetchAdd(rtp.SAMPLES_PER_FRAME, .acq_rel);

        const packet = rtp.buildPacket(self.allocator, opus, seq, ts, self.ssrc) catch return;
        defer self.allocator.free(packet);
        self.rtp_sock.send(io, &self.remote_addr, packet) catch {};

        self.out_stats.add(self.session_id, "openai->sip", data.len);
        if (self.recorder) |rec| {
            // Store the BARE Opus payload (already extracted above), not the raw
            // RTP packet — otherwise each recorded frame carries a 12-byte RTP
            // header that decodes as noise on the AI track.
            rec.recordFrame(self.session_id, .assistant, nowNs(), opus);
        }
    }

    // Called from OpenAI bridge event callback (C++ thread) — route to transcript.
    pub fn onEventFromOpenAI(json: []const u8, ctx: ?*anyopaque) void {
        const self: *SipEndpoint = @ptrCast(@alignCast(ctx.?));
        if (self.transcript) |tr| {
            _ = tr.processEvent(self.session_id, self.allocator, json);
        }
        if (self.human_transfer_uri == null) return;
        var tool_call = (realtime_event.parseHumanTransfer(self.allocator, json) catch return) orelse return;
        defer tool_call.deinit(self.allocator);
        if (self.transfer_requested.swap(true, .acq_rel)) return;

        var out = std.ArrayList(u8).empty;
        defer out.deinit(self.allocator);
        out.appendSlice(self.allocator, "{\"type\":\"conversation.item.create\",\"item\":{\"type\":\"function_call_output\",\"call_id\":") catch return;
        json_util.appendQuoted(&out, self.allocator, tool_call.call_id) catch return;
        out.appendSlice(self.allocator, ",\"output\":\"{\\\"status\\\":\\\"transferring\\\"}\"}}") catch return;
        self.bridge.sendEvent(out.items);
    }
};

fn rtpRecvLoop(ep: *SipEndpoint) void {
    const io = std.Options.debug_io;
    var buf: [MAX_UDP]u8 = undefined;
    const timeout = std.Io.Timeout{ .duration = .{ .raw = std.Io.Duration.fromMilliseconds(RTP_RECV_TIMEOUT_MS), .clock = .awake } };

    sendSilencePackets(ep, 3);

    while (ep.running.load(.acquire)) {
        const msg = ep.rtp_sock.receiveTimeout(io, &buf, timeout) catch |err| {
            if (err == error.Timeout) continue;
            sleepMs(10);
            continue;
        };

        const payload = rtp.extractOpusPayload(msg.data) orelse continue;
        ep.in_stats.add(ep.session_id, "sip->openai", payload.len);
        ep.bridge.sendAudio(payload);

        if (ep.recorder) |rec| {
            rec.recordFrame(ep.session_id, .user, nowNs(), payload);
        }
    }
}

fn sendSilencePackets(ep: *SipEndpoint, count: u8) void {
    const io = std.Options.debug_io;
    var i: u8 = 0;
    while (i < count) : (i += 1) {
        const seq = ep.seq.fetchAdd(1, .acq_rel);
        const ts = ep.ts.fetchAdd(rtp.SAMPLES_PER_FRAME, .acq_rel);
        const pkt = rtp.buildSilencePacket(ep.allocator, seq, ts, ep.ssrc) catch continue;
        defer ep.allocator.free(pkt);
        ep.rtp_sock.send(io, &ep.remote_addr, pkt) catch {};
        sleepMs(20);
    }
}

// ---- SIP Server ----

pub const SipServer = struct {
    allocator: std.mem.Allocator,
    cfg: Config,

    sock: net.Socket,
    endpoints: std.StringHashMap(Endpoint),
    mu: Mutex,

    next_rtp_port: std.atomic.Value(u16),
    thread: ?std.Thread,
    running: std.atomic.Value(bool),

    pub fn init(allocator: std.mem.Allocator, cfg: Config) !SipServer {
        const io = std.Options.debug_io;
        const addr = try net.IpAddress.parseIp4("0.0.0.0", cfg.sip_port);
        const sock = try net.IpAddress.bind(&addr, io, .{ .mode = .dgram });

        return .{
            .allocator = allocator,
            .cfg = cfg,
            .sock = sock,
            .endpoints = std.StringHashMap(Endpoint).init(allocator),
            .mu = .{},
            .next_rtp_port = std.atomic.Value(u16).init(cfg.rtp_base_port),
            .thread = null,
            .running = std.atomic.Value(bool).init(false),
        };
    }

    pub fn start(self: *SipServer) !void {
        self.running.store(true, .release);
        self.thread = try std.Thread.spawn(.{}, sipLoop, .{self});
        std.log.info("sip: listening on 0.0.0.0:{d}", .{self.cfg.sip_port});
    }

    pub fn stop(self: *SipServer) void {
        self.running.store(false, .release);
        if (self.thread) |t| {
            t.join();
            self.thread = null;
        }
    }

    pub fn deinit(self: *SipServer) void {
        const io = std.Options.debug_io;
        self.stop();

        self.mu.lock();
        var it = self.endpoints.iterator();
        while (it.next()) |entry| {
            switch (entry.value_ptr.*) {
                .llm => |ep| {
                    ep.joinRtpThread();
                    if (ep.transcript) |tr| _ = tr.flushSession(ep.session_id);
                    if (ep.recorder) |rec| rec.flushPending();
                    if (self.cfg.store) |s| s.unbindSession(ep.session_id);
                    ep.destroy(true);
                },
                .human => |ep| {
                    if (self.cfg.store) |s| s.unbindSession(ep.session_id);
                    ep.destroy();
                },
            }
        }
        self.endpoints.deinit();
        self.mu.unlock();

        self.sock.close(io);
    }

    fn allocRtpPort(self: *SipServer) u16 {
        return self.next_rtp_port.fetchAdd(2, .acq_rel);
    }

    fn sipLoop(self: *SipServer) void {
        const io = std.Options.debug_io;
        var buf: [MAX_UDP]u8 = undefined;
        const timeout = std.Io.Timeout{ .duration = .{ .raw = std.Io.Duration.fromMilliseconds(SIP_RECV_TIMEOUT_MS), .clock = .awake } };

        while (self.running.load(.acquire)) {
            self.processPendingTransfers();
            const msg = self.sock.receiveTimeout(io, &buf, timeout) catch |err| {
                if (err == error.Timeout) {
                    self.reapFinishedHumanEndpoints();
                    continue;
                }
                std.log.err("sip: recv: {s}", .{@errorName(err)});
                continue;
            };
            const first_line = blk: {
                const nl = std.mem.indexOfScalar(u8, msg.data, '\r') orelse msg.data.len;
                break :blk msg.data[0..@min(nl, 60)];
            };
            std.log.info("sip: recv {d}b: {s}", .{ msg.data.len, first_line });
            self.handleMessage(msg.data, &msg.from) catch |err| {
                std.log.warn("sip: handleMessage: {s}", .{@errorName(err)});
            };
        }
    }

    /// Destroy human endpoints whose call already ended (operator hung up →
    /// finish() ran on the outbound recv thread; destruction must happen here,
    /// on the SIP server thread).
    fn reapFinishedHumanEndpoints(self: *SipServer) void {
        while (true) {
            var finished: ?*human_bridge.HumanEndpoint = null;

            self.mu.lock();
            var it = self.endpoints.iterator();
            while (it.next()) |entry| {
                switch (entry.value_ptr.*) {
                    .human => |ep| {
                        if (ep.isFinished()) {
                            finished = ep;
                            _ = self.endpoints.removeByPtr(entry.key_ptr);
                            break;
                        }
                    },
                    .llm => {},
                }
            }
            self.mu.unlock();

            const ep = finished orelse return;
            std.log.info("sip: reaping finished transfer call (session={s})", .{ep.session_id});
            if (self.cfg.store) |s| s.unbindSession(ep.session_id);
            ep.destroy();
        }
    }

    /// Tool callbacks only set an atomic flag. The SIP owner thread performs
    /// the actual endpoint swap so no QuickJS/OpenAI callback mutates the live
    /// endpoint map or blocks on an outbound SIP dial.
    fn processPendingTransfers(self: *SipServer) void {
        while (true) {
            var pending: ?*SipEndpoint = null;
            self.mu.lock();
            var it = self.endpoints.iterator();
            while (it.next()) |entry| {
                switch (entry.value_ptr.*) {
                    .llm => |ep| {
                        if (!ep.transfer_requested.load(.acquire)) continue;
                        pending = ep;
                        _ = self.endpoints.removeByPtr(entry.key_ptr);
                        break;
                    },
                    .human => {},
                }
            }
            self.mu.unlock();

            const ep = pending orelse return;
            self.transferLlmToHuman(ep);
        }
    }

    fn transferLlmToHuman(self: *SipServer, ep: *SipEndpoint) void {
        const target = ep.human_transfer_uri orelse {
            ep.destroy(true);
            return;
        };
        ep.running.store(false, .release);
        ep.joinRtpThread();
        ep.bridge.close();

        std.log.info("sip: AI requested human transfer {s} -> {s} (session={s})", .{ ep.identifier, target, ep.session_id });
        const human = human_bridge.HumanEndpoint.create(self.allocator, ep.call_id, .{
            .caller_ip = "",
            .caller_rtp_port = 0,
            .caller_addr = ep.remote_addr,
            .caller_socket = ep.rtp_sock,
            .target_uri = target,
            .from_user = ep.identifier,
            .public_ip = self.cfg.public_ip,
            .a_rtp_port = ep.local_rtp_port,
            .b_rtp_port = self.allocRtpPort(),
            .sip_auth = self.cfg.sip_auth,
            .language = ep.transfer_language,
            .transcription = .{
                .api_key = self.cfg.bridge_base.api_key,
                .calls_url = self.cfg.bridge_base.calls_url,
                .transcription_model = ep.human_transcription_model orelse self.cfg.bridge_base.transcription_model,
                .noise_reduction = self.cfg.bridge_base.noise_reduction,
                .vad_threshold = self.cfg.bridge_base.vad_threshold,
                .vad_silence_ms = self.cfg.bridge_base.vad_silence_ms,
                .vad_prefix_ms = self.cfg.bridge_base.vad_prefix_ms,
                .stun_url = self.cfg.bridge_base.stun_url,
                .ice_port_range_begin = self.cfg.bridge_base.ice_port_range_begin,
                .ice_port_range_end = self.cfg.bridge_base.ice_port_range_end,
            },
            .dc_client = self.cfg.dc_client,
            .recorder = self.cfg.recorder,
            .transcript = self.cfg.transcript,
        }) catch |err| {
            std.log.err("sip: AI human transfer failed (session={s}): {s}", .{ ep.session_id, @errorName(err) });
            if (ep.caller_bye) |bye| self.sock.send(std.Options.debug_io, &ep.caller_signal_addr, bye) catch {};
            ep.destroy(false);
            return;
        };

        if (ep.caller_bye) |bye| {
            human.armCallerBye(self.sock, ep.caller_signal_addr, bye);
            ep.caller_bye = null;
        }
        ep.destroy(false);

        self.mu.lock();
        self.endpoints.put(human.call_id, .{ .human = human }) catch {
            self.mu.unlock();
            human.destroy();
            return;
        };
        self.mu.unlock();
        human.start() catch |err| {
            std.log.err("sip: transferred human relay start failed: {s}", .{@errorName(err)});
            human.finish();
        };
    }

    fn handleMessage(self: *SipServer, raw: []const u8, src: *const net.IpAddress) !void {
        var parsed = SipMsg.parse(raw) catch return;

        // Responses to requests WE sent from this socket (e.g. the 200 OK for a
        // BYE we issued towards the caller). Never answer a response.
        if (parsed.isResponse()) return;

        if (std.mem.eql(u8, parsed.method, "INVITE")) {
            try self.handleInvite(&parsed, raw, src);
        } else if (std.mem.eql(u8, parsed.method, "BYE")) {
            try self.handleBye(&parsed, src);
        } else {
            // ACK, CANCEL, REGISTER, OPTIONS → 200 OK
            try self.sendOk200(src, &parsed, "");
        }
    }

    fn handleInvite(self: *SipServer, msg: *SipMsg, raw: []const u8, src: *const net.IpAddress) !void {
        const client_ip = msg.sdpConnectionIp();
        const client_rtp_port = msg.sdpAudioPort();

        if (client_rtp_port == 0) {
            try self.sendResponse(src, msg, "400 Bad Request", "", null);
            return;
        }

        const remote_ip = if (client_ip.len > 0) client_ip else ipString(src);
        const call_id = msg.getHeader("call-id");
        const identifier = extractPhone(msg.getHeader("from"));
        const dialed = extractPhone(msg.getHeader("to"));

        // Re-INVITE: just re-send 200 OK
        {
            self.mu.lock();
            const exists = self.endpoints.contains(call_id);
            self.mu.unlock();
            if (exists) {
                try self.sendInviteOk(src, msg, self.next_rtp_port.load(.acquire) - 2);
                return;
            }
        }

        // Send 100 Trying immediately so baresip stops retransmitting INVITE
        self.sendResponse(src, msg, "100 Trying", "", null) catch {};

        // Spawn per-call setup thread. The raw INVITE is copied: the parsed
        // SipMsg borrows from the recv buffer, which the SIP loop overwrites
        // with the next packet, while setup may run for many seconds (human
        // transfer keeps ringing the operator).
        const raw_copy = try self.allocator.dupe(u8, raw);
        errdefer self.allocator.free(raw_copy);

        const ctx = try self.allocator.create(InviteCtx);
        ctx.* = .{
            .server = self,
            .call_id = try self.allocator.dupe(u8, call_id),
            .identifier = try self.allocator.dupe(u8, identifier),
            .dialed = try self.allocator.dupe(u8, dialed),
            .remote_ip = try self.allocator.dupe(u8, remote_ip),
            .remote_port = client_rtp_port,
            .src = src.*,
            .raw = raw_copy,
        };
        const t = std.Thread.spawn(.{}, handleInviteSetup, .{ctx}) catch |err| {
            std.log.err("sip: spawn invite setup: {s}", .{@errorName(err)});
            self.allocator.free(ctx.call_id);
            self.allocator.free(ctx.identifier);
            self.allocator.free(ctx.dialed);
            self.allocator.free(ctx.remote_ip);
            self.allocator.free(ctx.raw);
            self.allocator.destroy(ctx);
            try self.sendResponse(src, msg, "503 Service Unavailable", "", null);
            return;
        };
        t.detach();
    }

    fn handleBye(self: *SipServer, msg: *SipMsg, src: *const net.IpAddress) !void {
        try self.sendOk200(src, msg, "");
        const call_id = msg.getHeader("call-id");

        self.mu.lock();
        const kv = self.endpoints.fetchRemove(call_id);
        self.mu.unlock();

        if (kv) |entry| {
            switch (entry.value) {
                .llm => |ep| {
                    ep.running.store(false, .release);
                    ep.joinRtpThread();
                    if (ep.transcript) |tr| _ = tr.flushSession(ep.session_id);
                    if (ep.recorder) |rec| rec.flushPending();
                    if (self.cfg.store) |s| s.unbindSession(ep.session_id);
                    ep.destroy(true);
                },
                .human => |ep| {
                    if (self.cfg.store) |s| s.unbindSession(ep.session_id);
                    ep.destroy();
                },
            }
        }
    }

    fn sendInviteOk(self: *SipServer, src: *const net.IpAddress, msg: *SipMsg, rtp_port: u16) !void {
        const sdp = try buildSdp(self.allocator, self.cfg.public_ip, rtp_port);
        defer self.allocator.free(sdp);
        try self.sendResponse(src, msg, "200 OK", sdp, "application/sdp");
    }

    fn sendOk200(self: *SipServer, src: *const net.IpAddress, msg: *SipMsg, body: []const u8) !void {
        try self.sendResponse(src, msg, "200 OK", body, null);
    }

    fn sendResponse(
        self: *SipServer,
        dst: *const net.IpAddress,
        req: *SipMsg,
        status: []const u8,
        body: []const u8,
        content_type: ?[]const u8,
    ) !void {
        const io = std.Options.debug_io;
        var out = try std.ArrayList(u8).initCapacity(self.allocator, 512);
        defer out.deinit(self.allocator);

        try out.appendSlice(self.allocator, "SIP/2.0 ");
        try out.appendSlice(self.allocator, status);
        try out.appendSlice(self.allocator, "\r\nVia: ");
        try out.appendSlice(self.allocator, req.getHeader("via"));
        try out.appendSlice(self.allocator, "\r\nFrom: ");
        try out.appendSlice(self.allocator, req.getHeader("from"));
        try out.appendSlice(self.allocator, "\r\nTo: ");
        const to = req.getHeader("to");
        try out.appendSlice(self.allocator, to);
        if (std.mem.indexOf(u8, to, "tag=") == null) {
            try out.appendSlice(self.allocator, ";tag=llm0");
        }
        try out.appendSlice(self.allocator, "\r\nCall-ID: ");
        try out.appendSlice(self.allocator, req.getHeader("call-id"));
        try out.appendSlice(self.allocator, "\r\nCSeq: ");
        try out.appendSlice(self.allocator, req.getHeader("cseq"));

        const contact = try std.fmt.allocPrint(self.allocator, "\r\nContact: <sip:{s}:{d}>", .{ self.cfg.public_ip, self.cfg.sip_port });
        defer self.allocator.free(contact);
        try out.appendSlice(self.allocator, contact);

        if (content_type) |ct| {
            try out.appendSlice(self.allocator, "\r\nContent-Type: ");
            try out.appendSlice(self.allocator, ct);
        }

        const cl = try std.fmt.allocPrint(self.allocator, "\r\nContent-Length: {d}\r\n\r\n", .{body.len});
        defer self.allocator.free(cl);
        try out.appendSlice(self.allocator, cl);
        try out.appendSlice(self.allocator, body);

        const payload = try out.toOwnedSlice(self.allocator);
        defer self.allocator.free(payload);
        try self.sock.send(io, dst, payload);
    }
};

// ---- Invite setup (runs in spawned thread) ----

const InviteCtx = struct {
    server: *SipServer,
    call_id: []u8,
    identifier: []u8,
    /// Dialed number (SIP To) — selects the call route via the phone-numbers
    /// store. Distinct from `identifier` (the caller, SIP From).
    dialed: []u8,
    remote_ip: []u8,
    remote_port: u16,
    src: net.IpAddress,
    /// Owned copy of the raw INVITE; re-parsed in the setup thread so headers
    /// stay valid however long setup takes.
    raw: []u8,
};

fn handleInviteSetup(ctx: *InviteCtx) void {
    defer {
        ctx.server.allocator.free(ctx.call_id);
        ctx.server.allocator.free(ctx.identifier);
        ctx.server.allocator.free(ctx.dialed);
        ctx.server.allocator.free(ctx.remote_ip);
        ctx.server.allocator.free(ctx.raw);
        ctx.server.allocator.destroy(ctx);
    }

    const server = ctx.server;
    const alloc = server.allocator;
    const io = std.Options.debug_io;

    // Re-parse the owned raw INVITE (the recv-buffer copy dies immediately).
    var invite_msg = SipMsg.parse(ctx.raw) catch {
        std.log.err("sip: setup re-parse failed (call={s})", .{ctx.call_id});
        return;
    };
    const msg = &invite_msg;

    // Resolve the route for the dialed number BEFORE allocating any call
    // resources. No store / no mapping / no valid route → refuse the call:
    // the gate never answers without knowing what to do with the call.
    const store = server.cfg.store orelse {
        std.log.err("sip: call refused — no store to resolve route (dialed={s})", .{ctx.dialed});
        server.sendResponse(&ctx.src, msg, "503 Service Unavailable", "", null) catch {};
        return;
    };
    var route = (store.resolvePhoneRoute(alloc, "", ctx.dialed) catch |err| {
        std.log.err("sip: route lookup failed (dialed={s}): {s}", .{ ctx.dialed, @errorName(err) });
        server.sendResponse(&ctx.src, msg, "503 Service Unavailable", "", null) catch {};
        return;
    }) orelse {
        std.log.warn("sip: call refused — no route mapped for dialed number {s}", .{ctx.dialed});
        server.sendResponse(&ctx.src, msg, "404 Not Found", "", null) catch {};
        return;
    };
    defer route.deinit(alloc);

    var plan = if (server.cfg.policy) |policy|
        policy.planIncoming(.{
            .call_id = ctx.call_id,
            .caller = ctx.identifier,
            .dialed = ctx.dialed,
            .route_context_id = route.context_id,
            .route_transfer_uri = route.transfer_uri,
            .route_transfer_language = route.transfer_language,
        }) catch |err| {
            std.log.err("sip: policy failed (call={s}): {s}", .{ ctx.call_id, @errorName(err) });
            server.sendResponse(&ctx.src, msg, "500 Server Internal Error", "", null) catch {};
            return;
        }
    else
        legacyPlan(alloc, &route) catch {
            server.sendResponse(&ctx.src, msg, "404 Not Found", "", null) catch {};
            return;
        };
    defer plan.deinit(alloc);

    switch (plan.action) {
        .human => {
            handleTransferSetup(ctx, msg, plan.transfer_uri.?, plan.language, plan.transcription_model);
            return;
        },
        .reject => {
            server.sendResponse(&ctx.src, msg, sipRejectStatus(plan.reject_status), "", null) catch {};
            return;
        },
        .ai => {},
    }
    if (plan.provider) |provider| {
        if (!std.mem.eql(u8, provider, "openai")) {
            std.log.err("sip: policy selected unsupported realtime provider {s}", .{provider});
            server.sendResponse(&ctx.src, msg, "501 Not Implemented", "", null) catch {};
            return;
        }
    }

    const context_id = plan.context_id.?;

    var context = (store.getContext(alloc, "", context_id, null) catch |err| {
        std.log.err("sip: context load failed (id={s}): {s}", .{ context_id, @errorName(err) });
        server.sendResponse(&ctx.src, msg, "503 Service Unavailable", "", null) catch {};
        return;
    }) orelse {
        std.log.warn("sip: call refused — context '{s}' missing/incomplete", .{context_id});
        server.sendResponse(&ctx.src, msg, "404 Not Found", "", null) catch {};
        return;
    };
    defer context.deinit(alloc);
    var bridge_cfg = server.cfg.bridge_base.withContext(context.instructions, context.language);
    if (plan.model) |value| bridge_cfg.model = value;
    if (plan.voice) |value| bridge_cfg.voice = value;
    if (plan.transcription_model) |value| bridge_cfg.transcription_model = value;
    if (plan.noise_reduction) |value| bridge_cfg.noise_reduction = value;
    if (plan.vad_threshold) |value| bridge_cfg.vad_threshold = value;
    if (plan.vad_silence_ms) |value| bridge_cfg.vad_silence_ms = value;
    if (plan.vad_prefix_ms) |value| bridge_cfg.vad_prefix_ms = value;
    if (plan.vad_interrupt) |value| bridge_cfg.vad_interrupt = value;
    if (plan.hasHumanTransferTool()) bridge_cfg.tools_json = transfer_tool_json;

    const local_port = server.allocRtpPort();
    const rtp_addr = net.IpAddress.parseIp4("0.0.0.0", local_port) catch {
        server.sendResponse(&ctx.src, msg, "503 Service Unavailable", "", null) catch {};
        return;
    };
    const rtp_sock = net.IpAddress.bind(&rtp_addr, io, .{ .mode = .dgram }) catch |err| {
        std.log.err("sip: bind rtp port {d}: {s}", .{ local_port, @errorName(err) });
        server.sendResponse(&ctx.src, msg, "503 Service Unavailable", "", null) catch {};
        return;
    };

    const bridge = alloc.create(bridge_mod.OpenAIBridge) catch {
        rtp_sock.close(io);
        server.sendResponse(&ctx.src, msg, "503 Service Unavailable", "", null) catch {};
        return;
    };
    bridge.* = bridge_mod.OpenAIBridge.init(alloc, server.cfg.dc_client, bridge_cfg);

    const ep = alloc.create(SipEndpoint) catch {
        alloc.destroy(bridge);
        rtp_sock.close(io);
        server.sendResponse(&ctx.src, msg, "503 Service Unavailable", "", null) catch {};
        return;
    };
    ep.* = SipEndpoint.init(
        alloc,
        ctx.call_id,
        ctx.identifier,
        ctx.remote_ip,
        ctx.remote_port,
        local_port,
        rtp_sock,
        bridge,
        server.cfg.recorder,
        server.cfg.transcript,
        plan.human_transfer_uri,
        plan.language,
        plan.transcription_model,
        ctx.src,
    ) catch |err| {
        alloc.destroy(bridge);
        alloc.destroy(ep);
        rtp_sock.close(io);
        std.log.err("sip: endpoint init: {s}", .{@errorName(err)});
        server.sendResponse(&ctx.src, msg, "503 Service Unavailable", "", null) catch {};
        return;
    };
    ep.caller_bye = buildCallerBye(alloc, server, msg) catch null;

    bridge.on_audio = SipEndpoint.onAudioFromOpenAI;
    bridge.on_audio_ctx = ep;
    bridge.on_event = SipEndpoint.onEventFromOpenAI;
    bridge.on_event_ctx = ep;

    if (server.cfg.store) |s| {
        s.bindSession(ep.session_id, "") catch |err| {
            std.log.warn("sip: bindSession failed for {s}: {s}", .{ ep.session_id, @errorName(err) });
        };
        s.putSession(ep.session_id, ep.identifier, nowNs()) catch |err| {
            std.log.err("sip: putSession failed for {s} ({s}): {s}", .{ ep.session_id, ep.identifier, @errorName(err) });
        };
    }
    sipRegisterThreadAudio(server.cfg.store, ep.session_id);

    std.log.info("sip: INVITE from {s} rtp={s}:{d} id={s}", .{ ctx.identifier, ctx.remote_ip, ctx.remote_port, ctx.call_id });
    bridge.connect() catch |err| {
        std.log.err("sip: bridge connect: {s}", .{@errorName(err)});
        ep.destroy(true);
        server.sendResponse(&ctx.src, msg, "503 Service Unavailable", "", null) catch {};
        return;
    };
    std.log.info("sip: OpenAI bridge connected for {s}", .{ctx.identifier});
    // The greeting used to fire inside bridge.connect(); it now lives behind
    // requestGreeting() so the browser path can defer it until DTLS is up. SIP
    // keeps the original timing (right after connect, before 200 OK / RTP thread).
    bridge.requestGreeting();

    server.mu.lock();
    server.endpoints.put(ep.call_id, .{ .llm = ep }) catch {
        server.mu.unlock();
        ep.destroy(true);
        return;
    };
    server.mu.unlock();

    server.sendInviteOk(&ctx.src, msg, local_port) catch |err| {
        std.log.err("sip: sendInviteOk: {s}", .{@errorName(err)});
    };

    ep.startRtpThread() catch |err| {
        std.log.err("sip: startRtpThread: {s}", .{@errorName(err)});
    };
}

/// Transfer route: bridge the caller to a human over the trunk. Runs on the
/// invite-setup thread; blocks while the operator's phone rings.
fn handleTransferSetup(
    ctx: *InviteCtx,
    msg: *SipMsg,
    transfer_uri: []const u8,
    transfer_language: ?[]const u8,
    transcription_model: ?[]const u8,
) void {
    const server = ctx.server;
    const alloc = server.allocator;

    // Ring feedback while we dial the other human.
    server.sendResponse(&ctx.src, msg, "180 Ringing", "", null) catch {};

    const a_rtp_port = server.allocRtpPort();
    const b_rtp_port = server.allocRtpPort();

    std.log.info("sip: transfer INVITE from {s} -> {s} (call={s})", .{ ctx.identifier, transfer_uri, ctx.call_id });

    const ep = human_bridge.HumanEndpoint.create(alloc, ctx.call_id, .{
        .caller_ip = ctx.remote_ip,
        .caller_rtp_port = ctx.remote_port,
        .caller_addr = null,
        .caller_socket = null,
        .target_uri = transfer_uri,
        .from_user = ctx.identifier,
        .public_ip = server.cfg.public_ip,
        .a_rtp_port = a_rtp_port,
        .b_rtp_port = b_rtp_port,
        .sip_auth = server.cfg.sip_auth,
        .language = transfer_language,
        .transcription = .{
            .api_key = server.cfg.bridge_base.api_key,
            .calls_url = server.cfg.bridge_base.calls_url,
            .transcription_model = transcription_model orelse server.cfg.bridge_base.transcription_model,
            .noise_reduction = server.cfg.bridge_base.noise_reduction,
            .vad_threshold = server.cfg.bridge_base.vad_threshold,
            .vad_silence_ms = server.cfg.bridge_base.vad_silence_ms,
            .vad_prefix_ms = server.cfg.bridge_base.vad_prefix_ms,
            .stun_url = server.cfg.bridge_base.stun_url,
            .ice_port_range_begin = server.cfg.bridge_base.ice_port_range_begin,
            .ice_port_range_end = server.cfg.bridge_base.ice_port_range_end,
        },
        .dc_client = server.cfg.dc_client,
        .recorder = server.cfg.recorder,
        .transcript = server.cfg.transcript,
    }) catch |err| {
        std.log.err("sip: transfer setup failed ({s} -> {s}): {s}", .{ ctx.identifier, transfer_uri, @errorName(err) });
        const status = if (err == error.SipCallRejected or err == error.SipAnswerTimeout)
            "480 Temporarily Unavailable"
        else
            "503 Service Unavailable";
        server.sendResponse(&ctx.src, msg, status, "", null) catch {};
        return;
    };

    // Register the session exactly like the LLM path so recording playback,
    // thread index and stats work unchanged.
    if (server.cfg.store) |s| {
        s.bindSession(ep.session_id, "") catch |err| {
            std.log.warn("sip: bindSession failed for {s}: {s}", .{ ep.session_id, @errorName(err) });
        };
        s.putSession(ep.session_id, ep.identifier, nowNs()) catch |err| {
            std.log.err("sip: putSession failed for {s} ({s}): {s}", .{ ep.session_id, ep.identifier, @errorName(err) });
        };
    }
    sipRegisterThreadAudio(server.cfg.store, ep.session_id);

    // Prebuilt BYE towards the caller, used if the operator hangs up first.
    if (buildCallerBye(alloc, server, msg)) |bye| {
        ep.armCallerBye(server.sock, ctx.src, bye);
    } else |err| {
        std.log.warn("sip: caller BYE not armed (call={s}): {s}", .{ ctx.call_id, @errorName(err) });
    }

    server.mu.lock();
    server.endpoints.put(ep.call_id, .{ .human = ep }) catch {
        server.mu.unlock();
        ep.destroy();
        server.sendResponse(&ctx.src, msg, "503 Service Unavailable", "", null) catch {};
        return;
    };
    server.mu.unlock();

    server.sendInviteOk(&ctx.src, msg, a_rtp_port) catch |err| {
        std.log.err("sip: transfer sendInviteOk: {s}", .{@errorName(err)});
    };

    ep.start() catch |err| {
        std.log.err("sip: transfer start relays: {s}", .{@errorName(err)});
    };
    std.log.info("sip: transfer bridged {s} <-> {s} (session={s})", .{ ctx.identifier, transfer_uri, ep.session_id });
}

fn legacyPlan(allocator: std.mem.Allocator, route: *const store_mod.PhoneRoute) !policy_types.CallPlan {
    if (route.transfer_uri) |uri| {
        const transfer_uri = try allocator.dupe(u8, uri);
        errdefer allocator.free(transfer_uri);
        const language = if (route.transfer_language) |v| try allocator.dupe(u8, v) else null;
        return .{
            .action = .human,
            .transfer_uri = transfer_uri,
            .language = language,
        };
    }
    if (route.context_id) |id| {
        return .{ .action = .ai, .context_id = try allocator.dupe(u8, id) };
    }
    return error.RouteIncomplete;
}

fn sipRejectStatus(status: u16) []const u8 {
    return switch (status) {
        404 => "404 Not Found",
        480 => "480 Temporarily Unavailable",
        486 => "486 Busy Here",
        503 => "503 Service Unavailable",
        else => "403 Forbidden",
    };
}

/// BYE for the INBOUND dialog (we are the callee): sent to the caller's trunk
/// when the operator side ends first. Direction flips: our From is the
/// INVITE's To (+ our tag), our To is the INVITE's From.
fn buildCallerBye(alloc: std.mem.Allocator, server: *SipServer, invite: *SipMsg) ![]u8 {
    const contact = invite.getHeader("contact");
    const request_uri = blk: {
        if (std.mem.indexOfScalar(u8, contact, '<')) |lt| {
            const gt = std.mem.indexOfScalarPos(u8, contact, lt, '>') orelse break :blk contact;
            break :blk contact[lt + 1 .. gt];
        }
        if (contact.len > 0) break :blk contact;
        return error.NoContactHeader;
    };

    const to = invite.getHeader("to");
    const needs_tag = std.mem.indexOf(u8, to, "tag=") == null;

    var branch_bytes: [8]u8 = undefined;
    std.Options.debug_io.random(&branch_bytes);
    const branch_hex = std.fmt.bytesToHex(branch_bytes, .lower);

    return std.fmt.allocPrint(
        alloc,
        "BYE {s} SIP/2.0\r\n" ++
            "Via: SIP/2.0/UDP {s}:{d};branch=z9hG4bK{s};rport\r\n" ++
            "Max-Forwards: 70\r\n" ++
            "From: {s}{s}\r\n" ++
            "To: {s}\r\n" ++
            "Call-ID: {s}\r\n" ++
            "CSeq: 1 BYE\r\n" ++
            "Content-Length: 0\r\n\r\n",
        .{
            request_uri,
            server.cfg.public_ip,
            server.cfg.sip_port,
            branch_hex,
            to,
            if (needs_tag) ";tag=llm0" else "",
            invite.getHeader("from"),
            invite.getHeader("call-id"),
        },
    );
}

fn sipRegisterThreadAudio(store: ?*store_mod.Store, session_id: []const u8) void {
    const s = store orelse {
        std.log.warn("sip: store unavailable, session {s} not indexed", .{session_id});
        return;
    };
    // Service API write into the ms-threads thread_index. Non-fatal.
    s.registerThreadIndex(session_id, "audio") catch |err| {
        std.log.warn("sip: registerThreadAudio index write failed (session={s}): {s}", .{ session_id, @errorName(err) });
        return;
    };
    std.log.info("sip: session {s} registered as audio thread", .{session_id});
}

// ---- Helpers ----

fn ipString(addr: *const net.IpAddress) []const u8 {
    _ = addr;
    return "0.0.0.0"; // fallback; proper impl would format addr
}
