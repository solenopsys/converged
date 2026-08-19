//! The LLM provider hub: parses the uniform `rt.llm` request, resolves the
//! provider, and owns the one long-lived HTTP client so TLS/keep-alive
//! connections to the vendors stay warm across calls.
//!
//! Providers register only when their API key is present in the environment;
//! asking for an unregistered one fails loudly with the exact env var to set.
//! Nothing is defaulted here: provider, model, maxTokens and messages always
//! come from the workflow script.
//!
//! Env:
//!   OPENAI_API_KEY                        enables provider "openai"
//!   ANTHROPIC_API_KEY (or CLAUDE_API_KEY) enables provider "claude"
//!   GEMINI_API_KEY                        enables provider "gemini"
//!   RT_OPENAI_BASE_URL / RT_ANTHROPIC_BASE_URL / RT_GEMINI_BASE_URL
//!                                         optional endpoint overrides (proxies)

const std = @import("std");
const env = @import("../env.zig");
const provider = @import("provider.zig");
const openai = @import("openai.zig");
const openai_realtime = @import("openai_realtime.zig");
const claude = @import("claude.zig");
const gemini = @import("gemini.zig");

pub const Hub = struct {
    gpa: std.mem.Allocator,
    client: std.http.Client,
    openai_cfg: ?*openai.Config = null,
    realtime_pool: ?*openai_realtime.Pool = null,
    claude_cfg: ?*claude.Config = null,
    gemini_cfg: ?*gemini.Config = null,

    pub const Endpoint = struct {
        provider_name: []const u8,
        model: []const u8,
    };

    pub fn init(gpa: std.mem.Allocator, io: std.Io) !Hub {
        var hub = Hub{ .gpa = gpa, .client = .{ .allocator = gpa, .io = io } };
        errdefer hub.deinit();

        if (env.opt("OPENAI_API_KEY")) |key| {
            const cfg = try gpa.create(openai.Config);
            cfg.* = .{ .api_key = key, .base_url = env.opt("RT_OPENAI_BASE_URL") orelse openai.default_base_url };
            hub.openai_cfg = cfg;
            if (env.opt("OPENAI_REALTIME_FAST_MODEL")) |fast_model| {
                const pool = try gpa.create(openai_realtime.Pool);
                const idle_per_model = parsePoolSize(env.opt("OPENAI_REALTIME_IDLE_PER_MODEL"));
                if (openai_realtime.Pool.init(gpa, .{
                    .api_key = key,
                    .base_url = env.opt("OPENAI_REALTIME_URL") orelse "wss://api.openai.com/v1/realtime",
                    .idle_per_model = idle_per_model,
                }, fast_model, env.opt("OPENAI_REALTIME_HEAVY_MODEL"))) |ready_pool| {
                    pool.* = ready_pool;
                    pool.rebindModelOwners();
                    hub.realtime_pool = pool;
                    std.debug.print("resonus: realtime pool ready: fast={s} heavy={s} idle_per_model={d}\n", .{
                        fast_model,
                        env.opt("OPENAI_REALTIME_HEAVY_MODEL") orelse "disabled",
                        idle_per_model,
                    });
                } else |err| {
                    gpa.destroy(pool);
                    std.log.warn("resonus: realtime pool unavailable ({s}); using HTTP OpenAI adapter", .{@errorName(err)});
                }
            }
        }
        if (env.opt("ANTHROPIC_API_KEY") orelse env.opt("CLAUDE_API_KEY")) |key| {
            const cfg = try gpa.create(claude.Config);
            cfg.* = .{ .api_key = key, .base_url = env.opt("RT_ANTHROPIC_BASE_URL") orelse claude.default_base_url };
            hub.claude_cfg = cfg;
        }
        if (env.opt("GEMINI_API_KEY")) |key| {
            const cfg = try gpa.create(gemini.Config);
            cfg.* = .{ .api_key = key, .base_url = env.opt("RT_GEMINI_BASE_URL") orelse gemini.default_base_url };
            hub.gemini_cfg = cfg;
        }

        std.debug.print("resonus: llm hub: openai={} realtime={} claude={} gemini={}\n", .{
            hub.openai_cfg != null, hub.realtime_pool != null, hub.claude_cfg != null, hub.gemini_cfg != null,
        });
        return hub;
    }

    pub fn deinit(self: *Hub) void {
        self.client.deinit();
        if (self.realtime_pool) |pool| {
            pool.deinit();
            self.gpa.destroy(pool);
        }
        if (self.openai_cfg) |c| self.gpa.destroy(c);
        if (self.claude_cfg) |c| self.gpa.destroy(c);
        if (self.gemini_cfg) |c| self.gpa.destroy(c);
    }

    fn resolve(self: *Hub, name: []const u8) ?provider.Provider {
        if (std.mem.eql(u8, name, "openai")) {
            if (self.openai_cfg) |c| return openai.make(c);
        } else if (std.mem.eql(u8, name, "openai-realtime") or std.mem.eql(u8, name, "realtime")) {
            if (self.realtime_pool) |pool| return openai_realtime.make(pool);
            // Matches the startup log ("realtime pool unavailable; using HTTP
            // OpenAI adapter"): the pool is a latency optimization, not a hard
            // requirement — degrade to the plain HTTP adapter instead of
            // failing every chat turn when it can't come up.
            if (self.openai_cfg) |c| return openai.make(c);
        } else if (std.mem.eql(u8, name, "claude") or std.mem.eql(u8, name, "anthropic")) {
            if (self.claude_cfg) |c| return claude.make(c);
        } else if (std.mem.eql(u8, name, "gemini") or std.mem.eql(u8, name, "google")) {
            if (self.gemini_cfg) |c| return gemini.make(c);
        }
        return null;
    }

    /// Public command-layer endpoints. Their vendor/model mapping is deployment
    /// configuration, never a client supplied provider/model pair.
    pub fn endpoint(self: *Hub, name: []const u8) !Endpoint {
        if (std.mem.eql(u8, name, "fast")) {
            if (self.realtime_pool != null) {
                return .{ .provider_name = "openai-realtime", .model = env.opt("OPENAI_REALTIME_FAST_MODEL") orelse return error.EndpointNotConfigured };
            }
            if (self.openai_cfg != null) return .{ .provider_name = "openai", .model = openAiModel() };
            return error.EndpointUnavailable;
        }
        if (std.mem.eql(u8, name, "heavy")) {
            if (self.realtime_pool != null) {
                return .{ .provider_name = "openai-realtime", .model = env.opt("OPENAI_REALTIME_HEAVY_MODEL") orelse return error.EndpointNotConfigured };
            }
            if (self.openai_cfg != null) return .{ .provider_name = "openai", .model = openAiModel() };
            return error.EndpointUnavailable;
        }
        if (std.mem.eql(u8, name, "openai")) {
            if (self.openai_cfg == null) return error.EndpointUnavailable;
            return .{ .provider_name = "openai", .model = openAiModel() };
        }
        return error.EndpointUnknown;
    }

    pub fn bindEndpoint(self: *Hub, endpoint_name: []const u8, session_id: []const u8) !void {
        const target = try self.endpoint(endpoint_name);
        if (std.mem.eql(u8, target.provider_name, "openai-realtime")) {
            const pool = self.realtime_pool orelse return error.EndpointUnavailable;
            try pool.bind(target.model, session_id);
        }
    }

    pub fn releaseSession(self: *Hub, session_id: []const u8) void {
        if (self.realtime_pool) |pool| pool.releaseSession(session_id);
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

    /// One `rt.llm` call: uniform request JSON in, uniform response (or a loud
    /// error line) out. `a` is the per-step arena.
    pub fn complete(self: *Hub, a: std.mem.Allocator, request_json: []const u8) !provider.Reply {
        const root = std.json.parseFromSliceLeaky(std.json.Value, a, request_json, .{}) catch
            return provider.errReply(a, "rt.llm: request is not valid JSON", .{});
        if (root != .object)
            return provider.errReply(a, "rt.llm: request must be an object", .{});

        const name = provider.strField(root, "provider") orelse
            return provider.errReply(a, "rt.llm: missing 'provider' (openai | claude | gemini)", .{});
        const model = provider.strField(root, "model") orelse
            return provider.errReply(a, "rt.llm: missing 'model'", .{});
        const max_tokens = provider.intField(root, "maxTokens") orelse
            return provider.errReply(a, "rt.llm: missing 'maxTokens' (explicit token budget required)", .{});
        const messages = provider.arrField(root, "messages") orelse
            return provider.errReply(a, "rt.llm: missing 'messages' array", .{});
        if (messages.len == 0)
            return provider.errReply(a, "rt.llm: 'messages' is empty", .{});

        const temperature: ?f64 = if (provider.field(root, "temperature")) |t| switch (t) {
            .float => |f| f,
            .integer => |n| @floatFromInt(n),
            else => return provider.errReply(a, "rt.llm: 'temperature' must be a number", .{}),
        } else null;

        const tools: []const std.json.Value = provider.arrField(root, "tools") orelse &.{};

        const p = self.resolve(name) orelse {
            if (isKnown(name))
                return provider.errReply(a, "rt.llm: provider '{s}' is not configured ({s})", .{ name, keyHint(name) });
            return provider.errReply(a, "rt.llm: unknown provider '{s}' (known: openai, claude, gemini)", .{name});
        };

        return p.complete(p.ctx, .{ .alloc = a, .client = &self.client }, .{
            .model = model,
            .max_tokens = max_tokens,
            .temperature = temperature,
            .messages = messages,
            .tools = tools,
        });
    }

    /// Streams one normalized chat turn. This bypasses the workflow VM and is
    /// the latency-critical path used by the Fujin chat gateway.
    pub fn stream(self: *Hub, a: std.mem.Allocator, request_json: []const u8, sink: provider.StreamSink) !provider.Completion {
        const root = std.json.parseFromSliceLeaky(std.json.Value, a, request_json, .{}) catch return error.InvalidRequest;
        if (root != .object) return error.InvalidRequest;
        const name = provider.strField(root, "provider") orelse return error.ProviderMissing;
        const model = provider.strField(root, "model") orelse return error.ModelMissing;
        const max_tokens = provider.intField(root, "maxTokens") orelse return error.MaxTokensMissing;
        const messages = provider.arrField(root, "messages") orelse return error.MessagesMissing;
        if (messages.len == 0) return error.MessagesEmpty;
        const temperature: ?f64 = if (provider.field(root, "temperature")) |t| switch (t) {
            .float => |f| f,
            .integer => |n| @floatFromInt(n),
            else => return error.InvalidTemperature,
        } else null;
        const tools: []const std.json.Value = provider.arrField(root, "tools") orelse &.{};
        const require_tool = provider.boolField(root, "requireTool") orelse false;
        std.debug.print("resonus: chat.stream: provider={s} model={s}\n", .{ name, model });
        const p = self.resolve(name) orelse {
            std.debug.print(
                "resonus: chat.stream: provider '{s}' unavailable (openai={} realtime={} claude={} gemini={})\n",
                .{ name, self.openai_cfg != null, self.realtime_pool != null, self.claude_cfg != null, self.gemini_cfg != null },
            );
            return error.ProviderUnavailable;
        };
        const stream_fn = p.stream orelse return error.StreamUnsupported;
        return stream_fn(p.ctx, .{ .alloc = a, .client = &self.client }, .{
            .model = model,
            .session_id = provider.strField(root, "sessionId"),
            .max_tokens = max_tokens,
            .temperature = temperature,
            .messages = messages,
            .tools = tools,
            .require_tool = require_tool,
        }, sink);
    }
};

fn openAiModel() []const u8 {
    return env.opt("OPENAI_MODEL") orelse "gpt-5.4-nano";
}

test "fast and heavy endpoints fall back to OpenAI when realtime is unavailable" {
    var cfg = openai.Config{ .api_key = "test" };
    const hub = Hub{
        .gpa = std.testing.allocator,
        .client = undefined,
        .openai_cfg = &cfg,
    };
    const fast = try hub.endpoint("fast");
    const heavy = try hub.endpoint("heavy");
    try std.testing.expectEqualStrings("openai", fast.provider_name);
    try std.testing.expectEqualStrings("openai", heavy.provider_name);
    try std.testing.expectEqualStrings(openAiModel(), fast.model);
    try std.testing.expectEqualStrings(openAiModel(), heavy.model);
}

fn parsePoolSize(value: ?[]const u8) usize {
    const parsed = if (value) |text| std.fmt.parseInt(usize, text, 10) catch 3 else 3;
    return @min(@max(parsed, 1), 16);
}

test "realtime idle pool size is bounded" {
    try std.testing.expectEqual(@as(usize, 3), parsePoolSize(null));
    try std.testing.expectEqual(@as(usize, 4), parsePoolSize("4"));
    try std.testing.expectEqual(@as(usize, 1), parsePoolSize("0"));
    try std.testing.expectEqual(@as(usize, 3), parsePoolSize("invalid"));
    try std.testing.expectEqual(@as(usize, 16), parsePoolSize("100"));
}

fn isKnown(name: []const u8) bool {
    const known = [_][]const u8{ "openai", "claude", "anthropic", "gemini", "google" };
    for (known) |k| if (std.mem.eql(u8, name, k)) return true;
    return false;
}

fn keyHint(name: []const u8) []const u8 {
    if (std.mem.eql(u8, name, "openai")) return "set OPENAI_API_KEY";
    if (std.mem.eql(u8, name, "gemini") or std.mem.eql(u8, name, "google")) return "set GEMINI_API_KEY";
    return "set ANTHROPIC_API_KEY";
}
