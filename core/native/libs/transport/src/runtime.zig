const std = @import("std");
const zimq = @import("zimq");
const control = @import("control.zig");
const endpoint = @import("endpoint.zig");
const envelope = @import("envelope.zig");

pub const Config = struct {
    endpoint: [:0]const u8,
    target: []const u8,
    limits: endpoint.Limits,
    recv_timeout_ms: i32 = 25,
    send_timeout_ms: i32 = 1_000,
    /// Number of handler threads. 0 = handlers run inline on the reactor
    /// thread (fine for fast, non-nested handlers). >0 dispatches inbound
    /// requests to a dedicated pool so a handler may block on a nested
    /// `call()` without stalling the socket. Use 1 to keep handlers
    /// single-threaded (nested calls safe, no shared-state races).
    workers: u32 = 0,
};

pub const Request = struct {
    envelope: envelope.Envelope,
    payload: []const u8,
};

pub const Response = struct {
    payload: []const u8,
    kind: envelope.Kind = .response,
    codec: ?envelope.PayloadCodec = null,
    method: ?[]const u8 = null,
    error_code: []const u8 = "",
    seq: u32 = 0,
    fin: bool = false,
    deferred: bool = false,
};

/// Owned addressing data for a reply that will be sent after the handler has
/// returned. This is the boundary between an app continuation and Runtime's
/// single polling loop.
pub const ReplyTarget = struct {
    request_id: []u8,
    to: envelope.Address,
    service: []u8,
    method: []u8,
    scope: []u8,
    user: []u8,
    codec: envelope.PayloadCodec,

    pub fn deinit(self: *ReplyTarget, allocator: std.mem.Allocator) void {
        allocator.free(self.request_id);
        allocator.free(self.to.target);
        allocator.free(self.to.service);
        allocator.free(self.service);
        allocator.free(self.method);
        allocator.free(self.scope);
        allocator.free(self.user);
        self.* = undefined;
    }
};

pub const Reply = struct {
    body: []u8,
    kind: envelope.Kind,
    error_code: []u8,

    pub fn ok(self: Reply) bool {
        return self.kind == .response;
    }

    pub fn deinit(self: *Reply, allocator: std.mem.Allocator) void {
        allocator.free(self.body);
        allocator.free(self.error_code);
        self.* = undefined;
    }
};

pub const Outgoing = struct {
    target: []const u8 = "services",
    service: []const u8,
    method: []const u8,
    scope: []const u8 = "",
    user: []const u8 = "",
    auth: []const u8 = "",
    body: []const u8,
    deadline_ms: u32 = 5_000,
};

pub const Completion = struct {
    context: *anyopaque,
    handle_fn: *const fn (*anyopaque, std.mem.Allocator, Reply) void,

    pub fn handle(self: Completion, allocator: std.mem.Allocator, reply: Reply) void {
        self.handle_fn(self.context, allocator, reply);
    }
};

pub const Handler = struct {
    context: *anyopaque,
    handle_fn: *const fn (*anyopaque, std.mem.Allocator, Request) anyerror!Response,

    pub fn handle(self: Handler, allocator: std.mem.Allocator, request: Request) !Response {
        return self.handle_fn(self.context, allocator, request);
    }
};

const Pending = struct {
    completion: Completion,
    deadline_ns: i128,
};

/// An already-encoded frame waiting for the reactor thread to put it on the
/// wire. Non-reactor threads never touch the DEALER socket; they enqueue here
/// and wake the reactor. Only `drainOutbound` (reactor thread) writes.
const Frame = struct {
    bytes: []u8,
    payload: []u8,
};

/// One inbound request handed to a worker thread. The worker owns the copied
/// bytes and frees them once the handler returns.
const Job = struct {
    envelope_bytes: []u8,
    payload: []u8,
};

/// One app-facing Fujin connection. The runtime owns the only DEALER socket
/// for the process and is the single thread that reads or writes it. All
/// services, incoming handlers and outbound NRPC replies are multiplexed on
/// that socket via a `zmq_poller`, keyed by service and request id.
pub const Runtime = struct {
    allocator: std.mem.Allocator,
    peer: endpoint.Peer,
    target: []u8,
    sequence: std.atomic.Value(u64) = .init(0),
    pending: std.StringHashMapUnmanaged(Pending) = .empty,
    pending_mutex: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,
    handlers: std.StringHashMapUnmanaged(Handler) = .empty,
    last_system_send_ns: i128 = 0,
    last_system_reply_ns: i128 = 0,
    system_registered: bool = false,

    poller: *zimq.Poller,
    wake_fd: i32,
    tick_ms: c_long,
    outbound: std.ArrayList(Frame) = .empty,
    outbound_mutex: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,

    /// False until the reactor loop (`poll`/`run`) starts. While false the
    /// process is single-threaded (init/bind), so sends go straight to the
    /// socket. Once true, every send funnels through `outbound` and only the
    /// reactor drains it — the single-writer discipline ZMQ requires.
    reactor_started: std.atomic.Value(bool) = .init(false),

    worker_count: u32,
    workers: []std.Thread = &.{},
    jobs: std.ArrayList(Job) = .empty,
    job_mutex: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,
    job_cond: std.c.pthread_cond_t = std.c.PTHREAD_COND_INITIALIZER,
    pool_shutdown: bool = false,

    pub fn init(allocator: std.mem.Allocator, config: Config) !Runtime {
        if (config.target.len == 0) return error.TargetRequired;
        var peer = try endpoint.Peer.initWithIdentity(config.endpoint, config.target, config.limits);
        errdefer peer.deinit();
        try peer.setRecvTimeoutMs(config.recv_timeout_ms);
        try peer.setSendTimeoutMs(config.send_timeout_ms);

        const poller = try zimq.Poller.init();
        errdefer poller.deinit();
        try poller.add(peer.socket, null, .in);

        const wake_rc = std.os.linux.eventfd(0, std.os.linux.EFD.NONBLOCK | std.os.linux.EFD.CLOEXEC);
        if (@as(isize, @bitCast(wake_rc)) < 0) return error.EventFdFailed;
        const wake_fd: i32 = @intCast(wake_rc);
        errdefer _ = std.os.linux.close(wake_fd);
        try poller.addFd(wake_fd, null, .in);

        var self = Runtime{
            .allocator = allocator,
            .peer = peer,
            .target = try allocator.dupe(u8, config.target),
            .poller = poller,
            .wake_fd = wake_fd,
            // The system heartbeat has a sub-second contract even when an
            // application selected a long request receive timeout.
            .tick_ms = @min(@max(config.recv_timeout_ms, 1), 50),
            .worker_count = config.workers,
        };
        errdefer allocator.free(self.target);
        self.register() catch |err| std.log.debug("transport runtime {s} initial system register failed: {s}", .{ self.target, @errorName(err) });
        return self;
    }

    pub fn deinit(self: *Runtime) void {
        self.stopWorkers();
        var pending = self.pending.iterator();
        while (pending.next()) |entry| self.allocator.free(entry.key_ptr.*);
        self.pending.deinit(self.allocator);
        var handlers = self.handlers.iterator();
        while (handlers.next()) |entry| self.allocator.free(entry.key_ptr.*);
        self.handlers.deinit(self.allocator);
        for (self.outbound.items) |frame| {
            self.allocator.free(frame.bytes);
            self.allocator.free(frame.payload);
        }
        self.outbound.deinit(self.allocator);
        for (self.jobs.items) |job| {
            self.allocator.free(job.envelope_bytes);
            self.allocator.free(job.payload);
        }
        self.jobs.deinit(self.allocator);
        self.allocator.free(self.target);
        self.poller.deinit();
        _ = std.os.linux.close(self.wake_fd);
        self.peer.deinit();
        self.* = undefined;
    }

    /// Attaches an app function to a service inside this connection target.
    pub fn bind(self: *Runtime, service: []const u8, handler: Handler) !void {
        if (service.len == 0) return error.ServiceRequired;
        const key = try self.allocator.dupe(u8, service);
        errdefer self.allocator.free(key);
        if (self.handlers.fetchRemove(service)) |previous| self.allocator.free(previous.key);
        try self.handlers.put(self.allocator, key, handler);
    }

    /// True once the reactor loop is running. Callers on other threads should
    /// wait for this before sending, so their frames funnel to the reactor
    /// rather than racing the socket during startup.
    pub fn isRunning(self: *const Runtime) bool {
        return self.reactor_started.load(.acquire);
    }

    // ── Outbound ──────────────────────────────────────────────────────────

    /// Sends a request and records its completion before the packet is put on
    /// the wire. Thread-safe: completion runs from the reactor's poll() when a
    /// response or error with the same request id arrives.
    pub fn request(self: *Runtime, outgoing: Outgoing, completion: Completion) !void {
        const request_id = try std.fmt.allocPrint(self.allocator, "{s}:nrpc:{x}", .{ self.target, self.sequence.fetchAdd(1, .monotonic) });
        errdefer self.allocator.free(request_id);
        _ = std.c.pthread_mutex_lock(&self.pending_mutex);
        const deadline_ns = nowNs() + @as(i128, @max(outgoing.deadline_ms, 1)) * std.time.ns_per_ms;
        self.pending.put(self.allocator, request_id, .{ .completion = completion, .deadline_ns = deadline_ns }) catch |err| {
            _ = std.c.pthread_mutex_unlock(&self.pending_mutex);
            return err;
        };
        _ = std.c.pthread_mutex_unlock(&self.pending_mutex);

        const env = envelope.Envelope{
            .kind = .request,
            .request_id = request_id,
            .to = .{ .target = outgoing.target, .service = outgoing.service },
            .from = .{ .target = self.target, .service = outgoing.service },
            .method = outgoing.method,
            .scope = outgoing.scope,
            .user = outgoing.user,
            .auth = outgoing.auth,
            .codec = .json,
            .deadline_ms = outgoing.deadline_ms,
        };
        self.send(env, outgoing.body) catch |err| {
            _ = std.c.pthread_mutex_lock(&self.pending_mutex);
            const removed = self.pending.fetchRemove(request_id);
            _ = std.c.pthread_mutex_unlock(&self.pending_mutex);
            if (removed) |entry| self.allocator.free(entry.key);
            return err;
        };
    }

    /// Blocking NRPC call for a NON-reactor thread (a worker or a background
    /// loop). Sends the request and waits until the reactor delivers the
    /// matching response. Never call this from the reactor thread — it would
    /// deadlock, because the reactor is the one that must deliver the reply.
    pub fn call(self: *Runtime, allocator: std.mem.Allocator, outgoing: Outgoing) !Reply {
        var slot = CallSlot{ .caller_allocator = allocator };
        try self.request(outgoing, .{ .context = &slot, .handle_fn = CallSlot.onComplete });
        slot.wait();
        if (slot.failed) return error.RequestFailed;
        return slot.reply;
    }

    pub fn send(self: *Runtime, env: envelope.Envelope, payload: []const u8) !void {
        const bytes = try envelope.encodeAlloc(self.allocator, &env);
        if (!self.reactor_started.load(.acquire)) {
            // Setup phase: single-threaded, write directly.
            defer self.allocator.free(bytes);
            try self.peer.send(bytes, payload);
            return;
        }
        errdefer self.allocator.free(bytes);
        const payload_copy = try self.allocator.dupe(u8, payload);
        errdefer self.allocator.free(payload_copy);
        _ = std.c.pthread_mutex_lock(&self.outbound_mutex);
        const append_result = self.outbound.append(self.allocator, .{ .bytes = bytes, .payload = payload_copy });
        _ = std.c.pthread_mutex_unlock(&self.outbound_mutex);
        try append_result;
        self.wake();
    }

    fn wake(self: *Runtime) void {
        const one: u64 = 1;
        _ = std.os.linux.write(self.wake_fd, std.mem.asBytes(&one), @sizeOf(u64));
    }

    fn drainWake(self: *Runtime) void {
        var buffer: [8]u8 = undefined;
        while (true) {
            const rc = std.os.linux.read(self.wake_fd, &buffer, buffer.len);
            if (@as(isize, @bitCast(rc)) <= 0) break;
        }
    }

    fn drainOutbound(self: *Runtime) void {
        _ = std.c.pthread_mutex_lock(&self.outbound_mutex);
        const frames = self.outbound;
        self.outbound = .empty;
        _ = std.c.pthread_mutex_unlock(&self.outbound_mutex);
        var owned = frames;
        for (owned.items) |frame| {
            self.peer.send(frame.bytes, frame.payload) catch |err|
                std.log.warn("transport runtime {s} send failed: {s}", .{ self.target, @errorName(err) });
            self.allocator.free(frame.bytes);
            self.allocator.free(frame.payload);
        }
        owned.deinit(self.allocator);
    }

    // ── Reactor loop ──────────────────────────────────────────────────────

    /// Processes one poller wakeup: inbound packets, pending completions and
    /// any queued outbound frames. False means the tick timeout elapsed with
    /// no socket traffic.
    pub fn poll(self: *Runtime) !bool {
        self.ensureReactor();
        self.expirePending();
        self.maintainSystem();
        self.drainOutbound();

        var events: [2]zimq.Poller.Event = .{ .{}, .{} };
        const count = self.poller.waitAll(events[0..], self.tick_ms) catch |err| switch (err) {
            error.NoEvent, error.Interrupted => {
                self.drainOutbound();
                return false;
            },
            else => {
                self.drainOutbound();
                return error.PollFailed;
            },
        };

        var processed = false;
        for (events[0..count]) |event| {
            if (event.socket != null) {
                self.drainSocket();
                processed = true;
            } else {
                self.drainWake();
            }
        }
        self.drainOutbound();
        return processed;
    }

    pub fn run(self: *Runtime) void {
        self.ensureReactor();
        while (true) {
            _ = self.poll() catch |err| std.log.warn("transport runtime {s} failed: {s}", .{ self.target, @errorName(err) });
        }
    }

    fn ensureReactor(self: *Runtime) void {
        if (self.reactor_started.load(.acquire)) return;
        self.reactor_started.store(true, .release);
        self.startWorkers();
    }

    fn drainSocket(self: *Runtime) void {
        while (true) {
            var incoming = (self.peer.recvNonBlocking() catch |err| {
                std.log.warn("transport runtime {s} recv failed: {s}", .{ self.target, @errorName(err) });
                return;
            }) orelse return;
            defer incoming.deinit();
            const env = incoming.parseEnvelope() catch |err| {
                std.log.warn("transport runtime {s} envelope rejected: {s}", .{ self.target, @errorName(err) });
                continue;
            };
            self.dispatch(env, &incoming) catch |err|
                std.log.warn("transport runtime {s} dispatch failed: {s}", .{ self.target, @errorName(err) });
        }
    }

    fn dispatch(self: *Runtime, env: envelope.Envelope, incoming: *endpoint.Incoming) !void {
        if (env.kind == .response or env.kind == .@"error") {
            self.completePending(env, incoming.payload());
            return;
        }
        if (env.kind == .system) {
            self.handleSystem(env);
            return;
        }
        if (env.kind != .request and env.kind != .event) return;

        if (self.worker_count > 0) {
            try self.enqueueJob(incoming);
            return;
        }
        try self.handleRequestEnvelope(env, incoming.payload());
    }

    fn completePending(self: *Runtime, env: envelope.Envelope, payload: []const u8) void {
        _ = std.c.pthread_mutex_lock(&self.pending_mutex);
        const removed = self.pending.fetchRemove(env.request_id);
        _ = std.c.pthread_mutex_unlock(&self.pending_mutex);
        const entry = removed orelse return;
        self.allocator.free(entry.key);
        const body = self.allocator.dupe(u8, payload) catch {
            entry.value.completion.handle(self.allocator, .{ .body = &.{}, .kind = .@"error", .error_code = &.{} });
            return;
        };
        const error_code = self.allocator.dupe(u8, env.error_code) catch {
            self.allocator.free(body);
            entry.value.completion.handle(self.allocator, .{ .body = &.{}, .kind = .@"error", .error_code = &.{} });
            return;
        };
        entry.value.completion.handle(self.allocator, .{ .body = body, .kind = env.kind, .error_code = error_code });
    }

    fn expirePending(self: *Runtime) void {
        const now = nowNs();
        while (true) {
            _ = std.c.pthread_mutex_lock(&self.pending_mutex);
            var iterator = self.pending.iterator();
            var removed: ?std.StringHashMapUnmanaged(Pending).KV = null;
            while (iterator.next()) |entry| {
                if (entry.value_ptr.deadline_ns > now) continue;
                removed = self.pending.fetchRemove(entry.key_ptr.*);
                break;
            }
            _ = std.c.pthread_mutex_unlock(&self.pending_mutex);

            const entry = removed orelse return;
            self.allocator.free(entry.key);
            const body = self.allocator.dupe(u8, "{\"error\":\"request deadline exceeded\"}") catch return;
            const error_code = self.allocator.dupe(u8, "deadline_exceeded") catch {
                self.allocator.free(body);
                return;
            };
            entry.value.completion.handle(self.allocator, .{
                .body = body,
                .kind = .@"error",
                .error_code = error_code,
            });
        }
    }

    fn handleRequestEnvelope(self: *Runtime, env: envelope.Envelope, payload: []const u8) !void {
        const handler = self.handlers.get(env.to.service) orelse return error.ServiceUnavailable;
        var arena = std.heap.ArenaAllocator.init(self.allocator);
        defer arena.deinit();
        const incoming_request = Request{ .envelope = env, .payload = payload };
        const response = handler.handle(arena.allocator(), incoming_request) catch |err| {
            const message = try std.json.Stringify.valueAlloc(arena.allocator(), .{ .@"error" = @errorName(err) }, .{});
            try self.reply(incoming_request, .@"error", message, "application_error");
            return;
        };
        if (!response.deferred) try self.replyWith(incoming_request, response);
    }

    // ── Worker pool ───────────────────────────────────────────────────────

    fn startWorkers(self: *Runtime) void {
        if (self.worker_count == 0 or self.workers.len > 0) return;
        const workers = self.allocator.alloc(std.Thread, self.worker_count) catch |err| {
            std.log.warn("transport runtime {s} worker alloc failed: {s}", .{ self.target, @errorName(err) });
            return;
        };
        var spawned: usize = 0;
        for (workers) |*worker| {
            worker.* = std.Thread.spawn(.{}, workerMain, .{self}) catch |err| {
                std.log.warn("transport runtime {s} worker spawn failed: {s}", .{ self.target, @errorName(err) });
                break;
            };
            spawned += 1;
        }
        self.workers = workers[0..spawned];
    }

    fn stopWorkers(self: *Runtime) void {
        if (self.workers.len == 0) {
            if (self.worker_count > 0) self.allocator.free(self.workers.ptr[0..self.worker_count]);
            return;
        }
        _ = std.c.pthread_mutex_lock(&self.job_mutex);
        self.pool_shutdown = true;
        _ = std.c.pthread_cond_broadcast(&self.job_cond);
        _ = std.c.pthread_mutex_unlock(&self.job_mutex);
        for (self.workers) |worker| worker.join();
        self.allocator.free(self.workers.ptr[0..self.worker_count]);
        self.workers = &.{};
    }

    fn enqueueJob(self: *Runtime, incoming: *endpoint.Incoming) !void {
        const envelope_bytes = try self.allocator.dupe(u8, incoming.envelopeBytes());
        errdefer self.allocator.free(envelope_bytes);
        const payload = try self.allocator.dupe(u8, incoming.payload());
        errdefer self.allocator.free(payload);
        _ = std.c.pthread_mutex_lock(&self.job_mutex);
        const append_result = self.jobs.append(self.allocator, .{ .envelope_bytes = envelope_bytes, .payload = payload });
        if (append_result) |_| {
            _ = std.c.pthread_cond_signal(&self.job_cond);
        } else |_| {}
        _ = std.c.pthread_mutex_unlock(&self.job_mutex);
        try append_result;
    }

    fn workerMain(self: *Runtime) void {
        while (true) {
            _ = std.c.pthread_mutex_lock(&self.job_mutex);
            while (self.jobs.items.len == 0 and !self.pool_shutdown) {
                _ = std.c.pthread_cond_wait(&self.job_cond, &self.job_mutex);
            }
            if (self.jobs.items.len == 0 and self.pool_shutdown) {
                _ = std.c.pthread_mutex_unlock(&self.job_mutex);
                return;
            }
            const job = self.jobs.orderedRemove(0);
            _ = std.c.pthread_mutex_unlock(&self.job_mutex);

            defer {
                self.allocator.free(job.envelope_bytes);
                self.allocator.free(job.payload);
            }
            const env = envelope.decode(job.envelope_bytes) catch |err| {
                std.log.warn("transport runtime {s} worker envelope rejected: {s}", .{ self.target, @errorName(err) });
                continue;
            };
            self.handleRequestEnvelope(env, job.payload) catch |err|
                std.log.warn("transport runtime {s} worker dispatch failed: {s}", .{ self.target, @errorName(err) });
        }
    }

    // ── Replies ───────────────────────────────────────────────────────────

    pub fn reply(self: *Runtime, incoming_request: Request, kind: envelope.Kind, payload: []const u8, error_code: []const u8) !void {
        if (incoming_request.envelope.kind == .event) return;
        try self.send(.{
            .kind = kind,
            .request_id = incoming_request.envelope.request_id,
            .to = incoming_request.envelope.from,
            .from = .{ .target = self.target, .service = incoming_request.envelope.to.service },
            .method = incoming_request.envelope.method,
            .scope = incoming_request.envelope.scope,
            .user = incoming_request.envelope.user,
            .codec = incoming_request.envelope.codec,
            .error_code = error_code,
        }, payload);
    }

    pub fn captureReplyTarget(self: *Runtime, incoming_request: Request) !ReplyTarget {
        return .{
            .request_id = try self.allocator.dupe(u8, incoming_request.envelope.request_id),
            .to = .{
                .target = try self.allocator.dupe(u8, incoming_request.envelope.from.target),
                .service = try self.allocator.dupe(u8, incoming_request.envelope.from.service),
            },
            .service = try self.allocator.dupe(u8, incoming_request.envelope.to.service),
            .method = try self.allocator.dupe(u8, incoming_request.envelope.method),
            .scope = try self.allocator.dupe(u8, incoming_request.envelope.scope),
            .user = try self.allocator.dupe(u8, incoming_request.envelope.user),
            .codec = incoming_request.envelope.codec,
        };
    }

    pub fn replyTo(self: *Runtime, target: ReplyTarget, kind: envelope.Kind, payload: []const u8, error_code: []const u8) !void {
        try self.send(.{
            .kind = kind,
            .request_id = target.request_id,
            .to = target.to,
            .from = .{ .target = self.target, .service = target.service },
            .method = target.method,
            .scope = target.scope,
            .user = target.user,
            .codec = target.codec,
            .error_code = error_code,
        }, payload);
    }

    pub fn sendStreamChunk(self: *Runtime, incoming_request: Request, payload: []const u8, seq: u32, fin: bool) !void {
        if (incoming_request.envelope.kind == .event) return;
        try self.send(.{
            .kind = .stream_chunk,
            .request_id = incoming_request.envelope.request_id,
            .to = incoming_request.envelope.from,
            .from = .{ .target = self.target, .service = incoming_request.envelope.to.service },
            .method = incoming_request.envelope.method,
            .scope = incoming_request.envelope.scope,
            .user = incoming_request.envelope.user,
            .codec = incoming_request.envelope.codec,
            .seq = seq,
            .fin = fin,
        }, payload);
    }

    /// Stream chunk for a request whose handler has already returned
    /// (`Response.deferred`). Same frame as `sendStreamChunk`, but addressed
    /// from a captured `ReplyTarget` so the continuation may outlive the
    /// handler's arena — and, since `send` only enqueues, it is safe to call
    /// from any thread.
    pub fn sendStreamChunkTo(self: *Runtime, target: ReplyTarget, payload: []const u8, seq: u32, fin: bool) !void {
        try self.send(.{
            .kind = .stream_chunk,
            .request_id = target.request_id,
            .to = target.to,
            .from = .{ .target = self.target, .service = target.service },
            .method = target.method,
            .scope = target.scope,
            .user = target.user,
            .codec = target.codec,
            .seq = seq,
            .fin = fin,
        }, payload);
    }

    fn replyWith(self: *Runtime, incoming_request: Request, response: Response) !void {
        if (incoming_request.envelope.kind == .event) return;
        try self.send(.{
            .kind = response.kind,
            .request_id = incoming_request.envelope.request_id,
            .to = incoming_request.envelope.from,
            .from = .{ .target = self.target, .service = incoming_request.envelope.to.service },
            .method = response.method orelse incoming_request.envelope.method,
            .scope = incoming_request.envelope.scope,
            .user = incoming_request.envelope.user,
            .codec = response.codec orelse incoming_request.envelope.codec,
            .error_code = response.error_code,
            .seq = response.seq,
            .fin = response.fin,
        }, response.payload);
    }

    // ── Transport control plane ───────────────────────────────────────────

    // The runtime re-registers its one target after a router restart.
    const system_ping_interval_ns = 250 * std.time.ns_per_ms;
    const system_timeout_ns = std.time.ns_per_s;

    fn nowNs() i128 {
        return std.Io.Timestamp.now(std.Options.debug_io, .awake).toNanoseconds();
    }

    fn maintainSystem(self: *Runtime) void {
        const now = nowNs();
        if (self.system_registered and now - self.last_system_reply_ns >= system_timeout_ns) {
            self.system_registered = false;
        }
        if (now - self.last_system_send_ns < system_ping_interval_ns) return;
        if (self.system_registered) {
            self.ping() catch |err| std.log.debug("transport runtime {s} system ping failed: {s}", .{ self.target, @errorName(err) });
        } else {
            self.register() catch |err| std.log.debug("transport runtime {s} system register failed: {s}", .{ self.target, @errorName(err) });
        }
    }

    fn handleSystem(self: *Runtime, env: envelope.Envelope) void {
        if (std.mem.eql(u8, env.method, "registered") or std.mem.eql(u8, env.method, "pong")) {
            self.system_registered = true;
            self.last_system_reply_ns = nowNs();
            return;
        }
        if (std.mem.eql(u8, env.method, "register_required")) {
            self.system_registered = false;
            self.last_system_send_ns = 0;
        }
    }

    fn register(self: *Runtime) !void {
        var registration = try control.register(self.allocator, .{
            .target = self.target,
        });
        defer registration.deinit(self.allocator);
        try self.send(registration.envelope, registration.payload);
        self.last_system_send_ns = nowNs();
    }

    fn ping(self: *Runtime) !void {
        var packet = try control.ping(self.allocator, self.target);
        defer packet.deinit(self.allocator);
        try self.send(packet.envelope, packet.payload);
        self.last_system_send_ns = nowNs();
    }
};

/// Backs the blocking `call()`: a caller-thread condvar the reactor posts once
/// the matching reply lands. The reply body is duped into the caller's
/// allocator so it outlives the reactor's transient copy.
const CallSlot = struct {
    caller_allocator: std.mem.Allocator,
    mutex: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,
    cond: std.c.pthread_cond_t = std.c.PTHREAD_COND_INITIALIZER,
    done: bool = false,
    failed: bool = false,
    reply: Reply = undefined,

    fn onComplete(context: *anyopaque, allocator: std.mem.Allocator, incoming: Reply) void {
        const self: *CallSlot = @ptrCast(@alignCast(context));
        var owned = incoming;
        defer owned.deinit(allocator);
        const body = self.caller_allocator.dupe(u8, owned.body) catch return self.finish(true, undefined);
        const error_code = self.caller_allocator.dupe(u8, owned.error_code) catch {
            self.caller_allocator.free(body);
            return self.finish(true, undefined);
        };
        self.finish(false, .{ .body = body, .kind = owned.kind, .error_code = error_code });
    }

    fn finish(self: *CallSlot, failed: bool, reply: Reply) void {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        self.failed = failed;
        self.reply = reply;
        self.done = true;
        _ = std.c.pthread_cond_signal(&self.cond);
        _ = std.c.pthread_mutex_unlock(&self.mutex);
    }

    fn wait(self: *CallSlot) void {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        while (!self.done) _ = std.c.pthread_cond_wait(&self.cond, &self.mutex);
        _ = std.c.pthread_mutex_unlock(&self.mutex);
    }
};

const TestCompletion = struct {
    called: bool = false,
    body: []const u8 = "",

    fn handle(context: *anyopaque, allocator: std.mem.Allocator, reply_value: Reply) void {
        const self: *TestCompletion = @ptrCast(@alignCast(context));
        var reply = reply_value;
        defer reply.deinit(allocator);
        self.called = true;
        self.body = allocator.dupe(u8, reply.body) catch "";
    }
};

test "runtime dispatches a response to the completion registered by request id" {
    var endpoint_buffer: [128]u8 = undefined;
    const address = try std.fmt.bufPrintZ(
        &endpoint_buffer,
        "ipc:///tmp/transport-runtime-test-{d}.sock",
        .{std.c.getpid()},
    );
    const limits = endpoint.Limits{ .max_envelope_bytes = 4096, .max_payload_bytes = 1 << 20 };
    var router = try endpoint.Router.init(address, limits);
    defer router.deinit();
    try router.setRecvTimeoutMs(2_000);

    var runtime = try Runtime.init(std.testing.allocator, .{
        .endpoint = address,
        .target = "test-app",
        .limits = limits,
        .recv_timeout_ms = 2_000,
    });
    defer runtime.deinit();

    var registration = (try router.recv()) orelse return error.TestTimeout;
    defer registration.deinit();
    const registration_env = try registration.parseEnvelope();
    try std.testing.expectEqual(envelope.Kind.system, registration_env.kind);
    try std.testing.expectEqualStrings("test-app", registration_env.from.target);
    try std.testing.expectEqualStrings("{}", registration.payload());

    var completion = TestCompletion{};
    try runtime.request(.{
        .service = "echo",
        .method = "ping",
        .body = "{}",
    }, .{ .context = &completion, .handle_fn = TestCompletion.handle });

    var request_packet = (try router.recv()) orelse return error.TestTimeout;
    defer request_packet.deinit();
    const request_envelope = try request_packet.parseEnvelope();
    try std.testing.expectEqualStrings("services", request_envelope.to.target);
    try std.testing.expectEqualStrings("echo", request_envelope.to.service);
    const response = envelope.Envelope{
        .kind = .response,
        .request_id = request_envelope.request_id,
        .to = request_envelope.from,
        .from = request_envelope.to,
        .method = request_envelope.method,
        .codec = .json,
    };
    const response_bytes = try envelope.encodeAlloc(std.testing.allocator, &response);
    defer std.testing.allocator.free(response_bytes);
    try router.send(request_packet.identity(), response_bytes, "{\"ok\":true}");

    try std.testing.expect(try runtime.poll());
    defer if (completion.body.len > 0) std.testing.allocator.free(completion.body);
    try std.testing.expect(completion.called);
    try std.testing.expectEqualStrings("{\"ok\":true}", completion.body);
}

test "runtime completes an unanswered request at its deadline" {
    var endpoint_buffer: [128]u8 = undefined;
    const address = try std.fmt.bufPrintZ(&endpoint_buffer, "ipc:///tmp/transport-runtime-deadline-{d}.sock", .{std.c.getpid()});
    const limits = endpoint.Limits{ .max_envelope_bytes = 4096, .max_payload_bytes = 1 << 20 };
    var router = try endpoint.Router.init(address, limits);
    defer router.deinit();
    try router.setRecvTimeoutMs(2_000);

    var runtime = try Runtime.init(std.testing.allocator, .{
        .endpoint = address,
        .target = "deadline-caller",
        .limits = limits,
    });
    defer runtime.deinit();

    var registration = (try router.recv()) orelse return error.TestTimeout;
    defer registration.deinit();

    var completion = TestCompletion{};
    try runtime.request(.{
        .target = "missing-target",
        .service = "echo",
        .method = "ping",
        .body = "{}",
        .deadline_ms = 1,
    }, .{ .context = &completion, .handle_fn = TestCompletion.handle });

    var request_packet = (try router.recv()) orelse return error.TestTimeout;
    defer request_packet.deinit();
    _ = try runtime.poll();
    _ = try runtime.poll();
    defer if (completion.body.len > 0) std.testing.allocator.free(completion.body);
    try std.testing.expect(completion.called);
    try std.testing.expectEqualStrings("{\"error\":\"request deadline exceeded\"}", completion.body);
}

test "router reset re-registers the connection target without application help" {
    var endpoint_buffer: [128]u8 = undefined;
    const address = try std.fmt.bufPrintZ(&endpoint_buffer, "ipc:///tmp/transport-runtime-reset-{d}.sock", .{std.c.getpid()});
    const limits = endpoint.Limits{ .max_envelope_bytes = 4096, .max_payload_bytes = 1 << 20 };
    var router = try endpoint.Router.init(address, limits);
    defer router.deinit();
    try router.setRecvTimeoutMs(2_000);

    var runtime = try Runtime.init(std.testing.allocator, .{
        .endpoint = address,
        .target = "ptah",
        .limits = limits,
    });
    defer runtime.deinit();

    var initial = (try router.recv()) orelse return error.TestTimeout;
    defer initial.deinit();
    const reset = envelope.Envelope{
        .kind = .system,
        .to = .{ .target = "ptah" },
        .from = .{ .target = "fujin" },
        .method = "register_required",
        .codec = .json,
    };
    const reset_bytes = try envelope.encodeAlloc(std.testing.allocator, &reset);
    defer std.testing.allocator.free(reset_bytes);
    try router.send(initial.identity(), reset_bytes, "{}");

    try std.testing.expect(try runtime.poll());
    _ = try runtime.poll();
    var replay = (try router.recv()) orelse return error.TestTimeout;
    defer replay.deinit();
    const replay_env = try replay.parseEnvelope();
    try std.testing.expectEqual(envelope.Kind.system, replay_env.kind);
    try std.testing.expectEqualStrings("register", replay_env.method);
    try std.testing.expectEqualStrings("ptah", replay_env.from.target);
    try std.testing.expectEqualStrings("{}", replay.payload());
}
