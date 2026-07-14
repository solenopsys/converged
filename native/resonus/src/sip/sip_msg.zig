// Minimal SIP message parsing + shared SIP/SDP helpers, used by both the
// inbound UDP server (sip_server.zig) and the outbound UAC leg (sip_client.zig).
const std = @import("std");

pub const MAX_HEADERS = 32;

pub const SipMsg = struct {
    /// Request method ("INVITE", "BYE", ...). Empty for responses.
    method: []const u8 = "",
    uri: []const u8 = "",
    /// Non-zero when the message is a response ("SIP/2.0 200 OK").
    status_code: u16 = 0,
    reason: []const u8 = "",
    header_names: [MAX_HEADERS][]const u8 = undefined,
    header_values: [MAX_HEADERS][]const u8 = undefined,
    header_count: usize = 0,
    body: []const u8 = "",

    pub fn parse(raw: []const u8) !SipMsg {
        var msg = SipMsg{};
        var lines = std.mem.splitSequence(u8, raw, "\r\n");

        const first = lines.next() orelse return error.Empty;
        var parts = std.mem.splitScalar(u8, first, ' ');
        const head = parts.next() orelse return error.InvalidMsg;
        if (std.mem.startsWith(u8, head, "SIP/")) {
            const code = parts.next() orelse return error.InvalidMsg;
            msg.status_code = std.fmt.parseInt(u16, code, 10) catch return error.InvalidMsg;
            msg.reason = parts.rest();
        } else {
            msg.method = head;
            msg.uri = parts.next() orelse "";
        }

        while (lines.next()) |line| {
            if (line.len == 0) {
                // body starts after the blank line; compute offset safely
                const line_start = @intFromPtr(line.ptr) - @intFromPtr(raw.ptr);
                const body_start = @min(line_start + 2, raw.len);
                msg.body = raw[body_start..];
                break;
            }
            const colon = std.mem.indexOfScalar(u8, line, ':') orelse continue;
            if (msg.header_count >= MAX_HEADERS) break;
            msg.header_names[msg.header_count] = std.mem.trim(u8, line[0..colon], " \t");
            msg.header_values[msg.header_count] = std.mem.trim(u8, line[colon + 1 ..], " \t");
            msg.header_count += 1;
        }
        return msg;
    }

    pub fn isResponse(self: *const SipMsg) bool {
        return self.status_code != 0;
    }

    pub fn getHeader(self: *const SipMsg, name: []const u8) []const u8 {
        var i: usize = 0;
        while (i < self.header_count) : (i += 1) {
            if (std.ascii.eqlIgnoreCase(self.header_names[i], name)) return self.header_values[i];
        }
        return "";
    }

    pub fn sdpConnectionIp(self: *const SipMsg) []const u8 {
        var lines = std.mem.splitSequence(u8, self.body, "\r\n");
        while (lines.next()) |line| {
            if (std.mem.startsWith(u8, line, "c=IN IP4 ")) {
                return std.mem.trim(u8, line["c=IN IP4 ".len..], " \t\r\n");
            }
        }
        return "";
    }

    pub fn sdpAudioPort(self: *const SipMsg) u16 {
        var lines = std.mem.splitSequence(u8, self.body, "\r\n");
        while (lines.next()) |line| {
            if (std.mem.startsWith(u8, line, "m=audio ")) {
                var ps = std.mem.splitScalar(u8, line["m=audio ".len..], ' ');
                return std.fmt.parseInt(u16, ps.next() orelse return 0, 10) catch 0;
            }
        }
        return 0;
    }

    /// Payload type of the Opus codec in the answered SDP, or null when the
    /// remote did not accept Opus at all (the gate never transcodes).
    pub fn sdpOpusPayloadType(self: *const SipMsg) ?u7 {
        var lines = std.mem.splitSequence(u8, self.body, "\r\n");
        while (lines.next()) |line| {
            if (!std.mem.startsWith(u8, line, "a=rtpmap:")) continue;
            const rest = line["a=rtpmap:".len..];
            const space = std.mem.indexOfScalar(u8, rest, ' ') orelse continue;
            const codec = rest[space + 1 ..];
            if (!std.ascii.startsWithIgnoreCase(codec, "opus/")) continue;
            const pt = std.fmt.parseInt(u7, rest[0..space], 10) catch continue;
            return pt;
        }
        return null;
    }
};

/// Extract the user part of a SIP URI found in a From/To header (the phone).
pub fn extractPhone(from: []const u8) []const u8 {
    const start = std.mem.indexOf(u8, from, "sip:") orelse return from;
    const user = start + 4;
    const at = std.mem.indexOfScalarPos(u8, from, user, '@') orelse return from[user..];
    return from[user..at];
}

/// Opus-only SDP used for both the inbound 200 OK and the outbound INVITE.
pub fn buildSdp(allocator: std.mem.Allocator, public_ip: []const u8, rtp_port: u16) ![]u8 {
    const ts = @as(u64, @intCast(@max(nowSec(), 0)));
    return std.fmt.allocPrint(
        allocator,
        "v=0\r\n" ++
            "o=- {d} {d} IN IP4 {s}\r\n" ++
            "s=-\r\n" ++
            "c=IN IP4 {s}\r\n" ++
            "t=0 0\r\n" ++
            "m=audio {d} RTP/AVP 111 96\r\n" ++
            "a=rtpmap:111 opus/48000/2\r\n" ++
            "a=rtpmap:96 opus/48000/2\r\n" ++
            "a=fmtp:111 minptime=10;useinbandfec=1\r\n" ++
            "a=fmtp:96 minptime=10;useinbandfec=1\r\n" ++
            "a=sendrecv\r\n" ++
            "a=ptime:20\r\n",
        .{ ts, ts, public_ip, public_ip, rtp_port },
    );
}

// Time helpers using POSIX clock_gettime (std.time.timestamp/nanoTimestamp removed in Zig 0.16)
pub fn nowNs() i64 {
    var ts: std.c.timespec = undefined;
    _ = std.c.clock_gettime(.REALTIME, &ts);
    return ts.sec * std.time.ns_per_s + ts.nsec;
}

pub fn nowSec() i64 {
    var ts: std.c.timespec = undefined;
    _ = std.c.clock_gettime(.REALTIME, &ts);
    return ts.sec;
}

pub fn sleepMs(ms: u64) void {
    const io = std.Options.debug_io;
    std.Io.sleep(io, std.Io.Duration.fromMilliseconds(@intCast(ms)), .awake) catch {};
}

test "SipMsg parses a response status line" {
    const raw = "SIP/2.0 407 Proxy Authentication Required\r\n" ++
        "Via: SIP/2.0/UDP 1.2.3.4:5060;branch=z9hG4bKabc\r\n" ++
        "Proxy-Authenticate: Digest realm=\"sip.telnyx.com\", nonce=\"xyz\"\r\n" ++
        "Content-Length: 0\r\n\r\n";
    const msg = try SipMsg.parse(raw);
    try std.testing.expect(msg.isResponse());
    try std.testing.expectEqual(@as(u16, 407), msg.status_code);
    try std.testing.expectEqualStrings("Proxy Authentication Required", msg.reason);
    try std.testing.expect(std.mem.indexOf(u8, msg.getHeader("proxy-authenticate"), "nonce=\"xyz\"") != null);
}

test "SipMsg finds opus payload type in answered SDP" {
    const raw = "SIP/2.0 200 OK\r\n" ++
        "Content-Type: application/sdp\r\n\r\n" ++
        "v=0\r\nc=IN IP4 10.0.0.7\r\nm=audio 23456 RTP/AVP 96\r\na=rtpmap:96 OPUS/48000/2\r\n";
    const msg = try SipMsg.parse(raw);
    try std.testing.expectEqual(@as(u16, 200), msg.status_code);
    try std.testing.expectEqualStrings("10.0.0.7", msg.sdpConnectionIp());
    try std.testing.expectEqual(@as(u16, 23456), msg.sdpAudioPort());
    try std.testing.expectEqual(@as(u7, 96), msg.sdpOpusPayloadType().?);
}

test "SipMsg returns null opus PT when remote answered G711 only" {
    const raw = "SIP/2.0 200 OK\r\n\r\n" ++
        "v=0\r\nc=IN IP4 10.0.0.7\r\nm=audio 23456 RTP/AVP 0\r\na=rtpmap:0 PCMU/8000\r\n";
    const msg = try SipMsg.parse(raw);
    try std.testing.expect(msg.sdpOpusPayloadType() == null);
}
