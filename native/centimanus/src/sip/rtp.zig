// RTP packet helpers for Opus audio.
const std = @import("std");

pub const HEADER_SIZE: usize = 12;
pub const OPUS_PT: u8 = 111;      // preferred Opus payload type (matches baresip default)
pub const OPUS_PT_ALT: u8 = 96;   // alternate Opus PT accepted from remote
pub const SAMPLES_PER_FRAME: u32 = 960; // 20ms at 48kHz

pub const Header = struct {
    version: u2 = 2,
    padding: bool = false,
    extension: bool = false,
    cc: u4 = 0,
    marker: bool = false,
    payload_type: u7,
    seq_num: u16,
    timestamp: u32,
    ssrc: u32,
};

/// Parse RTP header from a packet. Returns null if packet is too short or version != 2.
pub fn parseHeader(packet: []const u8) ?Header {
    if (packet.len < HEADER_SIZE) return null;
    const version: u2 = @truncate(packet[0] >> 6);
    if (version != 2) return null;
    return .{
        .version = version,
        .padding = (packet[0] & 0x20) != 0,
        .extension = (packet[0] & 0x10) != 0,
        .cc = @truncate(packet[0] & 0x0F),
        .marker = (packet[1] & 0x80) != 0,
        .payload_type = @truncate(packet[1] & 0x7F),
        .seq_num = std.mem.readInt(u16, @as(*const [2]u8, @ptrCast(&packet[2])), .big),
        .timestamp = std.mem.readInt(u32, @as(*const [4]u8, @ptrCast(&packet[4])), .big),
        .ssrc = std.mem.readInt(u32, @as(*const [4]u8, @ptrCast(&packet[8])), .big),
    };
}

/// Extract Opus payload from an RTP packet. Returns null if invalid or wrong PT.
pub fn extractOpusPayload(packet: []const u8) ?[]const u8 {
    const hdr = parseHeader(packet) orelse return null;
    if (hdr.payload_type != OPUS_PT and hdr.payload_type != OPUS_PT_ALT) return null;

    var offset: usize = HEADER_SIZE + @as(usize, hdr.cc) * 4;
    if (hdr.extension) {
        if (packet.len < offset + 4) return null;
        const ext_len = std.mem.readInt(u16, @as(*const [2]u8, @ptrCast(&packet[offset + 2])), .big);
        offset += 4 + @as(usize, ext_len) * 4;
    }
    if (offset >= packet.len) return null;
    return packet[offset..];
}

/// Strip the RTP header (incl. CSRCs and one extension block) and return the
/// raw payload, regardless of payload type. Used when the PT is known from
/// signaling (e.g. a browser-negotiated dynamic Opus PT) rather than fixed.
pub fn extractPayload(packet: []const u8) ?[]const u8 {
    const hdr = parseHeader(packet) orelse return null;
    var offset: usize = HEADER_SIZE + @as(usize, hdr.cc) * 4;
    if (hdr.extension) {
        if (packet.len < offset + 4) return null;
        const ext_len = std.mem.readInt(u16, @as(*const [2]u8, @ptrCast(&packet[offset + 2])), .big);
        offset += 4 + @as(usize, ext_len) * 4;
    }
    if (offset >= packet.len) return null;
    return packet[offset..];
}

/// Build an RTP packet with Opus payload. Caller owns returned slice.
pub fn buildPacket(
    allocator: std.mem.Allocator,
    opus: []const u8,
    seq: u16,
    timestamp: u32,
    ssrc: u32,
) ![]u8 {
    return buildPacketWithPt(allocator, opus, OPUS_PT, seq, timestamp, ssrc);
}

/// Same, but with an explicit payload type — used for the outbound trunk leg,
/// where the PT is whatever the remote picked from our SDP offer.
pub fn buildPacketWithPt(
    allocator: std.mem.Allocator,
    opus: []const u8,
    pt: u7,
    seq: u16,
    timestamp: u32,
    ssrc: u32,
) ![]u8 {
    const buf = try allocator.alloc(u8, HEADER_SIZE + opus.len);
    buf[0] = 0x80; // V=2, P=0, X=0, CC=0
    buf[1] = @as(u8, pt); // M=0
    std.mem.writeInt(u16, @as(*[2]u8, @ptrCast(&buf[2])), seq, .big);
    std.mem.writeInt(u32, @as(*[4]u8, @ptrCast(&buf[4])), timestamp, .big);
    std.mem.writeInt(u32, @as(*[4]u8, @ptrCast(&buf[8])), ssrc, .big);
    @memcpy(buf[HEADER_SIZE..], opus);
    return buf;
}

/// Build a silence/comfort-noise RTP packet (1 byte payload).
pub fn buildSilencePacket(allocator: std.mem.Allocator, seq: u16, timestamp: u32, ssrc: u32) ![]u8 {
    const silence = [_]u8{0xF8}; // Opus silence frame
    return buildPacket(allocator, &silence, seq, timestamp, ssrc);
}
