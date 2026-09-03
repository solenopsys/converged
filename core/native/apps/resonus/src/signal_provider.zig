const std = @import("std");
const transport = @import("transport");
const gateway_mod = @import("gate/gateway.zig");
const clock = @import("util/clock.zig");
const env = @import("env.zig");
const LlmHub = @import("llm/hub.zig").Hub;
const llm_provider = @import("llm/provider.zig");
const dictation_mod = @import("bridge/dictation_bridge.zig");
const resonus_nrpc = @import("generated/resonus_nrpc.zig");

const Mutex = struct {
    raw: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,

    fn lock(self: *Mutex) void {
        _ = std.c.pthread_mutex_lock(&self.raw);
    }

    fn unlock(self: *Mutex) void {
        _ = std.c.pthread_mutex_unlock(&self.raw);
    }
};

pub const Provider = struct {
    gateway: *gateway_mod.Gateway,
    gpa: std.mem.Allocator,
    llm: LlmHub,
    runtime: ?*transport.Runtime = null,
    auth: *transport.auth.receiver.Receiver,
    /// Explicit, hot control-plane state. It deliberately contains only ids,
    /// snapshots and short-lived message bodies; legacy `histories` below is
    /// retained until `chat.message` callers migrate.
    control: ControlPlane = .{},
    histories: std.StringHashMapUnmanaged([]u8) = .{},
    /// Live dictation streams by session id. Touched by the transport worker
    /// (start/stop) and by the reaper thread (session destroyed), hence the lock.
    dictations: std.StringHashMapUnmanaged(*DictationEmitter) = .{},
    dictations_mutex: Mutex = .{},

    pub fn init(gpa: std.mem.Allocator, io: std.Io, gateway: *gateway_mod.Gateway, auth: *transport.auth.receiver.Receiver) !Provider {
        return .{ .gateway = gateway, .gpa = gpa, .auth = auth, .control = .{ .gpa = gpa }, .llm = try LlmHub.init(gpa, io) };
    }

    pub fn deinit(self: *Provider) void {
        self.control.deinit(self.gpa, &self.llm);
        var it = self.histories.iterator();
        while (it.next()) |entry| {
            self.gpa.free(entry.key_ptr.*);
            self.gpa.free(entry.value_ptr.*);
        }
        self.histories.deinit(self.gpa);

        // End live dictations through the gateway while this provider is still
        // valid: tearing a session down fires its destroy hook, and that hook
        // walks back into this registry. Shutdown runs provider.deinit before
        // gateway.deinit, so leaving them for the gateway would call the hook on
        // an already-undefined Provider.
        while (true) {
            self.dictations_mutex.lock();
            var it_live = self.dictations.iterator();
            // Own the id: the destroy hook frees the registry key, so the
            // borrowed one would dangle the moment the session goes away.
            const next_id: ?[]u8 = if (it_live.next()) |entry|
                self.gpa.dupe(u8, entry.key_ptr.*) catch null
            else
                null;
            self.dictations_mutex.unlock();
            const id = next_id orelse break;
            defer self.gpa.free(id);
            self.gateway.endDictationSession(id);
            // The hook detaches the emitter; if it somehow did not, drop the
            // entry here so shutdown cannot spin on the same session.
            if (self.takeDictation(id)) |taken| {
                taken.emitter.target.deinit(self.gpa);
                self.gpa.free(taken.key);
                self.gpa.destroy(taken.emitter);
            }
        }
        self.dictations.deinit(self.gpa);
        self.llm.deinit();
        self.* = undefined;
    }

    pub fn transportHandler(self: *Provider) transport.RuntimeHandler {
        return .{ .context = self, .handle_fn = handleOpaque };
    }

    fn handleOpaque(context: *anyopaque, allocator: std.mem.Allocator, request: transport.RuntimeRequest) !transport.RuntimeResponse {
        const self: *Provider = @ptrCast(@alignCast(context));
        return self.handle(allocator, request) catch |err| {
            std.log.warn("resonus command {s} request={s} failed: {s}", .{
                request.envelope.method,
                request.envelope.request_id,
                @errorName(err),
            });
            return err;
        };
    }

    fn handle(self: *Provider, allocator: std.mem.Allocator, request: transport.RuntimeRequest) !transport.RuntimeResponse {
        if (request.envelope.request_id.len == 0) return error.RequestIdMissing;
        const name = request.envelope.method;

        const policy = if (std.mem.eql(u8, name, "llm.complete"))
            transport.auth.authorize.MethodPolicy{ .service = resonus_nrpc.service, .method = name, .level = .internal }
        else
            resonus_nrpc.policy(name) orelse return error.CommandUnsupported;
        const now = std.Io.Timestamp.now(std.Options.debug_io, .real).toSeconds();
        var verified = try self.auth.authorize(request.envelope.auth, request.envelope.user, request.envelope.scope, policy, now);
        defer if (verified) |*token| token.deinit(self.auth.allocator);

        // Internal caller (centimanus workflow VM `rt.llm()`): no browser scope,
        // one uniform request/response, never streamed.
        if (std.mem.eql(u8, name, "llm.complete")) {
            const reply = try self.llm.complete(allocator, request.payload);
            return .{ .payload = reply.body };
        }

        if (request.envelope.scope.len == 0) return error.ScopeRequired;

        if (std.mem.eql(u8, name, "chat.message")) {
            return self.handleChatMessage(allocator, request);
        }

        var parsed = try std.json.parseFromSlice(std.json.Value, allocator, request.payload, .{});
        defer parsed.deinit();
        if (parsed.value != .object) return error.PayloadInvalid;
        const payload = parsed.value.object;
        const request_id = request.envelope.request_id;

        if (std.mem.eql(u8, name, "session.open")) {
            return .{ .payload = try self.control.openSession(allocator, request.envelope.scope, payload) };
        }
        if (std.mem.eql(u8, name, "session.bind")) {
            return .{ .payload = try self.control.bindSession(allocator, request.envelope.scope, payload, &self.llm) };
        }
        if (std.mem.eql(u8, name, "session.close")) {
            return .{ .payload = try self.control.closeSession(allocator, request.envelope.scope, payload, &self.llm) };
        }
        if (std.mem.eql(u8, name, "message.put")) {
            return .{ .payload = try self.control.putMessage(allocator, request.envelope.scope, payload) };
        }
        if (std.mem.eql(u8, name, "context.create")) {
            return .{ .payload = try self.control.createContext(allocator, request.envelope.scope, payload) };
        }
        if (std.mem.eql(u8, name, "context.replace")) {
            return .{ .payload = try self.control.replaceContext(allocator, request.envelope.scope, payload) };
        }
        if (std.mem.eql(u8, name, "context.delete")) {
            return .{ .payload = try self.control.deleteContext(allocator, request.envelope.scope, payload) };
        }
        if (std.mem.eql(u8, name, "llm.generate")) {
            return self.control.generate(allocator, request, payload, &self.llm, self.runtime orelse return error.TransportUnavailable);
        }

        if (std.mem.eql(u8, name, "call.offer")) {
            return .{ .payload = try self.offer(allocator, request.envelope.scope, request_id, payload) };
        }
        if (std.mem.eql(u8, name, "call.hangup")) {
            const session_id = stringField(payload, "sessionId") orelse return error.SessionIdMissing;
            // Flag only — the teardown must not run on this thread (single
            // transport worker: it would hold up the next call.offer).
            const live = self.gateway.requestWebSessionHangup(session_id);
            std.log.info("signal: call.hangup session={s} live={}", .{ session_id, live });
            return .{ .payload = try event(allocator, request_id, "call.ended", session_id, "{}") };
        }
        if (std.mem.eql(u8, name, "call.ice")) {
            const session_id = stringField(payload, "sessionId") orelse "";
            return .{ .payload = try event(allocator, request_id, "call.ice_ack", session_id, "{}") };
        }
        if (std.mem.eql(u8, name, "dictation.start")) {
            return self.dictationStart(allocator, request, payload);
        }
        if (std.mem.eql(u8, name, "dictation.stop")) {
            const session_id = stringField(payload, "sessionId") orelse return error.SessionIdMissing;
            if (!self.gateway.requestDictationStop(session_id)) return error.DictationSessionUnknown;
            // The final text goes out on the dictation.start stream after VAD
            // closes its active phrase. This reply merely acknowledges stop;
            // the reaper owns teardown so the transport worker stays free.
            return .{ .payload = "{\"stopped\":true}" };
        }
        return error.CommandUnsupported;
    }

    // ---- dictation: microphone → transcription-only session → text ----------
    //
    // The stream stays open for the whole dictation, but the handler must not:
    // the transport runs a single worker, so blocking it here would stall every
    // other request (chat included) until the user stopped talking. The handler
    // therefore returns `deferred`, and the recognised text is pushed from the
    // media callbacks through a captured reply target.

    fn dictationStart(
        self: *Provider,
        _: std.mem.Allocator,
        request: transport.RuntimeRequest,
        payload: std.json.ObjectMap,
    ) !transport.RuntimeResponse {
        const runtime = self.runtime orelse return error.TransportUnavailable;
        const sdp = stringField(payload, "sdp") orelse return error.OfferSdpMissing;
        const language = stringField(payload, "language");

        const timestamp = clock.nanoTimestamp();
        const session_id = try std.fmt.allocPrint(self.gpa, "dic-{x}", .{@as(u64, @bitCast(timestamp))});
        errdefer self.gpa.free(session_id);

        const emitter = try self.gpa.create(DictationEmitter);
        errdefer self.gpa.destroy(emitter);
        emitter.* = .{
            .provider = self,
            .runtime = runtime,
            .session_id = session_id,
            .target = try runtime.captureReplyTarget(request),
        };
        errdefer emitter.target.deinit(self.gpa);

        self.dictations_mutex.lock();
        self.dictations.put(self.gpa, session_id, emitter) catch |err| {
            self.dictations_mutex.unlock();
            return err;
        };
        self.dictations_mutex.unlock();
        errdefer {
            self.dictations_mutex.lock();
            _ = self.dictations.remove(session_id);
            self.dictations_mutex.unlock();
        }

        // Setting the session up costs seconds — waiting for the browser track,
        // then for local ICE gathering, because the answer is not trickled. The
        // transport runs a single worker, so doing that here freezes every other
        // request (chat included) until the microphone is live. Hand it to a
        // thread and answer over the deferred stream, which already carries the
        // transcript from other threads.
        // Each copy gets its own errdefer: `job.deinit()` would double-free
        // against the allocation errdefers if it were used for the failure path
        // as well, and it cannot run before the struct is fully initialised.
        const sdp_copy = try self.gpa.dupe(u8, sdp);
        errdefer self.gpa.free(sdp_copy);
        const language_copy: ?[]u8 = if (language) |value| try self.gpa.dupe(u8, value) else null;
        errdefer if (language_copy) |value| self.gpa.free(value);

        const job = try self.gpa.create(StartJob);
        errdefer self.gpa.destroy(job);
        job.* = .{
            .provider = self,
            .emitter = emitter,
            .sdp = sdp_copy,
            .language = language_copy,
        };

        const thread = try std.Thread.spawn(.{}, StartJob.run, .{job});
        thread.detach();

        return .{ .payload = &.{}, .deferred = true };
    }

    /// Owns the copies the setup thread needs: the request payload it was
    /// parsed from is gone the moment the handler returns.
    const StartJob = struct {
        provider: *Provider,
        emitter: *DictationEmitter,
        sdp: []u8,
        language: ?[]u8,

        fn deinit(self: *StartJob) void {
            const gpa = self.provider.gpa;
            gpa.free(self.sdp);
            if (self.language) |value| gpa.free(value);
            gpa.destroy(self);
        }

        fn run(self: *StartJob) void {
            const provider = self.provider;
            const emitter = self.emitter;
            const session_id = emitter.session_id;
            defer self.deinit();

            const answer = provider.gateway.createDictationSession(
                session_id,
                self.language,
                self.sdp,
                DictationEmitter.onText,
                emitter,
                DictationEmitter.onSessionFinished,
            ) catch |err| {
                std.log.err("dictation [{s}]: session setup failed: {s}", .{ session_id, @errorName(err) });
                provider.failDictation(session_id, @errorName(err));
                return;
            };
            defer provider.gateway.allocator.free(answer);

            const alloc = std.heap.c_allocator;
            const chunk = buildAnswerChunk(alloc, session_id, answer) catch |err| {
                std.log.err("dictation [{s}]: answer chunk build failed: {s}", .{ session_id, @errorName(err) });
                provider.gateway.endDictationSession(session_id);
                return;
            };
            defer alloc.free(chunk);

            emitter.runtime.sendStreamChunkTo(emitter.target, chunk, emitter.nextSeq(), false) catch |err| {
                std.log.err("dictation [{s}]: answer send failed: {s}", .{ session_id, @errorName(err) });
                provider.gateway.endDictationSession(session_id);
            };
        }
    };

    /// The session never came up: close the caller's stream with an error
    /// instead of leaving the microphone button waiting for its deadline.
    fn failDictation(self: *Provider, session_id: []const u8, error_code: []const u8) void {
        const taken = self.takeDictation(session_id) orelse return;
        const emitter = taken.emitter;
        if (!emitter.finished.swap(true, .acq_rel)) {
            emitter.runtime.replyTo(emitter.target, .@"error", "{}", error_code) catch |err| {
                std.log.warn("dictation [{s}]: error reply failed: {s}", .{ session_id, @errorName(err) });
            };
        }
        emitter.target.deinit(self.gpa);
        self.gpa.free(taken.key);
        self.gpa.destroy(emitter);
    }

    /// Detach an emitter from the registry; the caller owns it afterwards.
    fn takeDictation(self: *Provider, session_id: []const u8) ?struct { key: []const u8, emitter: *DictationEmitter } {
        self.dictations_mutex.lock();
        defer self.dictations_mutex.unlock();
        const kv = self.dictations.fetchRemove(session_id) orelse return null;
        return .{ .key = kv.key, .emitter = kv.value };
    }

    fn offer(
        self: *Provider,
        allocator: std.mem.Allocator,
        scope: []const u8,
        request_id: []const u8,
        payload: std.json.ObjectMap,
    ) ![]u8 {
        const sdp = stringField(payload, "sdp") orelse return error.OfferSdpMissing;
        const context_name = stringField(payload, "contextName") orelse return error.ContextRequired;
        if (context_name.len == 0) return error.ContextRequired;
        const language = stringField(payload, "language");
        const user = stringField(payload, "user") orelse "anonymous";
        const identifier = stringField(payload, "phone") orelse user;
        const timestamp = clock.nanoTimestamp();
        const session_id = try std.fmt.allocPrint(allocator, "ws-{x}", .{@as(u64, @bitCast(timestamp))});

        std.log.info(
            "signal call.offer (session={s} scope={s} context={s} language={s})",
            .{ session_id, scope, context_name, language orelse "(default)" },
        );
        const answer = self.gateway.createWebBridgeSession(
            session_id,
            identifier,
            scope,
            context_name,
            language,
            sdp,
        ) catch |err| {
            std.log.err(
                "signal call.offer failed (session={s} scope={s} context={s}): {s}",
                .{ session_id, scope, context_name, @errorName(err) },
            );
            return err;
        };
        defer self.gateway.allocator.free(answer);

        const answer_json = try std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = answer }, .{});
        const payload_json = try std.fmt.allocPrint(allocator, "{{\"sdp\":{s}}}", .{answer_json});
        return event(allocator, request_id, "call.answer", session_id, payload_json);
    }

    // ---- chat.message: LLM chat streamed straight to the browser/CLI, ---------
    // bypassing the workflow VM entirely. Session history lives here (resonus
    // owns chat sessions, same as it owns voice sessions).

    fn handleChatMessage(self: *Provider, allocator: std.mem.Allocator, request: transport.RuntimeRequest) !transport.RuntimeResponse {
        const runtime = self.runtime orelse return error.TransportUnavailable;

        var parsed = try std.json.parseFromSlice(std.json.Value, allocator, request.payload, .{});
        defer parsed.deinit();
        if (parsed.value != .object) return error.PayloadInvalid;

        const session_id = stringField(parsed.value.object, "sessionId") orelse return error.SessionIdMissing;
        const key = try std.fmt.allocPrint(allocator, "{s}\x1f{s}", .{ request.envelope.scope, session_id });
        const history_before = self.histories.get(key) orelse "[]";
        const history_with_input = try appendInputMessages(allocator, history_before, parsed.value.object);
        const request_json = try buildStreamRequest(allocator, parsed.value.object, history_with_input);

        var emitter = ChunkEmitter{ .runtime = runtime, .request = request };
        const completion = try self.llm.stream(allocator, request_json, .{
            .context = &emitter,
            .emit_fn = ChunkEmitter.emit,
        });

        const history_after = try appendAssistant(allocator, history_with_input, completion);
        try self.storeHistory(key, history_after);

        for (completion.tool_calls) |tool_call| {
            try emitter.send(try llm_provider.toolCallReady(allocator, tool_call));
        }
        try emitter.send(try llm_provider.usageEvent(allocator, completion.usage_input, completion.usage_output));
        const final_event = try llm_provider.completedEvent(allocator, completion.finish_reason);
        const final_seq = emitter.nextSeq();
        return .{
            .payload = final_event,
            .kind = .stream_chunk,
            .seq = final_seq,
            .fin = true,
        };
    }

    fn storeHistory(self: *Provider, key: []const u8, value: []const u8) !void {
        const gop = try self.histories.getOrPut(self.gpa, key);
        if (gop.found_existing) {
            self.gpa.free(gop.value_ptr.*);
        } else {
            gop.key_ptr.* = try self.gpa.dupe(u8, key);
        }
        gop.value_ptr.* = try self.gpa.dupe(u8, value);
    }
};

/// The new command layer is intentionally a hot, process-local prototype. Its
/// keys and revisions are already wire-stable; Valkey backing and async threads
/// persistence can be added without changing a single command payload.
const ControlPlane = struct {
    gpa: std.mem.Allocator = undefined,
    sessions: std.StringHashMapUnmanaged(ControlSession) = .{},
    messages: std.StringHashMapUnmanaged(HotMessage) = .{},
    contexts: std.StringHashMapUnmanaged(ContextSnapshot) = .{},

    const ControlSession = struct {
        scope: []u8,
        bindings: std.StringHashMapUnmanaged(void) = .{},

        fn deinit(self: *ControlSession, gpa: std.mem.Allocator) void {
            gpa.free(self.scope);
            var it = self.bindings.iterator();
            while (it.next()) |entry| gpa.free(entry.key_ptr.*);
            self.bindings.deinit(gpa);
        }
    };

    const HotMessage = struct {
        scope: []u8,
        json: []u8,

        fn deinit(self: *HotMessage, gpa: std.mem.Allocator) void {
            gpa.free(self.scope);
            gpa.free(self.json);
        }
    };

    const ContextSnapshot = struct {
        scope: []u8,
        revision: []u8,
        messages_json: []u8,
        estimated_bytes: usize,

        fn deinit(self: *ContextSnapshot, gpa: std.mem.Allocator) void {
            gpa.free(self.scope);
            gpa.free(self.revision);
            gpa.free(self.messages_json);
        }
    };

    fn deinit(self: *ControlPlane, gpa: std.mem.Allocator, llm: *LlmHub) void {
        var sessions = self.sessions.iterator();
        while (sessions.next()) |entry| {
            llm.releaseSession(entry.key_ptr.*);
            gpa.free(entry.key_ptr.*);
            entry.value_ptr.deinit(gpa);
        }
        self.sessions.deinit(gpa);
        var messages = self.messages.iterator();
        while (messages.next()) |entry| {
            gpa.free(entry.key_ptr.*);
            entry.value_ptr.deinit(gpa);
        }
        self.messages.deinit(gpa);
        var contexts = self.contexts.iterator();
        while (contexts.next()) |entry| {
            gpa.free(entry.key_ptr.*);
            entry.value_ptr.deinit(gpa);
        }
        self.contexts.deinit(gpa);
    }

    fn openSession(self: *ControlPlane, a: std.mem.Allocator, scope: []const u8, payload: std.json.ObjectMap) ![]u8 {
        const session_id = stringField(payload, "sessionId") orelse return error.SessionIdMissing;
        _ = try self.ensureSession(scope, session_id);
        return try response(a, "sessionId", session_id, "state", "open");
    }

    fn bindSession(self: *ControlPlane, a: std.mem.Allocator, scope: []const u8, payload: std.json.ObjectMap, llm: *LlmHub) ![]u8 {
        const session_id = stringField(payload, "sessionId") orelse return error.SessionIdMissing;
        const endpoint = stringField(payload, "endpoint") orelse return error.EndpointMissing;
        const session_entry = try self.ensureSession(scope, session_id);
        try self.bindTo(session_entry, session_id, endpoint, llm);
        return try response(a, "sessionId", session_id, "endpoint", endpoint);
    }

    fn closeSession(self: *ControlPlane, a: std.mem.Allocator, scope: []const u8, payload: std.json.ObjectMap, llm: *LlmHub) ![]u8 {
        const session_id = stringField(payload, "sessionId") orelse return error.SessionIdMissing;
        // Closing a session this process never had is the state the caller
        // asked for. Saying otherwise turns every teardown that follows a peer
        // replacement into an error the host can do nothing about.
        const removed = self.sessions.fetchRemove(session_id) orelse
            return try response(a, "sessionId", session_id, "state", "closed");
        if (!std.mem.eql(u8, removed.value.scope, scope)) {
            try self.sessions.put(self.gpa, removed.key, removed.value);
            return error.SessionScopeMismatch;
        }
        llm.releaseSession(session_id);
        self.gpa.free(removed.key);
        var owned = removed.value;
        owned.deinit(self.gpa);
        return try response(a, "sessionId", session_id, "state", "closed");
    }

    fn putMessage(self: *ControlPlane, a: std.mem.Allocator, scope: []const u8, payload: std.json.ObjectMap) ![]u8 {
        const message_id = stringField(payload, "messageId") orelse return error.MessageIdMissing;
        const message = payload.get("message") orelse return error.MessageMissing;
        if (message != .object) return error.MessageInvalid;
        const json = try std.json.Stringify.valueAlloc(self.gpa, message, .{});
        const gop = try self.messages.getOrPut(self.gpa, message_id);
        if (gop.found_existing) {
            if (!std.mem.eql(u8, gop.value_ptr.scope, scope)) return error.MessageScopeMismatch;
            self.gpa.free(gop.value_ptr.json);
            gop.value_ptr.json = json;
        } else {
            gop.key_ptr.* = try self.gpa.dupe(u8, message_id);
            gop.value_ptr.* = .{ .scope = try self.gpa.dupe(u8, scope), .json = json };
        }
        return try response(a, "messageId", message_id, "state", "hot");
    }

    fn createContext(self: *ControlPlane, a: std.mem.Allocator, scope: []const u8, payload: std.json.ObjectMap) ![]u8 {
        const context_id = stringField(payload, "contextId") orelse return error.ContextIdMissing;
        const revision = stringField(payload, "revision") orelse return error.ContextRevisionMissing;
        const ids = payload.get("messageIds") orelse return error.ContextMessagesMissing;
        const messages_json = try self.materialize(self.gpa, scope, ids);
        const gop = try self.contexts.getOrPut(self.gpa, context_id);
        if (gop.found_existing) {
            if (!std.mem.eql(u8, gop.value_ptr.scope, scope)) return error.ContextScopeMismatch;
            if (!std.mem.eql(u8, gop.value_ptr.revision, revision)) return error.ContextRevisionConflict;
        } else {
            gop.key_ptr.* = try self.gpa.dupe(u8, context_id);
            gop.value_ptr.* = .{
                .scope = try self.gpa.dupe(u8, scope),
                .revision = try self.gpa.dupe(u8, revision),
                .messages_json = messages_json,
                .estimated_bytes = messages_json.len,
            };
            return try contextResponse(a, context_id, revision, messages_json.len);
        }
        self.gpa.free(messages_json);
        return try contextResponse(a, context_id, revision, gop.value_ptr.estimated_bytes);
    }

    fn deleteContext(self: *ControlPlane, a: std.mem.Allocator, scope: []const u8, payload: std.json.ObjectMap) ![]u8 {
        const context_id = stringField(payload, "contextId") orelse return error.ContextIdMissing;
        const removed = self.contexts.fetchRemove(context_id) orelse return error.ContextUnknown;
        if (!std.mem.eql(u8, removed.value.scope, scope)) {
            try self.contexts.put(self.gpa, removed.key, removed.value);
            return error.ContextScopeMismatch;
        }
        self.gpa.free(removed.key);
        var owned = removed.value;
        owned.deinit(self.gpa);
        return try response(a, "contextId", context_id, "state", "deleted");
    }

    fn replaceContext(self: *ControlPlane, a: std.mem.Allocator, scope: []const u8, payload: std.json.ObjectMap) ![]u8 {
        const context_id = stringField(payload, "contextId") orelse return error.ContextIdMissing;
        const expected = stringField(payload, "expectedRevision") orelse return error.ContextRevisionMissing;
        const revision = stringField(payload, "revision") orelse return error.ContextRevisionMissing;
        const ids = payload.get("messageIds") orelse return error.ContextMessagesMissing;
        const entry = try self.context(scope, context_id);
        if (!std.mem.eql(u8, entry.revision, expected)) return error.ContextRevisionConflict;
        const messages_json = try self.materialize(self.gpa, scope, ids);
        self.gpa.free(entry.revision);
        self.gpa.free(entry.messages_json);
        entry.revision = try self.gpa.dupe(u8, revision);
        entry.messages_json = messages_json;
        entry.estimated_bytes = messages_json.len;
        return try contextResponse(a, context_id, revision, messages_json.len);
    }

    fn generate(self: *ControlPlane, a: std.mem.Allocator, request: transport.RuntimeRequest, payload: std.json.ObjectMap, llm: *LlmHub, runtime: *transport.Runtime) !transport.RuntimeResponse {
        const session_id = stringField(payload, "sessionId") orelse return error.SessionIdMissing;
        const endpoint = stringField(payload, "endpoint") orelse return error.EndpointMissing;
        const context_id = stringField(payload, "contextId") orelse return error.ContextIdMissing;
        const output_id = stringField(payload, "outputMessageId");
        const session_entry = try self.ensureSession(request.envelope.scope, session_id);
        try self.bindTo(session_entry, session_id, endpoint, llm);
        const context_entry = try self.context(request.envelope.scope, context_id);
        const generation = payload.get("generation") orelse return error.GenerationMissing;
        if (generation != .object) return error.GenerationInvalid;
        const max_tokens = integerField(generation.object, "maxTokens") orelse return error.MaxTokensMissing;
        const tools_value = payload.get("tools") orelse std.json.Value{ .array = std.json.Array.init(a) };
        const tools_json = try std.json.Stringify.valueAlloc(a, tools_value, .{});

        var emitter = ChunkEmitter{ .runtime = runtime, .request = request };
        const completion = try llm.streamEndpoint(
            a,
            endpoint,
            session_id,
            context_entry.messages_json,
            tools_json,
            max_tokens,
            true,
            .{ .context = &emitter, .emit_fn = ChunkEmitter.emit },
        );
        if (output_id) |id| try self.putAssistant(request.envelope.scope, id, completion.text);
        for (completion.tool_calls) |tool_call| try emitter.send(try llm_provider.toolCallReady(a, tool_call));
        try emitter.send(try llm_provider.usageEvent(a, completion.usage_input, completion.usage_output));
        return .{
            .payload = try llm_provider.completedEvent(a, completion.finish_reason),
            .kind = .stream_chunk,
            .seq = emitter.nextSeq(),
            .fin = true,
        };
    }

    /// The session for `session_id`, created if this process does not have it.
    ///
    /// A session carries an id, a scope and its endpoint bindings — nothing a
    /// caller could not restate, and nothing that survives a restart anyway:
    /// this state is process-local. The browser's socket terminates at the
    /// signalling peer, not here, so a resonus replacement leaves a live client
    /// holding an id no process knows, with no event to notice it by. Refusing
    /// that turn costs the user their message to protect state that was already
    /// gone; recreating it costs one hash insert. Scope is still enforced — an
    /// absent session is recreated for its caller, never adopted from another.
    fn ensureSession(self: *ControlPlane, scope: []const u8, session_id: []const u8) !*ControlSession {
        if (self.sessions.getPtr(session_id)) |existing| {
            if (!std.mem.eql(u8, existing.scope, scope)) return error.SessionScopeMismatch;
            return existing;
        }
        const key = try self.gpa.dupe(u8, session_id);
        errdefer self.gpa.free(key);
        const owned_scope = try self.gpa.dupe(u8, scope);
        errdefer self.gpa.free(owned_scope);
        try self.sessions.put(self.gpa, key, .{ .scope = owned_scope });
        return self.sessions.getPtr(key).?;
    }

    /// Attach an endpoint to a session, once. Idempotent for the same reason
    /// `ensureSession` is: a binding is a pool lease this process either holds
    /// or can take again, so a generation naming an unbound endpoint is a
    /// binding to make, not a request to refuse.
    fn bindTo(
        self: *ControlPlane,
        entry: *ControlSession,
        session_id: []const u8,
        endpoint: []const u8,
        llm: *LlmHub,
    ) !void {
        if (entry.bindings.contains(endpoint)) return;
        try llm.bindEndpoint(endpoint, session_id);
        const owned = try self.gpa.dupe(u8, endpoint);
        errdefer self.gpa.free(owned);
        try entry.bindings.put(self.gpa, owned, {});
    }

    fn context(self: *ControlPlane, scope: []const u8, context_id: []const u8) !*ContextSnapshot {
        const value = self.contexts.getPtr(context_id) orelse return error.ContextUnknown;
        if (!std.mem.eql(u8, value.scope, scope)) return error.ContextScopeMismatch;
        return value;
    }

    fn materialize(self: *ControlPlane, a: std.mem.Allocator, scope: []const u8, ids: std.json.Value) ![]u8 {
        const values = switch (ids) {
            .array => |array| array.items,
            else => return error.ContextMessagesInvalid,
        };
        var out: std.ArrayList(u8) = .empty;
        errdefer out.deinit(a);
        try out.append(a, '[');
        for (values, 0..) |value, index| {
            const id = switch (value) {
                .string => |text| text,
                else => return error.ContextMessageIdInvalid,
            };
            const message = self.messages.get(id) orelse return error.MessageUnknown;
            if (!std.mem.eql(u8, message.scope, scope)) return error.MessageScopeMismatch;
            if (index > 0) try out.append(a, ',');
            try out.appendSlice(a, message.json);
        }
        try out.append(a, ']');
        return out.toOwnedSlice(a);
    }

    fn putAssistant(self: *ControlPlane, scope: []const u8, message_id: []const u8, text: []const u8) !void {
        const encoded = try quote(self.gpa, text);
        defer self.gpa.free(encoded);
        const json = try std.fmt.allocPrint(self.gpa, "{{\"role\":\"assistant\",\"content\":{s}}}", .{encoded});
        const gop = try self.messages.getOrPut(self.gpa, message_id);
        if (gop.found_existing) {
            if (!std.mem.eql(u8, gop.value_ptr.scope, scope)) return error.MessageScopeMismatch;
            self.gpa.free(gop.value_ptr.json);
            gop.value_ptr.json = json;
        } else {
            gop.key_ptr.* = try self.gpa.dupe(u8, message_id);
            gop.value_ptr.* = .{ .scope = try self.gpa.dupe(u8, scope), .json = json };
        }
    }
};

/// One dictation stream. Owns the addressing captured from `dictation.start`,
/// so the recognised text can be pushed long after that handler returned —
/// including from the libdatachannel callback thread that delivers it.
/// `dictation.answer` frame. Built with the C allocator: it runs on the setup
/// thread, same reason as the transcript chunks below.
fn buildAnswerChunk(allocator: std.mem.Allocator, session_id: []const u8, answer: []const u8) ![]u8 {
    const answer_json = try std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = answer }, .{});
    defer allocator.free(answer_json);
    const session_json = try std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = session_id }, .{});
    defer allocator.free(session_json);
    return std.fmt.allocPrint(
        allocator,
        "{{\"type\":\"dictation.answer\",\"sessionId\":{s},\"sdp\":{s}}}",
        .{ session_json, answer_json },
    );
}

const DictationEmitter = struct {
    provider: *Provider,
    runtime: *transport.Runtime,
    /// Same allocation as the registry key; freed once, by whoever detaches it.
    session_id: []u8,
    target: transport.RuntimeReplyTarget,
    seq: std.atomic.Value(u32) = std.atomic.Value(u32).init(0),
    finished: std.atomic.Value(bool) = std.atomic.Value(bool).init(false),

    fn nextSeq(self: *DictationEmitter) u32 {
        return self.seq.fetchAdd(1, .acq_rel) + 1;
    }

    /// Recognised text on its way to the browser. Allocated through the C
    /// allocator: this runs on a libdatachannel thread, where the process gpa
    /// is not safe to touch (same reason as the realtime session pool).
    fn onText(kind: dictation_mod.TextKind, text: []const u8, ctx: ?*anyopaque) void {
        const self: *DictationEmitter = @ptrCast(@alignCast(ctx.?));
        if (self.finished.load(.acquire)) return;
        const alloc = std.heap.c_allocator;
        const text_json = std.json.Stringify.valueAlloc(alloc, std.json.Value{ .string = text }, .{}) catch return;
        defer alloc.free(text_json);
        const chunk = std.fmt.allocPrint(alloc, "{{\"type\":\"{s}\",\"text\":{s}}}", .{
            switch (kind) {
                .delta => "delta",
                .segment => "segment",
            },
            text_json,
        }) catch return;
        defer alloc.free(chunk);
        self.runtime.sendStreamChunkTo(self.target, chunk, self.nextSeq(), false) catch |err| {
            std.log.warn("dictation [{s}]: chunk send failed: {s}", .{ self.session_id, @errorName(err) });
        };
    }

    /// Close the stream with the joined text. Idempotent: the explicit stop and
    /// the teardown of an abandoned session both land here.
    fn finish(self: *DictationEmitter, text: []const u8) void {
        if (self.finished.swap(true, .acq_rel)) return;
        const alloc = std.heap.c_allocator;
        const text_json = std.json.Stringify.valueAlloc(alloc, std.json.Value{ .string = text }, .{}) catch return;
        defer alloc.free(text_json);
        const chunk = std.fmt.allocPrint(alloc, "{{\"type\":\"final\",\"text\":{s}}}", .{text_json}) catch return;
        defer alloc.free(chunk);
        self.runtime.sendStreamChunkTo(self.target, chunk, self.nextSeq(), true) catch |err| {
            std.log.warn("dictation [{s}]: final chunk send failed: {s}", .{ self.session_id, @errorName(err) });
        };
    }

    /// The session is gone after its transcript snapshot has been captured.
    /// Finish the original stream and release its captured reply target.
    fn onSessionFinished(text: []const u8, ctx: ?*anyopaque) void {
        const self: *DictationEmitter = @ptrCast(@alignCast(ctx.?));
        const provider = self.provider;
        const gpa = provider.gpa;
        const taken = provider.takeDictation(self.session_id) orelse {
            // Already detached (shutdown path): nothing left to release here.
            return;
        };
        taken.emitter.finish(text);
        taken.emitter.target.deinit(gpa);
        gpa.free(taken.key);
        gpa.destroy(taken.emitter);
    }
};

const ChunkEmitter = struct {
    runtime: *transport.Runtime,
    request: transport.RuntimeRequest,
    seq: u32 = 0,

    fn emit(context: *anyopaque, event_json: []const u8) anyerror!void {
        const self: *ChunkEmitter = @ptrCast(@alignCast(context));
        try self.send(event_json);
    }

    fn send(self: *ChunkEmitter, event_json: []const u8) !void {
        try self.runtime.sendStreamChunk(self.request, event_json, self.nextSeq(), false);
    }

    fn nextSeq(self: *ChunkEmitter) u32 {
        self.seq += 1;
        return self.seq;
    }
};

fn buildStreamRequest(allocator: std.mem.Allocator, payload: std.json.ObjectMap, messages_json: []const u8) ![]u8 {
    const provider = stringField(payload, "provider") orelse env.opt("AI_CHAT_PROVIDER") orelse
        return error.ChatProviderNotConfigured;
    const session_id = stringField(payload, "sessionId") orelse return error.SessionIdMissing;
    // The gateway owns the default: callers may select a model explicitly,
    // but an omitted field must use the server's provider configuration.
    const model = stringField(payload, "model") orelse defaultModel(provider);
    const options = payload.get("options");
    const max_tokens: i64 = if (options) |value|
        if (value == .object) integerField(value.object, "maxTokens") orelse 4096 else 4096
    else
        4096;
    const tools = if (options) |value|
        if (value == .object) value.object.get("tools") orelse std.json.Value{ .array = std.json.Array.init(allocator) } else std.json.Value{ .array = std.json.Array.init(allocator) }
    else
        std.json.Value{ .array = std.json.Array.init(allocator) };
    const provider_json = try quote(allocator, provider);
    const session_json = try quote(allocator, session_id);
    const model_json = try quote(allocator, model);
    const tools_json = try std.json.Stringify.valueAlloc(allocator, tools, .{});
    return std.fmt.allocPrint(
        allocator,
        "{{\"provider\":{s},\"sessionId\":{s},\"model\":{s},\"maxTokens\":{d},\"messages\":{s},\"tools\":{s}}}",
        .{ provider_json, session_json, model_json, max_tokens, messages_json, tools_json },
    );
}

/// The deployment's model for a provider, from `RESONUS_MODEL_<PROVIDER>`.
///
/// Provider names are uppercased with `-` folded to `_`, so `openai-realtime`
/// reads `RESONUS_MODEL_OPENAI_REALTIME`. `AI_MODEL` is the fallback for a
/// deployment that runs one provider and does not care to name it twice.
///
/// This used to be a table of vendor defaults compiled into the gate. Which
/// model a deployment runs is its configuration, not this program's knowledge —
/// but the variables naming it are older than `RESONUS_MODEL_<PROVIDER>`, so
/// `vendorModel` still reads the names the deployments actually carry.
fn defaultModel(provider: []const u8) []const u8 {
    var buf: [96]u8 = undefined;
    const prefix = "RESONUS_MODEL_";
    if (prefix.len + provider.len >= buf.len)
        return vendorModel(provider) orelse env.opt("AI_MODEL") orelse "";

    @memcpy(buf[0..prefix.len], prefix);
    for (provider, 0..) |ch, i| {
        buf[prefix.len + i] = if (ch == '-') '_' else std.ascii.toUpper(ch);
    }
    buf[prefix.len + provider.len] = 0;
    const name: [:0]const u8 = @ptrCast(buf[0 .. prefix.len + provider.len]);

    return env.opt(name) orelse vendorModel(provider) orelse env.opt("AI_MODEL") orelse "";
}

/// Per-vendor model variables predating `RESONUS_MODEL_<PROVIDER>`. Both names
/// a descriptor may go by are accepted: the registry calls Anthropic's provider
/// `anthropic`, while the deployments that configured it wrote `claude`.
fn vendorModel(provider: []const u8) ?[]const u8 {
    if (std.mem.eql(u8, provider, "openai-realtime") or std.mem.eql(u8, provider, "realtime"))
        return env.opt("OPENAI_REALTIME_FAST_MODEL") orelse env.opt("OPENAI_REALTIME_MODEL");
    if (std.mem.eql(u8, provider, "openai"))
        return env.opt("OPENAI_MODEL");
    if (std.mem.eql(u8, provider, "anthropic") or std.mem.eql(u8, provider, "claude"))
        return env.opt("ANTHROPIC_MODEL") orelse env.opt("CLAUDE_MODEL");
    if (std.mem.eql(u8, provider, "gemini"))
        return env.opt("GEMINI_MODEL");
    return null;
}

fn appendInputMessages(allocator: std.mem.Allocator, history: []const u8, payload: std.json.ObjectMap) ![]u8 {
    const blocks = payload.get("messages") orelse return allocator.dupe(u8, history);
    const items = switch (blocks) {
        .array => |array| array.items,
        else => return error.MessagesInvalid,
    };
    var result = try allocator.dupe(u8, history);
    for (items) |block| {
        if (block != .object) return error.MessageInvalid;
        const kind = stringField(block.object, "type") orelse return error.MessageTypeMissing;
        const item = if (std.mem.eql(u8, kind, "text"))
            try textMessage(allocator, block.object)
        else if (std.mem.eql(u8, kind, "tool_result"))
            try toolResultMessage(allocator, block.object)
        else if (std.mem.eql(u8, kind, "system"))
            try systemMessage(allocator, block.object)
        else
            return error.MessageTypeUnsupported;
        result = try appendHistoryItem(allocator, result, item);
    }
    return result;
}

fn textMessage(allocator: std.mem.Allocator, block: std.json.ObjectMap) ![]u8 {
    const content = try stringValueJson(allocator, block.get("data") orelse std.json.Value{ .string = "" });
    return std.fmt.allocPrint(allocator, "{{\"role\":\"user\",\"content\":{s}}}", .{content});
}

/// The instruction for a step. The gateway neither resolves nor invents it: the
/// orchestrator owns prompts (it reads ms-contexts) and sends the text as a
/// block, exactly like any other message — see docs/AI.md §4.3.
fn systemMessage(allocator: std.mem.Allocator, block: std.json.ObjectMap) ![]u8 {
    const content = try stringValueJson(allocator, block.get("data") orelse std.json.Value{ .string = "" });
    return std.fmt.allocPrint(allocator, "{{\"role\":\"system\",\"content\":{s}}}", .{content});
}

fn toolResultMessage(allocator: std.mem.Allocator, block: std.json.ObjectMap) ![]u8 {
    const id = stringField(block, "toolCallId") orelse stringField(block, "tool_call_id") orelse return error.ToolCallIdMissing;
    const id_json = try quote(allocator, id);
    const content = try stringValueJson(allocator, block.get("data") orelse std.json.Value{ .string = "" });
    return std.fmt.allocPrint(allocator, "{{\"role\":\"tool\",\"toolCallId\":{s},\"content\":{s}}}", .{ id_json, content });
}

fn appendAssistant(allocator: std.mem.Allocator, history: []const u8, completion: llm_provider.Completion) ![]u8 {
    const text_json = try quote(allocator, completion.text);
    var calls = std.ArrayList(u8).empty;
    try calls.appendSlice(allocator, "[");
    for (completion.tool_calls, 0..) |call, index| {
        if (index > 0) try calls.appendSlice(allocator, ",");
        const id = try quote(allocator, call.id);
        const call_name = try quote(allocator, call.name);
        try calls.appendSlice(allocator, try std.fmt.allocPrint(allocator, "{{\"id\":{s},\"name\":{s},\"args\":{s}}}", .{
            id,
            call_name,
            llm_provider.safeJsonObject(allocator, call.args_json),
        }));
    }
    try calls.appendSlice(allocator, "]");
    const item = try std.fmt.allocPrint(allocator, "{{\"role\":\"assistant\",\"content\":{s},\"toolCalls\":{s}}}", .{ text_json, calls.items });
    return appendHistoryItem(allocator, history, item);
}

fn appendHistoryItem(allocator: std.mem.Allocator, history: []const u8, item: []const u8) ![]u8 {
    const trimmed = std.mem.trim(u8, history, " \t\r\n");
    if (trimmed.len < 2 or trimmed[0] != '[' or trimmed[trimmed.len - 1] != ']') return error.HistoryInvalid;
    const inner = std.mem.trim(u8, trimmed[1 .. trimmed.len - 1], " \t\r\n");
    return std.fmt.allocPrint(allocator, "[{s}{s}{s}]", .{ inner, if (inner.len == 0) "" else ",", item });
}

fn stringValueJson(allocator: std.mem.Allocator, value: std.json.Value) ![]u8 {
    return switch (value) {
        .string => |text| quote(allocator, text),
        else => quote(allocator, try std.json.Stringify.valueAlloc(allocator, value, .{})),
    };
}

fn quote(allocator: std.mem.Allocator, value: []const u8) ![]u8 {
    return std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = value }, .{});
}

fn response(
    allocator: std.mem.Allocator,
    first_key: []const u8,
    first_value: []const u8,
    second_key: []const u8,
    second_value: []const u8,
) ![]u8 {
    const first_key_json = try quote(allocator, first_key);
    const first_value_json = try quote(allocator, first_value);
    const second_key_json = try quote(allocator, second_key);
    const second_value_json = try quote(allocator, second_value);
    return std.fmt.allocPrint(
        allocator,
        "{{{s}:{s},{s}:{s}}}",
        .{ first_key_json, first_value_json, second_key_json, second_value_json },
    );
}

fn contextResponse(allocator: std.mem.Allocator, context_id: []const u8, revision: []const u8, estimated_bytes: usize) ![]u8 {
    const context_json = try quote(allocator, context_id);
    const revision_json = try quote(allocator, revision);
    return std.fmt.allocPrint(
        allocator,
        "{{\"contextId\":{s},\"revision\":{s},\"estimatedBytes\":{d}}}",
        .{ context_json, revision_json, estimated_bytes },
    );
}

fn integerField(object: std.json.ObjectMap, key: []const u8) ?i64 {
    const value = object.get(key) orelse return null;
    return switch (value) {
        .integer => |integer| integer,
        .float => |number| @intFromFloat(number),
        else => null,
    };
}

fn event(
    allocator: std.mem.Allocator,
    request_id: []const u8,
    name: []const u8,
    session_id: []const u8,
    payload_json: []const u8,
) ![]u8 {
    const request = try std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = request_id }, .{});
    const event_name = try std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = name }, .{});
    const session = try std.json.Stringify.valueAlloc(allocator, std.json.Value{ .string = session_id }, .{});
    return std.fmt.allocPrint(
        allocator,
        "{{\"type\":\"event\",\"requestId\":{s},\"name\":{s},\"sessionId\":{s},\"payload\":{s}}}",
        .{ request, event_name, session, payload_json },
    );
}

fn stringField(object: std.json.ObjectMap, key: []const u8) ?[]const u8 {
    const value = object.get(key) orelse return null;
    return switch (value) {
        .string => |text| text,
        else => null,
    };
}
