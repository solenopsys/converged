//! The whole runtime of a processor binary: register with Fujin, authorize the
//! envelope against the generated NRPC policy, stage cache refs, run the
//! native library, hand the bytes back.
//!
//! There is deliberately no hub, no task queue and no scheduling policy here.
//! One process serves one processor; how many of them run, when they restart
//! and where they live is the ptah operator's decision, and which one gets a
//! request is Fujin's. That leaves this file with exactly one job per request.

const std = @import("std");
const transport = @import("transport");
const cache = @import("cache.zig");
const json = @import("json.zig");
const Processor = @import("processor.zig").Processor;
const Progress = @import("processor.zig").Progress;

pub const Options = struct {
    /// NRPC service name from the generated descriptor. Doubles as the default
    /// Fujin routing target and as the cache-key namespace.
    service: []const u8,
    /// Generated per-method authorization descriptor.
    policy_fn: *const fn (method: []const u8) ?transport.auth.authorize.MethodPolicy,
    /// Environment prefix for this binary, e.g. `CURAENGINE`. Every setting
    /// falls back to the unprefixed platform-wide name.
    env_prefix: []const u8,
    /// The single method this binary answers.
    method: []const u8 = "analyze",
    max_output_bytes: usize = 512 * 1024 * 1024,
};

/// Serves until the process is stopped. `processor` must outlive the call.
pub fn run(init: std.process.Init, processor: Processor, options: Options) !void {
    const allocator = init.gpa;

    var auth_receiver = try transport.auth.receiver.Receiver.init(allocator, init.environ_map);
    defer auth_receiver.deinit();

    const endpoint_value = cache.env(init.environ_map, options.env_prefix, "FUJIN_ZMQ_ENDPOINT") orelse
        "tcp://127.0.0.1:5557";
    const endpoint = try allocator.dupeZ(u8, endpoint_value);
    defer allocator.free(endpoint);
    const target = cache.env(init.environ_map, options.env_prefix, "FUJIN_TARGET") orelse options.service;

    var runtime = try transport.Runtime.init(allocator, .{
        .endpoint = endpoint,
        .target = target,
        .limits = .{ .max_envelope_bytes = 64 * 1024, .max_payload_bytes = 16 * 1024 * 1024 },
        .recv_timeout_ms = 1000,
        .send_timeout_ms = 1000,
        // A slice runs for minutes. One handler thread keeps the reactor free
        // to answer heartbeats and to put this processor's own progress chunks
        // on the wire, while still serializing calls into the native library.
        .workers = 1,
    });
    defer runtime.deinit();

    var server = Server{
        .processor = processor,
        .runtime = &runtime,
        .io = init.io,
        .cache = cache.Client.fromEnv(init.environ_map, options.env_prefix, options.service),
        .auth = &auth_receiver,
        .options = options,
    };
    try runtime.bind(options.service, server.handler());

    std.debug.print(
        "{s} ready: method={s} target={s} endpoint={s}\n",
        .{ options.service, options.method, target, endpoint },
    );
    runtime.run();
}

const OutputBinding = struct { field: []const u8, path: []const u8 };

const Server = struct {
    processor: Processor,
    runtime: *transport.Runtime,
    io: std.Io,
    cache: cache.Client,
    auth: *transport.auth.receiver.Receiver,
    options: Options,

    fn handler(self: *Server) transport.RuntimeHandler {
        return .{ .context = self, .handle_fn = handleOpaque };
    }

    fn handleOpaque(
        context: *anyopaque,
        allocator: std.mem.Allocator,
        request: transport.RuntimeRequest,
    ) !transport.RuntimeResponse {
        const self: *Server = @ptrCast(@alignCast(context));
        const policy = self.options.policy_fn(request.envelope.method) orelse return error.CommandUnsupported;
        const now = std.Io.Timestamp.now(self.io, .real).toSeconds();
        var verified = try self.auth.authorize(
            request.envelope.auth,
            request.envelope.user,
            request.envelope.scope,
            policy,
            now,
        );
        defer if (verified) |*token| token.deinit(self.auth.allocator);
        if (!std.mem.eql(u8, request.envelope.method, self.options.method)) return error.CommandUnsupported;
        return self.analyze(allocator, request);
    }

    /// Run the native library and answer with `{result, outputs}`.
    ///
    /// Progress streaming is opt-in: interactive ws/CLI callers set
    /// `"stream":true` and consume a server-stream, while the RT engine's
    /// `rt.call` is unary — it reads exactly one `.response` and rejects
    /// stream chunks — so a workflow runs without an emitter. Either way the
    /// payload is the same.
    fn analyze(
        self: *Server,
        allocator: std.mem.Allocator,
        request: transport.RuntimeRequest,
    ) !transport.RuntimeResponse {
        // The transport's arena owns `parsed` for the whole handler, so the
        // slices taken out of it stay valid without a deinit here.
        var parsed = try std.json.parseFromSlice(std.json.Value, allocator, request.payload, .{});
        if (parsed.value != .object) return error.PayloadInvalid;
        const task_ptr = parsed.value.object.getPtr("task") orelse return error.TaskRequired;
        if (task_ptr.* != .object) return error.TaskRequired;

        var temps: std.ArrayList([]const u8) = .empty; // every temp file, for cleanup
        defer for (temps.items) |p| std.Io.Dir.cwd().deleteFile(self.io, p) catch {};
        var outputs: std.ArrayList(OutputBinding) = .empty;

        // inputs: cacheKey -> temp file bound to the task field
        if (parsed.value.object.get("inputs")) |inputs_val| {
            if (inputs_val == .object) {
                var it = inputs_val.object.iterator();
                while (it.next()) |entry| {
                    if (entry.value_ptr.* != .string) continue;
                    const path = try self.tempPath(allocator, "in");
                    try temps.append(allocator, path);
                    const found = try self.cache.getToFile(self.io, entry.value_ptr.string, path);
                    if (!found) return error.CacheRefMissing;
                    try task_ptr.object.put(allocator, entry.key_ptr.*, .{ .string = path });
                }
            }
        }

        // outputs: pre-bind a temp file the processor writes; read it back after
        if (parsed.value.object.get("outputs")) |outputs_val| {
            if (outputs_val == .array) {
                for (outputs_val.array.items) |item| {
                    if (item != .string) continue;
                    const path = try self.tempPath(allocator, "out");
                    try temps.append(allocator, path);
                    try task_ptr.object.put(allocator, item.string, .{ .string = path });
                    try outputs.append(allocator, .{ .field = item.string, .path = path });
                }
            }
        }

        const streaming = switch (parsed.value.object.get("stream") orelse std.json.Value{ .bool = false }) {
            .bool => |b| b,
            else => false,
        };
        var emitter = ProgressEmitter{ .runtime = self.runtime, .request = request };
        const task_json = try std.json.Stringify.valueAlloc(allocator, task_ptr.*, .{});

        try self.processor.start();
        const result = try self.processor.execute(
            allocator,
            task_json,
            if (streaming) emitter.progress() else null,
        );

        var reply: std.ArrayList(u8) = .empty;
        try reply.appendSlice(allocator, "{\"result\":");
        try reply.appendSlice(allocator, result);
        try reply.appendSlice(allocator, ",\"outputs\":{");
        var first = true;
        for (outputs.items) |binding| {
            // A processor may legitimately not produce an optional output.
            const bytes = json.readFile(allocator, binding.path, self.options.max_output_bytes) catch continue;
            const cache_key = try self.cache.putBytes(self.io, allocator, bytes);
            if (!first) try reply.appendSlice(allocator, ",");
            first = false;
            const field_json = try json.jsonString(allocator, binding.field);
            const key_json = try json.jsonString(allocator, cache_key);
            try reply.print(allocator, "{s}:{{\"cacheKey\":{s},\"sizeBytes\":{d}}}", .{ field_json, key_json, bytes.len });
        }
        try reply.appendSlice(allocator, "}}");

        if (streaming) {
            return .{ .payload = reply.items, .kind = .stream_chunk, .seq = emitter.nextSeq(), .fin = true };
        }
        return .{ .payload = reply.items };
    }

    /// One handler thread serializes execution, so a monotonic counter is a
    /// sufficient process-unique token for a temp file.
    fn tempPath(self: *Server, allocator: std.mem.Allocator, tag: []const u8) ![]u8 {
        const seq = g_uid_seq.fetchAdd(1, .monotonic);
        return std.fmt.allocPrint(allocator, "/tmp/{s}-{s}-{x}", .{ self.options.service, tag, seq });
    }
};

var g_uid_seq: std.atomic.Value(u64) = .init(0);

/// Forwards progress events as transport server-stream chunks on the in-flight
/// request. Progress is best-effort: the processor swallows a failed send, so
/// a dropped transport never fails the work itself.
const ProgressEmitter = struct {
    runtime: *transport.Runtime,
    request: transport.RuntimeRequest,
    seq: u32 = 0,

    fn nextSeq(self: *ProgressEmitter) u32 {
        self.seq += 1;
        return self.seq;
    }

    fn emitOpaque(context: *anyopaque, event_json: []const u8) anyerror!void {
        const self: *ProgressEmitter = @ptrCast(@alignCast(context));
        try self.runtime.sendStreamChunk(self.request, event_json, self.nextSeq(), false);
    }

    fn progress(self: *ProgressEmitter) Progress {
        return .{ .ctx = self, .emit_fn = emitOpaque };
    }
};
