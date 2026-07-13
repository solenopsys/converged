const std = @import("std");

const redis_mod = @import("../native/redis_client.zig");
const http_util = @import("../util/http.zig");
const json_util = @import("../util/json.zig");
const clock = @import("../util/clock.zig");

const KEY_SEPARATOR = ":";
const AUDIO_PREFIX = "llm-audio";
const DEFAULT_FRAGMENT_DURATION_MS = 20;

const Mutex = struct {
    raw: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,

    fn lock(self: *Mutex) void {
        _ = std.c.pthread_mutex_lock(&self.raw);
    }

    fn unlock(self: *Mutex) void {
        _ = std.c.pthread_mutex_unlock(&self.raw);
    }
};

pub const Source = enum {
    user,
    assistant,

    pub fn str(self: Source) []const u8 {
        return switch (self) {
            .user => "user",
            .assistant => "assistant",
        };
    }

    pub fn fromStr(s: []const u8) ?Source {
        if (std.mem.eql(u8, s, "user")) return .user;
        if (std.mem.eql(u8, s, "assistant")) return .assistant;
        return null;
    }
};

pub const AudioFrame = struct {
    timestamp_ns: i64,
    data: []u8,

    pub fn deinit(self: *AudioFrame, allocator: std.mem.Allocator) void {
        allocator.free(self.data);
    }
};

pub const Context = struct {
    instructions: []u8,
    language: []u8,

    pub fn deinit(self: *Context, allocator: std.mem.Allocator) void {
        allocator.free(self.instructions);
        allocator.free(self.language);
        self.* = undefined;
    }
};

/// Inbound route for a dialed number. Exactly one of context_id (LLM answers)
/// or transfer_uri (bridge to a human over the provider SIP trunk) is set.
pub const PhoneRoute = struct {
    context_id: ?[]u8 = null,
    transfer_uri: ?[]u8 = null,
    /// Optional transcription language hint for the transfer mode.
    transfer_language: ?[]u8 = null,

    pub fn deinit(self: *PhoneRoute, allocator: std.mem.Allocator) void {
        if (self.context_id) |v| allocator.free(v);
        if (self.transfer_uri) |v| allocator.free(v);
        if (self.transfer_language) |v| allocator.free(v);
        self.* = undefined;
    }
};


pub const StoreConfig = struct {
    services_url: []const u8,
    service_token: ?[]const u8,
    valkey_url: []const u8,
    valkey_key_prefix: []const u8,
    valkey_ttl_seconds: u32,
};

const FragmentRef = struct {
    cache_key: []u8,
    source: Source,
    timestamp_ns: i64,
    size_bytes: usize,

    fn deinit(self: *FragmentRef, allocator: std.mem.Allocator) void {
        allocator.free(self.cache_key);
    }
};

const SessionState = struct {
    id: []u8,
    scope: []u8,
    user: []u8,
    start_ns: i64,
    fragments: std.ArrayList(FragmentRef),

    fn deinit(self: *SessionState, allocator: std.mem.Allocator) void {
        allocator.free(self.id);
        allocator.free(self.scope);
        allocator.free(self.user);
        for (self.fragments.items) |*fragment| fragment.deinit(allocator);
        self.fragments.deinit(allocator);
    }
};

pub const Store = struct {
    allocator: std.mem.Allocator,
    services_url: []u8,
    service_token: ?[]u8,
    redis: redis_mod.Client,
    sessions: std.StringHashMap(SessionState),
    mutex: Mutex,
    transcript_mutex: Mutex,

    pub fn init(allocator: std.mem.Allocator, cfg: StoreConfig) !Store {
        const services_url = try trimTrailingSlashOwned(allocator, cfg.services_url);
        errdefer allocator.free(services_url);
        const service_token = if (cfg.service_token) |token| try allocator.dupe(u8, token) else null;
        errdefer if (service_token) |token| allocator.free(token);
        var redis = try redis_mod.Client.init(allocator, .{
            .url = cfg.valkey_url,
            .key_prefix = cfg.valkey_key_prefix,
            .ttl_seconds = cfg.valkey_ttl_seconds,
        });
        errdefer redis.deinit();

        return .{
            .allocator = allocator,
            .services_url = services_url,
            .service_token = service_token,
            .redis = redis,
            .sessions = std.StringHashMap(SessionState).init(allocator),
            .mutex = .{},
            .transcript_mutex = .{},
        };
    }

    pub fn deinit(self: *Store) void {
        var it = self.sessions.iterator();
        while (it.next()) |entry| {
            self.allocator.free(entry.key_ptr.*);
            entry.value_ptr.deinit(self.allocator);
        }
        self.sessions.deinit();
        self.redis.deinit();
        self.allocator.free(self.services_url);
        if (self.service_token) |token| self.allocator.free(token);
        self.* = undefined;
    }

    pub fn bindSession(self: *Store, session_id: []const u8, domain: []const u8) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        // Idempotent: re-binding a LIVE session must never drop its accumulated
        // audio fragment refs. Read endpoints (/transcript, /record) call
        // bindSessionDomain on every request, so a transcript poll mid-call would
        // otherwise wipe the FragmentRef list — flushAudioFragments then dumped
        // nothing and the call showed no recording even though the raw Opus frames
        // were already in Valkey. Only refresh the scope; keep fragments + tail.
        if (self.sessions.getPtr(session_id)) |state| {
            if (!std.mem.eql(u8, state.scope, domain)) {
                const scope = try self.allocator.dupe(u8, domain);
                self.allocator.free(state.scope);
                state.scope = scope;
            }
            return;
        }

        const id = try self.allocator.dupe(u8, session_id);
        errdefer self.allocator.free(id);
        const key = try self.allocator.dupe(u8, session_id);
        errdefer self.allocator.free(key);
        const scope = try self.allocator.dupe(u8, domain);
        errdefer self.allocator.free(scope);
        const user = try self.allocator.dupe(u8, "");
        errdefer self.allocator.free(user);

        try self.sessions.put(key, .{
            .id = id,
            .scope = scope,
            .user = user,
            .start_ns = 0,
            .fragments = std.ArrayList(FragmentRef).empty,
        });
    }

    pub fn unbindSession(self: *Store, session_id: []const u8) void {
        self.flushAudioFragments(session_id) catch |err| {
            std.log.warn("store: audio fragment dump failed before unbind (session={s}): {s}", .{ session_id, @errorName(err) });
        };
        self.mutex.lock();
        defer self.mutex.unlock();
        if (self.sessions.fetchRemove(session_id)) |old| {
            self.allocator.free(old.key);
            var state = old.value;
            state.deinit(self.allocator);
        }
    }

    pub fn putContext(self: *Store, domain: []const u8, name: []const u8, language: []const u8, data: []const u8) !void {
        var body = try std.ArrayList(u8).initCapacity(self.allocator, name.len + language.len + data.len + 96);
        defer body.deinit(self.allocator);
        try body.appendSlice(self.allocator, "{\"input\":{\"name\":");
        try json_util.appendQuoted(&body, self.allocator, name);
        try body.appendSlice(self.allocator, ",\"language\":");
        try json_util.appendQuoted(&body, self.allocator, language);
        try body.appendSlice(self.allocator, ",\"data\":");
        try json_util.appendQuoted(&body, self.allocator, data);
        try body.appendSlice(self.allocator, "}}");
        var resp = try self.post("contexts", "saveContext", body.items, domain);
        defer resp.deinit(self.allocator);
        try ensureOk(resp.status);
    }

    pub fn getContext(self: *Store, allocator: std.mem.Allocator, domain: []const u8, name: []const u8, language: ?[]const u8) !?Context {
        var body = try std.ArrayList(u8).initCapacity(self.allocator, name.len + 64);
        defer body.deinit(self.allocator);
        try body.appendSlice(self.allocator, "{\"name\":");
        try json_util.appendQuoted(&body, self.allocator, name);
        if (language) |lang| {
            try body.appendSlice(self.allocator, ",\"language\":");
            try json_util.appendQuoted(&body, self.allocator, lang);
        }
        try body.append(self.allocator, '}');

        var resp = try self.post("contexts", "getContext", body.items, domain);
        defer resp.deinit(self.allocator);
        try ensureOk(resp.status);
        return parseContextResponse(allocator, resp.body);
    }

    pub fn deleteContext(self: *Store, domain: []const u8, name: []const u8) !void {
        var body = try std.ArrayList(u8).initCapacity(self.allocator, name.len + 32);
        defer body.deinit(self.allocator);
        try body.appendSlice(self.allocator, "{\"name\":");
        try json_util.appendQuoted(&body, self.allocator, name);
        try body.append(self.allocator, '}');
        var resp = try self.post("contexts", "deleteContext", body.items, domain);
        defer resp.deinit(self.allocator);
        try ensureOk(resp.status);
    }

    pub fn resolvePhoneContextId(self: *Store, allocator: std.mem.Allocator, domain: []const u8, dialed: []const u8) !?[]u8 {
        var route = (try self.resolvePhoneRoute(allocator, domain, dialed)) orelse return null;
        if (route.context_id) |context_id| {
            route.context_id = null;
            route.deinit(allocator);
            return context_id;
        }
        route.deinit(allocator);
        return null;
    }

    /// Resolve the dialed number to its inbound route: either a call context
    /// (LLM answers) or a human transfer target (call is bridged over the
    /// provider SIP trunk). `gateway.transfer` wins over `gateway.contextId`.
    pub fn resolvePhoneRoute(self: *Store, allocator: std.mem.Allocator, domain: []const u8, dialed: []const u8) !?PhoneRoute {
        var resp = try self.post("audiogate", "listPhoneNumbers", "{\"params\":{\"kind\":\"ip-telephony\",\"enabledOnly\":true,\"limit\":10000}}", domain);
        defer resp.deinit(self.allocator);
        try ensureOk(resp.status);
        return parsePhoneRoute(allocator, resp.body, dialed);
    }

    pub fn listContextKeys(self: *Store, allocator: std.mem.Allocator, domain: []const u8) ![][]u8 {
        var resp = try self.post("contexts", "listContexts", "{\"params\":{\"limit\":10000}}", domain);
        defer resp.deinit(self.allocator);
        try ensureOk(resp.status);
        return parseContextKeys(allocator, resp.body);
    }

    pub fn putSession(self: *Store, session_id: []const u8, user: []const u8, start_ns: i64) !void {
        var scope_owned: []u8 = undefined;
        self.mutex.lock();
        if (self.sessions.getPtr(session_id)) |state| {
            self.allocator.free(state.user);
            state.user = try self.allocator.dupe(u8, user);
            state.start_ns = start_ns;
            scope_owned = try self.allocator.dupe(u8, state.scope);
        } else {
            self.mutex.unlock();
            return error.UnboundWorkspaceSession;
        }
        self.mutex.unlock();
        defer self.allocator.free(scope_owned);

        const started_ms = @divTrunc(start_ns, std.time.ns_per_ms);
        var body = try std.ArrayList(u8).initCapacity(self.allocator, session_id.len * 5 + user.len + 160);
        defer body.deinit(self.allocator);
        try body.appendSlice(self.allocator, "{\"input\":{\"callId\":");
        try json_util.appendQuoted(&body, self.allocator, session_id);
        try body.appendSlice(self.allocator, ",\"startedAt\":");
        try appendInt(&body, self.allocator, started_ms);
        try body.appendSlice(self.allocator, ",\"phone\":");
        try json_util.appendQuoted(&body, self.allocator, user);
        try body.appendSlice(self.allocator, ",\"threadId\":");
        try json_util.appendQuoted(&body, self.allocator, session_id);
        try body.appendSlice(self.allocator, ",\"recordId\":");
        try json_util.appendQuoted(&body, self.allocator, session_id);
        try body.appendSlice(self.allocator, ",\"audioId\":");
        try json_util.appendQuoted(&body, self.allocator, session_id);
        try body.appendSlice(self.allocator, "}}");

        var resp = try self.post("calls", "registerCall", body.items, scope_owned);
        defer resp.deinit(self.allocator);
        try ensureOk(resp.status);
        std.log.info("store: session {s} registered via calls API", .{session_id});
    }

    pub fn listSessions(self: *Store, allocator: std.mem.Allocator, domain: []const u8) ![][]u8 {
        var resp = try self.post("calls", "listCalls", "{\"params\":{\"offset\":0,\"limit\":10000}}", domain);
        defer resp.deinit(self.allocator);
        try ensureOk(resp.status);
        return parseCallIds(allocator, resp.body);
    }

    pub fn listUserSessions(self: *Store, allocator: std.mem.Allocator, domain: []const u8, user: []const u8) ![][]u8 {
        var body = try std.ArrayList(u8).initCapacity(self.allocator, user.len + 80);
        defer body.deinit(self.allocator);
        try body.appendSlice(self.allocator, "{\"params\":{\"offset\":0,\"limit\":10000,\"phone\":");
        try json_util.appendQuoted(&body, self.allocator, user);
        try body.appendSlice(self.allocator, "}}");
        var resp = try self.post("calls", "listCalls", body.items, domain);
        defer resp.deinit(self.allocator);
        try ensureOk(resp.status);
        return parseCallIds(allocator, resp.body);
    }

    pub fn putAudioFrame(self: *Store, session_id: []const u8, source: Source, timestamp_ns: i64, data: []const u8) !void {
        self.mutex.lock();
        const bound = self.sessions.contains(session_id);
        self.mutex.unlock();
        if (!bound) return error.UnboundWorkspaceSession;

        var ts_buf: [32]u8 = undefined;
        const ts = try std.fmt.bufPrint(&ts_buf, "{d:0>20}", .{@as(u64, @intCast(@max(timestamp_ns, 0)))});
        const cache_key = try self.redis.buildKey(self.allocator, &.{ "centimanus", "fragments", session_id, source.str(), ts });
        errdefer self.allocator.free(cache_key);
        try self.redis.setBytes(cache_key, data);

        self.mutex.lock();
        defer self.mutex.unlock();
        const state = self.sessions.getPtr(session_id) orelse return error.UnboundWorkspaceSession;
        try state.fragments.append(self.allocator, .{
            .cache_key = cache_key,
            .source = source,
            .timestamp_ns = timestamp_ns,
            .size_bytes = data.len,
        });
    }

    pub fn getAudioFrames(self: *Store, allocator: std.mem.Allocator, session_id: []const u8, source: Source) ![]AudioFrame {
        const pattern = try self.redis.buildKey(self.allocator, &.{ "centimanus", "fragments", session_id, source.str(), "*" });
        defer self.allocator.free(pattern);
        const keys = try self.redis.keys(allocator, pattern);
        defer {
            for (keys) |key| allocator.free(key);
            allocator.free(keys);
        }
        std.mem.sort([]u8, keys, {}, lessThanBytes);

        var frames = try std.ArrayList(AudioFrame).initCapacity(allocator, keys.len);
        errdefer {
            for (frames.items) |*frame| frame.deinit(allocator);
            frames.deinit(allocator);
        }

        for (keys) |key| {
            const data = (try self.redis.getBytes(allocator, key)) orelse continue;
            errdefer allocator.free(data);
            const ts = timestampFromKey(key);
            try frames.append(allocator, .{ .timestamp_ns = ts, .data = data });
        }
        return frames.toOwnedSlice(allocator);
    }

    pub fn deleteAudioFrames(self: *Store, session_id: []const u8) !void {
        for ([_]Source{ .user, .assistant }) |source| {
            const pattern = try self.redis.buildKey(self.allocator, &.{ "centimanus", "fragments", session_id, source.str(), "*" });
            defer self.allocator.free(pattern);
            const keys = try self.redis.keys(self.allocator, pattern);
            defer {
                for (keys) |key| self.allocator.free(key);
                self.allocator.free(keys);
            }
            for (keys) |key| self.redis.delete(key) catch |err| {
                std.log.warn("store: Valkey DEL failed for {s}: {s}", .{ key, @errorName(err) });
            };
        }
    }

    pub fn putTranscriptPhrase(self: *Store, session_id: []const u8, source: Source, timestamp_unix: i64, text: []const u8) !void {
        // Write-only: the gate persists each recognised phrase to ms-threads and
        // never reads transcripts back. Phrases are ordered by their timestamp on
        // read (ms-calls / the UI sort by it), so no beforeId chaining is kept.
        self.transcript_mutex.lock();
        defer self.transcript_mutex.unlock();

        const scope = try self.scopeForSession(session_id);
        defer self.allocator.free(scope);

        const message_id = try transcriptMessageId(self.allocator, session_id, source, text);
        defer self.allocator.free(message_id);

        var body = try std.ArrayList(u8).initCapacity(self.allocator, session_id.len + message_id.len + text.len + 160);
        defer body.deinit(self.allocator);
        try body.appendSlice(self.allocator, "{\"message\":{\"threadId\":");
        try json_util.appendQuoted(&body, self.allocator, session_id);
        try body.appendSlice(self.allocator, ",\"id\":");
        try json_util.appendQuoted(&body, self.allocator, message_id);
        try body.appendSlice(self.allocator, ",\"timestamp\":");
        try appendInt(&body, self.allocator, timestamp_unix);
        try body.appendSlice(self.allocator, ",\"user\":");
        try json_util.appendQuoted(&body, self.allocator, source.str());
        try body.appendSlice(self.allocator, ",\"type\":\"message\",\"data\":");
        try json_util.appendQuoted(&body, self.allocator, text);
        try body.appendSlice(self.allocator, "}}");

        var resp = try self.post("threads", "saveMessage", body.items, scope);
        defer resp.deinit(self.allocator);
        try ensureOk(resp.status);
        std.log.info("store: transcript phrase stored via threads API (session={s} source={s})", .{ session_id, source.str() });
    }

    pub fn registerThreadIndex(self: *Store, session_id: []const u8, kind: []const u8) !void {
        const scope = try self.scopeForSession(session_id);
        defer self.allocator.free(scope);
        var body = try std.ArrayList(u8).initCapacity(self.allocator, session_id.len + kind.len + 64);
        defer body.deinit(self.allocator);
        try body.appendSlice(self.allocator, "{\"threadId\":");
        try json_util.appendQuoted(&body, self.allocator, session_id);
        try body.appendSlice(self.allocator, ",\"kind\":");
        try json_util.appendQuoted(&body, self.allocator, kind);
        try body.append(self.allocator, '}');
        var resp = try self.post("threads", "registerThread", body.items, scope);
        defer resp.deinit(self.allocator);
        try ensureOk(resp.status);
    }

    pub fn touchThreadIndex(self: *Store, session_id: []const u8) !void {
        _ = self;
        _ = session_id;
    }

    pub fn flushAudioFragments(self: *Store, session_id: []const u8) !void {
        var state_copy = try self.copySessionForFlush(session_id);
        defer state_copy.deinit(self.allocator);
        const flushed_count = state_copy.fragments.items.len;
        if (flushed_count == 0) return;

        var body = try std.ArrayList(u8).initCapacity(self.allocator, flushed_count * 160 + 128);
        defer body.deinit(self.allocator);
        try body.appendSlice(self.allocator, "{\"input\":{\"callId\":");
        try json_util.appendQuoted(&body, self.allocator, session_id);
        try body.appendSlice(self.allocator, ",\"audioId\":");
        try json_util.appendQuoted(&body, self.allocator, session_id);
        try body.appendSlice(self.allocator, ",\"fragments\":[");
        for (state_copy.fragments.items, 0..) |fragment, i| {
            if (i > 0) try body.append(self.allocator, ',');
            try body.appendSlice(self.allocator, "{\"cacheKey\":");
            try json_util.appendQuoted(&body, self.allocator, fragment.cache_key);
            try body.appendSlice(self.allocator, ",\"source\":");
            try json_util.appendQuoted(&body, self.allocator, fragment.source.str());
            try body.appendSlice(self.allocator, ",\"timestampNs\":");
            try appendInt(&body, self.allocator, fragment.timestamp_ns);
            try body.appendSlice(self.allocator, ",\"durationMs\":");
            try appendInt(&body, self.allocator, DEFAULT_FRAGMENT_DURATION_MS);
            try body.appendSlice(self.allocator, ",\"sizeBytes\":");
            try appendInt(&body, self.allocator, fragment.size_bytes);
            try body.append(self.allocator, '}');
        }
        try body.appendSlice(self.allocator, "]}}");

        var resp = try self.post("calls", "dumpAudioFragments", body.items, state_copy.scope);
        defer resp.deinit(self.allocator);
        try ensureOk(resp.status);
        std.log.info("store: dumped {d} audio fragments via calls API (session={s})", .{
            flushed_count,
            session_id,
        });

        self.mutex.lock();
        defer self.mutex.unlock();
        if (self.sessions.getPtr(session_id)) |state| {
            const remove_count = @min(flushed_count, state.fragments.items.len);
            for (state.fragments.items[0..remove_count]) |*fragment| fragment.deinit(self.allocator);
            const remaining = state.fragments.items.len - remove_count;
            if (remaining > 0) {
                std.mem.copyForwards(FragmentRef, state.fragments.items[0..remaining], state.fragments.items[remove_count..]);
            }
            state.fragments.shrinkRetainingCapacity(remaining);
        }
    }

    pub fn flushActiveAudioFragments(self: *Store) void {
        const session_ids = self.copyActiveSessionIds() catch |err| {
            std.log.warn("store: snapshot active audio sessions failed: {s}", .{@errorName(err)});
            return;
        };
        defer {
            for (session_ids) |id| self.allocator.free(id);
            self.allocator.free(session_ids);
        }

        for (session_ids) |session_id| {
            self.flushAudioFragments(session_id) catch |err| switch (err) {
                error.UnboundWorkspaceSession => {},
                else => std.log.warn("store: periodic audio fragment dump failed (session={s}): {s}", .{ session_id, @errorName(err) }),
            };
        }
    }

    fn post(self: *Store, service: []const u8, method: []const u8, body: []const u8, scope: []const u8) !http_util.Response {
        const url = try std.fmt.allocPrint(self.allocator, "{s}/{s}/{s}", .{ self.services_url, service, method });
        defer self.allocator.free(url);

        var header_storage: [2]http_util.SimpleHeader = undefined;
        var header_count: usize = 0;
        if (scope.len > 0) {
            header_storage[header_count] = .{ .name = "scope", .value = scope };
            header_count += 1;
            header_storage[header_count] = .{ .name = "workspace", .value = scope };
            header_count += 1;
        }
        var auth_buf: [1024]u8 = undefined;
        const auth = if (self.service_token) |token|
            if (std.mem.startsWith(u8, token, "Bearer ")) token else std.fmt.bufPrint(&auth_buf, "Bearer {s}", .{token}) catch token
        else
            null;
        return http_util.post(self.allocator, url, body, "application/json", auth, header_storage[0..header_count]);
    }

    fn scopeForSession(self: *Store, session_id: []const u8) ![]u8 {
        self.mutex.lock();
        defer self.mutex.unlock();
        const state = self.sessions.get(session_id) orelse return error.UnboundWorkspaceSession;
        return try self.allocator.dupe(u8, state.scope);
    }

    fn copySessionForFlush(self: *Store, session_id: []const u8) !SessionState {
        self.mutex.lock();
        defer self.mutex.unlock();
        const state = self.sessions.get(session_id) orelse return error.UnboundWorkspaceSession;
        var out = SessionState{
            .id = try self.allocator.dupe(u8, state.id),
            .scope = try self.allocator.dupe(u8, state.scope),
            .user = try self.allocator.dupe(u8, state.user),
            .start_ns = state.start_ns,
            .fragments = try std.ArrayList(FragmentRef).initCapacity(self.allocator, state.fragments.items.len),
        };
        errdefer out.deinit(self.allocator);
        for (state.fragments.items) |fragment| {
            try out.fragments.append(self.allocator, .{
                .cache_key = try self.allocator.dupe(u8, fragment.cache_key),
                .source = fragment.source,
                .timestamp_ns = fragment.timestamp_ns,
                .size_bytes = fragment.size_bytes,
            });
        }
        return out;
    }

    fn copyActiveSessionIds(self: *Store) ![][]u8 {
        self.mutex.lock();
        defer self.mutex.unlock();

        var ids = try std.ArrayList([]u8).initCapacity(self.allocator, self.sessions.count());
        errdefer {
            for (ids.items) |id| self.allocator.free(id);
            ids.deinit(self.allocator);
        }

        var it = self.sessions.iterator();
        while (it.next()) |entry| {
            if (entry.value_ptr.fragments.items.len == 0) continue;
            try ids.append(self.allocator, try self.allocator.dupe(u8, entry.key_ptr.*));
        }
        return ids.toOwnedSlice(self.allocator);
    }

};

fn trimTrailingSlashOwned(allocator: std.mem.Allocator, value: []const u8) ![]u8 {
    const clean = std.mem.trim(u8, value, " \t\r\n");
    var end = clean.len;
    while (end > 0 and clean[end - 1] == '/') end -= 1;
    const trimmed = clean[0..end];
    if (trimmed.len == 0) return error.MissingServicesUrl;
    return allocator.dupe(u8, trimmed);
}

fn ensureOk(status: u16) !void {
    if (status >= 200 and status < 300) return;
    return error.ServiceApiError;
}

fn appendInt(out: *std.ArrayList(u8), allocator: std.mem.Allocator, value: anytype) !void {
    const text = try std.fmt.allocPrint(allocator, "{d}", .{value});
    defer allocator.free(text);
    try out.appendSlice(allocator, text);
}

fn parseContextResponse(allocator: std.mem.Allocator, body: []const u8) !?Context {
    var parsed = std.json.parseFromSlice(std.json.Value, allocator, body, .{}) catch return null;
    defer parsed.deinit();
    if (parsed.value == .null) return null;
    if (parsed.value != .object) return null;
    const obj = &parsed.value.object;
    const lang = obj.get("language") orelse return null;
    const data = obj.get("data") orelse return null;
    if (lang != .string or lang.string.len == 0) return null;
    if (data != .string or data.string.len == 0) return null;
    return .{
        .instructions = try allocator.dupe(u8, data.string),
        .language = try allocator.dupe(u8, lang.string),
    };
}

fn parsePhoneRoute(allocator: std.mem.Allocator, body: []const u8, dialed: []const u8) !?PhoneRoute {
    var parsed = std.json.parseFromSlice(std.json.Value, allocator, body, .{}) catch return null;
    defer parsed.deinit();
    if (parsed.value != .object) return null;
    const items = parsed.value.object.get("items") orelse return null;
    if (items != .array) return null;
    for (items.array.items) |item| {
        if (item != .object) continue;
        const obj = &item.object;
        const kind = obj.get("kind") orelse continue;
        if (kind != .string or !std.mem.eql(u8, kind.string, "ip-telephony")) continue;
        if (obj.get("enabled")) |enabled| {
            if (enabled == .bool and !enabled.bool) continue;
        }
        const phone = obj.get("phone") orelse continue;
        if (phone != .string or !digitsEqual(phone.string, dialed)) continue;
        const gateway = obj.get("gateway") orelse continue;
        if (gateway != .object) continue;

        if (gateway.object.get("transfer")) |transfer| {
            if (transfer == .object) {
                const sip_uri = transfer.object.get("sipUri") orelse continue;
                if (sip_uri != .string or sip_uri.string.len == 0) continue;
                const uri_owned = try allocator.dupe(u8, sip_uri.string);
                errdefer allocator.free(uri_owned);
                var language_owned: ?[]u8 = null;
                if (transfer.object.get("language")) |language| {
                    if (language == .string and language.string.len > 0) {
                        language_owned = try allocator.dupe(u8, language.string);
                    }
                }
                return .{ .transfer_uri = uri_owned, .transfer_language = language_owned };
            }
        }

        const context_id = gateway.object.get("contextId") orelse continue;
        if (context_id != .string or context_id.string.len == 0) continue;
        return .{ .context_id = try allocator.dupe(u8, context_id.string) };
    }
    return null;
}

fn parseContextKeys(allocator: std.mem.Allocator, body: []const u8) ![][]u8 {
    var parsed = std.json.parseFromSlice(std.json.Value, allocator, body, .{}) catch return try allocator.alloc([]u8, 0);
    defer parsed.deinit();
    if (parsed.value != .object) return try allocator.alloc([]u8, 0);
    const items = parsed.value.object.get("items") orelse return try allocator.alloc([]u8, 0);
    if (items != .array) return try allocator.alloc([]u8, 0);
    var out = try std.ArrayList([]u8).initCapacity(allocator, items.array.items.len);
    errdefer {
        for (out.items) |item| allocator.free(item);
        out.deinit(allocator);
    }
    for (items.array.items) |item| {
        if (item != .object) continue;
        const name = item.object.get("name") orelse continue;
        const lang = item.object.get("language") orelse continue;
        if (name != .string or lang != .string) continue;
        try out.append(allocator, try std.fmt.allocPrint(allocator, "{s}/{s}", .{ lang.string, name.string }));
    }
    return out.toOwnedSlice(allocator);
}

fn parseCallIds(allocator: std.mem.Allocator, body: []const u8) ![][]u8 {
    var parsed = std.json.parseFromSlice(std.json.Value, allocator, body, .{}) catch return try allocator.alloc([]u8, 0);
    defer parsed.deinit();
    if (parsed.value != .object) return try allocator.alloc([]u8, 0);
    const items = parsed.value.object.get("items") orelse return try allocator.alloc([]u8, 0);
    if (items != .array) return try allocator.alloc([]u8, 0);
    var out = try std.ArrayList([]u8).initCapacity(allocator, items.array.items.len);
    errdefer {
        for (out.items) |item| allocator.free(item);
        out.deinit(allocator);
    }
    for (items.array.items) |item| {
        if (item != .object) continue;
        const id = item.object.get("id") orelse continue;
        if (id != .string) continue;
        try out.append(allocator, try allocator.dupe(u8, id.string));
    }
    return out.toOwnedSlice(allocator);
}

fn timestampFromKey(key: []const u8) i64 {
    const last = std.mem.lastIndexOfScalar(u8, key, ':') orelse return 0;
    return std.fmt.parseInt(i64, key[last + 1 ..], 10) catch 0;
}

fn lessThanBytes(_: void, a: []u8, b: []u8) bool {
    return std.mem.order(u8, a, b) == .lt;
}

fn digitsEqual(a: []const u8, b: []const u8) bool {
    var ia: usize = 0;
    var ib: usize = 0;
    while (true) {
        while (ia < a.len and !std.ascii.isDigit(a[ia])) ia += 1;
        while (ib < b.len and !std.ascii.isDigit(b[ib])) ib += 1;
        const a_end = ia >= a.len;
        const b_end = ib >= b.len;
        if (a_end or b_end) return a_end and b_end;
        if (a[ia] != b[ib]) return false;
        ia += 1;
        ib += 1;
    }
}

fn transcriptMessageId(allocator: std.mem.Allocator, session_id: []const u8, source: Source, text: []const u8) ![]u8 {
    var hasher = std.crypto.hash.sha2.Sha256.init(.{});
    hasher.update(session_id);
    hasher.update("\x00");
    hasher.update(source.str());
    hasher.update("\x00");
    hasher.update(text);

    var digest: [std.crypto.hash.sha2.Sha256.digest_length]u8 = undefined;
    hasher.final(&digest);

    var hex: [16]u8 = undefined;
    writeHexLower(&hex, digest[0..8]);
    return try std.fmt.allocPrint(allocator, "llm-{s}-{s}", .{ source.str(), &hex });
}

fn writeHexLower(out: []u8, bytes: []const u8) void {
    const alphabet = "0123456789abcdef";
    for (bytes, 0..) |byte, i| {
        out[i * 2] = alphabet[byte >> 4];
        out[i * 2 + 1] = alphabet[byte & 0x0f];
    }
}

test "parsePhoneRoute picks transfer over contextId" {
    const allocator = std.testing.allocator;
    const body =
        \\{"items":[{"kind":"ip-telephony","enabled":true,"phone":"+1 (555) 010-0001",
        \\"gateway":{"contextId":"landing","transfer":{"sipUri":"sip:+15550100999@sip.telnyx.com","language":"ru"}}}]}
    ;
    var route = (try parsePhoneRoute(allocator, body, "15550100001")).?;
    defer route.deinit(allocator);
    try std.testing.expect(route.context_id == null);
    try std.testing.expectEqualStrings("sip:+15550100999@sip.telnyx.com", route.transfer_uri.?);
    try std.testing.expectEqualStrings("ru", route.transfer_language.?);
}

test "parsePhoneRoute falls through to contextId without transfer" {
    const allocator = std.testing.allocator;
    const body =
        \\{"items":[{"kind":"ip-telephony","enabled":true,"phone":"+15550100001",
        \\"gateway":{"contextId":"landing"}}]}
    ;
    var route = (try parsePhoneRoute(allocator, body, "+15550100001")).?;
    defer route.deinit(allocator);
    try std.testing.expectEqualStrings("landing", route.context_id.?);
    try std.testing.expect(route.transfer_uri == null);
}

test "parsePhoneRoute returns null for unknown number" {
    const allocator = std.testing.allocator;
    const body =
        \\{"items":[{"kind":"ip-telephony","enabled":true,"phone":"+15550100001","gateway":{"contextId":"x"}}]}
    ;
    try std.testing.expect((try parsePhoneRoute(allocator, body, "+15550109999")) == null);
}
