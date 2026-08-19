//! OpenAI Realtime text adapter with session-affine WebSocket pools.
//!
//! Every configured model owns a pool of empty, authenticated WSS sessions.
//! A session is leased by a chat `sessionId` on its first turn and remains
//! attached to that conversation. The external protocol remains the provider
//! neutral StreamSink contract used by the SSE adapters.

const std = @import("std");
const provider = @import("provider.zig");
const protocol = @import("openai_realtime/protocol.zig");

test {
    _ = protocol;
}

const c = @cImport({
    @cInclude("libdatachannel_wrapper.h");
});

const Mutex = struct {
    raw: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,

    fn lock(self: *Mutex) void {
        _ = std.c.pthread_mutex_lock(&self.raw);
    }

    fn unlock(self: *Mutex) void {
        _ = std.c.pthread_mutex_unlock(&self.raw);
    }
};

const Condvar = struct {
    raw: std.c.pthread_cond_t = std.c.PTHREAD_COND_INITIALIZER,

    fn wait(self: *Condvar, mutex: *Mutex) void {
        _ = std.c.pthread_cond_wait(&self.raw, &mutex.raw);
    }

    fn broadcast(self: *Condvar) void {
        _ = std.c.pthread_cond_broadcast(&self.raw);
    }
};

fn sleepMs(ms: u64) void {
    var delay = std.c.timespec{
        .sec = @intCast(ms / std.time.ms_per_s),
        .nsec = @intCast((ms % std.time.ms_per_s) * std.time.ns_per_ms),
    };
    _ = std.c.nanosleep(&delay, &delay);
}

// std.time.Timer / milliTimestamp were removed in zig 0.16; go straight to
// the monotonic clock for turn-timing logs.
fn monotonicMs() i64 {
    var ts: std.c.timespec = undefined;
    _ = std.c.clock_gettime(.MONOTONIC, &ts);
    return @as(i64, ts.sec) * 1000 + @divTrunc(@as(i64, ts.nsec), std.time.ns_per_ms);
}

pub const Config = struct {
    api_key: []const u8,
    base_url: []const u8 = "wss://api.openai.com/v1/realtime",
    idle_per_model: usize = 3,
};

pub fn make(pool: *Pool) provider.Provider {
    return .{ .name = "openai-realtime", .ctx = pool, .complete = unsupportedComplete, .stream = stream };
}

fn unsupportedComplete(_: *anyopaque, env: provider.CallEnv, _: provider.ChatRequest) anyerror!provider.Reply {
    return provider.errReply(env.alloc, "openai-realtime requires the streaming transport", .{});
}

fn stream(ctx: *anyopaque, env: provider.CallEnv, req: provider.ChatRequest, sink: provider.StreamSink) anyerror!provider.Completion {
    const pool: *Pool = @ptrCast(@alignCast(ctx));
    return pool.stream(env.alloc, req.session_id orelse return error.RealtimeSessionIdMissing, req, sink);
}

pub const Pool = struct {
    allocator: std.mem.Allocator,
    // libdatachannel invokes callbacks and the idle-session refill on native
    // threads. `init.gpa` is not safe to use from those threads, so every
    // Session owns its callback queue through the process-wide C allocator.
    session_allocator: std.mem.Allocator = std.heap.c_allocator,
    config: Config,
    models: std.ArrayList(*ModelPool) = .empty,

    pub fn init(allocator: std.mem.Allocator, config: Config, fast_model: []const u8, heavy_model: ?[]const u8) !Pool {
        var self = Pool{ .allocator = allocator, .config = config };
        errdefer self.deinit();
        try self.addModel(fast_model);
        if (heavy_model) |model| {
            if (!std.mem.eql(u8, model, fast_model)) try self.addModel(model);
        }
        for (self.models.items) |model| try self.fill(model);
        return self;
    }

    pub fn deinit(self: *Pool) void {
        for (self.models.items) |model| {
            for (model.idle.items) |session| session.deinit();
            var active = model.active.iterator();
            while (active.next()) |entry| {
                self.allocator.free(entry.key_ptr.*);
                entry.value_ptr.*.deinit();
            }
            model.active.deinit(self.allocator);
            model.idle.deinit(self.allocator);
            self.allocator.free(model.name);
            self.allocator.destroy(model);
        }
        self.models.deinit(self.allocator);
        self.* = undefined;
    }

    /// `Pool.init` returns a value so its address changes when Hub places it in
    /// the long-lived allocation. Rebind the model back-references after that
    /// move; refill workers must never retain the temporary stack address.
    pub fn rebindModelOwners(self: *Pool) void {
        for (self.models.items) |model| model.pool = self;
    }

    pub fn stream(self: *Pool, allocator: std.mem.Allocator, session_id: []const u8, req: provider.ChatRequest, sink: provider.StreamSink) !provider.Completion {
        const model = self.findModel(req.model) orelse return error.RealtimeModelNotConfigured;
        // One retry on a freshly reconnected session: the leased socket can
        // die between the lease() liveness check and the send (vendor-side
        // idle close, network blip). Without this the *current* turn still
        // fails even though the pool would have healed itself for the next
        // one — see the eviction logic in `lease`.
        var attempt: u8 = 0;
        while (true) : (attempt += 1) {
            const session = try self.lease(model, session_id);
            const result = session.stream(allocator, session_id, req, sink);
            if (result) |completion| return completion else |err| {
                if (err == error.RealtimeSessionClosed and attempt == 0) {
                    std.debug.print("resonus: chat={s} model={s}: session died mid-turn, reconnecting and retrying once\n", .{ session_id, model.name });
                    self.evict(model, session_id);
                    continue;
                }
                return err;
            }
        }
    }

    /// Explicit control-plane acquire. The command layer calls this before a
    /// generation so a logical session, not an incidental chat request, owns
    /// the model binding.
    pub fn bind(self: *Pool, model_name: []const u8, session_id: []const u8) !void {
        const model = self.findModel(model_name) orelse return error.RealtimeModelNotConfigured;
        _ = try self.lease(model, session_id);
    }

    /// A logical session can own one binding in every configured model pool.
    /// Closing it must release all of them; leaving this work to a future
    /// request was the source of the unbounded active map.
    pub fn releaseSession(self: *Pool, session_id: []const u8) void {
        for (self.models.items) |model| self.evict(model, session_id);
    }

    fn evict(self: *Pool, model: *ModelPool, session_id: []const u8) void {
        model.mutex.lock();
        const removed = model.active.fetchRemove(session_id);
        model.mutex.unlock();
        if (removed) |kv| {
            self.allocator.free(kv.key);
            kv.value.deinit();
        }
    }

    fn addModel(self: *Pool, name: []const u8) !void {
        const model = try self.allocator.create(ModelPool);
        errdefer self.allocator.destroy(model);
        const owned_name = try self.allocator.dupe(u8, name);
        errdefer self.allocator.free(owned_name);
        model.* = .{ .pool = self, .name = owned_name };
        try self.models.append(self.allocator, model);
    }

    fn findModel(self: *Pool, name: []const u8) ?*ModelPool {
        for (self.models.items) |model| {
            if (std.mem.eql(u8, model.name, name)) return model;
        }
        return null;
    }

    fn fill(self: *Pool, model: *ModelPool) !void {
        var created: usize = 0;
        while (created < self.config.idle_per_model) : (created += 1) {
            const session = try Session.create(self.session_allocator, self.config, model.name);
            model.idle.append(self.allocator, session) catch |err| {
                session.deinit();
                return err;
            };
        }
    }

    fn lease(self: *Pool, model: *ModelPool, session_id: []const u8) !*Session {
        const session = blk: while (true) {
            model.mutex.lock();
            if (model.active.get(session_id)) |active| {
                active.mutex.lock();
                const alive = active.handle != null and !active.closed;
                active.mutex.unlock();
                if (alive) {
                    model.mutex.unlock();
                    return active;
                }
                model.mutex.unlock();
                // The realtime socket died between turns (vendor-side idle
                // close, network drop, ...). Drop it before acquiring a
                // replacement from the pool.
                std.debug.print("resonus: chat={s} model={s}: leased session was dead, reconnecting\n", .{ session_id, model.name });
                self.evict(model, session_id);
                continue;
            }
            if (model.idle.pop()) |idle| {
                model.mutex.unlock();
                break :blk idle;
            }

            // Do not let every caller open a websocket when the warm pool is
            // depleted. One worker creates a fully initialized session; all
            // waiters wake only after it has either joined the pool or failed.
            const start_refill = !model.refilling;
            const generation = if (start_refill) new_refill: {
                model.refilling = true;
                model.refill_generation += 1;
                break :new_refill model.refill_generation;
            } else model.refill_generation;
            model.mutex.unlock();
            if (start_refill) {
                const thread = std.Thread.spawn(.{}, refillWorker, .{model}) catch {
                    model.mutex.lock();
                    model.refilling = false;
                    model.refill_failed_generation = generation;
                    model.ready.broadcast();
                    model.mutex.unlock();
                    return error.RealtimePoolRefillUnavailable;
                };
                thread.detach();
            }

            model.mutex.lock();
            while (model.refilling and model.refill_generation == generation) model.ready.wait(&model.mutex);
            const failed = model.refill_failed_generation == generation;
            model.mutex.unlock();
            if (failed) return error.RealtimePoolRefillFailed;
        };
        std.debug.print("resonus: chat={s} model={s}: leased {s} session (socket={d})\n", .{
            session_id, model.name, "idle", session.socket_id,
        });
        const session_key = self.allocator.dupe(u8, session_id) catch |err| {
            session.deinit();
            return err;
        };
        errdefer self.allocator.free(session_key);

        model.mutex.lock();
        if (model.active.get(session_id)) |existing| {
            model.mutex.unlock();
            self.allocator.free(session_key);
            session.deinit();
            return existing;
        }
        model.active.put(self.allocator, session_key, session) catch |err| {
            model.mutex.unlock();
            session.deinit();
            return err;
        };
        model.mutex.unlock();
        self.replenish(model);
        return session;
    }

    fn replenish(self: *Pool, model: *ModelPool) void {
        _ = self;
        model.mutex.lock();
        if (model.refilling or model.idle.items.len >= model.pool.config.idle_per_model) {
            model.mutex.unlock();
            return;
        }
        model.refilling = true;
        model.refill_generation += 1;
        const generation = model.refill_generation;
        model.mutex.unlock();
        const thread = std.Thread.spawn(.{}, refillWorker, .{model}) catch {
            model.mutex.lock();
            model.refilling = false;
            model.refill_failed_generation = generation;
            model.ready.broadcast();
            model.mutex.unlock();
            return;
        };
        thread.detach();
    }

    fn refillWorker(model: *ModelPool) void {
        const session = Session.create(model.pool.session_allocator, model.pool.config, model.name) catch {
            model.mutex.lock();
            model.refilling = false;
            model.refill_failed_generation = model.refill_generation;
            model.ready.broadcast();
            model.mutex.unlock();
            return;
        };
        model.mutex.lock();
        defer model.mutex.unlock();
        model.refilling = false;
        if (model.idle.items.len < model.pool.config.idle_per_model) {
            model.idle.append(model.pool.allocator, session) catch session.deinit();
        } else session.deinit();
        model.ready.broadcast();
    }
};

const ModelPool = struct {
    pool: *Pool,
    name: []u8,
    mutex: Mutex = .{},
    idle: std.ArrayList(*Session) = .empty,
    active: std.StringHashMapUnmanaged(*Session) = .{},
    refilling: bool = false,
    refill_generation: usize = 0,
    refill_failed_generation: ?usize = null,
    ready: Condvar = .{},
};

test "pool model owners are rebound after value move" {
    const source = try Pool.init(std.testing.allocator, .{
        .api_key = "test-key",
        .idle_per_model = 0,
    }, "fast", "heavy");
    const moved = try std.testing.allocator.create(Pool);
    moved.* = source;
    moved.rebindModelOwners();
    defer moved.deinit();
    defer std.testing.allocator.destroy(moved);

    for (moved.models.items) |model| try std.testing.expectEqual(moved, model.pool);
}

const Session = struct {
    allocator: std.mem.Allocator,
    model: []const u8 = "",
    handle: ?*c.ldc_wrapper_t = null,
    socket_id: i32 = -1,
    mutex: Mutex = .{},
    request_mutex: Mutex = .{},
    opened: bool = false,
    closed: bool = false,
    opened_at_ms: i64 = 0,
    turns: u32 = 0,
    events: std.ArrayList([]u8) = .empty,
    /// Last transport-level error reported by libdatachannel (TLS/handshake/
    /// protocol failures, vendor-side resets, ...). These never surface as a
    /// `{"type":"error"}` application event, so without this the connection
    /// just silently dies with no clue why.
    last_error: ?[]u8 = null,

    fn create(allocator: std.mem.Allocator, config: Config, model: []const u8) !*Session {
        const self = try allocator.create(Session);
        self.* = .{ .allocator = allocator, .model = model };
        errdefer allocator.destroy(self);

        var handle: ?*c.ldc_wrapper_t = null;
        if (c.ldc_wrapper_create(&handle, null) != 0 or handle == null)
            return error.RealtimeWrapperUnavailable;
        self.handle = handle;
        errdefer c.ldc_wrapper_destroy(handle.?);

        const url_text = try std.fmt.allocPrint(allocator, "{s}?model={s}", .{ config.base_url, model });
        defer allocator.free(url_text);
        const url = try allocator.dupeZ(u8, url_text);
        defer allocator.free(url);
        const auth_text = try std.fmt.allocPrint(allocator, "Bearer {s}", .{config.api_key});
        defer allocator.free(auth_text);
        const auth = try allocator.dupeZ(u8, auth_text);
        defer allocator.free(auth);
        var socket_id: i32 = -1;
        if (c.ldc_create_websocket_with_header(handle.?, url.ptr, "Authorization", auth.ptr, &socket_id) != 0)
            return error.RealtimeConnectFailed;
        self.socket_id = socket_id;
        errdefer _ = c.ldc_delete_id(handle.?, socket_id);
        if (c.ldc_set_open_callback(handle.?, socket_id, openedCallback, self) != 0 or
            c.ldc_set_closed_callback(handle.?, socket_id, closedCallback, self) != 0 or
            c.ldc_set_error_callback(handle.?, socket_id, errorCallback, self) != 0 or
            c.ldc_set_message_callback(handle.?, socket_id, messageCallback, self) != 0)
            return error.RealtimeCallbackFailed;

        self.waitOpen(10_000) catch |err| {
            std.debug.print("resonus: model={s} socket={d}: connect failed: {s} ({s})\n", .{
                model, socket_id, @errorName(err), self.last_error orelse "no transport error reported",
            });
            return err;
        };

        // WS OPEN is not the same as "Realtime session ready": the vendor
        // session comes up in its default audio/server-VAD shape and only
        // reconfigures on our explicit session.update. Handing the socket to
        // the pool before that handshake finishes is what let turn 2 race a
        // still-audio session and get a clean vendor-initiated close.
        self.waitForEventType(allocator, "session.created", 10_000) catch |err| {
            std.debug.print("resonus: model={s} socket={d}: never received session.created: {s}\n", .{ model, socket_id, @errorName(err) });
            return err;
        };

        // BISECT: the migration to resonus added the `session.update` handshake
        // below (centimanus never sent it and its first turn worked). The socket
        // now dies ~308ms after OPEN, before `session.updated`. Flip this to
        // `false` to keep the new handshake. With it `true` we go straight from
        // `session.created` to READY like centimanus did — if the socket then
        // survives and a turn completes, the killer is `session.update`, not the
        // pool/lifecycle.
        const bisect_skip_session_update = false;
        if (!bisect_skip_session_update) {
            const update_payload = try protocol.sessionUpdateText(allocator);
            defer allocator.free(update_payload);
            if (c.ldc_send_message(handle.?, socket_id, update_payload.ptr, update_payload.len) != 0)
                return error.RealtimeSendFailed;

            self.waitForEventType(allocator, "session.updated", 10_000) catch |err| {
                std.debug.print("resonus: model={s} socket={d}: session.update rejected: {s}\n", .{ model, socket_id, @errorName(err) });
                return err;
            };
        } else {
            std.debug.print("resonus: model={s} socket={d}: BISECT skipping session.update handshake\n", .{ model, socket_id });
        }

        std.debug.print("resonus: model={s} socket={d}: session READY (text-only)\n", .{ model, socket_id });
        return self;
    }

    fn deinit(self: *Session) void {
        if (self.handle) |handle| {
            if (self.socket_id >= 0) _ = c.ldc_delete_id(handle, self.socket_id);
            c.ldc_wrapper_destroy(handle);
        }
        for (self.events.items) |event| self.allocator.free(event);
        self.events.deinit(self.allocator);
        if (self.last_error) |e| self.allocator.free(e);
        self.allocator.destroy(self);
    }

    fn waitOpen(self: *Session, timeout_ms: u64) !void {
        var waited: u64 = 0;
        while (waited < timeout_ms) : (waited += 5) {
            self.mutex.lock();
            const opened = self.opened;
            const closed = self.closed;
            self.mutex.unlock();
            if (opened) return;
            if (closed) return error.RealtimeClosedBeforeReady;
            sleepMs(5);
        }
        return error.RealtimeOpenTimedOut;
    }

    /// Drains setup-time events (before any turn is in flight) until one of
    /// type `expected` arrives. Anything else seen here (e.g. stray
    /// `rate_limits.updated`) is logged and discarded — only `response.create`
    /// turns care about the general event stream, handled by `pump`.
    fn waitForEventType(self: *Session, allocator: std.mem.Allocator, expected: []const u8, timeout_ms: u64) !void {
        var waited: u64 = 0;
        while (waited < timeout_ms) : (waited += 5) {
            if (self.takeEvent()) |raw_event| {
                defer self.allocator.free(raw_event);
                const parsed = std.json.parseFromSlice(std.json.Value, allocator, raw_event, .{}) catch continue;
                defer parsed.deinit();
                const event_type = provider.strField(parsed.value, "type") orelse continue;
                if (std.mem.eql(u8, event_type, expected)) return;
                if (std.mem.eql(u8, event_type, "error")) {
                    std.debug.print("resonus: model={s} socket={d}: realtime error while waiting for {s}: {s}\n", .{ self.model, self.socket_id, expected, raw_event });
                    return error.RealtimeResponseFailed;
                }
                std.debug.print("resonus: model={s} socket={d}: setup recv (waiting for {s}) {s}\n", .{ self.model, self.socket_id, expected, raw_event });
                continue;
            }
            self.mutex.lock();
            const closed = self.closed;
            self.mutex.unlock();
            if (closed) return error.RealtimeClosedBeforeReady;
            sleepMs(5);
        }
        return error.RealtimeSessionSetupTimedOut;
    }

    fn stream(self: *Session, allocator: std.mem.Allocator, session_id: []const u8, req: provider.ChatRequest, sink: provider.StreamSink) !provider.Completion {
        self.request_mutex.lock();
        defer self.request_mutex.unlock();
        self.turns += 1;
        const turn = self.turns;
        const started = monotonicMs();
        std.debug.print("resonus: chat={s} model={s} turn={d} socket={d}: response.create ({d} messages)\n", .{
            session_id, self.model, turn, self.socket_id, req.messages.len,
        });

        const payload = try protocol.responseCreate(allocator, req);
        defer allocator.free(payload);
        // TEMP diagnostic: dump the exact wire payload so we can see what's
        // actually different about the request that kills the socket.
        std.debug.print("resonus: chat={s} turn={d}: payload ({d} bytes) = {s}\n", .{ session_id, turn, payload.len, payload });
        const handle = self.handle orelse return error.RealtimeSessionClosed;
        if (c.ldc_send_message(handle, self.socket_id, payload.ptr, payload.len) != 0) {
            std.debug.print("resonus: chat={s} turn={d}: ldc_send_message failed\n", .{ session_id, turn });
            return error.RealtimeSendFailed;
        }

        const result = self.pump(allocator, sink);
        const elapsed = monotonicMs() - started;
        if (result) |completion| {
            std.debug.print("resonus: chat={s} turn={d}: done in {d}ms ({d} in / {d} out tokens, finish={s})\n", .{
                session_id, turn, elapsed, completion.usage_input, completion.usage_output, completion.finish_reason,
            });
        } else |err| {
            std.debug.print("resonus: chat={s} turn={d}: failed after {d}ms: {s}{s}{s}\n", .{
                session_id,                                               turn,                      elapsed, @errorName(err),
                if (self.last_error != null) " transport_error=" else "", self.last_error orelse "",
            });
        }
        return result;
    }

    /// Drains parsed realtime events for the in-flight turn until completion,
    /// a vendor error, the socket closing, or the response timing out.
    fn pump(self: *Session, allocator: std.mem.Allocator, sink: provider.StreamSink) !provider.Completion {
        var text: std.ArrayList(u8) = .empty;
        var tool_calls: std.ArrayList(provider.ToolCall) = .empty;
        errdefer {
            for (tool_calls.items) |call| freeToolCall(allocator, call);
            tool_calls.deinit(allocator);
        }
        var waited: u64 = 0;
        while (waited < 120_000) : (waited += 2) {
            if (self.takeEvent()) |raw_event| {
                defer self.allocator.free(raw_event);
                var event = protocol.parseEvent(allocator, raw_event) catch continue;
                defer event.deinit(allocator);
                switch (event) {
                    .text_delta => |delta| {
                        try text.appendSlice(allocator, delta);
                        try sink.emit(try provider.textDelta(allocator, delta));
                    },
                    .tool_arguments_delta => |delta| try sink.emit(try provider.toolCallDelta(
                        allocator,
                        delta.call_id,
                        delta.name,
                        delta.delta,
                    )),
                    .tool_call_done => |call| {
                        if (!hasToolCall(tool_calls.items, call.id)) {
                            try tool_calls.append(allocator, call);
                            event = .ignored;
                        }
                    },
                    .api_error => {
                        std.debug.print("resonus: OpenAI Realtime application error: {s}\n", .{raw_event});
                        return error.RealtimeResponseFailed;
                    },
                    .ignored => std.debug.print("resonus: model={s} socket={d}: recv {s}\n", .{ self.model, self.socket_id, raw_event }),
                    .completed => |completed| {
                        // Most responses arrive as deltas, but Realtime may put
                        // a short text-only answer solely in response.done.
                        if (text.items.len == 0 and completed.text.len > 0) {
                            try text.appendSlice(allocator, completed.text);
                            try sink.emit(try provider.textDelta(allocator, completed.text));
                        }
                        allocator.free(completed.text);
                        for (completed.tool_calls) |call| {
                            if (hasToolCall(tool_calls.items, call.id)) {
                                freeToolCall(allocator, call);
                                continue;
                            }
                            tool_calls.append(allocator, call) catch |err| {
                                freeToolCall(allocator, call);
                                return err;
                            };
                        }
                        allocator.free(completed.tool_calls);
                        event = .ignored; // Transfer completion-owned data to the caller.
                        return .{
                            .text = text.items,
                            .tool_calls = tool_calls.items,
                            .finish_reason = if (tool_calls.items.len > 0) "tool_calls" else "stop",
                            .usage_input = completed.usage_input,
                            .usage_output = completed.usage_output,
                        };
                    },
                }
            }
            self.mutex.lock();
            const closed = self.closed;
            self.mutex.unlock();
            if (closed) return error.RealtimeSessionClosed;
            sleepMs(2);
        }
        return error.RealtimeResponseTimedOut;
    }

    fn takeEvent(self: *Session) ?[]u8 {
        self.mutex.lock();
        defer self.mutex.unlock();
        if (self.events.items.len == 0) return null;
        return self.events.orderedRemove(0);
    }

    fn openedCallback(socket_id: i32, context: ?*anyopaque) callconv(.c) void {
        const self: *Session = @ptrCast(@alignCast(context orelse return));
        self.mutex.lock();
        self.opened = true;
        self.opened_at_ms = monotonicMs();
        self.mutex.unlock();
        std.debug.print("resonus: model={s} socket={d}: channel OPEN\n", .{ self.model, socket_id });
    }

    fn closedCallback(socket_id: i32, context: ?*anyopaque) callconv(.c) void {
        const self: *Session = @ptrCast(@alignCast(context orelse return));
        self.mutex.lock();
        self.closed = true;
        const turns = self.turns;
        const last_error = self.last_error;
        const lifetime_ms = if (self.opened_at_ms != 0) monotonicMs() - self.opened_at_ms else -1;
        const handle = self.handle;
        self.mutex.unlock();
        // errorCallback only fires for some failure classes; ldc_last_error is
        // the wrapper's own handle-level diagnostic and can hold detail (e.g.
        // an HTTP status/close reason from libdatachannel) even when it didn't.
        const wrapper_error: [*:0]const u8 = if (handle) |h| c.ldc_last_error(h) else "";
        std.debug.print("resonus: model={s} socket={d}: channel CLOSE after {d}ms alive, {d} turn(s){s}{s} wrapper_last_error={s}\n", .{
            self.model,           socket_id,     lifetime_ms, turns,
            if (last_error != null) ", last transport error: " else " (no error callback fired — clean/vendor-initiated close)",
            last_error orelse "", wrapper_error,
        });
    }

    fn errorCallback(socket_id: i32, message: [*c]const u8, context: ?*anyopaque) callconv(.c) void {
        const self: *Session = @ptrCast(@alignCast(context orelse return));
        const text = std.mem.span(message);
        std.debug.print("resonus: model={s} socket={d}: realtime transport error: {s}\n", .{ self.model, socket_id, text });
        const owned = self.allocator.dupe(u8, text) catch return;
        self.mutex.lock();
        if (self.last_error) |old| self.allocator.free(old);
        self.last_error = owned;
        self.mutex.unlock();
    }

    fn messageCallback(_: i32, data: [*c]const u8, len: usize, context: ?*anyopaque) callconv(.c) void {
        const self: *Session = @ptrCast(@alignCast(context orelse return));
        const copy = self.allocator.dupe(u8, data[0..len]) catch return;
        self.mutex.lock();
        self.events.append(self.allocator, copy) catch self.allocator.free(copy);
        self.mutex.unlock();
    }
};

fn hasToolCall(calls: []const provider.ToolCall, id: []const u8) bool {
    if (id.len == 0) return false;
    for (calls) |call| {
        if (std.mem.eql(u8, call.id, id)) return true;
    }
    return false;
}

fn freeToolCall(allocator: std.mem.Allocator, call: provider.ToolCall) void {
    allocator.free(call.id);
    allocator.free(call.name);
    allocator.free(call.args_json);
}
