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

    pub fn initSession(
        self: *Engine,
        a: std.mem.Allocator,
        entry: *registry_mod.Entry,
        client: *std.http.Client,
        model: []const u8,
        session_id: []const u8,
    ) !?[]const u8 {
        const lifecycle = entry.table.session orelse return null;
        const model_json = try provider.jsonStr(a, model);
        const session_json = try provider.jsonStr(a, session_id);
        const request_json = try std.fmt.allocPrint(a, "{{\"model\":{s},\"sessionId\":{s}}}", .{ model_json, session_json });
        const args = try std.fmt.allocPrint(a, "[{s}]", .{request_json});
        const encoded = try self.registry.callHook(a, entry.name(), lifecycle.open_hook, args);
        const wire = try parseWire(a, encoded);
        const response = try self.send(a, entry, client, model, wire);
        if (response.status < 200 or response.status >= 300) {
            return error.ProviderSessionInitFailed;
        }
        _ = std.json.parseFromSliceLeaky(std.json.Value, a, response.body, .{}) catch
            return error.ProviderSessionResponseInvalid;
        const response_json = response.body;
        const decode_args = try std.fmt.allocPrint(a, "[{s},{s}]", .{ request_json, response_json });
        const state_json = try self.registry.callHook(a, entry.name(), lifecycle.decode_hook, decode_args);
        return try a.dupe(u8, state_json);
    }

    pub fn closeSession(
        self: *Engine,
        a: std.mem.Allocator,
        entry: *registry_mod.Entry,
        client: *std.http.Client,
        model: []const u8,
        session_id: []const u8,
        session_state_json: []const u8,
    ) !void {
        const lifecycle = entry.table.session orelse return;
        const hook = lifecycle.close_hook orelse return;
        const model_json = try provider.jsonStr(a, model);
        const session_json = try provider.jsonStr(a, session_id);
        const request_json = try std.fmt.allocPrint(a, "{{\"model\":{s},\"sessionId\":{s}}}", .{ model_json, session_json });
        const args = try std.fmt.allocPrint(a, "[{s},{s}]", .{ request_json, session_state_json });
        const encoded = try self.registry.callHook(a, entry.name(), hook, args);
        const wire = try parseWire(a, encoded);
        const response = try self.send(a, entry, client, model, wire);
        if (response.status < 200 or response.status >= 300) return error.ProviderSessionCloseFailed;
    }

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
        const url = wire.url orelse try registry_mod.substitute(a, entry.table.transport.url, req.model, self.secrets);
        const headers = try self.buildHeaders(a, entry, req.model, wire);

        var decoder = decode.Decoder.init(a, &entry.table, sink, self.hookRunner());
        var state = LineState{ .decoder = &decoder };

        const target = if (wire.path) |path| try joinUrl(a, url, path) else url;
        _ = http.postJsonLines(client, a, parseMethod(wire.method) orelse return error.EncodeTurnInvalid, target, headers, wire.body, .{
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

    pub const Wire = struct {
        method: []const u8,
        path: ?[]const u8 = null,
        url: ?[]const u8 = null,
        content_type: ?[]const u8 = null,
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

        return parseWire(a, reply);
    }

    fn buildHeaders(
        self: *Engine,
        a: std.mem.Allocator,
        entry: *registry_mod.Entry,
        model: []const u8,
        wire: Wire,
    ) ![]const std.http.Header {
        const t = &entry.table.transport;
        var headers: std.ArrayList(std.http.Header) = .empty;
        for (t.header_names, t.header_values) |name, value| {
            try setHeader(a, &headers, name, registry_mod.substitute(a, value, model, self.secrets) catch |err| {
                std.log.err("provider {s}: header '{s}': {s}", .{ entry.name(), name, @errorName(err) });
                return err;
            });
        }
        for (wire.extra_headers) |header| try setHeader(a, &headers, header.name, header.value);
        if (wire.content_type) |content_type| try setHeader(a, &headers, "content-type", content_type);
        return headers.items;
    }

    fn send(
        self: *Engine,
        a: std.mem.Allocator,
        entry: *registry_mod.Entry,
        client: *std.http.Client,
        model: []const u8,
        wire: Wire,
    ) !http.Result {
        const base_url = wire.url orelse try registry_mod.substitute(a, entry.table.transport.url, model, self.secrets);
        const url = if (wire.path) |path| try joinUrl(a, base_url, path) else base_url;
        const headers = try self.buildHeaders(a, entry, model, wire);
        return http.requestJson(client, a, parseMethod(wire.method) orelse return error.EncodeTurnInvalid, url, headers, if (wire.body.len == 0) null else wire.body);
    }
};

fn parseMethod(method: []const u8) ?std.http.Method {
    inline for (.{ "GET", "HEAD", "POST", "PUT", "DELETE", "CONNECT", "OPTIONS", "TRACE", "PATCH" }) |name| {
        if (std.mem.eql(u8, method, name)) return @field(std.http.Method, name);
    }
    return null;
}

fn parseWire(a: std.mem.Allocator, json: []const u8) !Engine.Wire {
    const value = std.json.parseFromSliceLeaky(std.json.Value, a, json, .{}) catch return error.EncodeTurnInvalid;
    if (value != .object) return error.EncodeTurnInvalid;
    return .{
        .method = provider.strField(value, "method") orelse "POST",
        .path = provider.strField(value, "path"),
        .url = provider.strField(value, "url"),
        .content_type = provider.strField(value, "contentType"),
        .body = provider.strField(value, "body") orelse "",
        .extra_headers = try parseHeaders(a, value),
    };
}

fn parseHeaders(a: std.mem.Allocator, wire: std.json.Value) ![]const std.http.Header {
    const value = provider.field(wire, "headers") orelse return &.{};
    if (value != .object) return error.EncodeTurnInvalid;
    const headers = try a.alloc(std.http.Header, value.object.count());
    var it = value.object.iterator();
    var i: usize = 0;
    while (it.next()) |entry| : (i += 1) {
        if (entry.value_ptr.* != .string) return error.EncodeTurnInvalid;
        headers[i] = .{ .name = entry.key_ptr.*, .value = entry.value_ptr.string };
    }
    return headers;
}

fn setHeader(a: std.mem.Allocator, headers: *std.ArrayList(std.http.Header), name: []const u8, value: []const u8) !void {
    for (headers.items) |*header| {
        if (std.ascii.eqlIgnoreCase(header.name, name)) {
            header.value = value;
            return;
        }
    }
    try headers.append(a, .{ .name = name, .value = value });
}

/// Re-encode the parsed chat request into the uniform dialect the hooks expect.
/// Messages and tools pass through verbatim: the core does not interpret them,
/// and re-serializing what it never decoded would only invite drift.
fn uniformRequestJson(a: std.mem.Allocator, req: provider.ChatRequest) ![]const u8 {
    var out: std.ArrayList(u8) = .empty;
    defer out.deinit(a);

    try out.appendSlice(a, "{\"model\":");
    try provider.appendJsonStr(&out, a, req.model);
    if (req.session_state) |session_state| {
        try out.appendSlice(a, ",\"session\":");
        try provider.appendValue(&out, a, session_state);
    }
    try out.appendSlice(a, try std.fmt.allocPrint(a, ",\"maxTokens\":{d}", .{req.max_tokens}));
    if (req.operation) |operation| {
        try out.appendSlice(a, ",\"operation\":");
        try provider.appendJsonStr(&out, a, operation);
    }
    if (req.input) |input| {
        try out.appendSlice(a, ",\"input\":");
        try provider.appendValue(&out, a, input);
    }
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

fn joinUrl(a: std.mem.Allocator, base: []const u8, path: []const u8) ![]const u8 {
    if (path.len == 0 or path[0] != '/') return error.EncodeTurnInvalid;
    const trimmed = std.mem.trimEnd(u8, base, "/");
    return std.fmt.allocPrint(a, "{s}{s}", .{ trimmed, path });
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
