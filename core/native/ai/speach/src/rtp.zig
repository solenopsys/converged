const std = @import("std");

// Minimal RTP parsing for the Opus audio legs, copied from the resonus gate
// (apps/resonus/src/sip/rtp.zig): 12-byte header + CSRC count + one
// extension block, payload type checked against the SDP-negotiated value.
// RTCP arrives on the same callback in the bridge and is dropped by the
// version/PT check, same as there.
pub const header_size: usize = 12;

pub const Header = struct {
    payload_type: u7,
    seq: u16,
    timestamp: u32,
    ssrc: u32,
    marker: bool,
};

pub fn parseHeader(packet: []const u8) ?Header {
    if (packet.len < header_size) return null;
    if (packet[0] >> 6 != 2) return null;
    return .{
        .payload_type = @truncate(packet[1] & 0x7F),
        .seq = std.mem.readInt(u16, packet[2..4][0..2], .big),
        .timestamp = std.mem.readInt(u32, packet[4..8][0..4], .big),
        .ssrc = std.mem.readInt(u32, packet[8..12][0..4], .big),
        .marker = (packet[1] & 0x80) != 0,
    };
}

fn payloadOffset(packet: []const u8) ?usize {
    const cc: usize = packet[0] & 0x0F;
    var offset: usize = header_size + cc * 4;
    if (offset > packet.len) return null;
    if ((packet[0] & 0x10) != 0) {
        if (offset + 4 > packet.len) return null;
        const ext_len: usize = std.mem.readInt(u16, packet[offset + 2 .. offset + 4][0..2], .big);
        offset += 4 + ext_len * 4;
        if (offset > packet.len) return null;
    }
    return offset;
}

/// Raw payload regardless of payload type. The caller filters by the
/// session's negotiated Opus PT (from SDP rtpmap), like dictation_bridge.
pub fn extractPayload(packet: []const u8) ?[]const u8 {
    if (parseHeader(packet) == null) return null;
    const offset = payloadOffset(packet) orelse return null;
    if (offset >= packet.len) return null;
    return packet[offset..];
}

/// Jitter/gap accounting: DTX (1-3 byte comfort-noise frames are valid media
/// but carry no speech) and sequence gaps, same counters as
/// BrowserOpusStats in dictation_bridge.zig.
pub const LegStats = struct {
    frames: u64 = 0,
    bytes: u64 = 0,
    dtx: u64 = 0,
    gaps: u64 = 0,
    last_seq: u16 = 0,
    have_seq: bool = false,

    pub fn add(self: *LegStats, seq: u16, payload_len: usize) void {
        self.frames += 1;
        self.bytes += payload_len;
        if (payload_len <= 3) self.dtx += 1;
        if (self.have_seq) {
            const expected: u16 = self.last_seq +% 1;
            if (seq != expected) self.gaps += 1;
        } else {
            self.have_seq = true;
        }
        self.last_seq = seq;
    }

    /// True when the stream so far is dominated by comfort noise.
    pub fn mostlyDtx(self: *const LegStats) bool {
        return self.frames >= 50 and self.dtx * 4 >= self.frames * 3;
    }
};
