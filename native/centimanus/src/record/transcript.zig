const std = @import("std");
const store_mod = @import("../store/store.zig");
const clock = @import("../util/clock.zig");

const Mutex = struct {
    raw: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,

    fn lock(self: *Mutex) void {
        _ = std.c.pthread_mutex_lock(&self.raw);
    }

    fn unlock(self: *Mutex) void {
        _ = std.c.pthread_mutex_unlock(&self.raw);
    }
};

const BufferState = struct {
    session_id: []u8,
    source: store_mod.Source,
    text: std.ArrayList(u8),

    fn deinit(self: *BufferState, allocator: std.mem.Allocator) void {
        allocator.free(self.session_id);
        self.text.deinit(allocator);
        self.* = undefined;
    }
};

pub const Transcript = struct {
    allocator: std.mem.Allocator,
    store: *store_mod.Store,
    buffers: std.StringHashMap(BufferState),
    mutex: Mutex,

    pub fn init(allocator: std.mem.Allocator, store: *store_mod.Store) Transcript {
        return .{
            .allocator = allocator,
            .store = store,
            .buffers = std.StringHashMap(BufferState).init(allocator),
            .mutex = .{},
        };
    }

    pub fn deinit(self: *Transcript) void {
        self.mutex.lock();
        defer self.mutex.unlock();

        var it = self.buffers.iterator();
        while (it.next()) |entry| {
            self.allocator.free(entry.key_ptr.*);
            entry.value_ptr.deinit(self.allocator);
        }
        self.buffers.deinit();
        self.* = undefined;
    }

    /// Parse an OpenAI data channel JSON event and store any transcript phrase.
    /// Returns true if a phrase was stored.
    pub fn processEvent(
        self: *Transcript,
        session_id: []const u8,
        allocator: std.mem.Allocator,
        json_bytes: []const u8,
    ) bool {
        return self.processEventImpl(session_id, allocator, json_bytes, null);
    }

    /// Same as processEvent, but every input_audio_transcription event is
    /// attributed to `forced_source`. Used by the human-transfer bridge, which
    /// runs one transcription-only session per RTP leg: there both channels
    /// arrive as "input audio", so the event type alone cannot tell the caller
    /// (.user) from the operator (.assistant) — the leg does.
    pub fn processEventForSource(
        self: *Transcript,
        session_id: []const u8,
        forced_source: store_mod.Source,
        allocator: std.mem.Allocator,
        json_bytes: []const u8,
    ) bool {
        return self.processEventImpl(session_id, allocator, json_bytes, forced_source);
    }

    fn processEventImpl(
        self: *Transcript,
        session_id: []const u8,
        allocator: std.mem.Allocator,
        json_bytes: []const u8,
        forced_source: ?store_mod.Source,
    ) bool {
        var parsed = std.json.parseFromSlice(std.json.Value, allocator, json_bytes, .{}) catch |err| {
            std.log.warn("transcript: [{s}] event JSON parse failed: {s} ({d} bytes: {s})", .{
                session_id, @errorName(err), json_bytes.len, json_bytes[0..@min(200, json_bytes.len)],
            });
            return false;
        };
        defer parsed.deinit();

        if (parsed.value != .object) {
            std.log.warn("transcript: [{s}] event is not a JSON object", .{session_id});
            return false;
        }
        const obj = &parsed.value.object;

        const msg_type = blk: {
            const v = obj.get("type") orelse {
                std.log.warn("transcript: [{s}] event without \"type\" field", .{session_id});
                return false;
            };
            if (v != .string) return false;
            break :blk v.string;
        };

        // Trace every non-delta event so it's visible which events actually
        // arrive on the data channel (deltas are too chatty to log).
        if (std.mem.indexOf(u8, msg_type, ".delta") == null) {
            std.log.info("transcript: [{s}] event: {s}", .{ session_id, msg_type });
        }

        var source: store_mod.Source = undefined;
        var text_field: []const u8 = undefined;
        var is_delta = false;

        if (std.mem.eql(u8, msg_type, "conversation.item.input_audio_transcription.delta")) {
            source = forced_source orelse .user;
            text_field = "delta";
            is_delta = true;
        } else if (std.mem.eql(u8, msg_type, "conversation.item.input_audio_transcription.completed")) {
            source = forced_source orelse .user;
            text_field = "transcript";
        } else if (std.mem.eql(u8, msg_type, "response.audio_transcript.delta") or
            std.mem.eql(u8, msg_type, "response.output_audio_transcript.delta"))
        {
            source = .assistant;
            text_field = "delta";
            is_delta = true;
        } else if (std.mem.eql(u8, msg_type, "response.audio_transcript.done") or
            std.mem.eql(u8, msg_type, "response.output_audio_transcript.done"))
        {
            source = .assistant;
            text_field = "transcript";
        } else {
            if (std.mem.eql(u8, msg_type, "conversation.item.input_audio_transcription.failed") or
                std.mem.eql(u8, msg_type, "error"))
            {
                std.log.warn("transcript: [{s}] {s}: {s}", .{
                    session_id, msg_type, json_bytes[0..@min(400, json_bytes.len)],
                });
            }
            return false;
        }

        const text_val = obj.get(text_field) orelse {
            std.log.warn("transcript: [{s}] {s} without \"{s}\" field", .{ session_id, msg_type, text_field });
            return false;
        };
        if (text_val != .string) return false;
        const text = text_val.string;
        if (text.len == 0) {
            std.log.warn("transcript: [{s}] {s} with empty text, skipping", .{ session_id, msg_type });
            return false;
        }

        if (is_delta) {
            self.appendDelta(session_id, source, text) catch |err| {
                std.log.err("transcript: buffer delta failed (session={s} source={s}): {s}", .{
                    session_id, source.str(), @errorName(err),
                });
                return false;
            };
            return false;
        }

        self.discardSource(session_id, source);
        const ts = clock.timestamp();
        std.log.info("transcript: [{s}] {s}: {s}", .{ session_id, source.str(), text[0..@min(120, text.len)] });
        self.store.putTranscriptPhrase(session_id, source, ts, text) catch |err| {
            std.log.err("transcript: putPhrase failed (session={s}): {s}", .{ session_id, @errorName(err) });
            return false;
        };
        return true;
    }

    pub fn flushSession(self: *Transcript, session_id: []const u8) bool {
        const assistant = self.flushSource(session_id, .assistant);
        const user = self.flushSource(session_id, .user);
        return assistant or user;
    }

    fn appendDelta(self: *Transcript, session_id: []const u8, source: store_mod.Source, delta: []const u8) !void {
        if (delta.len == 0) return;

        const key = try self.bufferKey(session_id, source);
        errdefer self.allocator.free(key);

        self.mutex.lock();
        defer self.mutex.unlock();

        if (self.buffers.getPtr(key)) |state| {
            self.allocator.free(key);
            try state.text.appendSlice(self.allocator, delta);
            return;
        }

        const session_owned = try self.allocator.dupe(u8, session_id);
        errdefer self.allocator.free(session_owned);
        var text = std.ArrayList(u8).empty;
        errdefer text.deinit(self.allocator);
        try text.appendSlice(self.allocator, delta);

        try self.buffers.put(key, .{
            .session_id = session_owned,
            .source = source,
            .text = text,
        });
    }

    fn flushSource(self: *Transcript, session_id: []const u8, source: store_mod.Source) bool {
        var removed = self.takeBuffer(session_id, source) catch |err| {
            std.log.err("transcript: take buffer failed (session={s} source={s}): {s}", .{
                session_id, source.str(), @errorName(err),
            });
            return false;
        } orelse return false;
        defer self.allocator.free(removed.key);
        defer removed.value.deinit(self.allocator);

        const text = std.mem.trim(u8, removed.value.text.items, " \t\r\n");
        if (text.len == 0) return false;

        const ts = clock.timestamp();
        std.log.info("transcript: [{s}] flushing buffered {s}: {s}", .{
            session_id, source.str(), text[0..@min(120, text.len)],
        });
        self.store.putTranscriptPhrase(session_id, source, ts, text) catch |err| {
            std.log.err("transcript: buffered putPhrase failed (session={s} source={s}): {s}", .{
                session_id, source.str(), @errorName(err),
            });
            return false;
        };
        return true;
    }

    fn discardSource(self: *Transcript, session_id: []const u8, source: store_mod.Source) void {
        var removed = self.takeBuffer(session_id, source) catch return orelse return;
        self.allocator.free(removed.key);
        removed.value.deinit(self.allocator);
    }

    const RemovedBuffer = struct {
        key: []const u8,
        value: BufferState,
    };

    fn takeBuffer(self: *Transcript, session_id: []const u8, source: store_mod.Source) !?RemovedBuffer {
        const key = try self.bufferKey(session_id, source);
        defer self.allocator.free(key);

        self.mutex.lock();
        defer self.mutex.unlock();

        if (self.buffers.fetchRemove(key)) |removed| {
            return .{ .key = removed.key, .value = removed.value };
        }
        return null;
    }

    fn bufferKey(self: *Transcript, session_id: []const u8, source: store_mod.Source) ![]u8 {
        return try std.fmt.allocPrint(self.allocator, "{s}:{s}", .{ session_id, source.str() });
    }
};
