const std = @import("std");
const store_mod = @import("../store/store.zig");
const webm_mod = @import("../webm/webm.zig");
const clock = @import("../util/clock.zig");

const MAX_QUEUED_FRAMES = 4096;
const WORKER_IDLE_SLEEP_MS = 2;
const FLUSH_INTERVAL_NS: i64 = std.time.ns_per_s;

const Mutex = struct {
    raw: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,

    fn lock(self: *Mutex) void {
        _ = std.c.pthread_mutex_lock(&self.raw);
    }

    fn unlock(self: *Mutex) void {
        _ = std.c.pthread_mutex_unlock(&self.raw);
    }
};

const QueuedFrame = struct {
    session_id: []u8,
    source: store_mod.Source,
    timestamp_ns: i64,
    data: []u8,

    fn deinit(self: *QueuedFrame, allocator: std.mem.Allocator) void {
        allocator.free(self.session_id);
        allocator.free(self.data);
    }
};

const RecorderState = struct {
    allocator: std.mem.Allocator,
    store: *store_mod.Store,
    queue: std.ArrayList(QueuedFrame),
    mutex: Mutex,
    closed: std.atomic.Value(bool),
    in_flight: std.atomic.Value(u32),
    last_flush_ns: std.atomic.Value(i64),
    worker: ?std.Thread,

    fn init(allocator: std.mem.Allocator, store: *store_mod.Store) !*RecorderState {
        const state = try allocator.create(RecorderState);
        state.* = .{
            .allocator = allocator,
            .store = store,
            .queue = std.ArrayList(QueuedFrame).empty,
            .mutex = .{},
            .closed = std.atomic.Value(bool).init(false),
            .in_flight = std.atomic.Value(u32).init(0),
            .last_flush_ns = std.atomic.Value(i64).init(clock.nanoTimestamp()),
            .worker = null,
        };
        errdefer allocator.destroy(state);

        state.worker = try std.Thread.spawn(.{}, workerMain, .{state});
        return state;
    }

    fn deinit(self: *RecorderState) void {
        self.closed.store(true, .release);
        if (self.worker) |worker| worker.join();

        self.mutex.lock();
        defer self.mutex.unlock();
        for (self.queue.items) |*frame| frame.deinit(self.allocator);
        self.queue.deinit(self.allocator);
        self.allocator.destroy(self);
    }

    fn enqueue(self: *RecorderState, session_id: []const u8, source: store_mod.Source, timestamp_ns: i64, data: []const u8) !void {
        const session_copy = try self.allocator.dupe(u8, session_id);
        errdefer self.allocator.free(session_copy);
        const data_copy = try self.allocator.dupe(u8, data);
        errdefer self.allocator.free(data_copy);

        self.mutex.lock();
        defer self.mutex.unlock();

        if (self.closed.load(.acquire)) return error.RecorderClosed;
        if (self.queue.items.len >= MAX_QUEUED_FRAMES) return error.RecorderQueueFull;
        try self.queue.append(self.allocator, .{
            .session_id = session_copy,
            .source = source,
            .timestamp_ns = timestamp_ns,
            .data = data_copy,
        });
    }

    fn takeBatch(self: *RecorderState) std.ArrayList(QueuedFrame) {
        self.mutex.lock();
        defer self.mutex.unlock();
        const batch = self.queue;
        self.queue = std.ArrayList(QueuedFrame).empty;
        if (batch.items.len > 0) {
            _ = self.in_flight.fetchAdd(@intCast(batch.items.len), .acq_rel);
        }
        return batch;
    }

    fn processBatch(self: *RecorderState, batch: *std.ArrayList(QueuedFrame)) void {
        for (batch.items) |*frame| {
            defer _ = self.in_flight.fetchSub(1, .acq_rel);
            defer frame.deinit(self.allocator);
            self.store.putAudioFrame(frame.session_id, frame.source, frame.timestamp_ns, frame.data) catch |err| {
                std.log.err("recorder: putAudioFrame failed (session={s} source={s} len={d}): {s}", .{
                    frame.session_id, frame.source.str(), frame.data.len, @errorName(err),
                });
            };
        }
    }

    fn flushPending(self: *RecorderState) void {
        while (true) {
            var batch = self.takeBatch();
            defer batch.deinit(self.allocator);
            self.processBatch(&batch);

            if (batch.items.len == 0 and self.in_flight.load(.acquire) == 0) return;
            clock.sleepMs(1);
        }
    }

    fn flushActiveSessionsEverySecond(self: *RecorderState) void {
        const now = clock.nanoTimestamp();
        const last = self.last_flush_ns.load(.acquire);
        if (now - last < FLUSH_INTERVAL_NS) return;
        if (self.last_flush_ns.cmpxchgStrong(last, now, .acq_rel, .acquire) != null) return;
        self.store.flushActiveAudioFragments();
    }
};

pub const Recorder = struct {
    state: *RecorderState,

    pub fn init(allocator: std.mem.Allocator, store: *store_mod.Store) !Recorder {
        return .{ .state = try RecorderState.init(allocator, store) };
    }

    pub fn deinit(self: *Recorder) void {
        self.state.flushPending();
        self.state.deinit();
        self.* = undefined;
    }

    pub fn flushPending(self: *Recorder) void {
        self.state.flushPending();
    }

    /// Queue a raw Opus frame. Never performs network I/O on the audio callback.
    pub fn recordFrame(
        self: *Recorder,
        session_id: []const u8,
        source: store_mod.Source,
        timestamp_ns: i64,
        data: []const u8,
    ) void {
        self.state.enqueue(session_id, source, timestamp_ns, data) catch |err| {
            if (err == error.RecorderQueueFull or err == error.RecorderClosed) return;
            std.log.warn("recorder: queue frame failed (session={s} source={s} len={d}): {s}", .{
                session_id, source.str(), data.len, @errorName(err),
            });
        };
    }

    /// Build a WebM file from stored frames. Caller owns the returned slice.
    pub fn buildWebM(
        self: *Recorder,
        allocator: std.mem.Allocator,
        session_id: []const u8,
        source: store_mod.Source,
    ) ![]u8 {
        const raw_frames = try self.state.store.getAudioFrames(allocator, session_id, source);
        defer {
            for (raw_frames) |*f| {
                var mf = f.*;
                mf.deinit(allocator);
            }
            allocator.free(raw_frames);
        }

        if (raw_frames.len == 0) return error.NoFrames;

        const base_ns = raw_frames[0].timestamp_ns;

        var opus_frames = try allocator.alloc(webm_mod.OpusFrame, raw_frames.len);
        defer allocator.free(opus_frames);

        for (raw_frames, 0..) |frame, i| {
            const elapsed_ns = frame.timestamp_ns - base_ns;
            const elapsed_ms: u32 = @truncate(@as(u64, @intCast(@max(elapsed_ns, 0))) / 1_000_000);
            opus_frames[i] = .{ .timestamp_ms = elapsed_ms, .data = frame.data };
        }

        return webm_mod.writeWebM(allocator, opus_frames, 48000, 1);
    }
};

fn workerMain(state: *RecorderState) void {
    while (true) {
        var batch = state.takeBatch();
        defer batch.deinit(state.allocator);

        if (batch.items.len == 0) {
            if (state.closed.load(.acquire)) return;
            clock.sleepMs(WORKER_IDLE_SLEEP_MS);
            continue;
        }

        state.processBatch(&batch);
        state.flushActiveSessionsEverySecond();
    }
}
