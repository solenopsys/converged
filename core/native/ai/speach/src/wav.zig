const std = @import("std");

// Minimal WAV reader for the raw file path: PCM 8/16/24/32-bit and
// IEEE float, any channel count, any sample rate. Output is mono f32.
// Resampling to 16 kHz is linear; anything else in the pipeline
// (decoding, VAD, chunking) stays outside, same split as onnx-asr:
// read_wav -> select channel -> resample -> model.
pub const Pcm = struct {
    samples: []f32,
    sample_rate: u32,

    pub fn deinit(self: *Pcm, allocator: std.mem.Allocator) void {
        allocator.free(self.samples);
    }
};

pub fn readFile(allocator: std.mem.Allocator, path: []const u8) !Pcm {
    const bytes = try std.Io.Dir.cwd().readFileAlloc(std.Options.debug_io, path, allocator, .limited(512 * 1024 * 1024));
    defer allocator.free(bytes);
    return parse(allocator, bytes);
}

pub fn parse(allocator: std.mem.Allocator, bytes: []const u8) !Pcm {
    if (bytes.len < 44) return error.WavTooShort;
    if (!std.mem.eql(u8, bytes[0..4], "RIFF")) return error.WavNotRiff;
    if (!std.mem.eql(u8, bytes[8..12], "WAVE")) return error.WavNotWave;
    var offset: usize = 12;
    var format: u16 = 0;
    var channels: u16 = 0;
    var sample_rate: u32 = 0;
    var bits: u16 = 0;
    var data: []const u8 = &.{};
    while (offset + 8 <= bytes.len) {
        const id = bytes[offset .. offset + 4];
        const size: usize = std.mem.readInt(u32, bytes[offset + 4 ..][0..4], .little);
        const chunk = bytes[offset + 8 .. @min(bytes.len, offset + 8 + size)];
        if (std.mem.eql(u8, id, "fmt ")) {
            if (chunk.len < 16) return error.WavBadFmt;
            format = std.mem.readInt(u16, chunk[0..2], .little);
            channels = std.mem.readInt(u16, chunk[2..4], .little);
            sample_rate = std.mem.readInt(u32, chunk[4..8], .little);
            bits = std.mem.readInt(u16, chunk[14..16], .little);
        } else if (std.mem.eql(u8, id, "data")) {
            data = chunk;
        }
        offset += 8 + size + (size & 1);
    }
    if (channels == 0 or sample_rate == 0) return error.WavNoFormat;
    if (data.len == 0) return error.WavNoData;
    const mono = try toMonoF32(allocator, data, format, channels, bits);
    errdefer allocator.free(mono);
    const resampled = try resampleTo16k(allocator, mono, sample_rate);
    if (resampled.ptr != mono.ptr) allocator.free(mono);
    const normalized = normalize(resampled);
    return .{ .samples = normalized, .sample_rate = 16000 };
}

fn toMonoF32(allocator: std.mem.Allocator, data: []const u8, format: u16, channels: usize, bits: u16) ![]f32 {
    const bytes_per_sample: usize = switch (bits) {
        8 => 1,
        16 => 2,
        24 => 3,
        32 => 4,
        else => return error.WavUnsupportedBits,
    };
    if (format != 1 and !(format == 3 and bits == 32)) return error.WavUnsupportedFormat;
    const frame_bytes = bytes_per_sample * channels;
    const frames = data.len / frame_bytes;
    if (frames == 0) return error.WavNoData;
    const out = try allocator.alloc(f32, frames);
    var frame: usize = 0;
    while (frame < frames) : (frame += 1) {
        var sum: f32 = 0;
        var channel: usize = 0;
        while (channel < channels) : (channel += 1) {
            const at = frame * frame_bytes + channel * bytes_per_sample;
            sum += sampleToF32(data[at .. at + bytes_per_sample], format, bits);
        }
        out[frame] = sum / @as(f32, @floatFromInt(channels));
    }
    return out;
}

fn sampleToF32(raw: []const u8, format: u16, bits: u16) f32 {
    if (format == 3) return @bitCast(std.mem.readInt(u32, raw[0..4], .little));
    return switch (bits) {
        8 => (@as(f32, @floatFromInt(raw[0])) - 128) / 128,
        16 => @as(f32, @floatFromInt(std.mem.readInt(i16, raw[0..2], .little))) / 32768,
        24 => blk: {
            const value: i32 = (@as(i32, @intCast(@as(i8, @bitCast(raw[2])))) << 16) | (@as(i32, @intCast(raw[1])) << 8) | raw[0];
            break :blk @as(f32, @floatFromInt(value)) / 8388608;
        },
        32 => @as(f32, @floatFromInt(std.mem.readInt(i32, raw[0..4], .little))) / 2147483648,
        else => 0,
    };
}

// fairseq2/onnx-asr normalize the waveform to zero mean + unit variance
// (layer_norm over the whole clip) before the encoder.
fn normalize(samples: []f32) []f32 {
    var mean: f64 = 0;
    for (samples) |value| mean += value;
    mean /= @as(f64, @floatFromInt(samples.len));
    var variance: f64 = 0;
    for (samples) |value| {
        const delta = @as(f64, value) - mean;
        variance += delta * delta;
    }
    variance /= @as(f64, @floatFromInt(samples.len));
    const std_dev = @sqrt(variance);
    if (std_dev < 1e-9) {
        for (samples) |*value| value.* = @floatCast(@as(f64, value.*) - mean);
        return samples;
    }
    for (samples) |*value| value.* = @floatCast((@as(f64, value.*) - mean) / std_dev);
    return samples;
}

fn resampleTo16k(allocator: std.mem.Allocator, mono: []const f32, sample_rate: u32) ![]f32 {
    if (sample_rate == 16000) return allocator.dupe(f32, mono);
    if (sample_rate == 0) return error.WavNoFormat;
    const ratio: f64 = 16000.0 / @as(f64, @floatFromInt(sample_rate));
    const out_len = @as(usize, @intFromFloat(@as(f64, @floatFromInt(mono.len)) * ratio));
    if (out_len == 0) return error.WavNoData;
    const out = try allocator.alloc(f32, out_len);
    var i: usize = 0;
    while (i < out_len) : (i += 1) {
        const position = @as(f64, @floatFromInt(i)) / ratio;
        const index: usize = @intFromFloat(position);
        const frac: f32 = @floatCast(position - @as(f64, @floatFromInt(index)));
        const first = mono[@min(index, mono.len - 1)];
        const second = mono[@min(index + 1, mono.len - 1)];
        out[i] = first + (second - first) * frac;
    }
    return out;
}
