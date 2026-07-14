// Pure-Zig EBML/WebM writer for Opus audio.
// Produces a valid WebM file playable in browsers from a slice of Opus frames.
const std = @import("std");

// EBML element IDs (pre-encoded with marker bits)
const ID_EBML: u32 = 0x1A45DFA3;
const ID_SEGMENT: u32 = 0x18538067;
const ID_INFO: u32 = 0x1549A966;
const ID_TIMESTAMP_SCALE: u32 = 0x2AD7B1;
const ID_MUXING_APP: u32 = 0x4D80;
const ID_WRITING_APP: u32 = 0x5741;
const ID_DURATION: u32 = 0x4489;
const ID_TRACKS: u32 = 0x1654AE6B;
const ID_TRACK_ENTRY: u32 = 0xAE;
const ID_TRACK_NUMBER: u32 = 0xD7;
const ID_TRACK_UID: u32 = 0x73C5;
const ID_TRACK_TYPE: u32 = 0x83;
const ID_CODEC_ID: u32 = 0x86;
const ID_CODEC_PRIVATE: u32 = 0x63A2;
const ID_AUDIO: u32 = 0xE1;
const ID_SAMPLING_FREQ: u32 = 0xB5;
const ID_CHANNELS: u32 = 0x9F;
const ID_CLUSTER: u32 = 0x1F43B675;
const ID_CLUSTER_TIMESTAMP: u32 = 0xE7;
const ID_SIMPLE_BLOCK: u32 = 0xA3;

// WebM EBML element IDs
const ID_EBML_VERSION: u32 = 0x4286;
const ID_EBML_READ_VERSION: u32 = 0x42F7;
const ID_EBML_MAX_ID_LEN: u32 = 0x42F2;
const ID_EBML_MAX_SIZE_LEN: u32 = 0x42F3;
const ID_DOCTYPE: u32 = 0x4282;
const ID_DOCTYPE_VERSION: u32 = 0x4287;
const ID_DOCTYPE_READ_VERSION: u32 = 0x4285;

const CLUSTER_MAX_MS: u32 = 30_000;

pub const OpusFrame = struct {
    timestamp_ms: u32,
    data: []const u8,
};

/// Writes a complete WebM file and returns the bytes (caller frees).
pub fn writeWebM(allocator: std.mem.Allocator, frames: []const OpusFrame, sample_rate: u32, channels: u8) ![]u8 {
    if (frames.len == 0) return error.NoFrames;

    var out = try std.ArrayList(u8).initCapacity(allocator, 4096);
    defer out.deinit(allocator);

    try buildEbmlHeader(&out, allocator);
    try buildSegment(&out, allocator, frames, sample_rate, channels);

    return out.toOwnedSlice(allocator);
}

fn buildEbmlHeader(out: *std.ArrayList(u8), allocator: std.mem.Allocator) !void {
    var body = try std.ArrayList(u8).initCapacity(allocator, 64);
    defer body.deinit(allocator);

    try writeUintElem(&body, allocator, ID_EBML_VERSION, 1, 1);
    try writeUintElem(&body, allocator, ID_EBML_READ_VERSION, 1, 1);
    try writeUintElem(&body, allocator, ID_EBML_MAX_ID_LEN, 4, 1);
    try writeUintElem(&body, allocator, ID_EBML_MAX_SIZE_LEN, 8, 1);
    try writeStrElem(&body, allocator, ID_DOCTYPE, "webm");
    try writeUintElem(&body, allocator, ID_DOCTYPE_VERSION, 4, 1);
    try writeUintElem(&body, allocator, ID_DOCTYPE_READ_VERSION, 2, 1);

    const bytes = try body.toOwnedSlice(allocator);
    defer allocator.free(bytes);
    try writeElem(out, allocator, ID_EBML, bytes);
}

fn buildSegment(out: *std.ArrayList(u8), allocator: std.mem.Allocator, frames: []const OpusFrame, sample_rate: u32, channels: u8) !void {
    // Segment with unknown size
    try writeId(out, allocator, ID_SEGMENT);
    try out.appendSlice(allocator, &[_]u8{ 0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF });

    try buildInfo(out, allocator, frames);
    try buildTracks(out, allocator, sample_rate, channels);
    try buildClusters(out, allocator, frames);
}

fn buildInfo(out: *std.ArrayList(u8), allocator: std.mem.Allocator, frames: []const OpusFrame) !void {
    var body = try std.ArrayList(u8).initCapacity(allocator, 64);
    defer body.deinit(allocator);

    try writeUintElem(&body, allocator, ID_TIMESTAMP_SCALE, 1_000_000, 4);
    try writeStrElem(&body, allocator, ID_MUXING_APP, "resonus");
    try writeStrElem(&body, allocator, ID_WRITING_APP, "resonus");

    const last_ms = frames[frames.len - 1].timestamp_ms;
    const duration_ms: f64 = @floatFromInt(last_ms + 20);
    try writeF64Elem(&body, allocator, ID_DURATION, duration_ms);

    const bytes = try body.toOwnedSlice(allocator);
    defer allocator.free(bytes);
    try writeElem(out, allocator, ID_INFO, bytes);
}

fn buildTracks(out: *std.ArrayList(u8), allocator: std.mem.Allocator, sample_rate: u32, channels: u8) !void {
    var track = try std.ArrayList(u8).initCapacity(allocator, 128);
    defer track.deinit(allocator);

    try writeUintElem(&track, allocator, ID_TRACK_NUMBER, 1, 1);
    try writeUintElem(&track, allocator, ID_TRACK_UID, 1, 1);
    try writeUintElem(&track, allocator, ID_TRACK_TYPE, 2, 1); // audio
    try writeStrElem(&track, allocator, ID_CODEC_ID, "A_OPUS");

    const opus_head = buildOpusHead(sample_rate, channels);
    try writeElem(&track, allocator, ID_CODEC_PRIVATE, &opus_head);

    var audio = try std.ArrayList(u8).initCapacity(allocator, 16);
    defer audio.deinit(allocator);
    try writeF64Elem(&audio, allocator, ID_SAMPLING_FREQ, @floatFromInt(sample_rate));
    try writeUintElem(&audio, allocator, ID_CHANNELS, channels, 1);
    const audio_bytes = try audio.toOwnedSlice(allocator);
    defer allocator.free(audio_bytes);
    try writeElem(&track, allocator, ID_AUDIO, audio_bytes);

    const track_bytes = try track.toOwnedSlice(allocator);
    defer allocator.free(track_bytes);

    var tracks = try std.ArrayList(u8).initCapacity(allocator, track_bytes.len + 4);
    defer tracks.deinit(allocator);
    try writeElem(&tracks, allocator, ID_TRACK_ENTRY, track_bytes);

    const tracks_bytes = try tracks.toOwnedSlice(allocator);
    defer allocator.free(tracks_bytes);
    try writeElem(out, allocator, ID_TRACKS, tracks_bytes);
}

fn buildClusters(out: *std.ArrayList(u8), allocator: std.mem.Allocator, frames: []const OpusFrame) !void {
    var start: usize = 0;
    while (start < frames.len) {
        const base_ms = frames[start].timestamp_ms;

        var end = start;
        while (end < frames.len and frames[end].timestamp_ms - base_ms < CLUSTER_MAX_MS) {
            end += 1;
        }

        var cluster = try std.ArrayList(u8).initCapacity(allocator, 1024);
        defer cluster.deinit(allocator);

        try writeUintElem(&cluster, allocator, ID_CLUSTER_TIMESTAMP, base_ms, 4);

        for (frames[start..end]) |frame| {
            const rel = @min(frame.timestamp_ms - base_ms, 32767);
            const rel_ms: u16 = @truncate(rel);

            var sb = try std.ArrayList(u8).initCapacity(allocator, 4 + frame.data.len);
            defer sb.deinit(allocator);
            try sb.append(allocator, 0x81); // track VINT = 1
            try sb.append(allocator, @truncate(rel_ms >> 8));
            try sb.append(allocator, @truncate(rel_ms & 0xFF));
            try sb.append(allocator, 0x80); // keyframe flag
            try sb.appendSlice(allocator, frame.data);

            const sb_bytes = try sb.toOwnedSlice(allocator);
            defer allocator.free(sb_bytes);
            try writeElem(&cluster, allocator, ID_SIMPLE_BLOCK, sb_bytes);
        }

        const cluster_bytes = try cluster.toOwnedSlice(allocator);
        defer allocator.free(cluster_bytes);
        try writeElem(out, allocator, ID_CLUSTER, cluster_bytes);

        start = end;
    }
}

fn buildOpusHead(sample_rate: u32, channels: u8) [19]u8 {
    var h: [19]u8 = undefined;
    h[0] = 'O';
    h[1] = 'p';
    h[2] = 'u';
    h[3] = 's';
    h[4] = 'H';
    h[5] = 'e';
    h[6] = 'a';
    h[7] = 'd';
    h[8] = 1; // version
    h[9] = channels; // channel count
    h[10] = 0;
    h[11] = 0; // pre-skip LE u16
    h[12] = @truncate(sample_rate);
    h[13] = @truncate(sample_rate >> 8);
    h[14] = @truncate(sample_rate >> 16);
    h[15] = @truncate(sample_rate >> 24);
    h[16] = 0;
    h[17] = 0; // output gain LE i16
    h[18] = 0; // channel mapping family
    return h;
}

fn writeElem(buf: *std.ArrayList(u8), allocator: std.mem.Allocator, id: u32, body: []const u8) !void {
    try writeId(buf, allocator, id);
    try writeVintSize(buf, allocator, body.len);
    try buf.appendSlice(allocator, body);
}

fn writeUintElem(buf: *std.ArrayList(u8), allocator: std.mem.Allocator, id: u32, value: u64, size: u4) !void {
    var body: [8]u8 = undefined;
    var i: u4 = 0;
    while (i < size) : (i += 1) {
        body[size - 1 - i] = @truncate((value >> (@as(u6, i) * 8)) & 0xFF);
    }
    try writeElem(buf, allocator, id, body[0..size]);
}

fn writeF64Elem(buf: *std.ArrayList(u8), allocator: std.mem.Allocator, id: u32, value: f64) !void {
    const bits: u64 = @bitCast(value);
    var body: [8]u8 = undefined;
    inline for (0..8) |i| {
        body[i] = @truncate(bits >> (56 - @as(u6, i) * 8));
    }
    try writeElem(buf, allocator, id, &body);
}

fn writeStrElem(buf: *std.ArrayList(u8), allocator: std.mem.Allocator, id: u32, s: []const u8) !void {
    try writeElem(buf, allocator, id, s);
}

fn writeId(buf: *std.ArrayList(u8), allocator: std.mem.Allocator, id: u32) !void {
    if (id <= 0xFF) {
        try buf.append(allocator, @truncate(id));
    } else if (id <= 0xFFFF) {
        try buf.append(allocator, @truncate(id >> 8));
        try buf.append(allocator, @truncate(id & 0xFF));
    } else if (id <= 0xFFFFFF) {
        try buf.append(allocator, @truncate(id >> 16));
        try buf.append(allocator, @truncate((id >> 8) & 0xFF));
        try buf.append(allocator, @truncate(id & 0xFF));
    } else {
        try buf.append(allocator, @truncate(id >> 24));
        try buf.append(allocator, @truncate((id >> 16) & 0xFF));
        try buf.append(allocator, @truncate((id >> 8) & 0xFF));
        try buf.append(allocator, @truncate(id & 0xFF));
    }
}

fn writeVintSize(buf: *std.ArrayList(u8), allocator: std.mem.Allocator, size: usize) !void {
    if (size < 0x7F) {
        try buf.append(allocator, @truncate(0x80 | size));
    } else if (size < 0x3FFE) {
        try buf.append(allocator, @truncate(0x40 | (size >> 8)));
        try buf.append(allocator, @truncate(size & 0xFF));
    } else if (size < 0x1FFFFE) {
        try buf.append(allocator, @truncate(0x20 | (size >> 16)));
        try buf.append(allocator, @truncate((size >> 8) & 0xFF));
        try buf.append(allocator, @truncate(size & 0xFF));
    } else if (size < 0x0FFFFFFE) {
        try buf.append(allocator, @truncate(0x10 | (size >> 24)));
        try buf.append(allocator, @truncate((size >> 16) & 0xFF));
        try buf.append(allocator, @truncate((size >> 8) & 0xFF));
        try buf.append(allocator, @truncate(size & 0xFF));
    } else {
        // 8-byte VINT for very large elements
        try buf.append(allocator, 0x01);
        var shift: i7 = 56;
        while (shift >= 0) : (shift -= 8) {
            try buf.append(allocator, @truncate((size >> @intCast(shift)) & 0xFF));
        }
    }
}
