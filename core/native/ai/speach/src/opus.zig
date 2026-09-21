const std = @import("std");

extern fn opus_decoder_create_state(sample_rate: i32, channels: i32) ?*anyopaque;
extern fn opus_decoder_destroy_state(state: ?*anyopaque) void;
extern fn opus_decode_frame(state: ?*anyopaque, packet: [*]const u8, packet_len: i32, pcm_out: [*]i16, frame_size: i32) c_int;
extern fn opus_decode_loss(state: ?*anyopaque, pcm_out: [*]i16, frame_size: i32) c_int;
extern fn opus_last_error_message(code: c_int) [*:0]const u8;

/// Largest Opus frame: 120 ms at 48 kHz mono.
pub const max_frame_samples: usize = 5760;
/// Nominal RTP frame: 20 ms at 48 kHz mono.
pub const rtp_frame_samples: usize = 960;

// Thin wrapper over the vendored libopus decoder
// (wrappers/protocols/opus, xiph/opus v1.5.2). Mono 48 kHz only — that is
// what the browser/SIP legs negotiate, and what the ASR frontend consumes.
pub const Decoder = struct {
    state: ?*anyopaque,

    pub fn init(sample_rate: u32, channels: u8) !Decoder {
        const state = opus_decoder_create_state(@intCast(sample_rate), channels);
        if (state == null) return error.OpusInitFailed;
        return .{ .state = state };
    }

    pub fn deinit(self: *Decoder) void {
        opus_decoder_destroy_state(self.state);
        self.state = null;
    }

    pub fn lastError(code: c_int) []const u8 {
        return std.mem.span(opus_last_error_message(code));
    }

    /// Decode one packet into `out`, returns samples per channel.
    /// Empty packets must go through `conceal` (PLC), not here.
    pub fn decode(self: *Decoder, packet: []const u8, out: []i16) !usize {
        if (packet.len == 0) return error.OpusEmptyPacket;
        if (out.len < max_frame_samples) return error.OpusBufferTooSmall;
        const n = opus_decode_frame(self.state, packet.ptr, @intCast(packet.len), out.ptr, @intCast(out.len));
        if (n < 0) return error.OpusDecodeFailed;
        return @intCast(n);
    }

    /// Packet-loss concealment: synthesize one frame without input audio.
    pub fn conceal(self: *Decoder, out: []i16, frame_samples: usize) !usize {
        if (frame_samples == 0 or frame_samples > max_frame_samples) return error.OpusBadFrameSize;
        if (out.len < frame_samples) return error.OpusBufferTooSmall;
        const n = opus_decode_loss(self.state, out.ptr, @intCast(frame_samples));
        if (n < 0) return error.OpusDecodeFailed;
        return @intCast(n);
    }
};
