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
const claude = @import("claude.zig");
const gemini = @import("gemini.zig");

pub const Hub = struct {
    gpa: std.mem.Allocator,
    client: std.http.Client,
    openai_cfg: ?*openai.Config = null,
    claude_cfg: ?*claude.Config = null,
    gemini_cfg: ?*gemini.Config = null,

    pub fn init(gpa: std.mem.Allocator, io: std.Io) !Hub {
        var hub = Hub{ .gpa = gpa, .client = .{ .allocator = gpa, .io = io } };

        if (env.opt("OPENAI_API_KEY")) |key| {
            const cfg = try gpa.create(openai.Config);
            cfg.* = .{ .api_key = key, .base_url = env.opt("RT_OPENAI_BASE_URL") orelse openai.default_base_url };
            hub.openai_cfg = cfg;
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

        std.debug.print("centimanus: llm hub: openai={} claude={} gemini={}\n", .{
            hub.openai_cfg != null, hub.claude_cfg != null, hub.gemini_cfg != null,
        });
        return hub;
    }

    pub fn deinit(self: *Hub) void {
        self.client.deinit();
        if (self.openai_cfg) |c| self.gpa.destroy(c);
        if (self.claude_cfg) |c| self.gpa.destroy(c);
        if (self.gemini_cfg) |c| self.gpa.destroy(c);
    }

    fn resolve(self: *Hub, name: []const u8) ?provider.Provider {
        if (std.mem.eql(u8, name, "openai")) {
            if (self.openai_cfg) |c| return openai.make(c);
        } else if (std.mem.eql(u8, name, "claude") or std.mem.eql(u8, name, "anthropic")) {
            if (self.claude_cfg) |c| return claude.make(c);
        } else if (std.mem.eql(u8, name, "gemini") or std.mem.eql(u8, name, "google")) {
            if (self.gemini_cfg) |c| return gemini.make(c);
        }
        return null;
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
};

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
