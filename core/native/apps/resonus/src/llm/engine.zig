//! The generic HTTPS provider.
//!
//! One implementation for every vendor that speaks request/response or SSE over
//! HTTP. It has no vendor knowledge at all: the URL, headers, request encoding
//! and event grammar all come from the descriptor, and the only vendor-shaped
//! code left in the process is the TypeScript that produced it.
//!
//! This is what `claude.zig`, `openai.zig` and `gemini.zig` used to be, minus
//! three copies of the same control flow.

const std = @import("std");
const decode = @import("decode.zig");
const descriptor = @import("descriptor.zig");
const http = @import("http.zig");
const provider = @import("provider.zig");
const registry_mod = @import("registry.zig");

pub const Engine = struct {
    registry: *registry_mod.Registry,
    secrets: *const registry_mod.Secrets,
    /// Set for the duration of a turn so the decode table's hook runner knows
    /// which provider and arena it is serving.
    current: ?Current = null,

    const Current = struct {
        allocator: std.mem.Allocator,
        provider_name: []const u8,
    };

    /// One non-streaming turn.
    pub fn complete(
        self: *Engine,
        a: std.mem.Allocator,
        entry: *registry_mod.Entry,
        client: *std.http.Client,
        req: provider.ChatRequest,
    ) !provider.Reply {
        const wire = try self.encodeTurn(a, entry, req, false);
        const res = try self.send(a, entry, client, req.model, wire);
        if (res.status < 200 or res.status >= 300) {
            return provider.errReply(a, "{s} HTTP {d}: {s}", .{ entry.name(), res.status, res.body });
        }

        // The vendor reply is parsed once here and handed to the hook as a
        // value, so the hook never re-parses what the core already holds.
        const parsed = std.json.parseFromSliceLeaky(std.json.Value, a, res.body, .{}) catch
            return provider.errReply(a, "{s}: malformed response: {s}", .{ entry.name(), res.body });

        const args = try argsJson(a, &.{parsed});
        const reply = try self.registry.callHook(a, entry.name(), "decodeResponse", args);

        const uniform = std.json.parseFromSliceLeaky(std.json.Value, a, reply, .{}) catch
            return provider.errReply(a, "{s}: decodeResponse returned invalid JSON", .{entry.name()});
        return .{ .ok = true, .body = try withProviderAndModel(a, uniform, entry.name(), req.model) };
    }

    /// One streaming turn. Frames are fed to the decode table; no JS runs here.
    pub fn stream(
        self: *Engine,
        a: std.mem.Allocator,
        entry: *registry_mod.Entry,
        client: *std.http.Client,
        req: provider.ChatRequest,
        sink: provider.StreamSink,
    ) !provider.Completion {
        const wire = try self.encodeTurn(a, entry, req, true);
        const url = try registry_mod.substitute(a, entry.table.transport.url, req.model, self.secrets);
        const headers = try self.buildHeaders(a, entry, req.model);

        var decoder = decode.Decoder.init(a, &entry.table, sink, self.hookRunner());
        var state = LineState{ .decoder = &decoder };

        _ = http.postJsonLines(client, a, url, headers, wire.body, .{
            .context = &state,
            .on_line = onLine,
        }) catch |err| {
            if (state.failure) |failure| return failure;
            return err;
        };
        if (state.failure) |failure| return failure;

        if (decoder.fatal_message) |message| {
            std.log.err("{s}: vendor error: {s}", .{ entry.name(), message });
            return error.VendorStreamFailed;
        }
        return decoder.finish();
    }

    // ---- internals ----------------------------------------------------------

    const LineState = struct {
        decoder: *decode.Decoder,
        done: bool = false,
        /// The line sink cannot stop the reader, so a failure is carried out
        /// rather than thrown through it.
        failure: ?anyerror = null,
    };

    fn onLine(context: *anyopaque, line: []const u8) anyerror!void {
        const state: *LineState = @ptrCast(@alignCast(context));
        if (state.done or state.failure != null) return;
        const outcome = state.decoder.feed(line) catch |err| {
            state.failure = err;
            return;
        };
        switch (outcome) {
            // Over HTTP the body ends by itself, so `complete` is informational
            // here; stopping early would drop a trailing usage frame.
            .done, .fatal => state.done = true,
            .complete, .open => {},
        }
    }

    fn hookRunner(self: *Engine) decode.HookRunner {
        return .{ .context = self, .run = runHook };
    }

    /// Bridges the decode table's escape hatch to the registry. The event is
    /// already serialized by the caller, so this only wraps it as an argument
    /// list and forwards.
    fn runHook(context: *anyopaque, hook: []const u8, event_json: []const u8) anyerror![]const u8 {
        const self: *Engine = @ptrCast(@alignCast(context));
        const current = self.current orelse return error.HookContextMissing;
        var buf: std.ArrayList(u8) = .empty;
        defer buf.deinit(current.allocator);
        try buf.appendSlice(current.allocator, "[");
        try buf.appendSlice(current.allocator, event_json);
        try buf.appendSlice(current.allocator, "]");
        return self.registry.callHook(current.allocator, current.provider_name, hook, buf.items);
    }

    const Wire = struct {
        method: []const u8,
        body: []const u8,
        extra_headers: []const std.http.Header,
    };

    fn encodeTurn(
        self: *Engine,
        a: std.mem.Allocator,
        entry: *registry_mod.Entry,
        req: provider.ChatRequest,
        streaming: bool,
    ) !Wire {
        self.current = .{ .allocator = a, .provider_name = entry.name() };

        const request_json = try uniformRequestJson(a, req);
        const args = try std.fmt.allocPrint(a, "[{s},{}]", .{ request_json, streaming });
        const reply = try self.registry.callHook(a, entry.name(), "encodeTurn", args);

        const wire = std.json.parseFromSliceLeaky(std.json.Value, a, reply, .{}) catch
            return error.EncodeTurnInvalid;
        const body = provider.strField(wire, "body") orelse return error.EncodeTurnInvalid;

        return .{
            .method = provider.strField(wire, "method") orelse "POST",
            .body = body,
            .extra_headers = &.{},
        };
    }

    fn buildHeaders(
        self: *Engine,
        a: std.mem.Allocator,
        entry: *registry_mod.Entry,
        model: []const u8,
    ) ![]const std.http.Header {
        const t = &entry.table.transport;
        const headers = try a.alloc(std.http.Header, t.header_names.len);
        for (t.header_names, t.header_values, 0..) |name, value, i| {
            headers[i] = .{
                .name = name,
                .value = registry_mod.substitute(a, value, model, self.secrets) catch |err| {
                    std.log.err("provider {s}: header '{s}': {s}", .{ entry.name(), name, @errorName(err) });
                    return err;
                },
            };
        }
        return headers;
    }

    fn send(
        self: *Engine,
        a: std.mem.Allocator,
        entry: *registry_mod.Entry,
        client: *std.http.Client,
        model: []const u8,
        wire: Wire,
    ) !http.Result {
        const url = try registry_mod.substitute(a, entry.table.transport.url, model, self.secrets);
        const headers = try self.buildHeaders(a, entry, model);
        return http.postJson(client, a, url, headers, wire.body);
    }
};

/// Re-encode the parsed chat request into the uniform dialect the hooks expect.
/// Messages and tools pass through verbatim: the core does not interpret them,
/// and re-serializing what it never decoded would only invite drift.
fn uniformRequestJson(a: std.mem.Allocator, req: provider.ChatRequest) ![]const u8 {
    var out: std.ArrayList(u8) = .empty;
    defer out.deinit(a);

    try out.appendSlice(a, "{\"model\":");
    try provider.appendJsonStr(&out, a, req.model);
    try out.appendSlice(a, try std.fmt.allocPrint(a, ",\"maxTokens\":{d}", .{req.max_tokens}));
    if (req.temperature) |t| {
        try out.appendSlice(a, try std.fmt.allocPrint(a, ",\"temperature\":{d}", .{t}));
    }
    try out.appendSlice(a, ",\"messages\":[");
    for (req.messages, 0..) |m, i| {
        if (i > 0) try out.appendSlice(a, ",");
        try provider.appendValue(&out, a, m);
    }
    try out.appendSlice(a, "],\"tools\":[");
    for (req.tools, 0..) |t, i| {
        if (i > 0) try out.appendSlice(a, ",");
        try provider.appendValue(&out, a, t);
    }
    try out.appendSlice(a, try std.fmt.allocPrint(a, "],\"requireTool\":{}}}", .{req.require_tool}));

    return out.toOwnedSlice(a);
}

fn argsJson(a: std.mem.Allocator, values: []const std.json.Value) ![]const u8 {
    var out: std.ArrayList(u8) = .empty;
    defer out.deinit(a);
    try out.appendSlice(a, "[");
    for (values, 0..) |v, i| {
        if (i > 0) try out.appendSlice(a, ",");
        try provider.appendValue(&out, a, v);
    }
    try out.appendSlice(a, "]");
    return out.toOwnedSlice(a);
}

/// The hook returns the vendor-neutral completion; provider and model are the
/// core's to state, not the script's.
fn withProviderAndModel(
    a: std.mem.Allocator,
    uniform: std.json.Value,
    provider_name: []const u8,
    model: []const u8,
) ![]const u8 {
    var out: std.ArrayList(u8) = .empty;
    defer out.deinit(a);

    try out.appendSlice(a, "{\"provider\":");
    try provider.appendJsonStr(&out, a, provider_name);
    try out.appendSlice(a, ",\"model\":");
    try provider.appendJsonStr(&out, a, model);
    if (uniform == .object) {
        var it = uniform.object.iterator();
        while (it.next()) |field| {
            if (std.mem.eql(u8, field.key_ptr.*, "provider")) continue;
            if (std.mem.eql(u8, field.key_ptr.*, "model")) continue;
            try out.appendSlice(a, ",");
            try provider.appendJsonStr(&out, a, field.key_ptr.*);
            try out.appendSlice(a, ":");
            try provider.appendValue(&out, a, field.value_ptr.*);
        }
    }
    try out.appendSlice(a, "}");
    return out.toOwnedSlice(a);
}
