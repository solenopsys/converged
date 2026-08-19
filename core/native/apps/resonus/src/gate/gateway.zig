const std = @import("std");
const transport = @import("transport");

const config_mod = @import("../config.zig");
const baresip_mod = @import("../native/baresip_client.zig");
const datachannel_mod = @import("../native/datachannel_client.zig");
const deps_probe_mod = @import("../native/deps_probe.zig");
const adapter_mod = @import("../signaling/adapter.zig");
const types = @import("../signaling/types.zig");
const session_mod = @import("session.zig");
const store_mod = @import("../store/store.zig");
const recorder_mod = @import("../record/recorder.zig");
const transcript_mod = @import("../record/transcript.zig");
const sip_mod = @import("../sip/sip_server.zig");
const bridge_mod = @import("../bridge/openai_bridge.zig");
const web_bridge_mod = @import("../bridge/web_bridge.zig");
const dictation_mod = @import("../bridge/dictation_bridge.zig");
const clock = @import("../util/clock.zig");
const policy_mod = @import("../policy/engine.zig");
const policy_types = @import("../policy/types.zig");

const Mutex = struct {
    raw: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,

    fn lock(self: *Mutex) void {
        _ = std.c.pthread_mutex_lock(&self.raw);
    }

    fn unlock(self: *Mutex) void {
        _ = std.c.pthread_mutex_unlock(&self.raw);
    }
};

pub const SignalOutcome = struct {
    result: types.NegotiationResult,
    context_used: bool,
};

pub const Health = struct {
    baresip_loaded: bool,
    baresip_wrapper_loaded: bool,
    libdatachannel_loaded: bool,
    libdatachannel_wrapper_loaded: bool,
    mbedtls_loaded: bool,
    mbedtls_version: ?[]const u8,
    baresip_error: ?[]const u8,
    baresip_wrapper_error: ?[]const u8,
    libdatachannel_error: ?[]const u8,
    libdatachannel_wrapper_error: ?[]const u8,
    mbedtls_error: ?[]const u8,
    valkey_loaded: bool,
    valkey_error: ?[]const u8,
    store_loaded: bool,
    policy_loaded: bool,
    policy_error: ?[]const u8,
};

pub const NativeSmoke = struct {
    baresip_version: []u8,
    datachannel_offer: datachannel_mod.LocalOffer,

    pub fn deinit(self: *NativeSmoke, allocator: std.mem.Allocator) void {
        allocator.free(self.baresip_version);
        self.datachannel_offer.deinit(allocator);
        self.* = undefined;
    }
};

pub const BridgeSession = struct {
    id: []u8, // owned
    user: []u8, // owned
    start_ns: i64,

    pub fn deinit(self: *BridgeSession, allocator: std.mem.Allocator) void {
        allocator.free(self.id);
        allocator.free(self.user);
    }
};

pub const Gateway = struct {
    allocator: std.mem.Allocator,
    cfg: *const config_mod.Config,

    deps_probe: deps_probe_mod.DepsProbe,
    baresip_client: ?baresip_mod.Client,
    baresip_client_error: ?[]u8,
    datachannel_client: ?datachannel_mod.Client,
    datachannel_client_error: ?[]u8,

    openai_adapter: ?adapter_mod.Adapter,
    gemini_adapter: adapter_mod.Adapter,

    store: ?*store_mod.Store,
    store_error: ?[]u8,
    recorder: ?recorder_mod.Recorder,
    transcript: ?transcript_mod.Transcript,
    sessions: std.StringHashMap(BridgeSession),
    web_sessions: std.StringHashMap(*web_bridge_mod.WebBridgeSession),
    /// Guards web_sessions: it is mutated from the HTTP handler thread (create /
    /// WS-close end) and the reaper thread (disconnect end).
    web_sessions_mutex: Mutex,
    /// Voice-to-text sessions for the chat composer. Kept apart from
    /// web_sessions: they are not calls — nothing is recorded, indexed or
    /// published for them, and their teardown has no audio dump to do.
    dictation_sessions: std.StringHashMap(*dictation_mod.DictationSession),
    dictation_mutex: Mutex,
    /// Background reaper that ends web sessions whose browser transport dropped.
    reaper_thread: ?std.Thread,
    reaper_stop: std.atomic.Value(bool),
    sip_server: ?sip_mod.SipServer,
    policy: ?*policy_mod.Engine,
    policy_error: ?[]u8,

    pub fn init(allocator: std.mem.Allocator, cfg: *const config_mod.Config, runtime: *transport.Runtime) !Gateway {
        var deps_probe = try deps_probe_mod.DepsProbe.init(allocator, cfg);
        errdefer deps_probe.deinit();

        var baresip_client: ?baresip_mod.Client = null;
        var baresip_client_error: ?[]u8 = null;
        var datachannel_client: ?datachannel_mod.Client = null;
        var datachannel_client_error: ?[]u8 = null;

        baresip_client = baresip_mod.Client.init(
            allocator,
            cfg.baresip_wrapper_lib_path,
            cfg.baresip_lib_path,
        ) catch |err| blk: {
            baresip_client_error = std.fmt.allocPrint(
                allocator,
                "{s} -> {s}: {s}",
                .{ cfg.baresip_wrapper_lib_path, cfg.baresip_lib_path, @errorName(err) },
            ) catch null;
            break :blk null;
        };
        errdefer if (baresip_client) |*client| client.deinit();
        errdefer if (baresip_client_error) |value| allocator.free(value);

        datachannel_client = datachannel_mod.Client.init(
            allocator,
            cfg.libdatachannel_wrapper_lib_path,
            cfg.libdatachannel_lib_path,
        ) catch |err| blk: {
            datachannel_client_error = std.fmt.allocPrint(
                allocator,
                "{s} -> {s}: {s}",
                .{ cfg.libdatachannel_wrapper_lib_path, cfg.libdatachannel_lib_path, @errorName(err) },
            ) catch null;
            break :blk null;
        };
        errdefer if (datachannel_client) |*client| client.deinit();
        errdefer if (datachannel_client_error) |value| allocator.free(value);

        const openai_adapter: ?adapter_mod.Adapter = if (cfg.openai_api_key) |api_key|
            .{ .openai = .{
                .api_key = api_key,
                .default_model = cfg.openai_model,
                .default_voice = cfg.openai_voice,
                .default_transcription_model = cfg.openai_transcription_model,
                .default_transcription_prompt = cfg.openai_transcription_prompt,
                .default_transcription_keywords = cfg.openai_transcription_keywords,
                .default_noise_reduction = cfg.openai_noise_reduction,
                .realtime_calls_url = cfg.openai_realtime_calls_url,
                .safety_identifier_override = cfg.openai_safety_identifier,
                .vad_threshold = cfg.openai_vad_threshold,
                .vad_silence_ms = cfg.openai_vad_silence_ms,
                .vad_prefix_ms = cfg.openai_vad_prefix_ms,
                .vad_interrupt = cfg.openai_vad_interrupt,
            } }
        else
            null;

        const gemini_adapter: adapter_mod.Adapter = .{ .gemini = .{
            .api_key = cfg.gemini_api_key,
            .default_model = cfg.gemini_model,
            .ws_url = cfg.gemini_ws_url,
            .sdp_url = cfg.gemini_sdp_url,
        } };

        // Init store (optional — service works without it). The gate is
        // stateless: audio fragments go to Valkey, domain data goes through
        // service APIs.
        // The store lives on the heap: recorder/transcript keep a pointer to
        // it, so it must outlive this stack frame.
        var store_val: ?*store_mod.Store = null;
        var store_error: ?[]u8 = null;
        var recorder_val: ?recorder_mod.Recorder = null;
        var transcript_val: ?transcript_mod.Transcript = null;
        var policy_val: ?*policy_mod.Engine = null;
        var policy_error: ?[]u8 = null;

        if (policy_mod.Engine.init(allocator, cfg.qjs_lib_path, cfg.policy_script_path)) |initialized| {
            const ptr = try allocator.create(policy_mod.Engine);
            ptr.* = initialized;
            policy_val = ptr;
            std.log.info("gateway: JS policy loaded from {s}", .{cfg.policy_script_path});
        } else |err| {
            if (cfg.policy_required) return err;
            policy_error = std.fmt.allocPrint(
                allocator,
                "{s} using {s}: {s}",
                .{ cfg.policy_script_path, cfg.qjs_lib_path, @errorName(err) },
            ) catch null;
            std.log.warn("gateway: optional JS policy unavailable; legacy route fallback active: {s}", .{@errorName(err)});
        }
        errdefer if (policy_val) |p| {
            p.deinit();
            allocator.destroy(p);
        };
        errdefer if (policy_error) |v| allocator.free(v);

        if (store_mod.Store.init(allocator, runtime, .{
            .service_token = cfg.service_token,
            .valkey_url = cfg.valkey_url,
            .valkey_key_prefix = cfg.valkey_key_prefix,
            .valkey_ttl_seconds = cfg.valkey_ttl_seconds,
        })) |initialized| {
            const ptr = try allocator.create(store_mod.Store);
            ptr.* = initialized;
            store_val = ptr;
        } else |err| {
            store_error = std.fmt.allocPrint(allocator, "service/valkey store: {s}", .{@errorName(err)}) catch null;
        }
        errdefer if (store_val) |s| {
            s.deinit();
            allocator.destroy(s);
        };

        // Only create recorder/transcript when store is available
        if (store_val) |s| {
            recorder_val = try recorder_mod.Recorder.init(allocator, s);
            transcript_val = transcript_mod.Transcript.init(allocator, s);
            std.log.info("gateway: store ready — recorder + transcript persistence enabled", .{});
        } else if (store_error) |e| {
            std.log.err("gateway: store init failed ({s}) — audio frames and transcripts will NOT be persisted", .{e});
        } else {
            std.log.warn("gateway: Valkey/API store not loaded — audio frames and transcripts will NOT be persisted", .{});
        }

        return .{
            .allocator = allocator,
            .cfg = cfg,
            .deps_probe = deps_probe,
            .baresip_client = baresip_client,
            .baresip_client_error = baresip_client_error,
            .datachannel_client = datachannel_client,
            .datachannel_client_error = datachannel_client_error,
            .openai_adapter = openai_adapter,
            .gemini_adapter = gemini_adapter,
            .store = store_val,
            .store_error = store_error,
            .recorder = recorder_val,
            .transcript = transcript_val,
            .sessions = std.StringHashMap(BridgeSession).init(allocator),
            .web_sessions = std.StringHashMap(*web_bridge_mod.WebBridgeSession).init(allocator),
            .web_sessions_mutex = .{},
            .dictation_sessions = std.StringHashMap(*dictation_mod.DictationSession).init(allocator),
            .dictation_mutex = .{},
            .reaper_thread = null,
            .reaper_stop = std.atomic.Value(bool).init(false),
            .sip_server = null,
            .policy = policy_val,
            .policy_error = policy_error,
        };
    }

    /// Start the background reaper. Call after the gateway is at its final
    /// address (the thread captures `self`). Idempotent.
    pub fn startReaper(self: *Gateway) !void {
        if (self.reaper_thread != null) return;
        self.reaper_thread = try std.Thread.spawn(.{}, reaperLoop, .{self});
    }

    fn reaperLoop(self: *Gateway) void {
        while (!self.reaper_stop.load(.acquire)) {
            // Also the dictation finaliser: the tick is the delay between the
            // user releasing the button and the transcription request going
            // out, so it is kept short. Both scans are over small maps.
            clock.sleepMs(100);
            self.reapDisconnectedWebSessions();
            self.reapFinishedDictationSessions();
        }
    }

    /// End every web session whose browser WebRTC transport has dropped. The
    /// signaling WebSocket is proxied and its close does not reach the gate, so
    /// this media-layer signal is what actually finishes the call and dumps the
    /// recording.
    fn reapDisconnectedWebSessions(self: *Gateway) void {
        var ids = std.ArrayList([]u8).empty;
        defer {
            for (ids.items) |id| self.allocator.free(id);
            ids.deinit(self.allocator);
        }

        self.web_sessions_mutex.lock();
        var it = self.web_sessions.iterator();
        while (it.next()) |entry| {
            if (!entry.value_ptr.*.isDisconnected()) continue;
            const dup = self.allocator.dupe(u8, entry.key_ptr.*) catch continue;
            ids.append(self.allocator, dup) catch {
                self.allocator.free(dup);
            };
        }
        self.web_sessions_mutex.unlock();

        for (ids.items) |id| {
            std.log.info("gateway: reaping disconnected web session {s}", .{id});
            self.endWebBridgeSession(id);
        }
    }

    /// Start SIP server (call after init, so all pointers are stable).
    pub fn startSip(self: *Gateway) !void {
        if (!self.cfg.sip_enabled) return;
        const api_key = self.cfg.openai_api_key orelse return error.MissingOpenAIApiKey;
        const dc = if (self.datachannel_client) |*c| c else return error.DataChannelWrapperUnavailable;

        const sip_cfg = sip_mod.Config{
            .sip_port = self.cfg.sip_port,
            .public_ip = self.cfg.sip_public_ip,
            .stun_url = if (self.cfg.stun_url.len > 0) self.cfg.stun_url else null,
            .bridge_base = .{
                .api_key = api_key,
                .calls_url = self.cfg.openai_realtime_calls_url,
                .model = self.cfg.openai_model,
                .voice = self.cfg.openai_voice,
                .transcription_model = self.cfg.openai_transcription_model,
                .transcription_prompt = self.cfg.openai_transcription_prompt,
                .transcription_keywords = self.cfg.openai_transcription_keywords,
                .noise_reduction = self.cfg.openai_noise_reduction,
                .vad_threshold = self.cfg.openai_vad_threshold,
                .vad_silence_ms = self.cfg.openai_vad_silence_ms,
                .vad_prefix_ms = self.cfg.openai_vad_prefix_ms,
                .vad_interrupt = self.cfg.openai_vad_interrupt,
                .safety_identifier = self.cfg.openai_safety_identifier,
                .stun_url = if (self.cfg.stun_url.len > 0) self.cfg.stun_url else null,
                .ice_port_range_begin = self.cfg.ice_port_range_begin,
                .ice_port_range_end = self.cfg.ice_port_range_end,
            },
            .dc_client = dc,
            .store = self.store,
            .recorder = if (self.recorder) |*r| r else null,
            .transcript = if (self.transcript) |*t| t else null,
            .policy = self.policy,
            .sip_auth = if (self.cfg.sip_auth_user) |user| .{
                .username = user,
                .password = self.cfg.sip_auth_password.?,
            } else null,
        };

        self.sip_server = try sip_mod.SipServer.init(self.allocator, sip_cfg);
        try self.sip_server.?.start();
    }

    pub fn deinit(self: *Gateway) void {
        self.reaper_stop.store(true, .release);
        if (self.reaper_thread) |thread| {
            thread.join();
            self.reaper_thread = null;
        }
        if (self.sip_server) |*s| s.deinit();

        // Free all live SIP sessions
        var it = self.sessions.iterator();
        while (it.next()) |entry| {
            var s = entry.value_ptr.*;
            s.deinit(self.allocator);
        }
        self.sessions.deinit();

        // Free all live web bridge sessions
        var wit = self.web_sessions.iterator();
        while (wit.next()) |entry| entry.value_ptr.*.destroy();
        self.web_sessions.deinit();

        var dit = self.dictation_sessions.iterator();
        while (dit.next()) |entry| {
            self.allocator.free(entry.key_ptr.*);
            entry.value_ptr.*.destroy();
        }
        self.dictation_sessions.deinit();

        if (self.transcript) |*tr| tr.deinit();
        if (self.recorder) |*rec| rec.deinit();

        if (self.store) |s| {
            s.deinit();
            self.allocator.destroy(s);
        }
        if (self.store_error) |v| self.allocator.free(v);

        if (self.policy) |p| {
            p.deinit();
            self.allocator.destroy(p);
        }
        if (self.policy_error) |v| self.allocator.free(v);

        if (self.datachannel_client) |*client| client.deinit();
        if (self.datachannel_client_error) |value| self.allocator.free(value);
        if (self.baresip_client) |*client| client.deinit();
        if (self.baresip_client_error) |value| self.allocator.free(value);
        self.deps_probe.deinit();
        self.* = undefined;
    }

    pub fn health(self: *const Gateway) Health {
        return .{
            .baresip_loaded = self.deps_probe.report.baresip_loaded,
            .baresip_wrapper_loaded = self.baresip_client != null,
            .libdatachannel_loaded = self.deps_probe.report.libdatachannel_loaded,
            .libdatachannel_wrapper_loaded = self.datachannel_client != null,
            .mbedtls_loaded = self.deps_probe.report.mbedtls_loaded,
            .mbedtls_version = self.deps_probe.report.mbedtls_version,
            .baresip_error = self.deps_probe.report.baresip_error,
            .baresip_wrapper_error = self.baresip_client_error,
            .libdatachannel_error = self.deps_probe.report.libdatachannel_error,
            .libdatachannel_wrapper_error = self.datachannel_client_error,
            .mbedtls_error = self.deps_probe.report.mbedtls_error,
            .valkey_loaded = self.store != null,
            .valkey_error = self.store_error,
            .store_loaded = self.store != null,
            .policy_loaded = self.policy != null,
            .policy_error = self.policy_error,
        };
    }

    pub fn nativeSmoke(self: *Gateway) !NativeSmoke {
        var baresip = if (self.baresip_client) |*client| client else return error.BaresipWrapperUnavailable;
        var datachannel = if (self.datachannel_client) |*client| client else return error.DataChannelWrapperUnavailable;

        const version = try baresip.version(self.allocator);
        errdefer self.allocator.free(version);
        const offer = try datachannel.createLocalOfferSmoke(self.allocator);
        errdefer {
            var tmp = offer;
            tmp.deinit(self.allocator);
        }

        return .{
            .baresip_version = version,
            .datachannel_offer = offer,
        };
    }

    pub fn negotiate(self: *Gateway, provider: adapter_mod.Provider, input: session_mod.SessionInput) !SignalOutcome {
        const domain = input.domain orelse "";
        var stored_context: ?store_mod.Context = null;
        const context_key = input.context_name orelse input.phone;
        if (context_key) |key| {
            stored_context = self.getContext(domain, key, input.language) catch |err| blk: {
                std.log.warn("context lookup failed for {s}: {s}", .{ key, @errorName(err) });
                break :blk null;
            };
        }
        defer if (stored_context) |*value| value.deinit(self.allocator);

        // No context and no inline override → refuse. The gate never answers a
        // call without knowing what to say and in which language.
        if (stored_context == null and input.instructions == null) {
            std.log.warn("negotiate refused: no context for key={s}", .{context_key orelse "(none)"});
            return error.ContextRequired;
        }

        const resolved = session_mod.resolve(input, stored_context);
        const result = switch (provider) {
            .openai => blk: {
                var adapter = self.openai_adapter orelse return error.MissingOpenAIApiKey;
                break :blk try adapter.negotiate(self.allocator, resolved.negotiation);
            },
            .gemini => blk: {
                var adapter = self.gemini_adapter;
                break :blk try adapter.negotiate(self.allocator, resolved.negotiation);
            },
        };

        return .{
            .result = result,
            .context_used = resolved.context_used,
        };
    }

    // --- Bridge session management ---

    pub fn createSession(self: *Gateway, session_id: []const u8, user: []const u8, domain: []const u8) !void {
        const id_owned = try self.allocator.dupe(u8, session_id);
        errdefer self.allocator.free(id_owned);
        const user_owned = try self.allocator.dupe(u8, user);
        errdefer self.allocator.free(user_owned);

        const start_ns = clock.nanoTimestamp();

        const session = BridgeSession{
            .id = id_owned,
            .user = user_owned,
            .start_ns = start_ns,
        };

        try self.sessions.put(id_owned, session);

        if (self.store) |s| {
            // Bind first so putSession + later recorder/transcript writes land in
            // this caller's mapped storage (scope → resolver → pool).
            s.bindSession(session_id, domain) catch |err| {
                std.log.warn("createSession: bindSession failed (session={s} scope={s}): {s}", .{ session_id, domain, @errorName(err) });
            };
            s.putSession(session_id, user, start_ns) catch |err| {
                std.log.err("createSession: putSession failed (session={s} user={s}): {s}", .{ session_id, user, @errorName(err) });
            };
        } else {
            std.log.warn("createSession: store not available, session {s} not persisted", .{session_id});
        }
        self.registerThreadAudio(session_id);
        self.publishCallEvent(session_id);
    }

    pub fn recordFrame(
        self: *Gateway,
        session_id: []const u8,
        source: store_mod.Source,
        data: []const u8,
    ) void {
        if (self.recorder) |*rec| {
            const ts = clock.nanoTimestamp();
            rec.recordFrame(session_id, source, ts, data);
        }
    }

    pub fn processDataChannelEvent(
        self: *Gateway,
        session_id: []const u8,
        json_bytes: []const u8,
    ) void {
        if (self.transcript) |*tr| {
            _ = tr.processEvent(session_id, self.allocator, json_bytes);
        }
    }

    pub fn endSession(self: *Gateway, session_id: []const u8) void {
        if (self.transcript) |*tr| _ = tr.flushSession(session_id);
        if (self.recorder) |*rec| rec.flushPending();
        if (self.store) |s| s.unbindSession(session_id);
        if (self.sessions.fetchRemove(session_id)) |kv| {
            var s = kv.value;
            s.deinit(self.allocator);
        }
    }

    // --- Web bridge sessions (browser WebRTC → gate → OpenAI) ---

    /// Create a WebRTC media proxy session for a browser caller.
    /// Returns the SDP answer the browser should use to connect to the gate.
    /// Caller owns the returned slice.
    pub fn createWebBridgeSession(
        self: *Gateway,
        session_id: []const u8,
        user: []const u8,
        domain: []const u8,
        context_key: ?[]const u8,
        language: ?[]const u8,
        browser_offer: []const u8,
    ) ![]u8 {
        const dc = if (self.datachannel_client) |*c| c else return error.DataChannelWrapperUnavailable;
        const api_key = self.cfg.openai_api_key orelse return error.MissingOpenAIApiKey;
        const key = context_key orelse {
            std.log.warn("web bridge refused (session={s}): no context key", .{session_id});
            return error.ContextRequired;
        };

        var policy_plan: ?policy_types.CallPlan = if (self.policy) |policy|
            try policy.planIncoming(.{
                .call_id = session_id,
                .caller = user,
                .dialed = key,
                .route_context_id = key,
            })
        else
            null;
        defer if (policy_plan) |*plan| plan.deinit(self.allocator);
        if (policy_plan) |plan| switch (plan.action) {
            .reject => return error.PolicyRejected,
            .human => return error.PolicyActionUnsupportedForWebRtc,
            .ai => {},
        };
        if (policy_plan) |plan| if (plan.provider) |provider| {
            if (!std.mem.eql(u8, provider, "openai")) return error.PolicyProviderUnavailable;
        };
        const selected_key = if (policy_plan) |plan| plan.context_id.? else key;

        var context = self.getContext(domain, selected_key, language) catch |err| {
            std.log.err(
                "web bridge context lookup unavailable (session={s} scope={s} context={s} language={s}): {s}",
                .{ session_id, domain, selected_key, language orelse "(default)", @errorName(err) },
            );
            return error.ContextUnavailable;
        } orelse {
            std.log.warn(
                "web bridge context not found (session={s} scope={s} context={s} language={s})",
                .{ session_id, domain, selected_key, language orelse "(default)" },
            );
            return error.ContextRequired;
        };
        defer context.deinit(self.allocator);

        var tenant_llm_config = if (self.store) |store|
            store.getActiveLlmConfig(self.allocator, domain) catch |err| blk: {
                std.log.warn("tenant LLM config lookup failed (scope={s}): {s}", .{ domain, @errorName(err) });
                break :blk null;
            }
        else
            null;
        defer if (tenant_llm_config) |*config| config.deinit(self.allocator);
        if (tenant_llm_config) |config| {
            if (!std.mem.eql(u8, config.provider, "openai") and
                !std.mem.eql(u8, config.provider, "openai-compatible"))
            {
                return error.PolicyProviderUnavailable;
            }
        }

        var openai_cfg = bridge_mod.Config{
            .api_key = api_key,
            .calls_url = self.cfg.openai_realtime_calls_url,
            .model = self.cfg.openai_model,
            .voice = self.cfg.openai_voice,
            .instructions = context.instructions,
            .transcription_model = self.cfg.openai_transcription_model,
            .transcription_languages = context.language,
            .transcription_prompt = self.cfg.openai_transcription_prompt,
            .transcription_keywords = self.cfg.openai_transcription_keywords,
            .noise_reduction = self.cfg.openai_noise_reduction,
            .vad_threshold = self.cfg.openai_vad_threshold,
            .vad_silence_ms = self.cfg.openai_vad_silence_ms,
            .vad_prefix_ms = self.cfg.openai_vad_prefix_ms,
            .vad_interrupt = self.cfg.openai_vad_interrupt,
            .safety_identifier = self.cfg.openai_safety_identifier,
            .stun_url = if (self.cfg.stun_url.len > 0) self.cfg.stun_url else null,
            .ice_port_range_begin = self.cfg.ice_port_range_begin,
            .ice_port_range_end = self.cfg.ice_port_range_end,
        };
        if (tenant_llm_config) |config| {
            openai_cfg.calls_url = config.endpoint;
            openai_cfg.model = config.model;
            if (config.voice) |value| openai_cfg.voice = value;
            if (config.transcription_model) |value| openai_cfg.transcription_model = value;
        }
        if (policy_plan) |plan| {
            if (plan.model) |value| openai_cfg.model = value;
            if (plan.voice) |value| openai_cfg.voice = value;
            if (plan.transcription_model) |value| openai_cfg.transcription_model = value;
            if (plan.noise_reduction) |value| openai_cfg.noise_reduction = value;
            if (plan.vad_threshold) |value| openai_cfg.vad_threshold = value;
            if (plan.vad_silence_ms) |value| openai_cfg.vad_silence_ms = value;
            if (plan.vad_prefix_ms) |value| openai_cfg.vad_prefix_ms = value;
            if (plan.vad_interrupt) |value| openai_cfg.vad_interrupt = value;
        }

        const wb = try web_bridge_mod.WebBridgeSession.create(
            self.allocator,
            dc,
            session_id,
            openai_cfg,
            if (self.recorder) |*r| r else null,
            if (self.transcript) |*t| t else null,
        );
        errdefer wb.destroy();

        // Bind session to tenant storage before bridge connects
        if (self.store) |s| {
            s.bindSession(session_id, domain) catch |err| {
                std.log.warn("createWebBridgeSession: bindSession (session={s} scope={s}): {s}", .{ session_id, domain, @errorName(err) });
            };
            s.putSession(session_id, user, clock.nanoTimestamp()) catch |err| {
                std.log.err("createWebBridgeSession: putSession (session={s} user={s}): {s}", .{ session_id, user, @errorName(err) });
            };
        } else {
            std.log.warn("createWebBridgeSession: store not available, session {s} not persisted", .{session_id});
        }
        self.registerThreadAudio(session_id);
        self.publishCallEvent(session_id);

        const stun_url: ?[]const u8 = if (self.cfg.stun_url.len > 0) self.cfg.stun_url else null;
        const answer = try wb.connect(
            browser_offer,
            stun_url,
            self.cfg.ice_port_range_begin,
            self.cfg.ice_port_range_end,
        );
        errdefer self.allocator.free(answer);

        const id_owned = try self.allocator.dupe(u8, session_id);
        errdefer self.allocator.free(id_owned);
        // Same lock as the removal side: the reaper thread walks this map every
        // 500 ms, so inserting unguarded could corrupt it mid-rehash.
        self.web_sessions_mutex.lock();
        defer self.web_sessions_mutex.unlock();
        try self.web_sessions.put(id_owned, wb);

        return answer;
    }

    /// Flag a web session for teardown and return immediately. This is what the
    /// signaling path (`call.hangup`) must call: the transport runs a SINGLE
    /// worker thread, so doing the teardown inline (closing the media path,
    /// flushing the transcript, dumping ~800 audio fragments over NRPC) blocks
    /// every other signaling request behind it — which is why the next
    /// `call.offer` timed out and the caller could not dial again. The reaper
    /// thread picks the session up within 500 ms and ends it off the hot path.
    /// Returns false if there is no such live session.
    pub fn requestWebSessionHangup(self: *Gateway, session_id: []const u8) bool {
        self.web_sessions_mutex.lock();
        defer self.web_sessions_mutex.unlock();
        const session = self.web_sessions.get(session_id) orelse return false;
        session.requestHangup();
        return true;
    }

    /// End a web session: exactly once, no matter who noticed first (the reaper
    /// or the shutdown path). Blocking work happens here — never call it from
    /// the signaling worker thread, use requestWebSessionHangup().
    pub fn endWebBridgeSession(self: *Gateway, session_id: []const u8) void {
        // Take the session out of the map under the lock — whoever wins the
        // removal owns the teardown, everyone else is a no-op.
        self.web_sessions_mutex.lock();
        const removed = self.web_sessions.fetchRemove(session_id);
        self.web_sessions_mutex.unlock();

        const kv = removed orelse return;
        const sid = kv.key;
        defer self.allocator.free(sid);
        const started_ns = clock.nanoTimestamp();

        // Close the media path FIRST. While the bridge lives, OpenAI keeps
        // pushing ~50 frames/s into the recorder queue, so flushPending() below
        // never sees an empty queue: it spun forever, wedging this thread and
        // leaving the line allocated so no further call could start.
        kv.value.close();
        std.log.info("gateway: [{s}] media closed", .{sid});

        if (self.transcript) |*tr| _ = tr.flushSession(sid);
        std.log.info("gateway: [{s}] transcript flushed", .{sid});
        if (self.recorder) |*rec| rec.flushPending();
        std.log.info("gateway: [{s}] frames flushed", .{sid});
        if (self.store) |s| s.unbindSession(sid);

        kv.value.destroy();
        const elapsed_ms = @divFloor(clock.nanoTimestamp() - started_ns, std.time.ns_per_ms);
        std.log.info("gateway: web session {s} ended in {d} ms", .{ sid, elapsed_ms });
    }

    // --- Dictation sessions (browser mic → gate → transcription) ---

    /// Stand up a voice-to-text session and return the SDP answer (caller owns).
    /// Deliberately does none of the per-call bookkeeping: dictation is a draft
    /// for a chat input, not a call, so there is no context to resolve, no
    /// session row, no thread index and no call event — which also keeps this
    /// off the microservice round trips entirely.
    pub fn createDictationSession(
        self: *Gateway,
        session_id: []const u8,
        language: ?[]const u8,
        browser_offer: []const u8,
        on_text: ?dictation_mod.TextCallback,
        on_text_ctx: ?*anyopaque,
        on_finish: ?dictation_mod.FinishCallback,
    ) ![]u8 {
        const dc = if (self.datachannel_client) |*c| c else return error.DataChannelWrapperUnavailable;
        const api_key = self.cfg.openai_api_key orelse return error.MissingOpenAIApiKey;

        const openai_cfg = bridge_mod.Config{
            .api_key = api_key,
            .calls_url = self.cfg.openai_realtime_calls_url,
            .session_kind = .transcription,
            .model = self.cfg.openai_model,
            .voice = self.cfg.openai_voice,
            .instructions = "",
            .transcription_model = self.cfg.dictation_transcription_model,
            .transcription_languages = language orelse "",
            .transcription_prompt = self.cfg.dictation_transcription_prompt,
            .transcription_keywords = self.cfg.dictation_transcription_keywords,
            .transcription_delay = self.cfg.dictation_transcription_delay,
            // Dictation uses a nearby laptop or headset microphone. Call
            // far_field tuning targets room microphones and harms near speech.
            .noise_reduction = "near_field",
            // Dictation must retain the beginning of a sentence. Browser
            // packets can arrive before server VAD crosses its threshold, and
            // the former 300 ms pre-roll discarded real opening words.
            .vad_threshold = 0.3,
            .vad_silence_ms = 1_000,
            .vad_prefix_ms = 1_000,
            .vad_interrupt = false,
            .safety_identifier = self.cfg.openai_safety_identifier,
            .stun_url = if (self.cfg.stun_url.len > 0) self.cfg.stun_url else null,
            .ice_port_range_begin = self.cfg.ice_port_range_begin,
            .ice_port_range_end = self.cfg.ice_port_range_end,
        };

        const session = try dictation_mod.DictationSession.create(
            self.allocator,
            dc,
            session_id,
            openai_cfg,
            on_text,
            on_text_ctx,
        );
        errdefer session.destroy();

        const stun_url: ?[]const u8 = if (self.cfg.stun_url.len > 0) self.cfg.stun_url else null;
        const answer = try session.connect(
            browser_offer,
            stun_url,
            self.cfg.ice_port_range_begin,
            self.cfg.ice_port_range_end,
        );
        errdefer self.allocator.free(answer);

        const id_owned = try self.allocator.dupe(u8, session_id);
        errdefer self.allocator.free(id_owned);
        self.dictation_mutex.lock();
        defer self.dictation_mutex.unlock();
        try self.dictation_sessions.put(id_owned, session);
        // Arm the finalizer only once the session is live and registered.
        // Set it earlier and a failure inside connect() could finish a stream
        // whose start handler is still unwinding.
        session.on_finish = on_finish;
        return answer;
    }

    /// Request a graceful close. The reaper waits for the current VAD segment
    /// (or its bounded grace deadline), then destroys the session and lets its
    /// finalizer send the accumulated text on the original stream.
    pub fn requestDictationStop(self: *Gateway, session_id: []const u8) bool {
        self.dictation_mutex.lock();
        const session = self.dictation_sessions.get(session_id) orelse {
            self.dictation_mutex.unlock();
            return false;
        };
        // Keep the registry lock until the request has touched the session: the
        // reaper otherwise could remove and free it in this small gap.
        session.requestStop();
        self.dictation_mutex.unlock();
        return true;
    }

    fn reapFinishedDictationSessions(self: *Gateway) void {
        var ids = std.ArrayList([]u8).empty;
        defer {
            for (ids.items) |id| self.allocator.free(id);
            ids.deinit(self.allocator);
        }

        const now_ns = clock.nanoTimestamp();
        self.dictation_mutex.lock();
        var it = self.dictation_sessions.iterator();
        while (it.next()) |entry| {
            if (!entry.value_ptr.*.isReadyToClose(now_ns)) continue;
            const dup = self.allocator.dupe(u8, entry.key_ptr.*) catch continue;
            ids.append(self.allocator, dup) catch {
                self.allocator.free(dup);
            };
        }
        self.dictation_mutex.unlock();

        for (ids.items) |id| self.endDictationSession(id);
    }

    /// End a dictation session exactly once, whoever noticed first.
    pub fn endDictationSession(self: *Gateway, session_id: []const u8) void {
        self.dictation_mutex.lock();
        const removed = self.dictation_sessions.fetchRemove(session_id);
        self.dictation_mutex.unlock();

        const kv = removed orelse return;
        defer self.allocator.free(kv.key);
        kv.value.destroy();
        std.log.info("gateway: dictation session {s} ended", .{session_id});
    }

    // --- Context (via service API) ---

    pub fn setContext(self: *Gateway, domain: []const u8, name: []const u8, language: []const u8, data: []const u8) !void {
        if (self.store) |s| {
            return s.putContext(domain, name, language, data);
        }
        return error.TransportUnavailable;
    }

    pub fn getContext(self: *Gateway, domain: []const u8, name: []const u8, language: ?[]const u8) !?store_mod.Context {
        if (self.store) |s| {
            return s.getContext(self.allocator, domain, name, language);
        }
        return error.TransportUnavailable;
    }

    /// Resolve a dialed (SIP To) number to its call context via the phone-numbers
    /// store → gateway.contextId → context. Language isn't known from telephony,
    /// so any stored variant of that context name is taken. Caller owns it.
    pub fn resolvePhoneContext(self: *Gateway, domain: []const u8, dialed: []const u8) !?store_mod.Context {
        const s = self.store orelse return error.TransportUnavailable;
        const context_id = (try s.resolvePhoneContextId(self.allocator, domain, dialed)) orelse return null;
        defer self.allocator.free(context_id);
        return s.getContext(self.allocator, domain, context_id, null);
    }

    pub fn deleteContext(self: *Gateway, domain: []const u8, phone: []const u8) !void {
        if (self.store) |s| {
            return s.deleteContext(domain, phone);
        }
        return error.TransportUnavailable;
    }

    /// Register the session in the ms-threads SQL thread_index so the thread
    /// becomes visible in the UI/stats via the ms-threads HTTP API. Non-fatal.
    pub fn registerThreadAudio(self: *Gateway, session_id: []const u8) void {
        const store = if (self.store) |s| s else {
            std.log.warn("registerThreadAudio: store unavailable, session {s} not indexed", .{session_id});
            return;
        };
        store.registerThreadIndex(session_id, "audio") catch |err| {
            std.log.warn("registerThreadAudio: index write failed (session={s}): {s}", .{ session_id, @errorName(err) });
            return;
        };
        std.log.info("registerThreadAudio: session {s} registered as audio thread", .{session_id});
    }

    /// Publish through the shared Fujin/ZMQ NRPC transport.
    pub fn publishCallEvent(self: *Gateway, session_id: []const u8) void {
        const store = self.store orelse return;
        store.publishCallEvent(session_id) catch |err| {
            std.log.warn("publishCallEvent: Fujin call failed (session={s}): {s}", .{ session_id, @errorName(err) });
            return;
        };
        std.log.info("publishCallEvent: call.created published (session={s})", .{session_id});
    }
};
