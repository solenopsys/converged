const std = @import("std");
const model_file = @import("model.zig");
const Model = model_file.Model;
const Vocab = @import("vocab.zig").Vocab;
const vocab_decode = @import("vocab.zig").decode;
const wav = @import("wav.zig");
const opus_mod = @import("opus.zig");
const session_mod = @import("session.zig");
const vad_mod = @import("vad.zig");

const max_request_bytes = 64 * 1024 * 1024;
const max_audio_seconds = 40;
const max_audio_samples = max_audio_seconds * 16000;
const blank_id = @import("vocab.zig").blank_id;
const subsampling_factor = 320;

/// One CTC frame = 320 samples at 16 kHz = 20 ms. Token timestamps in the
/// events below reuse the same frame grid, so
/// `startMs = frame_index * 20`.
pub const frame_ms: u64 = 20;

const App = struct {
    allocator: std.mem.Allocator,
    model: Model,
    vocab: Vocab,
    vad_cfg: vad_mod.Config,
    sessions_mutex: Mutex,
    sessions: std.StringHashMapUnmanaged(*session_mod.Session),
};

const Mutex = struct {
    raw: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,

    fn lock(self: *Mutex) void {
        _ = std.c.pthread_mutex_lock(&self.raw);
    }

    fn unlock(self: *Mutex) void {
        _ = std.c.pthread_mutex_unlock(&self.raw);
    }
};

/// PID 1 in a container gets no default SIGTERM disposition: without a
/// handler `podman stop` sits out the grace period and ends in SIGKILL
/// (same as resonus/src/main.zig). accept() restarts after EINTR, so the
/// handler exits through exit_group — the only call safe in signal context.
fn onSignal(_: std.posix.SIG) callconv(.c) void {
    const notice = "speach: signal received, shutting down\n";
    _ = std.os.linux.write(2, notice, notice.len);
    std.os.linux.exit_group(0);
}

fn installSignalHandlers() void {
    const action = std.posix.Sigaction{
        .handler = .{ .handler = onSignal },
        .mask = std.posix.sigemptyset(),
        .flags = 0,
    };
    std.posix.sigaction(std.posix.SIG.TERM, &action, null);
    std.posix.sigaction(std.posix.SIG.INT, &action, null);
}

pub fn main(init: std.process.Init) !void {
    installSignalHandlers();
    const allocator = init.gpa;
    const io = init.io;
    const argv = try init.minimal.args.toSlice(init.arena.allocator());
    var model = try Model.init(allocator, env("SPEACH_MODEL") orelse "models/model.onnx");
    defer model.deinit();
    var vocab = try Vocab.init(allocator, env("SPEACH_TOKENS") orelse "models/tokens.txt");
    defer vocab.deinit();
    _ = try warmup(allocator, &model, &vocab);
    if (argv.len > 1) return cli(allocator, io, &model, &vocab, argv[1..]);
    var app = App{
        .allocator = allocator,
        .model = model,
        .vocab = vocab,
        .vad_cfg = vad_mod.Config.fromEnv(),
        .sessions_mutex = .{},
        .sessions = .empty,
    };
    defer destroySessions(&app);
    try serve(allocator, &app, env("SPEACH_HOST") orelse "0.0.0.0", port(env("SPEACH_PORT") orelse "8002"));
}

// --- CLI: wav file or Ogg/Opus fixture ---------------------------------------

fn cli(allocator: std.mem.Allocator, io: std.Io, model: *Model, vocab: *Vocab, args: []const [:0]const u8) !void {
    if (args.len == 0) return error.CliUsage;
    const path: []const u8 = args[0];
    const text = if (std.mem.endsWith(u8, path, ".opus") or std.mem.endsWith(u8, path, ".ogg"))
        try transcribeOggFile(allocator, model, vocab, path)
    else
        try transcribeFile(allocator, model, vocab, path);
    defer allocator.free(text);
    var stdout_buf: [4096]u8 = undefined;
    var stdout = std.Io.File.stdout().writer(io, &stdout_buf);
    try stdout.interface.print("{s}\n", .{text});
    try stdout.interface.flush();
}

fn warmup(allocator: std.mem.Allocator, model: *Model, vocab: *Vocab) !bool {
    const silence = try allocator.alloc(f32, 16000);
    defer allocator.free(silence);
    @memset(silence, 0);
    var out = model.run(silence) catch |err| {
        std.log.warn("warmup failed: {s}", .{@errorName(err)});
        return false;
    };
    defer model_file.freeOutput(&out);
    _ = vocab;
    return true;
}

pub fn transcribeFile(allocator: std.mem.Allocator, model: *Model, vocab: *Vocab, path: []const u8) ![]u8 {
    var pcm = try wav.readFile(allocator, path);
    defer pcm.deinit(allocator);
    return transcribeSamples(allocator, model, vocab, pcm.samples);
}

/// Ogg/Opus fixture path (resonus tests/fixtures/dictation-ru.opus):
/// Ogg container is parsed, OpusHead/Tags skipped, payloads decoded to
/// 48 kHz PCM, decimated to 16 kHz, then the same graph + greedy decode.
pub fn transcribeOggFile(allocator: std.mem.Allocator, model: *Model, vocab: *Vocab, path: []const u8) ![]u8 {
    var session = try session_mod.Session.init(allocator, 111, vad_mod.Config.fromEnv());
    defer session.deinit();
    const data = try std.Io.Dir.cwd().readFileAlloc(std.Options.debug_io, path, allocator, .limited(64 * 1024 * 1024));
    defer allocator.free(data);
    try feedOgg(allocator, &session, data);
    session.finish();
    var pcm48 = std.ArrayList(i16).empty;
    defer pcm48.deinit(allocator);
    while (session.takeSegment()) |seg| {
        defer allocator.free(seg.pcm);
        try pcm48.appendSlice(allocator, seg.pcm);
    }
    if (pcm48.items.len == 0) return error.EmptyAudio;
    const wave16 = try decimate48to16(allocator, pcm48.items);
    defer allocator.free(wave16);
    const normed = normalize(wave16);
    return transcribeSamples(allocator, model, vocab, normed);
}

pub fn feedOgg(allocator: std.mem.Allocator, session: *session_mod.Session, data: []const u8) !void {
    _ = allocator;
    var cursor: usize = 0;
    var packet = std.ArrayList(u8).empty;
    defer packet.deinit(session.allocator);
    var packet_index: usize = 0;
    var seq: u16 = 0;
    var rtp_stamp: u32 = 0;
    while (cursor < data.len) {
        if (cursor + 27 > data.len or !std.mem.eql(u8, data[cursor .. cursor + 4], "OggS")) return error.InvalidOggOpus;
        const segments_len: usize = data[cursor + 26];
        const laces_begin = cursor + 27;
        const payload_begin = laces_begin + segments_len;
        if (payload_begin > data.len) return error.InvalidOggOpus;
        var payload_cursor = payload_begin;
        for (data[laces_begin..payload_begin]) |lace| {
            const part_len: usize = lace;
            if (payload_cursor + part_len > data.len) return error.InvalidOggOpus;
            packet.appendSlice(session.allocator, data[payload_cursor .. payload_cursor + part_len]) catch return error.OutOfMemory;
            payload_cursor += part_len;
            if (lace == 255) continue;
            if (packet_index >= 2 and packet.items.len > 0) {
                session.pushOpus(packet.items, seq, rtp_stamp);
                seq +%= 1;
                rtp_stamp +%= 960;
            } else {
                packet.clearRetainingCapacity();
            }
            packet_index += 1;
        }
        cursor = payload_cursor;
    }
}

/// 48 kHz -> 16 kHz by exact decimation (ratio 3:1, no interpolation error).
pub fn decimate48to16(allocator: std.mem.Allocator, pcm48: []const i16) ![]f32 {
    if (pcm48.len == 0) return error.EmptyAudio;
    const out_len = pcm48.len / 3;
    if (out_len == 0) return error.EmptyAudio;
    const out = try allocator.alloc(f32, out_len);
    var i: usize = 0;
    while (i < out_len) : (i += 1) {
        out[i] = @as(f32, @floatFromInt(pcm48[i * 3])) / 32768;
    }
    return out;
}

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

pub fn transcribeSamples(allocator: std.mem.Allocator, model: *Model, vocab: *Vocab, samples: []const f32) ![]u8 {
    if (samples.len == 0) return error.EmptyAudio;
    if (samples.len > max_audio_samples) return error.AudioTooLong;
    var out = try model.run(samples);
    defer model_file.freeOutput(&out);
    if (out.type != .float or out.data == null or out.shape == null) return error.InvalidOnnxOutput;
    const shape = out.shape.?;
    if (out.shape_len != 3) return error.InvalidOnnxOutput;
    const frames: usize = @intCast(shape[1]);
    const vocab_size: usize = @intCast(shape[2]);
    if (frames == 0 or vocab_size == 0) return error.InvalidOnnxOutput;
    if (out.data_bytes < frames * vocab_size * @sizeOf(f32)) return error.InvalidOnnxOutput;
    const logits: [*]const f32 = @ptrCast(@alignCast(out.data.?));
    const max_frames = samples.len / subsampling_factor + 1;
    return vocab_decode(allocator, vocab, logits[0 .. frames * vocab_size], frames, vocab_size, max_frames);
}

/// Same as transcribeSamples but keeps per-frame token ids for timestamps.
pub fn transcribeFrames(allocator: std.mem.Allocator, model: *Model, vocab: *Vocab, samples: []const f32) !FrameResult {
    if (samples.len == 0) return error.EmptyAudio;
    if (samples.len > max_audio_samples) return error.AudioTooLong;
    var out = try model.run(samples);
    defer model_file.freeOutput(&out);
    if (out.type != .float or out.data == null or out.shape == null) return error.InvalidOnnxOutput;
    const shape = out.shape.?;
    if (out.shape_len != 3) return error.InvalidOnnxOutput;
    const frames: usize = @intCast(shape[1]);
    const vocab_size: usize = @intCast(shape[2]);
    if (frames == 0 or vocab_size == 0) return error.InvalidOnnxOutput;
    if (out.data_bytes < frames * vocab_size * @sizeOf(f32)) return error.InvalidOnnxOutput;
    const logits: [*]const f32 = @ptrCast(@alignCast(out.data.?));
    const max_frames = samples.len / subsampling_factor + 1;
    return decodeFrames(allocator, vocab, logits[0 .. frames * vocab_size], frames, vocab_size, max_frames);
}

pub const FrameToken = struct {
    id: usize,
    frame: usize,
};

pub const FrameResult = struct {
    text: []u8,
    tokens: []FrameToken,

    pub fn deinit(self: *FrameResult, allocator: std.mem.Allocator) void {
        allocator.free(self.text);
        allocator.free(self.tokens);
    }
};

fn decodeFrames(allocator: std.mem.Allocator, vocab: *const Vocab, logits: []const f32, frames: usize, vocab_size: usize, max_frames: usize) !FrameResult {
    var out: std.ArrayList(u8) = .empty;
    errdefer out.deinit(allocator);
    var toks: std.ArrayList(FrameToken) = .empty;
    errdefer toks.deinit(allocator);
    var previous: i64 = blank_id;
    const limit = @min(frames, max_frames);
    var frame: usize = 0;
    while (frame < limit) : (frame += 1) {
        const row = logits[frame * vocab_size ..][0..vocab_size];
        var best: usize = 0;
        var best_value = row[0];
        for (row[1..], 1..) |value, index| {
            if (value > best_value) {
                best_value = value;
                best = index;
            }
        }
        const id: i64 = @intCast(best);
        if (id != blank_id and id != previous) {
            if (best >= vocab.size) return error.VocabIdOutOfRange;
            try out.appendSlice(allocator, vocab.lookup(best));
            try toks.append(allocator, .{ .id = best, .frame = frame });
        }
        previous = id;
    }
    const text = try out.toOwnedSlice(allocator);
    errdefer allocator.free(text);
    const tokens = try toks.toOwnedSlice(allocator);
    const trimmed_len = std.mem.trim(u8, text, " \t\r\n").len;
    if (trimmed_len != text.len) {
        // Leading/trailing space tokens shift frame alignment; re-trim text
        // and drop matching edge tokens.
        var start: usize = 0;
        while (start < text.len and (text[start] == ' ' or text[start] == '\t' or text[start] == '\r' or text[start] == '\n')) : (start += 1) {}
        const leading = start;
        const out_text = try allocator.dupe(u8, text[start .. start + trimmed_len]);
        allocator.free(text);
        // Tokens are whole UTF-8 pieces, not bytes: only a leading run of
        // single-space tokens can be dropped safely by byte count.
        var drop: usize = 0;
        var bytes: usize = 0;
        for (tokens) |tok| {
            const piece = vocab.lookup(tok.id);
            if (bytes + piece.len > leading) break;
            if (!std.mem.eql(u8, piece, " ")) break;
            bytes += piece.len;
            drop += 1;
        }
        const kept = try allocator.dupe(FrameToken, tokens[drop..]);
        allocator.free(tokens);
        return .{ .text = out_text, .tokens = kept };
    }
    return .{ .text = text, .tokens = tokens };
}

// --- HTTP: sessions + events in the resonus transcript dialect -------------

fn destroySessions(app: *App) void {
    app.sessions_mutex.lock();
    defer app.sessions_mutex.unlock();
    var it = app.sessions.iterator();
    while (it.next()) |entry| {
        entry.value_ptr.*.deinit();
        app.allocator.destroy(entry.value_ptr.*);
        app.allocator.free(entry.key_ptr.*);
    }
    app.sessions.deinit(app.allocator);
}

fn randomSessionId(allocator: std.mem.Allocator) ![]u8 {
    var bytes: [16]u8 = undefined;
    std.Options.debug_io.random(&bytes);
    const hex = std.fmt.bytesToHex(bytes, .lower);
    return allocator.dupe(u8, &hex);
}

fn serve(allocator: std.mem.Allocator, app: *App, host: []const u8, listen_port: u16) !void {
    const io = std.Options.debug_io;
    var listener = try (try std.Io.net.IpAddress.parse(host, listen_port)).listen(io, .{ .reuse_address = true });
    defer listener.deinit(io);
    std.log.info("SPEACH listening on http://{s}:{d}", .{ host, listen_port });
    while (true) {
        var stream = try listener.accept(io);
        defer stream.close(io);
        handle(allocator, app, stream) catch |err| std.log.warn("request failed: {s}", .{@errorName(err)});
    }
}

fn handle(allocator: std.mem.Allocator, app: *App, stream: std.Io.net.Stream) !void {
    const io = std.Options.debug_io;
    var input: [64 * 1024]u8 = undefined;
    var output: [16 * 1024]u8 = undefined;
    var reader = stream.reader(io, &input);
    var writer = stream.writer(io, &output);
    var server = std.http.Server.init(&reader.interface, &writer.interface);
    var request = try server.receiveHead();
    const path = request.head.target[0 .. std.mem.indexOfScalar(u8, request.head.target, '?') orelse request.head.target.len];
    if (request.head.method == .GET and std.mem.eql(u8, path, "/healthz")) return respond(&request, "{\"ok\":true}", .ok);
    if (request.head.method == .POST and std.mem.eql(u8, path, "/transcribe")) return handleTranscribe(allocator, app, &request);
    if (request.head.method == .POST and std.mem.eql(u8, path, "/sessions")) return handleSessionCreate(allocator, app, &request);
    if (request.head.method == .POST and std.mem.eql(u8, path, "/segments")) return handleSegments(allocator, app, &request);
    if (request.head.method == .POST and std.mem.eql(u8, path, "/sessions/stop")) return handleSessionStop(allocator, app, &request);
    if (request.head.method == .GET and std.mem.startsWith(u8, path, "/sessions/") and std.mem.endsWith(u8, path, "/events")) return handleSessionEvents(allocator, app, &request, path);
    return respond(&request, "{\"error\":\"not found\"}", .not_found);
}

// Legacy single-shot path: POST body is the wav file itself.
fn handleTranscribe(allocator: std.mem.Allocator, app: *App, request: *std.http.Server.Request) !void {
    var body_buffer: [64 * 1024]u8 = undefined;
    const body = request.readerExpectNone(&body_buffer).allocRemaining(allocator, .limited(max_request_bytes)) catch return respond(request, "{\"error\":\"payload rejected\"}", .payload_too_large);
    defer allocator.free(body);
    const text = transcribeBody(allocator, app, body) catch |err| {
        std.log.warn("model failed: {s}: {s}", .{ @errorName(err), model_file.lastError() });
        return respond(request, "{\"error\":\"transcribe failed\"}", .internal_server_error);
    };
    defer allocator.free(text);
    const reply = try jsonText(allocator, text);
    defer allocator.free(reply);
    return respond(request, reply, .ok);
}

fn transcribeBody(allocator: std.mem.Allocator, app: *App, body: []const u8) ![]u8 {
    var pcm = try wav.parse(allocator, body);
    defer pcm.deinit(allocator);
    return transcribeSamples(allocator, &app.model, &app.vocab, pcm.samples);
}

/// POST /sessions {"opusPt":111} -> {"sessionId":"..."}.
/// opusPt is the SDP-negotiated Opus payload type (dynamic 96-127).
fn handleSessionCreate(allocator: std.mem.Allocator, app: *App, request: *std.http.Server.Request) !void {
    var body_buffer: [64 * 1024]u8 = undefined;
    const body = request.readerExpectNone(&body_buffer).allocRemaining(allocator, .limited(64 * 1024)) catch return respond(request, "{\"error\":\"payload rejected\"}", .payload_too_large);
    defer allocator.free(body);
    var opus_pt: u8 = 111;
    if (body.len > 0) {
        var doc = std.json.parseFromSlice(std.json.Value, allocator, body, .{}) catch return respond(request, "{\"error\":\"bad json\"}", .bad_request);
        defer doc.deinit();
        if (doc.value == .object) {
            if (doc.value.object.get("opusPt")) |v| {
                const n: i64 = switch (v) {
                    .integer => |x| x,
                    else => return respond(request, "{\"error\":\"opusPt must be integer\"}", .bad_request),
                };
                if (n < 96 or n > 127) return respond(request, "{\"error\":\"opusPt must be 96..127\"}", .bad_request);
                opus_pt = @intCast(n);
            }
        }
    }
    const id = randomSessionId(allocator) catch return respond(request, "{\"error\":\"internal\"}", .internal_server_error);
    errdefer allocator.free(id);
    const session = allocator.create(session_mod.Session) catch return respond(request, "{\"error\":\"internal\"}", .internal_server_error);
    session.* = session_mod.Session.init(allocator, opus_pt, app.vad_cfg) catch return respond(request, "{\"error\":\"internal\"}", .internal_server_error);
    app.sessions_mutex.lock();
    app.sessions.put(allocator, id, session) catch {
        app.sessions_mutex.unlock();
        session.deinit();
        allocator.destroy(session);
        return respond(request, "{\"error\":\"internal\"}", .internal_server_error);
    };
    app.sessions_mutex.unlock();
    const reply = std.fmt.allocPrint(allocator, "{{\"sessionId\":\"{s}\"}}", .{id}) catch return respond(request, "{\"error\":\"internal\"}", .internal_server_error);
    defer allocator.free(reply);
    return respond(request, reply, .ok);
}

fn findSession(app: *App, id: []const u8) ?*session_mod.Session {
    app.sessions_mutex.lock();
    defer app.sessions_mutex.unlock();
    return app.sessions.get(id);
}

/// POST /segments {"sessionId":"...","frames":["<base64 opus>",...],"seq":12}
/// or {"sessionId":"...","rtp":["<base64 datagram>",...]}.
/// Each call decodes its frames, runs VAD, and returns whatever segments
/// closed since the last poll — same event shapes as
/// record/transcript.zig consumes:
///   {"type":"conversation.item.input_audio_transcription.delta","delta":"..."}
///   {"type":"conversation.item.input_audio_transcription.completed",
///    "transcript":"...","startMs":120,"endMs":1840}
fn handleSegments(allocator: std.mem.Allocator, app: *App, request: *std.http.Server.Request) !void {
    var body_buffer: [64 * 1024]u8 = undefined;
    const body = request.readerExpectNone(&body_buffer).allocRemaining(allocator, .limited(max_request_bytes)) catch return respond(request, "{\"error\":\"payload rejected\"}", .payload_too_large);
    defer allocator.free(body);
    var doc = std.json.parseFromSlice(std.json.Value, allocator, body, .{}) catch return respond(request, "{\"error\":\"bad json\"}", .bad_request);
    defer doc.deinit();
    if (doc.value != .object) return respond(request, "{\"error\":\"bad json\"}", .bad_request);
    const obj = &doc.value.object;
    const session_id = switch (obj.get("sessionId") orelse return respond(request, "{\"error\":\"sessionId required\"}", .bad_request)) {
        .string => |s| s,
        else => return respond(request, "{\"error\":\"sessionId required\"}", .bad_request),
    };
    const session = findSession(app, session_id) orelse return respond(request, "{\"error\":\"session not found\"}", .not_found);
    var seq: u16 = 0;
    if (obj.get("seq")) |v| {
        if (v != .integer) return respond(request, "{\"error\":\"seq must be integer\"}", .bad_request);
        seq = @intCast(@as(u32, @intCast(v.integer)) & 0xFFFF);
    }
    var rtp_stamp: u32 = 0;
    if (obj.get("rtpStamp")) |v| {
        if (v != .integer) return respond(request, "{\"error\":\"rtpStamp must be integer\"}", .bad_request);
        rtp_stamp = @intCast(@as(u64, @intCast(v.integer)) & 0xFFFFFFFF);
    }
    if (obj.get("rtp")) |v| {
        if (v != .array) return respond(request, "{\"error\":\"rtp must be array\"}", .bad_request);
        for (v.array.items) |item| {
            if (item != .string) return respond(request, "{\"error\":\"rtp entries must be base64\"}", .bad_request);
            const raw = decodeBase64(allocator, item.string) catch return respond(request, "{\"error\":\"rtp entries must be base64\"}", .bad_request);
            defer allocator.free(raw);
            session.pushRtp(raw);
        }
    } else if (obj.get("frames")) |v| {
        if (v != .array) return respond(request, "{\"error\":\"frames must be array\"}", .bad_request);
        for (v.array.items) |item| {
            if (item != .string) return respond(request, "{\"error\":\"frames entries must be base64\"}", .bad_request);
            const raw = decodeBase64(allocator, item.string) catch return respond(request, "{\"error\":\"frames entries must be base64\"}", .bad_request);
            defer allocator.free(raw);
            session.pushOpus(raw, seq, rtp_stamp);
            seq +%= 1;
            rtp_stamp +%= 960;
        }
    } else {
        return respond(request, "{\"error\":\"frames or rtp required\"}", .bad_request);
    }
    if (obj.get("loss")) |v| {
        if (v != .integer) return respond(request, "{\"error\":\"loss must be integer\"}", .bad_request);
        if (v.integer > 0) session.pushLoss(@intCast(@min(v.integer, 50)));
    }
    if (obj.get("final")) |v| {
        if (v == .bool and v.bool) session.finish();
    }
    return drainSession(allocator, app, request, session);
}

fn decodeBase64(allocator: std.mem.Allocator, text: []const u8) ![]u8 {
    const decoder = std.base64.standard.Decoder;
    const bound = try decoder.calcSizeUpperBound(text.len);
    const buf = try allocator.alloc(u8, bound);
    errdefer allocator.free(buf);
    const exact = try decoder.calcSizeForSlice(text);
    if (exact > buf.len) return error.InvalidBase64;
    try decoder.decode(buf[0..exact], text);
    if (exact == buf.len) return buf;
    defer allocator.free(buf);
    return allocator.dupe(u8, buf[0..exact]);
}

/// Decode every ready segment through the graph, emit completed events,
/// then the current partial (delta) — the live tail the next poll extends.
fn drainSession(allocator: std.mem.Allocator, app: *App, request: *std.http.Server.Request, session: *session_mod.Session) !void {
    var events: std.ArrayList(u8) = .empty;
    defer events.deinit(allocator);
    try events.appendSlice(allocator, "{\"events\":[");
    var first = true;
    while (session.takeSegment()) |seg| {
        defer allocator.free(seg.pcm);
        const wave16 = decimate48to16(allocator, seg.pcm) catch continue;
        defer allocator.free(wave16);
        const normed = normalize(wave16);
        var frames = transcribeFrames(allocator, &app.model, &app.vocab, normed) catch continue;
        defer frames.deinit(allocator);
        session.completeSegment(frames.text);
        const start_ms = seg.start_sample * 1000 / 48000;
        const end_ms = seg.end_sample * 1000 / 48000;
        const text_json = try jsonString(allocator, frames.text);
        defer allocator.free(text_json);
        const toks_json = try tokensJson(allocator, &app.vocab, frames.tokens);
        defer allocator.free(toks_json);
        if (!first) try events.append(allocator, ',');
        first = false;
        const ev = try std.fmt.allocPrint(allocator, "{{\"type\":\"conversation.item.input_audio_transcription.completed\",\"transcript\":{s},\"startMs\":{d},\"endMs\":{d},\"tokens\":{s}}}", .{ text_json, start_ms, end_ms, toks_json });
        defer allocator.free(ev);
        try events.appendSlice(allocator, ev);
    }
    // Partial tail: re-decode the open phrase in progress (bounded: last
    // 10 s of buffered PCM) so the caller sees deltas before VAD closes.
    const partial = try partialText(allocator, app, session);
    defer if (partial) |p| allocator.free(p);
    if (partial) |p| {
        session.appendDelta(p);
        const delta_json = try jsonString(allocator, p);
        defer allocator.free(delta_json);
        if (!first) try events.append(allocator, ',');
        first = false;
        const ev = try std.fmt.allocPrint(allocator, "{{\"type\":\"conversation.item.input_audio_transcription.delta\",\"delta\":{s}}}", .{delta_json});
        defer allocator.free(ev);
        try events.appendSlice(allocator, ev);
    }
    try events.appendSlice(allocator, "]}");
    return respond(request, events.items, .ok);
}

/// Re-decode the tail of the still-open phrase (up to 10 s) as the delta.
fn partialText(allocator: std.mem.Allocator, app: *App, session: *session_mod.Session) !?[]u8 {
    if (session.bufferedLen() < 4800 or session.speechFrames() == 0) return null;
    const tail = try session.copyTail(allocator, 10 * 48000);
    defer allocator.free(tail);
    if (tail.len == 0) return null;
    const wave16 = try decimate48to16(allocator, tail);
    defer allocator.free(wave16);
    const normed = normalize(wave16);
    const text = transcribeSamples(allocator, &app.model, &app.vocab, normed) catch return null;
    if (text.len == 0) {
        allocator.free(text);
        return null;
    }
    return text;
}

fn tokensJson(allocator: std.mem.Allocator, vocab: *const Vocab, toks: []FrameToken) ![]u8 {
    var out: std.ArrayList(u8) = .empty;
    errdefer out.deinit(allocator);
    try out.append(allocator, '[');
    for (toks, 0..) |tok, i| {
        if (i > 0) try out.append(allocator, ',');
        const piece = try jsonString(allocator, vocab.lookup(tok.id));
        defer allocator.free(piece);
        const start_ms = tok.frame * frame_ms;
        const entry = try std.fmt.allocPrint(allocator, "{{\"t\":{s},\"startMs\":{d}}}", .{ piece, start_ms });
        defer allocator.free(entry);
        try out.appendSlice(allocator, entry);
    }
    try out.append(allocator, ']');
    return out.toOwnedSlice(allocator);
}

/// POST /sessions/stop {"sessionId":"..."} -> {"stopped":true}.
/// The final text arrives via GET .../events after the VAD grace closes
/// the active phrase (same deferred-stream shape as dictation.stop).
fn handleSessionStop(allocator: std.mem.Allocator, app: *App, request: *std.http.Server.Request) !void {
    var body_buffer: [64 * 1024]u8 = undefined;
    const body = request.readerExpectNone(&body_buffer).allocRemaining(allocator, .limited(64 * 1024)) catch return respond(request, "{\"error\":\"payload rejected\"}", .payload_too_large);
    defer allocator.free(body);
    var doc = std.json.parseFromSlice(std.json.Value, allocator, body, .{}) catch return respond(request, "{\"error\":\"bad json\"}", .bad_request);
    defer doc.deinit();
    if (doc.value != .object) return respond(request, "{\"error\":\"bad json\"}", .bad_request);
    const session_id = switch (doc.value.object.get("sessionId") orelse return respond(request, "{\"error\":\"sessionId required\"}", .bad_request)) {
        .string => |s| s,
        else => return respond(request, "{\"error\":\"sessionId required\"}", .bad_request),
    };
    const session = findSession(app, session_id) orelse return respond(request, "{\"error\":\"session not found\"}", .not_found);
    var ts: std.c.timespec = undefined;
    _ = std.c.clock_gettime(.REALTIME, &ts);
    session.requestStop(ts.sec * std.time.ns_per_s + ts.nsec);
    return respond(request, "{\"stopped\":true}", .ok);
}

/// GET /sessions/<id>/events: drain closed segments (completed), then the
/// snapshot tail (delta); destroy + snapshot the session once it is ready
/// to close, like the dictation reaper finishing the stopped stream.
fn handleSessionEvents(allocator: std.mem.Allocator, app: *App, request: *std.http.Server.Request, path: []const u8) !void {
    const rest = path["/sessions/".len .. path.len - "/events".len];
    if (rest.len == 0 or std.mem.indexOfScalar(u8, rest, '/') != null) return respond(request, "{\"error\":\"not found\"}", .not_found);
    const session = findSession(app, rest) orelse return respond(request, "{\"error\":\"session not found\"}", .not_found);
    var ts: std.c.timespec = undefined;
    _ = std.c.clock_gettime(.REALTIME, &ts);
    const now_ns = ts.sec * std.time.ns_per_s + ts.nsec;
    if (session.isReadyToClose(now_ns)) {
        session.finish();
        // One last drain, then hand back the accumulated snapshot and drop
        // the session: the stream is finished.
        try drainSessionToEvents(allocator, app, session);
        const text = try session.snapshot(allocator);
        defer allocator.free(text);
        app.sessions_mutex.lock();
        const kv = app.sessions.fetchRemove(rest);
        app.sessions_mutex.unlock();
        if (kv) |entry| {
            entry.value.deinit();
            allocator.destroy(entry.value);
            allocator.free(entry.key);
        }
        const text_json = try jsonString(allocator, text);
        defer allocator.free(text_json);
        const reply = try std.fmt.allocPrint(allocator, "{{\"final\":{s}}}", .{text_json});
        defer allocator.free(reply);
        return respond(request, reply, .ok);
    }
    return drainSession(allocator, app, request, session);
}

/// Same as drainSession but discards the wire reply (reaper path): the
/// segments still land in the committed buffer via completeSegment.
fn drainSessionToEvents(allocator: std.mem.Allocator, app: *App, session: *session_mod.Session) !void {
    while (session.takeSegment()) |seg| {
        defer allocator.free(seg.pcm);
        const wave16 = decimate48to16(allocator, seg.pcm) catch continue;
        defer allocator.free(wave16);
        const normed = normalize(wave16);
        var frames = transcribeFrames(allocator, &app.model, &app.vocab, normed) catch continue;
        defer frames.deinit(allocator);
        session.completeSegment(frames.text);
    }
}

fn jsonString(allocator: std.mem.Allocator, value: []const u8) ![]u8 {
    return std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = value }, .{});
}

fn jsonText(allocator: std.mem.Allocator, text: []const u8) ![]u8 {
    const value = try jsonString(allocator, text);
    defer allocator.free(value);
    return std.fmt.allocPrint(allocator, "{{\"text\":{s}}}", .{value});
}

fn respond(request: *std.http.Server.Request, body: []const u8, status: std.http.Status) !void {
    try request.respond(body, .{ .status = status, .keep_alive = false, .extra_headers = &.{.{ .name = "content-type", .value = "application/json; charset=utf-8" }} });
}

fn port(value: []const u8) u16 {
    return std.fmt.parseInt(u16, value, 10) catch 8002;
}

fn env(name: [*:0]const u8) ?[]const u8 {
    const value = std.c.getenv(name) orelse return null;
    return std.mem.span(value);
}
