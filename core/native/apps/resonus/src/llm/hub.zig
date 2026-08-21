//! The LLM provider hub.
//!
//! Resolves a provider by name against the descriptor registry and drives it
//! through one generic engine. It owns the long-lived HTTP client, so TLS and
//! keep-alive connections to the vendors stay warm across calls.
//!
//! There is no vendor-specific code path here, and no vendor name in this file.
//! A provider exists because `resonus-providers` emitted a descriptor for it and
//! its secret is configured; asking for one that is not configured fails loudly
//! with the key that is missing.
//!
//! Env:
//!   RESONUS_PROVIDERS_DIR   descriptor artifacts (default `providers/dist`)
//!   LLM_GATE_QJS_LIB        QuickJS wrapper for warm hooks
//!   <NAME>_API_KEY          the secret a descriptor refers to as
//!                           `${secret:<name>}` — e.g. `${secret:openai}` reads
//!                           OPENAI_API_KEY
//!   RESONUS_ENDPOINT_FAST   `<provider>:<model>` for the `fast` endpoint
//!   RESONUS_ENDPOINT_HEAVY  `<provider>:<model>` for the `heavy` endpoint
//!
//! `fast` and `heavy` predate `RESONUS_ENDPOINT_*` and are still described by
//! the per-vendor variables every deployment was configured against, so they
//! keep resolving from those when no explicit spec is given:
//!
//!   OPENAI_REALTIME_FAST_MODEL   model behind `fast`
//!   OPENAI_REALTIME_HEAVY_MODEL  model behind `heavy`
//!   OPENAI_MODEL                 model behind `openai`, and behind `fast` /
//!                                `heavy` where realtime is not deployed

const std = @import("std");
const env = @import("../env.zig");
const engine_mod = @import("engine.zig");
const provider = @import("provider.zig");
const registry_mod = @import("registry.zig");
const ws_pool = @import("ws_pool.zig");

/// pthread mutex, matching the rest of this app.
const Mutex = struct {
    raw: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,

    fn lock(self: *Mutex) void {
        _ = std.c.pthread_mutex_lock(&self.raw);
    }

    fn unlock(self: *Mutex) void {
        _ = std.c.pthread_mutex_unlock(&self.raw);
    }
};

pub const Hub = struct {
    gpa: std.mem.Allocator,
    client: std.http.Client,
    registry: registry_mod.Registry,
    secrets: registry_mod.Secrets,
    engine: engine_mod.Engine,
    /// One pool per descriptor whose transport is a stateful session. Created
    /// lazily: a pool preconnects sockets, which is wasted unless that provider
    /// is actually used by this deployment.
    pools: std.ArrayList(Pool) = .empty,
    pools_mutex: Mutex = .{},

    const Pool = struct {
        provider_name: []const u8,
        pool: ws_pool.Pool,
    };

    pub const Endpoint = struct {
        provider_name: []const u8,
        model: []const u8,
    };

    pub fn init(gpa: std.mem.Allocator, io: std.Io) !Hub {
        var hub = Hub{
            .gpa = gpa,
            .client = .{ .allocator = gpa, .io = io },
            .registry = undefined,
            .secrets = undefined,
            .engine = undefined,
        };

        hub.registry = try registry_mod.Registry.init(gpa, .{
            .dir = env.opt("RESONUS_PROVIDERS_DIR") orelse "providers/dist",
            .qjs_lib = env.opt("LLM_GATE_QJS_LIB") orelse return error.QjsLibNotConfigured,
        });
        errdefer hub.registry.deinit();

        hub.secrets = try registry_mod.collectSecrets(gpa, &hub.registry);
        hub.engine = .{ .registry = &hub.registry, .secrets = &hub.secrets };
        return hub;
    }

    pub fn deinit(self: *Hub) void {
        for (self.pools.items) |*owned| owned.pool.deinit();
        self.pools.deinit(self.gpa);
        self.client.deinit();
        self.registry.deinit();
        registry_mod.freeSecrets(self.gpa, &self.secrets);
    }

    /// Public command-layer endpoints. Their provider/model mapping is
    /// deployment configuration, never a client-supplied pair.
    pub fn endpoint(self: *Hub, name: []const u8) !Endpoint {
        var buf: [64]u8 = undefined;
        var upper: [32]u8 = undefined;
        if (name.len >= upper.len) return error.EndpointUnknown;
        const key = std.fmt.bufPrintZ(&buf, "RESONUS_ENDPOINT_{s}", .{
            std.ascii.upperString(upper[0..name.len], name),
        }) catch return error.EndpointUnknown;

        const spec = env.opt(key) orelse return self.vendorEndpoint(name);
        const split = std.mem.indexOfScalar(u8, spec, ':') orelse return error.EndpointNotConfigured;
        const provider_name = spec[0..split];
        const model = spec[split + 1 ..];
        if (self.registry.find(provider_name) == null) return error.EndpointUnavailable;
        return .{ .provider_name = provider_name, .model = model };
    }

    /// The mapping `fast`, `heavy` and `openai` had before endpoints became a
    /// single `<provider>:<model>` string: the two tiers are realtime sessions,
    /// falling back to plain OpenAI wherever realtime is not deployed.
    fn vendorEndpoint(self: *Hub, name: []const u8) !Endpoint {
        const tier_model = if (std.mem.eql(u8, name, "fast"))
            "OPENAI_REALTIME_FAST_MODEL"
        else if (std.mem.eql(u8, name, "heavy"))
            "OPENAI_REALTIME_HEAVY_MODEL"
        else if (std.mem.eql(u8, name, "openai"))
            return self.openAiEndpoint()
        else
            return error.EndpointUnknown;

        if (self.registry.find("openai-realtime") != null) {
            if (env.opt(tier_model)) |model| {
                return .{ .provider_name = "openai-realtime", .model = model };
            }
        }
        return self.openAiEndpoint();
    }

    fn openAiEndpoint(self: *Hub) !Endpoint {
        if (self.registry.find("openai") == null) return error.EndpointUnavailable;
        const model = env.opt("OPENAI_MODEL") orelse return error.EndpointNotConfigured;
        return .{ .provider_name = "openai", .model = model };
    }

    /// Acquire a provider-side session for a logical chat session.
    ///
    /// Only meaningful for a stateful transport, where the vendor keeps
    /// conversation state on the connection. For a stateless provider there is
    /// nothing to bind, and saying so is not an error.
    pub fn bindEndpoint(self: *Hub, endpoint_name: []const u8, session_id: []const u8) !void {
        const target = try self.endpoint(endpoint_name);
        const entry = self.registry.find(target.provider_name) orelse return error.EndpointUnavailable;
        if (!entry.table.transport.stateful) return;
        const pool = try self.poolFor(entry, target.model);
        try pool.bind(target.model, session_id);
    }

    /// Release every provider-side session held for this logical session.
    pub fn releaseSession(self: *Hub, session_id: []const u8) void {
        self.pools_mutex.lock();
        defer self.pools_mutex.unlock();
        for (self.pools.items) |*owned| owned.pool.releaseSession(session_id);
    }

    /// The pool serving one provider, created on first use.
    fn poolFor(self: *Hub, entry: *registry_mod.Entry, model: []const u8) !*ws_pool.Pool {
        self.pools_mutex.lock();
        defer self.pools_mutex.unlock();

        for (self.pools.items) |*owned| {
            if (std.mem.eql(u8, owned.provider_name, entry.name())) return &owned.pool;
        }

        const idle: usize = entry.table.transport.idle_per_model orelse 3;
        try self.pools.append(self.gpa, .{
            .provider_name = entry.name(),
            .pool = try ws_pool.Pool.init(self.gpa, .{
                .entry = entry,
                .registry = &self.registry,
                .secrets = &self.secrets,
                .idle_per_model = idle,
            }, &.{model}),
        });
        const owned = &self.pools.items[self.pools.items.len - 1];
        owned.pool.rebindModelOwners();
        return &owned.pool;
    }

    /// One `rt.llm` call: uniform request JSON in, uniform response (or a loud
    /// error line) out. `a` is the per-step arena.
    pub fn complete(self: *Hub, a: std.mem.Allocator, request_json: []const u8) !provider.Reply {
        const root = std.json.parseFromSliceLeaky(std.json.Value, a, request_json, .{}) catch
            return provider.errReply(a, "rt.llm: request is not valid JSON", .{});
        if (root != .object)
            return provider.errReply(a, "rt.llm: request must be an object", .{});

        const name = provider.strField(root, "provider") orelse
            return provider.errReply(a, "rt.llm: missing 'provider'", .{});
        const req = self.parseRequest(root) catch |err|
            return provider.errReply(a, "rt.llm: {s}", .{@errorName(err)});

        const entry = self.registry.find(name) orelse
            return provider.errReply(a, "rt.llm: provider '{s}' is not loaded ({s})", .{ name, self.known(a) });

        return self.engine.complete(a, entry, &self.client, req);
    }

    /// Streams one normalized chat turn. This bypasses the workflow VM and is
    /// the latency-critical path used by the Fujin chat gateway.
    pub fn stream(
        self: *Hub,
        a: std.mem.Allocator,
        request_json: []const u8,
        sink: provider.StreamSink,
    ) !provider.Completion {
        const root = std.json.parseFromSliceLeaky(std.json.Value, a, request_json, .{}) catch
            return error.InvalidRequest;
        if (root != .object) return error.InvalidRequest;
        const name = provider.strField(root, "provider") orelse return error.ProviderMissing;
        const req = try self.parseRequest(root);

        const entry = self.registry.find(name) orelse {
            std.log.err("chat.stream: provider '{s}' is not loaded", .{name});
            return error.ProviderUnavailable;
        };
        if (entry.table.transport.kind == .ws) {
            const pool = try self.poolFor(entry, req.model);
            const session_id = req.session_id orelse return error.SessionIdRequired;
            return pool.stream(a, session_id, req, sink);
        }
        return self.engine.stream(a, entry, &self.client, req, sink);
    }

    pub fn streamEndpoint(
        self: *Hub,
        a: std.mem.Allocator,
        endpoint_name: []const u8,
        session_id: []const u8,
        messages_json: []const u8,
        tools_json: []const u8,
        max_tokens: i64,
        require_tool: bool,
        sink: provider.StreamSink,
    ) !provider.Completion {
        const target = try self.endpoint(endpoint_name);
        const provider_json = try provider.jsonStr(a, target.provider_name);
        const session_json = try provider.jsonStr(a, session_id);
        const model_json = try provider.jsonStr(a, target.model);
        const request_json = try std.fmt.allocPrint(
            a,
            "{{\"provider\":{s},\"sessionId\":{s},\"model\":{s},\"maxTokens\":{d},\"messages\":{s},\"tools\":{s},\"requireTool\":{}}}",
            .{ provider_json, session_json, model_json, max_tokens, messages_json, tools_json, require_tool },
        );
        return self.stream(a, request_json, sink);
    }

    fn parseRequest(self: *Hub, root: std.json.Value) !provider.ChatRequest {
        _ = self;
        const model = provider.strField(root, "model") orelse return error.ModelMissing;
        const max_tokens = provider.intField(root, "maxTokens") orelse return error.MaxTokensMissing;
        const messages = provider.arrField(root, "messages") orelse return error.MessagesMissing;
        if (messages.len == 0) return error.MessagesEmpty;
        const temperature: ?f64 = if (provider.field(root, "temperature")) |t| switch (t) {
            .float => |f| f,
            .integer => |n| @floatFromInt(n),
            else => return error.InvalidTemperature,
        } else null;
        return .{
            .model = model,
            .session_id = provider.strField(root, "sessionId"),
            .max_tokens = max_tokens,
            .temperature = temperature,
            .messages = messages,
            .tools = provider.arrField(root, "tools") orelse &.{},
            .require_tool = provider.boolField(root, "requireTool") orelse false,
        };
    }

    fn known(self: *Hub, a: std.mem.Allocator) []const u8 {
        var out: std.ArrayList(u8) = .empty;
        for (self.registry.entries, 0..) |entry, i| {
            if (i > 0) out.appendSlice(a, ", ") catch return "";
            out.appendSlice(a, entry.table.name) catch return "";
        }
        return out.items;
    }
};
