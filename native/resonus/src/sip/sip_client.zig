// Minimal SIP UAC (outbound leg) over UDP: INVITE with optional digest auth
// (RFC 2617 MD5), ACK, BYE, and a receive loop for in-dialog requests. Used by
// the human-transfer bridge to dial an operator through a provider SIP trunk
// (Telnyx / Twilio). Opus-only: an answer without Opus fails the call loudly.
const std = @import("std");
const net = std.Io.net;
const sip_msg = @import("sip_msg.zig");

const SipMsg = sip_msg.SipMsg;
const sleepMs = sip_msg.sleepMs;

const MAX_UDP: usize = 4096;
const RECV_TIMEOUT_MS: i64 = 200;
const INVITE_RETRANSMIT_MS: u64 = 500;
const INVITE_MAX_RETRANSMITS: u8 = 6;
const BYE_MAX_RETRANSMITS: u8 = 3;

pub const AuthCreds = struct {
    username: []const u8,
    password: []const u8,
};

pub const Config = struct {
    /// IP the trunk can reach us on: goes into Via/Contact/SDP.
    public_ip: []const u8,
    /// Caller identity presented in From (usually the original caller's phone).
    from_user: []const u8,
    /// Digest credentials for the trunk; absent => IP-auth trunk, any 401/407
    /// fails the call (no silent fallback).
    auth: ?AuthCreds = null,
    /// How long we let the operator's phone ring before giving up.
    answer_timeout_ms: u64 = 45_000,
};

pub const Answer = struct {
    remote_rtp_ip: []u8, // owned by OutboundCall.allocator
    remote_rtp_port: u16,
    opus_payload_type: u7,
};

pub const RemoteByeCallback = *const fn (ctx: ?*anyopaque) void;

pub const OutboundCall = struct {
    allocator: std.mem.Allocator,
    cfg: Config,

    sock: net.Socket,
    local_port: u16,
    proxy_addr: net.IpAddress,

    target_uri: []u8,
    call_id: []u8,
    from_tag: []u8,
    /// To header exactly as answered (incl. remote tag) — reused in ACK/BYE.
    to_header: ?[]u8 = null,
    from_header: []u8,
    cseq: u32 = 1,

    answer: ?Answer = null,

    running: std.atomic.Value(bool),
    /// Set when the remote side already sent BYE — hangup() becomes a no-op.
    remote_bye: std.atomic.Value(bool) = std.atomic.Value(bool).init(false),
    recv_thread: ?std.Thread = null,

    on_remote_bye: ?RemoteByeCallback = null,
    on_remote_bye_ctx: ?*anyopaque = null,

    /// Dial `target_uri` (e.g. sip:+15551234567@sip.telnyx.com[:port]) offering
    /// `sdp`. Blocks until the callee answers (or error). On success the call is
    /// established (ACK sent) and `answer` holds the remote RTP endpoint.
    pub fn dial(
        allocator: std.mem.Allocator,
        cfg: Config,
        target_uri: []const u8,
        sdp: []const u8,
    ) !*OutboundCall {
        const io = std.Options.debug_io;

        const host_port = try parseSipHostPort(target_uri);
        const proxy_addr = net.IpAddress.parse(host_port.host, host_port.port) catch
            try net.IpAddress.resolve(io, host_port.host, host_port.port);

        const bind_addr = try net.IpAddress.parseIp4("0.0.0.0", 0);
        const sock = try net.IpAddress.bind(&bind_addr, io, .{ .mode = .dgram });
        errdefer sock.close(io);
        const local_port = sock.address.getPort();

        const self = try allocator.create(OutboundCall);
        errdefer allocator.destroy(self);

        var rand_bytes: [12]u8 = undefined;
        randomBytes(&rand_bytes);
        const rand_hex = std.fmt.bytesToHex(rand_bytes, .lower);

        const call_id = try std.fmt.allocPrint(allocator, "{s}@llm-gate", .{rand_hex[0..16]});
        errdefer allocator.free(call_id);
        const from_tag = try allocator.dupe(u8, rand_hex[16..24]);
        errdefer allocator.free(from_tag);
        const target_owned = try allocator.dupe(u8, target_uri);
        errdefer allocator.free(target_owned);
        const from_header = try std.fmt.allocPrint(
            allocator,
            "<sip:{s}@{s}>;tag={s}",
            .{ cfg.from_user, cfg.public_ip, from_tag },
        );
        errdefer allocator.free(from_header);

        self.* = .{
            .allocator = allocator,
            .cfg = cfg,
            .sock = sock,
            .local_port = local_port,
            .proxy_addr = proxy_addr,
            .target_uri = target_owned,
            .call_id = call_id,
            .from_tag = from_tag,
            .from_header = from_header,
            .running = std.atomic.Value(bool).init(true),
        };

        try self.inviteTransaction(sdp);
        return self;
    }

    pub fn destroy(self: *OutboundCall) void {
        const io = std.Options.debug_io;
        self.running.store(false, .release);
        if (self.recv_thread) |t| {
            t.join();
            self.recv_thread = null;
        }
        self.sock.close(io);
        if (self.answer) |*a| self.allocator.free(a.remote_rtp_ip);
        if (self.to_header) |v| self.allocator.free(v);
        self.allocator.free(self.from_header);
        self.allocator.free(self.target_uri);
        self.allocator.free(self.from_tag);
        self.allocator.free(self.call_id);
        const allocator = self.allocator;
        self.* = undefined;
        allocator.destroy(self);
    }

    /// Start watching the signaling socket for in-dialog requests (BYE from the
    /// provider, OPTIONS keep-alives, retransmitted 200 OK). Call once after dial.
    pub fn startRecvLoop(self: *OutboundCall) !void {
        if (self.recv_thread != null) return;
        self.recv_thread = try std.Thread.spawn(.{}, recvLoop, .{self});
    }

    /// Terminate the call (BYE). Safe to call once; further packets are ignored.
    pub fn hangup(self: *OutboundCall) void {
        if (self.answer == null) return;
        if (self.remote_bye.load(.acquire)) return;
        self.sendBye() catch |err| {
            std.log.warn("sip-out: BYE failed (call={s}): {s}", .{ self.call_id, @errorName(err) });
        };
    }

    // ---- INVITE transaction ----

    fn inviteTransaction(self: *OutboundCall, sdp: []const u8) !void {
        var auth_header: ?[]u8 = null;
        defer if (auth_header) |v| self.allocator.free(v);
        var auth_attempted = false;

        retry: while (true) {
            var branch_bytes: [8]u8 = undefined;
            randomBytes(&branch_bytes);
            const branch_hex = std.fmt.bytesToHex(branch_bytes, .lower);

            const invite = try self.buildRequest("INVITE", self.target_uri, &branch_hex, auth_header, sdp);
            defer self.allocator.free(invite);

            const outcome = try self.awaitFinalResponse(invite, &branch_hex);
            switch (outcome.kind) {
                .answered => {
                    return;
                },
                .auth_required => {
                    if (auth_attempted) {
                        std.log.err("sip-out: digest auth rejected by trunk (call={s})", .{self.call_id});
                        return error.SipAuthRejected;
                    }
                    const creds = self.cfg.auth orelse {
                        std.log.err("sip-out: trunk demands auth (status={d}) but no LLM_GATE_SIP_AUTH_USER/PASSWORD configured (call={s})", .{ outcome.status, self.call_id });
                        return error.SipAuthCredentialsMissing;
                    };
                    auth_attempted = true;
                    auth_header = try buildAuthorizationHeader(
                        self.allocator,
                        outcome.challenge.?,
                        creds,
                        "INVITE",
                        self.target_uri,
                        outcome.status == 407,
                    );
                    self.allocator.free(outcome.challenge.?);
                    self.cseq += 1;
                    continue :retry;
                },
                .rejected => {
                    std.log.err("sip-out: call rejected by trunk: {d} (call={s})", .{ outcome.status, self.call_id });
                    return error.SipCallRejected;
                },
            }
        }
    }

    const FinalOutcome = struct {
        kind: enum { answered, auth_required, rejected },
        status: u16 = 0,
        challenge: ?[]u8 = null, // owned, only for auth_required
    };

    fn awaitFinalResponse(self: *OutboundCall, invite: []const u8, branch: []const u8) !FinalOutcome {
        const io = std.Options.debug_io;
        var buf: [MAX_UDP]u8 = undefined;
        const timeout = std.Io.Timeout{ .duration = .{ .raw = std.Io.Duration.fromMilliseconds(RECV_TIMEOUT_MS), .clock = .awake } };

        try self.sock.send(io, &self.proxy_addr, invite);

        var elapsed_ms: u64 = 0;
        var since_send_ms: u64 = 0;
        var retransmits: u8 = 0;
        var got_provisional = false;

        while (elapsed_ms < self.cfg.answer_timeout_ms) {
            const msg = self.sock.receiveTimeout(io, &buf, timeout) catch |err| {
                if (err != error.Timeout) {
                    std.log.warn("sip-out: recv: {s}", .{@errorName(err)});
                }
                elapsed_ms += RECV_TIMEOUT_MS;
                since_send_ms += RECV_TIMEOUT_MS;
                if (!got_provisional and since_send_ms >= INVITE_RETRANSMIT_MS) {
                    if (retransmits >= INVITE_MAX_RETRANSMITS) return error.SipInviteTimeout;
                    retransmits += 1;
                    since_send_ms = 0;
                    self.sock.send(io, &self.proxy_addr, invite) catch {};
                }
                continue;
            };

            const resp = SipMsg.parse(msg.data) catch continue;
            if (!resp.isResponse()) continue;
            if (!std.mem.eql(u8, resp.getHeader("call-id"), self.call_id)) continue;

            if (resp.status_code < 200) {
                got_provisional = true;
                std.log.info("sip-out: {d} {s} (call={s})", .{ resp.status_code, resp.reason, self.call_id });
                continue;
            }

            // Any final response to INVITE gets an ACK (same branch for non-2xx).
            if (resp.status_code == 200) {
                try self.acceptAnswer(&resp);
                try self.sendAck(resp.getHeader("to"), null);
                return .{ .kind = .answered, .status = 200 };
            }

            self.sendAck(resp.getHeader("to"), branch) catch {};

            if (resp.status_code == 401 or resp.status_code == 407) {
                const challenge_hdr = if (resp.status_code == 401)
                    resp.getHeader("www-authenticate")
                else
                    resp.getHeader("proxy-authenticate");
                if (challenge_hdr.len == 0) return error.SipAuthChallengeMissing;
                return .{
                    .kind = .auth_required,
                    .status = resp.status_code,
                    .challenge = try self.allocator.dupe(u8, challenge_hdr),
                };
            }

            return .{ .kind = .rejected, .status = resp.status_code };
        }
        return error.SipAnswerTimeout;
    }

    fn acceptAnswer(self: *OutboundCall, resp: *const SipMsg) !void {
        const ip = resp.sdpConnectionIp();
        const port = resp.sdpAudioPort();
        if (ip.len == 0 or port == 0) {
            std.log.err("sip-out: 200 OK without usable SDP (call={s})", .{self.call_id});
            return error.SipAnswerSdpInvalid;
        }
        const opus_pt = resp.sdpOpusPayloadType() orelse {
            std.log.err("sip-out: trunk answered without Opus — gate does not transcode (call={s})", .{self.call_id});
            return error.SipAnswerNoOpus;
        };

        const to_owned = try self.allocator.dupe(u8, resp.getHeader("to"));
        errdefer self.allocator.free(to_owned);
        const ip_owned = try self.allocator.dupe(u8, ip);

        if (self.to_header) |old| self.allocator.free(old);
        self.to_header = to_owned;
        self.answer = .{
            .remote_rtp_ip = ip_owned,
            .remote_rtp_port = port,
            .opus_payload_type = opus_pt,
        };
        std.log.info("sip-out: answered, rtp={s}:{d} opus_pt={d} (call={s})", .{ ip, port, opus_pt, self.call_id });
    }

    // ---- In-dialog requests ----

    fn sendAck(self: *OutboundCall, to_header: []const u8, invite_branch: ?[]const u8) !void {
        const io = std.Options.debug_io;
        var branch_buf: [16]u8 = undefined;
        const branch: []const u8 = invite_branch orelse blk: {
            var b: [8]u8 = undefined;
            randomBytes(&b);
            const hex = std.fmt.bytesToHex(b, .lower);
            @memcpy(branch_buf[0..16], hex[0..16]);
            break :blk branch_buf[0..16];
        };

        var out = try std.ArrayList(u8).initCapacity(self.allocator, 512);
        defer out.deinit(self.allocator);
        const w = try std.fmt.allocPrint(
            self.allocator,
            "ACK {s} SIP/2.0\r\n" ++
                "Via: SIP/2.0/UDP {s}:{d};branch=z9hG4bK{s};rport\r\n" ++
                "Max-Forwards: 70\r\n" ++
                "From: {s}\r\n" ++
                "To: {s}\r\n" ++
                "Call-ID: {s}\r\n" ++
                "CSeq: {d} ACK\r\n" ++
                "Content-Length: 0\r\n\r\n",
            .{ self.target_uri, self.cfg.public_ip, self.local_port, branch, self.from_header, to_header, self.call_id, self.cseq },
        );
        defer self.allocator.free(w);
        try self.sock.send(io, &self.proxy_addr, w);
    }

    fn sendBye(self: *OutboundCall) !void {
        const io = std.Options.debug_io;
        const to_header = self.to_header orelse return error.SipNotEstablished;
        self.cseq += 1;

        var branch_bytes: [8]u8 = undefined;
        randomBytes(&branch_bytes);
        const branch_hex = std.fmt.bytesToHex(branch_bytes, .lower);

        const bye = try std.fmt.allocPrint(
            self.allocator,
            "BYE {s} SIP/2.0\r\n" ++
                "Via: SIP/2.0/UDP {s}:{d};branch=z9hG4bK{s};rport\r\n" ++
                "Max-Forwards: 70\r\n" ++
                "From: {s}\r\n" ++
                "To: {s}\r\n" ++
                "Call-ID: {s}\r\n" ++
                "CSeq: {d} BYE\r\n" ++
                "Content-Length: 0\r\n\r\n",
            .{ self.target_uri, self.cfg.public_ip, self.local_port, branch_hex, self.from_header, to_header, self.call_id, self.cseq },
        );
        defer self.allocator.free(bye);

        // The recv loop (if running) consumes the 200; here we just retransmit
        // a bounded number of times without waiting for it.
        var i: u8 = 0;
        while (i < BYE_MAX_RETRANSMITS) : (i += 1) {
            try self.sock.send(io, &self.proxy_addr, bye);
            sleepMs(50);
        }
    }

    fn buildRequest(
        self: *OutboundCall,
        method: []const u8,
        uri: []const u8,
        branch: []const u8,
        auth_header: ?[]const u8,
        sdp: []const u8,
    ) ![]u8 {
        var out = try std.ArrayList(u8).initCapacity(self.allocator, 1024);
        errdefer out.deinit(self.allocator);

        const head = try std.fmt.allocPrint(
            self.allocator,
            "{s} {s} SIP/2.0\r\n" ++
                "Via: SIP/2.0/UDP {s}:{d};branch=z9hG4bK{s};rport\r\n" ++
                "Max-Forwards: 70\r\n" ++
                "From: {s}\r\n" ++
                "To: <{s}>\r\n" ++
                "Call-ID: {s}\r\n" ++
                "CSeq: {d} {s}\r\n" ++
                "Contact: <sip:{s}@{s}:{d}>\r\n",
            .{ method, uri, self.cfg.public_ip, self.local_port, branch, self.from_header, uri, self.call_id, self.cseq, method, self.cfg.from_user, self.cfg.public_ip, self.local_port },
        );
        defer self.allocator.free(head);
        try out.appendSlice(self.allocator, head);

        if (auth_header) |auth| {
            try out.appendSlice(self.allocator, auth);
            try out.appendSlice(self.allocator, "\r\n");
        }

        const tail = try std.fmt.allocPrint(
            self.allocator,
            "Content-Type: application/sdp\r\nContent-Length: {d}\r\n\r\n",
            .{sdp.len},
        );
        defer self.allocator.free(tail);
        try out.appendSlice(self.allocator, tail);
        try out.appendSlice(self.allocator, sdp);

        return out.toOwnedSlice(self.allocator);
    }

    fn recvLoop(self: *OutboundCall) void {
        const io = std.Options.debug_io;
        var buf: [MAX_UDP]u8 = undefined;
        const timeout = std.Io.Timeout{ .duration = .{ .raw = std.Io.Duration.fromMilliseconds(RECV_TIMEOUT_MS), .clock = .awake } };

        while (self.running.load(.acquire)) {
            const msg = self.sock.receiveTimeout(io, &buf, timeout) catch |err| {
                if (err == error.Timeout) continue;
                sleepMs(10);
                continue;
            };
            const req = SipMsg.parse(msg.data) catch continue;

            if (req.isResponse()) {
                // Retransmitted 200 OK for INVITE → re-ACK so the trunk stops.
                if (req.status_code == 200 and std.mem.indexOf(u8, req.getHeader("cseq"), "INVITE") != null) {
                    self.sendAck(req.getHeader("to"), null) catch {};
                }
                continue;
            }

            if (!std.mem.eql(u8, req.getHeader("call-id"), self.call_id)) continue;

            if (std.mem.eql(u8, req.method, "BYE")) {
                self.remote_bye.store(true, .release);
                self.respondOk(&msg.from, &req) catch {};
                std.log.info("sip-out: remote BYE (call={s})", .{self.call_id});
                if (self.on_remote_bye) |cb| cb(self.on_remote_bye_ctx);
                continue;
            }
            // OPTIONS / re-INVITE keep-alives → 200 OK without SDP.
            self.respondOk(&msg.from, &req) catch {};
        }
    }

    fn respondOk(self: *OutboundCall, dst: *const net.IpAddress, req: *const SipMsg) !void {
        const io = std.Options.debug_io;
        const resp = try std.fmt.allocPrint(
            self.allocator,
            "SIP/2.0 200 OK\r\n" ++
                "Via: {s}\r\n" ++
                "From: {s}\r\n" ++
                "To: {s}\r\n" ++
                "Call-ID: {s}\r\n" ++
                "CSeq: {s}\r\n" ++
                "Content-Length: 0\r\n\r\n",
            .{ req.getHeader("via"), req.getHeader("from"), req.getHeader("to"), req.getHeader("call-id"), req.getHeader("cseq") },
        );
        defer self.allocator.free(resp);
        try self.sock.send(io, dst, resp);
    }
};

/// CSPRNG via the Io interface (std.crypto.random is gone in Zig 0.16).
fn randomBytes(buf: []u8) void {
    std.Options.debug_io.random(buf);
}

// ---- SIP URI ----

const HostPort = struct {
    host: []const u8,
    port: u16,
};

/// Pull host[:port] out of a SIP URI: sip:user@host[:port][;params].
fn parseSipHostPort(uri: []const u8) !HostPort {
    var rest = uri;
    if (std.mem.startsWith(u8, rest, "sip:")) rest = rest[4..];
    if (std.mem.startsWith(u8, rest, "sips:")) return error.SipsNotSupported;
    if (std.mem.indexOfScalar(u8, rest, '@')) |at| rest = rest[at + 1 ..];
    if (std.mem.indexOfAny(u8, rest, ";?")) |end| rest = rest[0..end];
    if (rest.len == 0) return error.InvalidSipUri;

    if (std.mem.indexOfScalar(u8, rest, ':')) |colon| {
        const port = std.fmt.parseInt(u16, rest[colon + 1 ..], 10) catch return error.InvalidSipUri;
        if (colon == 0) return error.InvalidSipUri;
        return .{ .host = rest[0..colon], .port = port };
    }
    return .{ .host = rest, .port = 5060 };
}

// ---- Digest auth (RFC 2617, MD5) ----

const DigestChallenge = struct {
    realm: []const u8 = "",
    nonce: []const u8 = "",
    opaque_val: ?[]const u8 = null,
    qop_auth: bool = false,
    algorithm_md5: bool = true,
};

fn parseDigestChallenge(header: []const u8) !DigestChallenge {
    const digest_start = std.mem.indexOf(u8, header, "Digest") orelse return error.NotDigestChallenge;
    var challenge = DigestChallenge{};
    var it = std.mem.splitScalar(u8, header[digest_start + "Digest".len ..], ',');
    while (it.next()) |raw_param| {
        const param = std.mem.trim(u8, raw_param, " \t");
        const eq = std.mem.indexOfScalar(u8, param, '=') orelse continue;
        const name = std.mem.trim(u8, param[0..eq], " \t");
        const value = std.mem.trim(u8, param[eq + 1 ..], " \t\"");
        if (std.ascii.eqlIgnoreCase(name, "realm")) {
            challenge.realm = value;
        } else if (std.ascii.eqlIgnoreCase(name, "nonce")) {
            challenge.nonce = value;
        } else if (std.ascii.eqlIgnoreCase(name, "opaque")) {
            challenge.opaque_val = value;
        } else if (std.ascii.eqlIgnoreCase(name, "qop")) {
            // qop may be a list ("auth,auth-int") — we only ever do "auth".
            var qit = std.mem.splitScalar(u8, value, ',');
            while (qit.next()) |q| {
                if (std.ascii.eqlIgnoreCase(std.mem.trim(u8, q, " \t\""), "auth")) challenge.qop_auth = true;
            }
        } else if (std.ascii.eqlIgnoreCase(name, "algorithm")) {
            challenge.algorithm_md5 = std.ascii.eqlIgnoreCase(value, "md5");
        }
    }
    if (challenge.nonce.len == 0 or challenge.realm.len == 0) return error.DigestChallengeIncomplete;
    if (!challenge.algorithm_md5) return error.DigestAlgorithmUnsupported;
    return challenge;
}

fn md5Hex(input: []const u8) [32]u8 {
    var digest: [16]u8 = undefined;
    std.crypto.hash.Md5.hash(input, &digest, .{});
    return std.fmt.bytesToHex(digest, .lower);
}

/// response = MD5(HA1:nonce:HA2) or, with qop=auth,
/// MD5(HA1:nonce:nc:cnonce:auth:HA2) per RFC 2617.
fn computeDigestResponse(
    allocator: std.mem.Allocator,
    creds: AuthCreds,
    challenge: DigestChallenge,
    method: []const u8,
    uri: []const u8,
    cnonce: []const u8,
    nc: []const u8,
) ![32]u8 {
    const ha1_input = try std.fmt.allocPrint(allocator, "{s}:{s}:{s}", .{ creds.username, challenge.realm, creds.password });
    defer allocator.free(ha1_input);
    const ha1 = md5Hex(ha1_input);

    const ha2_input = try std.fmt.allocPrint(allocator, "{s}:{s}", .{ method, uri });
    defer allocator.free(ha2_input);
    const ha2 = md5Hex(ha2_input);

    const response_input = if (challenge.qop_auth)
        try std.fmt.allocPrint(allocator, "{s}:{s}:{s}:{s}:auth:{s}", .{ ha1, challenge.nonce, nc, cnonce, ha2 })
    else
        try std.fmt.allocPrint(allocator, "{s}:{s}:{s}", .{ ha1, challenge.nonce, ha2 });
    defer allocator.free(response_input);
    return md5Hex(response_input);
}

/// Build the full "(Proxy-)Authorization: Digest ..." header line (no CRLF).
fn buildAuthorizationHeader(
    allocator: std.mem.Allocator,
    challenge_header: []const u8,
    creds: AuthCreds,
    method: []const u8,
    uri: []const u8,
    proxy: bool,
) ![]u8 {
    const challenge = try parseDigestChallenge(challenge_header);

    var cnonce_bytes: [4]u8 = undefined;
    randomBytes(&cnonce_bytes);
    const cnonce_hex = std.fmt.bytesToHex(cnonce_bytes, .lower);
    const nc = "00000001";

    const response = try computeDigestResponse(allocator, creds, challenge, method, uri, &cnonce_hex, nc);

    var out = try std.ArrayList(u8).initCapacity(allocator, 512);
    errdefer out.deinit(allocator);

    const base = try std.fmt.allocPrint(
        allocator,
        "{s}: Digest username=\"{s}\", realm=\"{s}\", nonce=\"{s}\", uri=\"{s}\", response=\"{s}\", algorithm=MD5",
        .{ if (proxy) "Proxy-Authorization" else "Authorization", creds.username, challenge.realm, challenge.nonce, uri, response },
    );
    defer allocator.free(base);
    try out.appendSlice(allocator, base);

    if (challenge.qop_auth) {
        const qop_part = try std.fmt.allocPrint(allocator, ", qop=auth, nc={s}, cnonce=\"{s}\"", .{ nc, cnonce_hex });
        defer allocator.free(qop_part);
        try out.appendSlice(allocator, qop_part);
    }
    if (challenge.opaque_val) |op| {
        const opaque_part = try std.fmt.allocPrint(allocator, ", opaque=\"{s}\"", .{op});
        defer allocator.free(opaque_part);
        try out.appendSlice(allocator, opaque_part);
    }

    return out.toOwnedSlice(allocator);
}

// ---- Tests ----

test "digest response matches RFC 2617 example (qop=auth)" {
    const allocator = std.testing.allocator;
    const challenge = DigestChallenge{
        .realm = "testrealm@host.com",
        .nonce = "dcd98b7102dd2f0e8b11d0f600bfb0c093",
        .qop_auth = true,
    };
    const response = try computeDigestResponse(
        allocator,
        .{ .username = "Mufasa", .password = "Circle Of Life" },
        challenge,
        "GET",
        "/dir/index.html",
        "0a4f113b",
        "00000001",
    );
    try std.testing.expectEqualStrings("6629fae49393a05397450978507c4ef1", &response);
}

test "parseDigestChallenge extracts realm/nonce/qop" {
    const challenge = try parseDigestChallenge(
        "Digest realm=\"sip.telnyx.com\", nonce=\"abc123\", qop=\"auth\", algorithm=MD5, opaque=\"xyz\"",
    );
    try std.testing.expectEqualStrings("sip.telnyx.com", challenge.realm);
    try std.testing.expectEqualStrings("abc123", challenge.nonce);
    try std.testing.expect(challenge.qop_auth);
    try std.testing.expectEqualStrings("xyz", challenge.opaque_val.?);
}

test "parseSipHostPort variants" {
    const plain = try parseSipHostPort("sip:+15551234567@sip.telnyx.com");
    try std.testing.expectEqualStrings("sip.telnyx.com", plain.host);
    try std.testing.expectEqual(@as(u16, 5060), plain.port);

    const with_port = try parseSipHostPort("sip:op@10.0.0.5:5080;transport=udp");
    try std.testing.expectEqualStrings("10.0.0.5", with_port.host);
    try std.testing.expectEqual(@as(u16, 5080), with_port.port);

    try std.testing.expectError(error.InvalidSipUri, parseSipHostPort("sip:user@"));
}

test "buildAuthorizationHeader shape" {
    const allocator = std.testing.allocator;
    const header = try buildAuthorizationHeader(
        allocator,
        "Digest realm=\"r\", nonce=\"n\", qop=\"auth\"",
        .{ .username = "u", .password = "p" },
        "INVITE",
        "sip:x@y",
        true,
    );
    defer allocator.free(header);
    try std.testing.expect(std.mem.startsWith(u8, header, "Proxy-Authorization: Digest username=\"u\""));
    try std.testing.expect(std.mem.indexOf(u8, header, "qop=auth, nc=00000001") != null);
}
