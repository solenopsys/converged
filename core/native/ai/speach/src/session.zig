const std = @import("std");
const opus_mod = @import("opus.zig");
const rtp_mod = @import("rtp.zig");
const vad_mod = @import("vad.zig");

// One live transcription leg: Opus RTP payloads in, 48 kHz PCM out,
// VAD-cut segments out. Mirrors the resonus DictationSession data flow
// (browser mic -> gate -> transcription) with the vendor replaced by the
// local omniASR graph: same frame accounting (DTX/gaps), same grace rules
// (STOP_GRACE_NS), same committed+pending transcript buffer, same stop
// semantics (stop waits for the VAD segment or its deadline).
//
// Threading: the session is driven by one producer thread (RTP leg) calling
// `pushRtp`, and one consumer draining `takeSegment`. All shared state is
// behind the mutex; the ONNX call itself happens on the consumer.
pub const max_segment_seconds = 40;
pub const max_segment_samples_48k = max_segment_seconds * 48000;
pub const stop_grace_ns: i64 = 3 * std.time.ns_per_s;

const Mutex = struct {
    raw: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,

    pub fn lock(self: *Mutex) void {
        _ = std.c.pthread_mutex_lock(&self.raw);
    }

    pub fn unlock(self: *Mutex) void {
        _ = std.c.pthread_mutex_unlock(&self.raw);
    }
};

pub const Segment = struct {
    /// 48 kHz mono PCM, caller-owned.
    pcm: []i16,
    /// RTP timestamp of the first frame, for token timestamps.
    rtp_start: u32,
    speech_frames: u32,
    /// Session-relative sample offsets at 48 kHz; startMs/endMs for events.
    start_sample: u64,
    end_sample: u64,
};

pub const Session = struct {
    allocator: std.mem.Allocator,
    decoder: opus_mod.Decoder,
    vad: vad_mod.Detector,
    opus_pt: u8,
    stats: rtp_mod.LegStats,
    mutex: Mutex = .{},

    pcm: std.ArrayList(i16),
    prefix: std.ArrayList(i16),
    segment_start_rtp: u32 = 0,
    speech_frames: u32 = 0,
    last_rtp: u32 = 0,
    have_rtp: bool = false,
    produced_samples: u64 = 0,
    ready: std.ArrayList(Segment),

    stop_requested: bool = false,
    stop_deadline_ns: i64 = 0,
    segment_done: bool = false,
    closed: bool = false,

    committed: std.ArrayList(u8),
    pending: std.ArrayList(u8),

    pub fn init(allocator: std.mem.Allocator, opus_pt: u8, vad_cfg: vad_mod.Config) !Session {
        return .{
            .allocator = allocator,
            .decoder = try opus_mod.Decoder.init(48000, 1),
            .vad = vad_mod.Detector.init(vad_cfg),
            .opus_pt = opus_pt,
            .stats = .{},
            .pcm = .empty,
            .prefix = .empty,
            .ready = .empty,
            .committed = .empty,
            .pending = .empty,
        };
    }

    pub fn deinit(self: *Session) void {
        self.decoder.deinit();
        self.pcm.deinit(self.allocator);
        self.prefix.deinit(self.allocator);
        for (self.ready.items) |seg| self.allocator.free(seg.pcm);
        self.ready.deinit(self.allocator);
        self.committed.deinit(self.allocator);
        self.pending.deinit(self.allocator);
    }

    /// Feed one UDP datagram from the RTP leg. RTCP / wrong-PT / short
    /// packets are dropped, same as dictation_bridge.onBrowserAudio.
    pub fn pushRtp(self: *Session, datagram: []const u8) void {
        const header = rtp_mod.parseHeader(datagram) orelse return;
        if (header.payload_type != self.opus_pt) return;
        const payload = rtp_mod.extractPayload(datagram) orelse return;
        self.pushOpus(payload, header.seq, header.timestamp);
    }

    /// Feed a bare Opus packet (no RTP header): the /segments envelope and
    /// the Ogg-fixture CLI path.
    pub fn pushOpus(self: *Session, payload: []const u8, seq: u16, rtp_stamp: u32) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        if (self.closed) return;
        self.stats.add(seq, payload.len);
        if (payload.len == 0) {
            self.concealLocked(1);
            return;
        }
        if (payload.len <= 3) return; // comfort noise: valid media, no speech
        var out: [opus_mod.max_frame_samples]i16 = undefined;
        const n = self.decoder.decode(payload, &out) catch |err| {
            std.log.warn("opus decode failed (len={d}): {s}", .{ payload.len, @errorName(err) });
            return;
        };
        self.appendPcmLocked(out[0..n], rtp_stamp);
    }

    /// Packet loss observed by the caller (sequence gap): synthesize PLC.
    pub fn pushLoss(self: *Session, frames: usize) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        if (self.closed) return;
        self.concealLocked(frames);
    }

    fn concealLocked(self: *Session, frames: usize) void {
        var out: [opus_mod.max_frame_samples]i16 = undefined;
        var left = frames;
        while (left > 0) {
            const want: usize = @min(left, 960);
            const n = self.decoder.conceal(&out, want) catch return;
            self.appendPcmLocked(out[0..n], self.last_rtp);
            left -= 1;
        }
    }

    fn appendPcmLocked(self: *Session, samples: []const i16, rtp_stamp: u32) void {
        var at: usize = 0;
        while (at < samples.len) {
            const end = @min(at + 960, samples.len);
            self.appendFrameLocked(samples[at..end], rtp_stamp);
            at = end;
        }
    }

    fn appendFrameLocked(self: *Session, frame: []const i16, rtp_stamp: u32) void {
        // 20 ms bookkeeping even for odd-sized tail frames.
        self.last_rtp = rtp_stamp;
        self.have_rtp = true;
        const event = self.vad.frame(frame);
        switch (event) {
            .silence => {
                if (self.pcm.items.len > 0) {
                    // Inter-phrase pause inside hangover: keep it, the VAD
                    // still counts silence toward close.
                    self.pcm.appendSlice(self.allocator, frame) catch {};
                } else {
                    // Pre-speech ring: bounded by prefix_frames.
                    self.prefix.appendSlice(self.allocator, frame) catch {};
                    const cap = @as(usize, self.vad.cfg.prefix_frames) * 960;
                    if (self.prefix.items.len > cap) {
                        const drop = self.prefix.items.len - cap;
                        std.mem.copyForwards(i16, self.prefix.items[0..], self.prefix.items[drop..]);
                        self.prefix.shrinkRetainingCapacity(cap);
                    }
                }
            },
            .speech_start => {
                self.segment_start_rtp = self.last_rtp;
                self.speech_frames = 0;
                self.pcm.appendSlice(self.allocator, self.prefix.items) catch {};
                self.prefix.clearRetainingCapacity();
                self.pcm.appendSlice(self.allocator, frame) catch {};
                self.speech_frames += 1;
            },
            .speech_continue => {
                self.pcm.appendSlice(self.allocator, frame) catch {};
                self.speech_frames += 1;
                if (self.pcm.items.len >= max_segment_samples_48k) self.closeSegmentLocked();
            },
            .speech_end => {
                self.pcm.appendSlice(self.allocator, frame) catch {};
                self.closeSegmentLocked();
            },
        }
    }

    fn closeSegmentLocked(self: *Session) void {
        if (self.pcm.items.len == 0) {
            self.segment_done = true;
            return;
        }
        const owned = self.pcm.toOwnedSlice(self.allocator) catch {
            self.segment_done = true;
            return;
        };
        const start = self.produced_samples -| owned.len;
        self.produced_samples += owned.len;
        self.ready.append(self.allocator, .{
            .pcm = owned,
            .rtp_start = self.segment_start_rtp,
            .speech_frames = self.speech_frames,
            .start_sample = start,
            .end_sample = start + owned.len,
        }) catch {
            self.allocator.free(owned);
            self.segment_done = true;
            return;
        };
        self.pcm.clearRetainingCapacity();
        self.prefix.clearRetainingCapacity();
        self.speech_frames = 0;
        self.vad.reset();
        self.segment_done = true;
    }

    /// Drain one VAD-closed segment. Null when none is ready.
    pub fn takeSegment(self: *Session) ?Segment {
        self.mutex.lock();
        defer self.mutex.unlock();
        if (self.ready.items.len == 0) return null;
        return self.ready.orderedRemove(0);
    }

    pub fn bufferedLen(self: *Session) usize {
        self.mutex.lock();
        defer self.mutex.unlock();
        return self.pcm.items.len;
    }

    pub fn speechFrames(self: *Session) u32 {
        self.mutex.lock();
        defer self.mutex.unlock();
        return self.speech_frames;
    }

    pub fn copyTail(self: *Session, allocator: std.mem.Allocator, max_len: usize) ![]i16 {
        self.mutex.lock();
        defer self.mutex.unlock();
        const buffered = self.pcm.items.len;
        if (buffered == 0) return allocator.alloc(i16, 0);
        const tail_len = @min(buffered, max_len);
        return allocator.dupe(i16, self.pcm.items[buffered - tail_len ..]);
    }

    pub fn pendingSegments(self: *Session) usize {
        self.mutex.lock();
        defer self.mutex.unlock();
        return self.ready.items.len;
    }

    pub fn requestStop(self: *Session, now_ns: i64) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        if (self.stop_requested) return;
        self.stop_requested = true;
        self.stop_deadline_ns = now_ns + stop_grace_ns;
    }

    /// Graceful close: flush the open phrase as a final segment so its words
    /// are not lost (TranscriptBuffer kept the active delta at stop for the
    /// same reason in dictation_bridge.zig).
    pub fn finish(self: *Session) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        if (self.closed) return;
        self.closed = true;
        if (self.pcm.items.len > 0) self.closeSegmentLocked();
    }

    pub fn isReadyToClose(self: *Session, now_ns: i64) bool {
        self.mutex.lock();
        defer self.mutex.unlock();
        if (!self.stop_requested) return false;
        return self.segment_done or now_ns >= self.stop_deadline_ns;
    }

    // --- transcript buffer (committed + pending, same as TranscriptBuffer) ---

    pub fn appendDelta(self: *Session, text: []const u8) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        self.pending.appendSlice(self.allocator, text) catch {};
    }

    pub fn completeSegment(self: *Session, text: []const u8) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        if (self.committed.items.len > 0) self.committed.append(self.allocator, ' ') catch return;
        self.committed.appendSlice(self.allocator, text) catch return;
        self.pending.clearRetainingCapacity();
    }

    pub fn snapshot(self: *Session, allocator: std.mem.Allocator) ![]u8 {
        self.mutex.lock();
        defer self.mutex.unlock();
        var out: std.ArrayList(u8) = .empty;
        errdefer out.deinit(allocator);
        try out.appendSlice(allocator, self.committed.items);
        if (self.pending.items.len > 0) {
            if (out.items.len > 0) try out.append(allocator, ' ');
            try out.appendSlice(allocator, self.pending.items);
        }
        return out.toOwnedSlice(allocator);
    }
};
