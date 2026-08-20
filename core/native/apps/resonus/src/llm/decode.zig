//! The table executor: vendor events in, uniform events out, no JavaScript.
//!
//! One `std.json` parse per received event, then a lookup and a few path
//! resolutions against the descriptor loaded at startup. This is the whole
//! reason the decode table is data rather than code — the hot path never
//! crosses into a script runtime, and the payload is never serialized twice.
//!
//! Turn state (accumulated text, tool-call arguments, usage) lives here rather
//! than in each provider, because it is identical for all of them: only *which*
//! vendor field carries a fragment differs, and that is exactly what the table
//! says.

const std = @import("std");
const descriptor = @import("descriptor.zig");
const provider = @import("provider.zig");

/// Resolve a pre-split path. A segment that parses as an integer indexes an
/// array; anything else is an object key. A missing step yields null, which
/// every caller treats as "this event does not carry that field" — vendors omit
/// fields constantly, and that is not an error.
pub fn resolve(root: std.json.Value, path: descriptor.Path) ?std.json.Value {
    var current = root;
    for (path) |segment| {
        switch (current) {
            .object => |map| current = map.get(segment) orelse return null,
            .array => |items| {
                const index = std.fmt.parseInt(usize, segment, 10) catch return null;
                if (index >= items.items.len) return null;
                current = items.items[index];
            },
            else => return null,
        }
    }
    return if (current == .null) null else current;
}

fn resolveStr(root: std.json.Value, path: descriptor.Path) ?[]const u8 {
    const value = resolve(root, path) orelse return null;
    return switch (value) {
        .string => |s| s,
        else => null,
    };
}

fn resolveInt(root: std.json.Value, path: descriptor.Path) ?i64 {
    const value = resolve(root, path) orelse return null;
    return switch (value) {
        .integer => |n| n,
        .float => |f| @intFromFloat(f),
        else => null,
    };
}

/// A correlation key for one tool call. Vendors disagree on its type — a block
/// `index` in Anthropic, a `call_id` string in OpenAI Realtime — so both are
/// rendered to the same short text and the accumulator never has to care.
fn resolveKey(buf: []u8, root: std.json.Value, path: descriptor.Path) ?[]const u8 {
    const value = resolve(root, path) orelse return null;
    return switch (value) {
        .string => |s| s,
        .integer => |n| std.fmt.bufPrint(buf, "{d}", .{n}) catch null,
        else => null,
    };
}

/// Calls a warm hook by name and returns its JSON reply. Injected so the
/// executor stays testable without a JS runtime attached.
pub const HookRunner = struct {
    context: *anyopaque,
    run: *const fn (context: *anyopaque, hook: []const u8, event_json: []const u8) anyerror![]const u8,
};

const ToolCall = struct {
    key: []const u8,
    id: []const u8 = "",
    name: []const u8 = "",
    arguments: std.ArrayList(u8) = .empty,
};

pub const Outcome = enum {
    /// Keep reading the stream.
    open,
    /// The framing sentinel was seen; the stream is finished.
    done,
    /// The table's `turn.end` fired: this turn is complete, but the connection
    /// stays open for the next one.
    complete,
    /// The vendor reported an error event.
    fatal,
};

/// One event may produce several outcomes; the most serious wins. A `fatal`
/// beats a `complete` that fired alongside it, because a turn that ended in a
/// vendor error did not end normally.
fn worse(current: Outcome, next: Outcome) Outcome {
    return switch (next) {
        .fatal => .fatal,
        .done, .complete => if (current == .fatal) current else next,
        .open => current,
    };
}

/// Accumulates one turn. Create per turn, feed it frames, then `finish()`.
pub const Decoder = struct {
    allocator: std.mem.Allocator,
    table: *const descriptor.Descriptor,
    sink: provider.StreamSink,
    hooks: ?HookRunner = null,

    text: std.ArrayList(u8) = .empty,
    calls: std.ArrayList(ToolCall) = .empty,
    finish_reason: []const u8 = "stop",
    usage_input: i64 = 0,
    usage_output: i64 = 0,
    fatal_message: ?[]const u8 = null,

    pub fn init(
        allocator: std.mem.Allocator,
        table: *const descriptor.Descriptor,
        sink: provider.StreamSink,
        hooks: ?HookRunner,
    ) Decoder {
        return .{ .allocator = allocator, .table = table, .sink = sink, .hooks = hooks };
    }

    /// Feed one transport frame: an SSE line, or a whole WebSocket message.
    /// Framing is applied first, so callers hand over bytes without knowing
    /// which convention the vendor uses.
    pub fn feed(self: *Decoder, frame: []const u8) !Outcome {
        var payload = std.mem.trim(u8, frame, " \r\n");
        if (payload.len == 0) return .open;

        if (self.table.framing.prefix) |prefix| {
            if (!std.mem.startsWith(u8, payload, prefix)) return .open;
            payload = std.mem.trim(u8, payload[prefix.len..], " ");
        }
        if (self.table.framing.done) |sentinel| {
            if (std.mem.eql(u8, payload, sentinel)) return .done;
        }
        if (payload.len == 0) return .open;

        var parsed = std.json.parseFromSlice(std.json.Value, self.allocator, payload, .{}) catch
            return error.VendorEventNotJson;
        defer parsed.deinit();

        return self.apply(parsed.value);
    }

    /// Run the table against one already-parsed event.
    pub fn apply(self: *Decoder, event: std.json.Value) !Outcome {
        var outcome: Outcome = .open;

        if (self.table.always) |*rule| {
            outcome = worse(outcome, try self.runRule(rule, event));
        }

        if (self.table.event_type) |path| {
            const event_type = resolveStr(event, path) orelse return outcome;
            const rule = self.table.ruleFor(event_type) orelse return outcome;
            outcome = worse(outcome, try self.runRule(rule, event));
        }
        return outcome;
    }

    fn runRule(self: *Decoder, rule: *const descriptor.Rule, event: std.json.Value) anyerror!Outcome {
        switch (rule.*) {
            .list => |items| {
                var outcome: Outcome = .open;
                for (items) |*item| {
                    outcome = worse(outcome, try self.runRule(item, event));
                }
                return outcome;
            },
            .each => |each| {
                const target = resolve(event, each.path) orelse return .open;
                if (target != .array) return .open;
                var outcome: Outcome = .open;
                for (target.array.items) |item| {
                    outcome = worse(outcome, try self.runRule(each.rule, item));
                }
                return outcome;
            },
            .branch => |branch| {
                const discriminator = resolveStr(event, branch.when) orelse
                    return if (branch.default) |d| self.runRule(d, event) else .open;
                for (branch.case_values, 0..) |value, i| {
                    if (std.mem.eql(u8, value, discriminator)) {
                        return self.runRule(&branch.case_rules[i], event);
                    }
                }
                return if (branch.default) |d| self.runRule(d, event) else .open;
            },
            .emit => |emit| return self.runEmit(emit, event),
        }
    }

    fn runEmit(self: *Decoder, emit: descriptor.Emit, event: std.json.Value) !Outcome {
        const a = self.allocator;
        switch (emit) {
            .ignore => {},

            .turn_end => return .complete,

            .text_delta => |spec| {
                const text = resolveStr(event, spec.text) orelse return .open;
                if (text.len == 0) return .open;
                try self.text.appendSlice(a, text);
                try self.sink.emit(try provider.textDelta(a, text));
            },

            .tool_call_begin => |spec| {
                var key_buf: [32]u8 = undefined;
                const key = resolveKey(&key_buf, event, spec.call_key) orelse return .open;
                const call = try self.callFor(key);
                if (spec.id) |p| {
                    if (resolveStr(event, p)) |v| call.id = try a.dupe(u8, v);
                }
                if (spec.name) |p| {
                    if (resolveStr(event, p)) |v| call.name = try a.dupe(u8, v);
                }
            },

            .tool_call_delta => |spec| {
                var key_buf: [32]u8 = undefined;
                const key = resolveKey(&key_buf, event, spec.call_key) orelse return .open;
                const call = try self.callFor(key);
                // A delta may also be the first sighting of the call, so
                // identity fields are picked up here too when present.
                if (spec.id) |p| {
                    if (resolveStr(event, p)) |v| {
                        if (call.id.len == 0) call.id = try a.dupe(u8, v);
                    }
                }
                if (spec.name) |p| {
                    if (resolveStr(event, p)) |v| {
                        if (call.name.len == 0) call.name = try a.dupe(u8, v);
                    }
                }
                const fragment = resolveStr(event, spec.args_text) orelse return .open;
                if (fragment.len == 0) return .open;
                try call.arguments.appendSlice(a, fragment);
                try self.sink.emit(try provider.toolCallDelta(a, call.id, call.name, fragment));
            },

            .tool_call_ready => |spec| {
                const id = resolveStr(event, spec.id) orelse "";
                const name = resolveStr(event, spec.name) orelse "";
                const args = resolveStr(event, spec.args) orelse "{}";
                const call = try self.callFor(id);
                call.id = try a.dupe(u8, id);
                call.name = try a.dupe(u8, name);
                call.arguments.clearRetainingCapacity();
                try call.arguments.appendSlice(a, args);
                try self.sink.emit(try provider.toolCallReady(a, .{
                    .id = call.id,
                    .name = call.name,
                    .args_json = call.arguments.items,
                }));
            },

            .usage => |spec| {
                if (spec.input) |p| {
                    if (resolveInt(event, p)) |n| self.usage_input = n;
                }
                if (spec.output) |p| {
                    if (resolveInt(event, p)) |n| self.usage_output = n;
                }
            },

            .finish => |spec| {
                if (spec.reason) |p| {
                    if (resolveStr(event, p)) |reason| self.finish_reason = try a.dupe(u8, reason);
                }
            },

            .fatal => |spec| {
                self.fatal_message = if (spec.message) |p|
                    if (resolveStr(event, p)) |m| try a.dupe(u8, m) else null
                else
                    null;
                return .fatal;
            },

            .hook => |name| {
                const runner = self.hooks orelse return error.HookRunnerMissing;
                const event_json = try std.json.Stringify.valueAlloc(a, event, .{});
                const reply = try runner.run(runner.context, name, event_json);
                try self.applyHookReply(reply);
            },
        }
        return .open;
    }

    /// A hook returns the same uniform events the table emits, as
    /// `{"events":[...]}`. Applying them here keeps one accumulator for the
    /// turn no matter which path produced an event.
    fn applyHookReply(self: *Decoder, reply: []const u8) !void {
        const a = self.allocator;
        var parsed = std.json.parseFromSlice(std.json.Value, a, reply, .{}) catch
            return error.HookReplyNotJson;
        defer parsed.deinit();

        const events = provider.arrField(parsed.value, "events") orelse return error.HookReplyInvalid;
        for (events) |ev| {
            const kind = provider.strField(ev, "type") orelse continue;
            if (std.mem.eql(u8, kind, "text.total")) {
                const text = provider.strField(ev, "text") orelse "";
                // Terminal events carry the whole turn, not a fragment: replace
                // rather than append, or a stream that also sent deltas would
                // double its own text.
                self.text.clearRetainingCapacity();
                try self.text.appendSlice(a, text);
            } else if (std.mem.eql(u8, kind, "text.delta")) {
                const text = provider.strField(ev, "text") orelse "";
                try self.text.appendSlice(a, text);
                try self.sink.emit(try provider.textDelta(a, text));
            } else if (std.mem.eql(u8, kind, "tool_call.ready")) {
                const id = provider.strField(ev, "id") orelse "";
                const call = try self.callFor(id);
                call.id = try a.dupe(u8, id);
                call.name = try a.dupe(u8, provider.strField(ev, "name") orelse "");
                call.arguments.clearRetainingCapacity();
                try call.arguments.appendSlice(a, provider.strField(ev, "args") orelse "{}");
            } else if (std.mem.eql(u8, kind, "usage")) {
                if (provider.intField(ev, "inputTokens")) |n| self.usage_input = n;
                if (provider.intField(ev, "outputTokens")) |n| self.usage_output = n;
            } else if (std.mem.eql(u8, kind, "finish")) {
                if (provider.strField(ev, "finishReason")) |r| self.finish_reason = try a.dupe(u8, r);
            }
        }
    }

    fn callFor(self: *Decoder, key: []const u8) !*ToolCall {
        for (self.calls.items) |*call| {
            if (std.mem.eql(u8, call.key, key)) return call;
        }
        try self.calls.append(self.allocator, .{ .key = try self.allocator.dupe(u8, key) });
        return &self.calls.items[self.calls.items.len - 1];
    }

    /// The accumulated turn. Borrows the decoder's arena-backed buffers.
    pub fn finish(self: *Decoder) !provider.Completion {
        const calls = try self.allocator.alloc(provider.ToolCall, self.calls.items.len);
        for (self.calls.items, 0..) |call, i| {
            calls[i] = .{ .id = call.id, .name = call.name, .args_json = call.arguments.items };
        }
        return .{
            .text = self.text.items,
            .tool_calls = calls,
            .finish_reason = self.finish_reason,
            .usage_input = self.usage_input,
            .usage_output = self.usage_output,
        };
    }
};

// ---- tests ------------------------------------------------------------------
//
// These run against the real artifacts emitted by `resonus-providers`, not
// against hand-written fixtures: a table that parses here is the same bytes the
// core loads at startup, so the descriptor format cannot drift from its reader.

const testing = std.testing;

const anthropic_table = @embedFile("table:anthropic");
const openai_table = @embedFile("table:openai");
const realtime_table = @embedFile("table:openai-realtime");

const Collector = struct {
    events: std.ArrayList([]const u8) = .empty,
    allocator: std.mem.Allocator,

    fn sink(self: *Collector) provider.StreamSink {
        return .{ .context = self, .emit_fn = emit };
    }

    fn emit(context: *anyopaque, event_json: []const u8) anyerror!void {
        const self: *Collector = @ptrCast(@alignCast(context));
        try self.events.append(self.allocator, event_json);
    }

    fn contains(self: *const Collector, needle: []const u8) bool {
        for (self.events.items) |event| {
            if (std.mem.indexOf(u8, event, needle) != null) return true;
        }
        return false;
    }
};

test "anthropic: a streamed turn with text and a tool call" {
    var arena = std.heap.ArenaAllocator.init(testing.allocator);
    defer arena.deinit();
    const a = arena.allocator();

    var table = try descriptor.parse(a, anthropic_table);
    defer table.deinit();
    try testing.expectEqualStrings("anthropic", table.name);
    try testing.expect(!table.transport.stateful);

    var collector = Collector{ .allocator = a };
    var decoder = Decoder.init(a, &table, collector.sink(), null);

    const frames = [_][]const u8{
        \\data: {"type":"message_start","message":{"usage":{"input_tokens":11}}}
        ,
        \\data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hel"}}
        ,
        \\data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"lo"}}
        ,
        \\data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"tu_1","name":"clock"}}
        ,
        \\data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\"tz\":"}}
        ,
        \\data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"\"UTC\"}"}}
        ,
        \\data: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":7}}
        ,
    };
    for (frames) |frame| try testing.expectEqual(Outcome.open, try decoder.feed(frame));

    const completion = try decoder.finish();
    try testing.expectEqualStrings("Hello", completion.text);
    try testing.expectEqualStrings("tool_use", completion.finish_reason);
    try testing.expectEqual(@as(i64, 11), completion.usage_input);
    try testing.expectEqual(@as(i64, 7), completion.usage_output);

    // The two argument fragments are correlated by block index, and the
    // identity from content_block_start survives onto the accumulated call.
    try testing.expectEqual(@as(usize, 1), completion.tool_calls.len);
    try testing.expectEqualStrings("tu_1", completion.tool_calls[0].id);
    try testing.expectEqualStrings("clock", completion.tool_calls[0].name);
    try testing.expectEqualStrings("{\"tz\":\"UTC\"}", completion.tool_calls[0].args_json);

    try testing.expect(collector.contains("\"type\":\"text.delta\""));
    try testing.expect(collector.contains("\"type\":\"tool_call.delta\""));
}

test "anthropic: a non-data line and an error event" {
    var arena = std.heap.ArenaAllocator.init(testing.allocator);
    defer arena.deinit();
    const a = arena.allocator();

    var table = try descriptor.parse(a, anthropic_table);
    defer table.deinit();
    var collector = Collector{ .allocator = a };
    var decoder = Decoder.init(a, &table, collector.sink(), null);

    // SSE comment/event lines carry no payload and must not reach the parser.
    try testing.expectEqual(Outcome.open, try decoder.feed("event: message_start"));
    try testing.expectEqual(Outcome.open, try decoder.feed(""));

    const outcome = try decoder.feed(
        \\data: {"type":"error","error":{"message":"overloaded"}}
    );
    try testing.expectEqual(Outcome.fatal, outcome);
    try testing.expectEqualStrings("overloaded", decoder.fatal_message.?);
}

test "openai: frames have no discriminator, tool calls come as an array" {
    var arena = std.heap.ArenaAllocator.init(testing.allocator);
    defer arena.deinit();
    const a = arena.allocator();

    var table = try descriptor.parse(a, openai_table);
    defer table.deinit();
    try testing.expect(table.event_type == null);

    var collector = Collector{ .allocator = a };
    var decoder = Decoder.init(a, &table, collector.sink(), null);

    const frames = [_][]const u8{
        \\data: {"choices":[{"delta":{"content":"Hi"}}]}
        ,
        \\data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"f","arguments":"{\"x\":"}}]}}]}
        ,
        \\data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"1}"}}]}}]}
        ,
        \\data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":5,"completion_tokens":9}}
        ,
    };
    for (frames) |frame| try testing.expectEqual(Outcome.open, try decoder.feed(frame));

    // The sentinel ends the stream without being decoded.
    try testing.expectEqual(Outcome.done, try decoder.feed("data: [DONE]"));

    const completion = try decoder.finish();
    try testing.expectEqualStrings("Hi", completion.text);
    try testing.expectEqualStrings("tool_calls", completion.finish_reason);
    try testing.expectEqual(@as(i64, 5), completion.usage_input);
    try testing.expectEqual(@as(i64, 9), completion.usage_output);
    try testing.expectEqual(@as(usize, 1), completion.tool_calls.len);
    try testing.expectEqualStrings("c1", completion.tool_calls[0].id);
    try testing.expectEqualStrings("f", completion.tool_calls[0].name);
    try testing.expectEqualStrings("{\"x\":1}", completion.tool_calls[0].args_json);
}

/// Stands in for the QuickJS runner so the escape hatch can be exercised
/// without a JS engine in the test binary.
const StubHooks = struct {
    called: []const u8 = "",
    reply: []const u8,

    fn runner(self: *StubHooks) HookRunner {
        return .{ .context = self, .run = run };
    }

    fn run(context: *anyopaque, hook: []const u8, event_json: []const u8) anyerror![]const u8 {
        const self: *StubHooks = @ptrCast(@alignCast(context));
        _ = event_json;
        self.called = hook;
        return self.reply;
    }
};

test "realtime: a WebSocket turn, with response.done routed to a hook" {
    var arena = std.heap.ArenaAllocator.init(testing.allocator);
    defer arena.deinit();
    const a = arena.allocator();

    var table = try descriptor.parse(a, realtime_table);
    defer table.deinit();
    try testing.expect(table.transport.stateful);
    try testing.expectEqual(descriptor.Transport.Kind.ws, table.transport.kind);
    try testing.expect(table.framing.prefix == null);
    try testing.expect(table.hasHook("decodeDone"));

    var collector = Collector{ .allocator = a };
    var stub = StubHooks{ .reply = 
        \\{"events":[{"type":"text.total","text":"Hello"},
        \\{"type":"tool_call.ready","id":"c9","name":"f","args":"{\"a\":1}"},
        \\{"type":"usage","inputTokens":3,"outputTokens":4},
        \\{"type":"finish","finishReason":"stop"}]}
    };
    var decoder = Decoder.init(a, &table, collector.sink(), stub.runner());

    // Frames arrive whole, with no `data:` prefix to strip.
    _ = try decoder.feed(
        \\{"type":"response.output_text.delta","delta":"Hel"}
    );
    _ = try decoder.feed(
        \\{"type":"response.output_text.delta","delta":"lo"}
    );
    _ = try decoder.feed(
        \\{"type":"response.done","response":{}}
    );

    try testing.expectEqualStrings("decodeDone", stub.called);

    const completion = try decoder.finish();
    // The terminal hook replaces the streamed text rather than appending to it.
    try testing.expectEqualStrings("Hello", completion.text);
    try testing.expectEqual(@as(i64, 3), completion.usage_input);
    try testing.expectEqual(@as(usize, 1), completion.tool_calls.len);
    try testing.expectEqualStrings("c9", completion.tool_calls[0].id);
}

test "realtime: an unknown event type is ignored, not an error" {
    var arena = std.heap.ArenaAllocator.init(testing.allocator);
    defer arena.deinit();
    const a = arena.allocator();

    var table = try descriptor.parse(a, realtime_table);
    defer table.deinit();
    var collector = Collector{ .allocator = a };
    var decoder = Decoder.init(a, &table, collector.sink(), null);

    const outcome = try decoder.feed(
        \\{"type":"rate_limits.updated","rate_limits":[]}
    );
    try testing.expectEqual(Outcome.open, outcome);
    try testing.expectEqual(@as(usize, 0), collector.events.items.len);
}

test "a descriptor built for another contract version is refused" {
    const wrong =
        \\{"apiVersion":99,"name":"x","transport":{"kind":"https","stateful":false,"url":"u"},
        \\"decode":{"always":{"emit":"ignore"}},"hooks":[]}
    ;
    try testing.expectError(
        error.DescriptorVersionUnsupported,
        descriptor.parse(testing.allocator, wrong),
    );
}

test "stateful must be stated, never inferred" {
    const missing =
        \\{"apiVersion":1,"name":"x","transport":{"kind":"ws","url":"u"},
        \\"decode":{"always":{"emit":"ignore"}},"hooks":[]}
    ;
    try testing.expectError(
        error.DescriptorFieldMissing,
        descriptor.parse(testing.allocator, missing),
    );
}

test "path resolution walks objects and array indices" {
    var arena = std.heap.ArenaAllocator.init(testing.allocator);
    defer arena.deinit();
    const a = arena.allocator();

    const doc = try std.json.parseFromSliceLeaky(std.json.Value, a,
        \\{"choices":[{"delta":{"content":"x"}},{"delta":{"content":"y"}}],"nil":null}
    , .{});

    const first: descriptor.Path = &.{ "choices", "0", "delta", "content" };
    const second: descriptor.Path = &.{ "choices", "1", "delta", "content" };
    const past_end: descriptor.Path = &.{ "choices", "9", "delta" };
    const explicit_null: descriptor.Path = &.{"nil"};

    try testing.expectEqualStrings("x", resolve(doc, first).?.string);
    try testing.expectEqualStrings("y", resolve(doc, second).?.string);
    try testing.expect(resolve(doc, past_end) == null);
    // An explicit JSON null reads as absent: vendors use both to mean the same.
    try testing.expect(resolve(doc, explicit_null) == null);
}
