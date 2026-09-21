const std = @import("std");
const model_file = @import("model.zig");
const Model = model_file.Model;
const Vocab = @import("vocab.zig").Vocab;
const vocab_decode = @import("vocab.zig").decode;
const wav = @import("wav.zig");

const max_request_bytes = 64 * 1024 * 1024;
const max_audio_seconds = 40;
const max_audio_samples = max_audio_seconds * 16000;
const blank_id = @import("vocab.zig").blank_id;
const subsampling_factor = 320;

pub fn main(init: std.process.Init) !void {
    const allocator = init.gpa;
    const io = init.io;
    const argv = try init.minimal.args.toSlice(init.arena.allocator());
    var model = try Model.init(allocator, env("SPEACH_MODEL") orelse "models/model.onnx");
    defer model.deinit();
    var vocab = try Vocab.init(allocator, env("SPEACH_TOKENS") orelse "models/tokens.txt");
    defer vocab.deinit();
    _ = try warmup(allocator, &model, &vocab);
    if (argv.len > 1) {
        const text = try transcribeFile(allocator, &model, &vocab, argv[1]);
        defer allocator.free(text);
        var stdout_buf: [4096]u8 = undefined;
        var stdout = std.Io.File.stdout().writer(io, &stdout_buf);
        try stdout.interface.print("{s}\n", .{text});
        try stdout.interface.flush();
        return;
    }
    try serve(allocator, &model, &vocab, env("SPEACH_HOST") orelse "0.0.0.0", port(env("SPEACH_PORT") orelse "8002"));
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

fn serve(allocator: std.mem.Allocator, model: *Model, vocab: *Vocab, host: []const u8, listen_port: u16) !void {
    const io = std.Options.debug_io;
    var listener = try (try std.Io.net.IpAddress.parse(host, listen_port)).listen(io, .{ .reuse_address = true });
    defer listener.deinit(io);
    std.log.info("SPEACH listening on http://{s}:{d}", .{ host, listen_port });
    while (true) {
        var stream = try listener.accept(io);
        defer stream.close(io);
        handle(allocator, model, vocab, stream) catch |err| std.log.warn("request failed: {s}", .{@errorName(err)});
    }
}

fn handle(allocator: std.mem.Allocator, model: *Model, vocab: *Vocab, stream: std.Io.net.Stream) !void {
    const io = std.Options.debug_io;
    var input: [64 * 1024]u8 = undefined;
    var output: [16 * 1024]u8 = undefined;
    var reader = stream.reader(io, &input);
    var writer = stream.writer(io, &output);
    var server = std.http.Server.init(&reader.interface, &writer.interface);
    var request = try server.receiveHead();
    const path = request.head.target[0 .. std.mem.indexOfScalar(u8, request.head.target, '?') orelse request.head.target.len];
    if (request.head.method == .GET and std.mem.eql(u8, path, "/healthz")) return respond(&request, "{\"ok\":true}", .ok);
    if (request.head.method != .POST or !std.mem.eql(u8, path, "/transcribe")) return respond(&request, "{\"error\":\"not found\"}", .not_found);
    var body_buffer: [64 * 1024]u8 = undefined;
    const body = request.readerExpectNone(&body_buffer).allocRemaining(allocator, .limited(max_request_bytes)) catch return respond(&request, "{\"error\":\"payload rejected\"}", .payload_too_large);
    defer allocator.free(body);
    const text = transcribeBody(allocator, model, vocab, body) catch |err| {
        std.log.warn("model failed: {s}: {s}", .{ @errorName(err), model_file.lastError() });
        return respond(&request, "{\"error\":\"transcribe failed\"}", .internal_server_error);
    };
    defer allocator.free(text);
    const reply = try jsonText(allocator, text);
    defer allocator.free(reply);
    return respond(&request, reply, .ok);
}

// Raw file path: the POST body is the wav file itself. No JSON envelope,
// no multipart — same bytes as `speach file.wav` would read.
fn transcribeBody(allocator: std.mem.Allocator, model: *Model, vocab: *Vocab, body: []const u8) ![]u8 {
    var pcm = try wav.parse(allocator, body);
    defer pcm.deinit(allocator);
    return transcribeSamples(allocator, model, vocab, pcm.samples);
}

fn jsonText(allocator: std.mem.Allocator, text: []const u8) ![]u8 {
    const value = try std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = text }, .{});
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
