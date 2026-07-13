const std = @import("std");

const config_mod = @import("../config.zig");
const gateway_mod = @import("../gate/gateway.zig");
const session_mod = @import("../gate/session.zig");
const adapter_mod = @import("../signaling/adapter.zig");
const signaling_types = @import("../signaling/types.zig");
const json_util = @import("../util/json.zig");
const store_mod = @import("../store/store.zig");

pub const HttpServer = struct {
    allocator: std.mem.Allocator,
    cfg: *const config_mod.Config,
    gateway: *gateway_mod.Gateway,

    pub fn init(allocator: std.mem.Allocator, cfg: *const config_mod.Config, gateway: *gateway_mod.Gateway) HttpServer {
        return .{
            .allocator = allocator,
            .cfg = cfg,
            .gateway = gateway,
        };
    }

    pub fn serve(self: *HttpServer) !void {
        const io = std.Options.debug_io;
        const address = try parseListenAddress(self.cfg.http_host, self.cfg.http_port);
        var listener = try address.listen(io, .{ .reuse_address = true });
        defer listener.deinit(io);

        std.log.info("centimanus listening on {s}:{d}", .{ self.cfg.http_host, self.cfg.http_port });

        while (true) {
            const stream = try listener.accept(io);
            const thread = std.Thread.spawn(.{}, handleConnectionThread, .{ self, stream }) catch |err| {
                var fallback_stream = stream;
                defer fallback_stream.close(io);

                std.log.err("failed to spawn connection handler: {s}", .{@errorName(err)});
                self.handleConnection(fallback_stream) catch |handle_err| {
                    std.log.err("connection handling failed: {s}", .{@errorName(handle_err)});
                };
                continue;
            };
            thread.detach();
        }
    }

    fn handleConnectionThread(self: *HttpServer, stream: std.Io.net.Stream) void {
        const io = std.Options.debug_io;
        var owned_stream = stream;
        defer owned_stream.close(io);

        self.handleConnection(owned_stream) catch |err| {
            std.log.err("connection handling failed: {s}", .{@errorName(err)});
        };
    }

    fn handleConnection(self: *HttpServer, stream: std.Io.net.Stream) !void {
        const io = std.Options.debug_io;
        var read_buf: [32 * 1024]u8 = undefined;
        var write_buf: [32 * 1024]u8 = undefined;

        var reader = stream.reader(io, &read_buf);
        var writer = stream.writer(io, &write_buf);
        var server = std.http.Server.init(&reader.interface, &writer.interface);

        while (true) {
            var req = server.receiveHead() catch |err| switch (err) {
                error.HttpConnectionClosing => break,
                else => return err,
            };

            self.handleRequest(&req) catch |err| {
                std.log.err("request handling failed ({s} {s}): {s}", .{ @tagName(req.head.method), req.head.target, @errorName(err) });
                self.respondJsonError(&req, .internal_server_error, "internal_error", @errorName(err)) catch {};
            };
        }
    }

    fn handleRequest(self: *HttpServer, req: *std.http.Server.Request) !void {
        const target = req.head.target;
        const path = targetPath(target);
        const method = req.head.method;

        if (method == .GET and std.mem.eql(u8, path, "/health")) {
            return self.handleHealth(req);
        }

        if (method == .POST and std.mem.eql(u8, path, "/signal/openai")) {
            return self.handleSignal(req, .openai);
        }

        if (method == .POST and std.mem.eql(u8, path, "/signal/gemini")) {
            return self.handleSignal(req, .gemini);
        }

        if (method == .GET and std.mem.eql(u8, path, "/ws")) {
            return self.handleWebSocket(req, target);
        }

        if (std.mem.startsWith(u8, path, "/context/")) {
            const key = path["/context/".len..];
            if (key.len == 0) {
                return self.respondJsonError(req, .bad_request, "bad_request", "missing context key");
            }
            return self.handleContext(req, method, key);
        }

        if (method == .GET and std.mem.eql(u8, path, "/sessions")) {
            return self.handleListSessions(req);
        }

        if (method == .GET and std.mem.startsWith(u8, path, "/user/")) {
            const user = path["/user/".len..];
            return self.handleUserSessions(req, user);
        }

        if (std.mem.startsWith(u8, path, "/record/")) {
            const rest = path["/record/".len..];
            return self.handleRecord(req, method, rest);
        }

        // NOTE: the gate does NOT serve transcripts. It only INGESTS audio and
        // writes recognised phrases to ms-threads. Reading a call transcript is
        // the ms-calls microservice's job (calls.getTranscript) — the admin UI
        // must never query the gate for data.

        return self.respondJsonError(req, .not_found, "not_found", "route not found");
    }

    fn handleHealth(self: *HttpServer, req: *std.http.Server.Request) !void {
        const report = self.gateway.health();

        var out = try std.ArrayList(u8).initCapacity(self.allocator, 512);
        defer out.deinit(self.allocator);

        try out.appendSlice(self.allocator, "{\"ok\":true,\"deps\":{");
        try out.appendSlice(self.allocator, "\"baresipLoaded\":");
        try out.appendSlice(self.allocator, boolLiteral(report.baresip_loaded));
        try out.appendSlice(self.allocator, ",\"baresipWrapperLoaded\":");
        try out.appendSlice(self.allocator, boolLiteral(report.baresip_wrapper_loaded));
        try out.appendSlice(self.allocator, ",\"libdatachannelLoaded\":");
        try out.appendSlice(self.allocator, boolLiteral(report.libdatachannel_loaded));
        try out.appendSlice(self.allocator, ",\"libdatachannelWrapperLoaded\":");
        try out.appendSlice(self.allocator, boolLiteral(report.libdatachannel_wrapper_loaded));
        try out.appendSlice(self.allocator, ",\"mbedtlsLoaded\":");
        try out.appendSlice(self.allocator, boolLiteral(report.mbedtls_loaded));
        try out.appendSlice(self.allocator, ",\"mbedtlsVersion\":");
        try appendQuotedOrNull(&out, self.allocator, report.mbedtls_version);
        try out.appendSlice(self.allocator, ",\"errors\":{");
        try out.appendSlice(self.allocator, "\"baresip\":");
        try appendQuotedOrNull(&out, self.allocator, report.baresip_error);
        try out.appendSlice(self.allocator, ",\"baresipWrapper\":");
        try appendQuotedOrNull(&out, self.allocator, report.baresip_wrapper_error);
        try out.appendSlice(self.allocator, ",\"libdatachannel\":");
        try appendQuotedOrNull(&out, self.allocator, report.libdatachannel_error);
        try out.appendSlice(self.allocator, ",\"libdatachannelWrapper\":");
        try appendQuotedOrNull(&out, self.allocator, report.libdatachannel_wrapper_error);
        try out.appendSlice(self.allocator, ",\"mbedtls\":");
        try appendQuotedOrNull(&out, self.allocator, report.mbedtls_error);
        try out.appendSlice(self.allocator, "}");
        try out.appendSlice(self.allocator, "},\"valkey\":{");
        try out.appendSlice(self.allocator, "\"loaded\":");
        try out.appendSlice(self.allocator, boolLiteral(report.valkey_loaded));
        try out.appendSlice(self.allocator, ",\"error\":");
        try appendQuotedOrNull(&out, self.allocator, report.valkey_error);
        try out.appendSlice(self.allocator, "},\"store\":{\"loaded\":");
        try out.appendSlice(self.allocator, boolLiteral(report.store_loaded));
        try out.appendSlice(self.allocator, "},\"policy\":{\"loaded\":");
        try out.appendSlice(self.allocator, boolLiteral(report.policy_loaded));
        try out.appendSlice(self.allocator, ",\"error\":");
        try appendQuotedOrNull(&out, self.allocator, report.policy_error);
        try out.appendSlice(self.allocator, "}}");

        const payload = try out.toOwnedSlice(self.allocator);
        defer self.allocator.free(payload);

        return self.respondJson(req, .ok, payload);
    }

    fn handleSignal(self: *HttpServer, req: *std.http.Server.Request, provider: adapter_mod.Provider) !void {
        const body = try self.readBody(req, 8 * 1024 * 1024);
        defer self.allocator.free(body);

        var parsed = std.json.parseFromSlice(std.json.Value, self.allocator, body, .{}) catch {
            return self.respondJsonError(req, .bad_request, "bad_json", "request body must be valid json");
        };
        defer parsed.deinit();

        var input = decodeSignalInput(parsed.value) catch {
            return self.respondJsonError(req, .bad_request, "bad_request", "invalid signaling payload");
        };
        if (input.domain == null) input.domain = requestDomain(req);

        var outcome = self.gateway.negotiate(provider, input) catch |err| {
            return self.respondJsonError(req, statusForError(err), "signal_failed", @errorName(err));
        };
        defer signaling_types.deinitResult(self.allocator, &outcome.result);

        var out = try std.ArrayList(u8).initCapacity(self.allocator, 512);
        defer out.deinit(self.allocator);

        try out.appendSlice(self.allocator, "{\"ok\":true,\"provider\":");
        try json_util.appendQuoted(&out, self.allocator, @tagName(provider));
        try out.appendSlice(self.allocator, ",\"contextUsed\":");
        try out.appendSlice(self.allocator, boolLiteral(outcome.context_used));

        switch (outcome.result) {
            .sdp_answer => |answer| {
                try out.appendSlice(self.allocator, ",\"resultType\":\"sdp\",\"answer\":");
                try json_util.appendQuoted(&out, self.allocator, answer);
            },
            .session_descriptor => |descriptor| {
                try out.appendSlice(self.allocator, ",\"resultType\":\"session_descriptor\",\"descriptor\":");
                try json_util.appendQuoted(&out, self.allocator, descriptor);
            },
        }

        try out.append(self.allocator, '}');

        const payload = try out.toOwnedSlice(self.allocator);
        defer self.allocator.free(payload);

        return self.respondJson(req, .ok, payload);
    }

    /// Bind a session_id to the request's mapped storage so session-keyed
    /// reads/deletes (record, transcript) resolve to the same storage even
    /// after the live call ended. No-op when no scope is supplied.
    fn bindSessionDomain(self: *HttpServer, session_id: []const u8, req: *std.http.Server.Request) void {
        const store = (self.gateway.store orelse return);
        const domain = requestDomain(req);
        if (domain.len == 0) return;
        store.bindSession(session_id, domain) catch |err| {
            std.log.warn("bindSessionDomain {s}: {s}", .{ session_id, @errorName(err) });
        };
    }

    fn handleListSessions(self: *HttpServer, req: *std.http.Server.Request) !void {
        const store = (self.gateway.store orelse {
            return self.respondJsonError(req, .service_unavailable, "store_unavailable", "store not configured");
        });
        const sessions = store.listSessions(self.allocator, requestDomain(req)) catch |err| {
            return self.respondJsonError(req, .internal_server_error, "store_error", @errorName(err));
        };
        defer {
            for (sessions) |s| self.allocator.free(s);
            self.allocator.free(sessions);
        }

        var out = try std.ArrayList(u8).initCapacity(self.allocator, 64 + sessions.len * 48);
        defer out.deinit(self.allocator);
        try out.appendSlice(self.allocator, "{\"ok\":true,\"sessions\":[");
        for (sessions, 0..) |id, i| {
            if (i > 0) try out.append(self.allocator, ',');
            try json_util.appendQuoted(&out, self.allocator, id);
        }
        try out.appendSlice(self.allocator, "]}");
        const payload = try out.toOwnedSlice(self.allocator);
        defer self.allocator.free(payload);
        return self.respondJson(req, .ok, payload);
    }

    fn handleUserSessions(self: *HttpServer, req: *std.http.Server.Request, user: []const u8) !void {
        const store = (self.gateway.store orelse {
            return self.respondJsonError(req, .service_unavailable, "store_unavailable", "store not configured");
        });
        const sessions = store.listUserSessions(self.allocator, requestDomain(req), user) catch |err| {
            return self.respondJsonError(req, .internal_server_error, "store_error", @errorName(err));
        };
        defer {
            for (sessions) |s| self.allocator.free(s);
            self.allocator.free(sessions);
        }

        var out = try std.ArrayList(u8).initCapacity(self.allocator, 64 + sessions.len * 48);
        defer out.deinit(self.allocator);
        try out.appendSlice(self.allocator, "{\"ok\":true,\"user\":");
        try json_util.appendQuoted(&out, self.allocator, user);
        try out.appendSlice(self.allocator, ",\"sessions\":[");
        for (sessions, 0..) |id, i| {
            if (i > 0) try out.append(self.allocator, ',');
            try json_util.appendQuoted(&out, self.allocator, id);
        }
        try out.appendSlice(self.allocator, "]}");
        const payload = try out.toOwnedSlice(self.allocator);
        defer self.allocator.free(payload);
        return self.respondJson(req, .ok, payload);
    }

    fn handleRecord(self: *HttpServer, req: *std.http.Server.Request, method: std.http.Method, rest: []const u8) !void {
        switch (method) {
            .GET => {
                // rest = "{session_id}/{source}"
                const sep = std.mem.indexOfScalar(u8, rest, '/') orelse {
                    return self.respondJsonError(req, .bad_request, "bad_request", "expected /record/{session_id}/{source}");
                };
                const session_id = rest[0..sep];
                const source_str = rest[sep + 1 ..];
                const source = store_mod.Source.fromStr(source_str) orelse {
                    return self.respondJsonError(req, .bad_request, "bad_request", "source must be 'user' or 'assistant'");
                };
                const recorder = &(self.gateway.recorder orelse {
                    return self.respondJsonError(req, .service_unavailable, "store_unavailable", "store not configured");
                });
                self.bindSessionDomain(session_id, req);
                const webm = recorder.buildWebM(self.allocator, session_id, source) catch |err| {
                    if (err == error.NoFrames) {
                        return self.respondJsonError(req, .not_found, "not_found", "no audio frames for this session/source");
                    }
                    return self.respondJsonError(req, .internal_server_error, "record_error", @errorName(err));
                };
                defer self.allocator.free(webm);
                return self.respondBinary(req, .ok, "audio/webm", webm);
            },
            .DELETE => {
                const store = (self.gateway.store orelse {
                    return self.respondJsonError(req, .service_unavailable, "store_unavailable", "store not configured");
                });
                self.bindSessionDomain(rest, req);
                store.deleteAudioFrames(rest) catch |err| {
                    return self.respondJsonError(req, .internal_server_error, "store_error", @errorName(err));
                };
                return self.respondJson(req, .ok, "{\"ok\":true}");
            },
            else => return self.respondJsonError(req, .method_not_allowed, "method_not_allowed", "GET or DELETE"),
        }
    }

    fn respondBinary(self: *HttpServer, req: *std.http.Server.Request, status: std.http.Status, content_type: []const u8, body: []const u8) !void {
        _ = self;
        const headers = [_]std.http.Header{
            .{ .name = "content-type", .value = content_type },
            .{ .name = "cache-control", .value = "no-store" },
        };
        try req.respond(body, .{
            .status = status,
            .extra_headers = &headers,
        });
    }

    fn handleContext(self: *HttpServer, req: *std.http.Server.Request, method: std.http.Method, key: []const u8) !void {
        const domain = requestDomain(req);
        switch (method) {
            .GET => {
                const value = self.gateway.getContext(domain, key, queryParam(req.head.target, "lang")) catch |err| {
                    return self.respondJsonError(req, statusForError(err), "context_get_failed", @errorName(err));
                };
                if (value) |found| {
                    var context = found;
                    defer context.deinit(self.allocator);

                    var out = try std.ArrayList(u8).initCapacity(self.allocator, context.instructions.len + context.language.len + 96);
                    defer out.deinit(self.allocator);

                    try out.appendSlice(self.allocator, "{\"ok\":true,\"key\":");
                    try json_util.appendQuoted(&out, self.allocator, key);
                    try out.appendSlice(self.allocator, ",\"instructions\":");
                    try json_util.appendQuoted(&out, self.allocator, context.instructions);
                    try out.appendSlice(self.allocator, ",\"language\":");
                    try json_util.appendQuoted(&out, self.allocator, context.language);
                    try out.append(self.allocator, '}');

                    const payload = try out.toOwnedSlice(self.allocator);
                    defer self.allocator.free(payload);

                    return self.respondJson(req, .ok, payload);
                }
                return self.respondJsonError(req, .not_found, "not_found", "context not found");
            },
            .POST, .PUT => {
                const body = try self.readBody(req, 2 * 1024 * 1024);
                defer self.allocator.free(body);

                var parsed = std.json.parseFromSlice(std.json.Value, self.allocator, body, .{}) catch {
                    return self.respondJsonError(req, .bad_request, "bad_json", "request body must be valid json");
                };
                defer parsed.deinit();

                const context = decodeContextBody(parsed.value) catch {
                    return self.respondJsonError(req, .bad_request, "bad_request", "required string fields: 'instructions' (or 'context') and 'language'");
                };

                self.gateway.setContext(domain, key, context.language, context.instructions) catch |err| {
                    return self.respondJsonError(req, statusForError(err), "context_set_failed", @errorName(err));
                };

                return self.respondJson(req, .ok, "{\"ok\":true}");
            },
            .DELETE => {
                self.gateway.deleteContext(domain, key) catch |err| {
                    return self.respondJsonError(req, statusForError(err), "context_delete_failed", @errorName(err));
                };
                return self.respondJson(req, .ok, "{\"ok\":true}");
            },
            else => return self.respondJsonError(req, .method_not_allowed, "method_not_allowed", "supported methods: GET, POST, PUT, DELETE"),
        }
    }

    fn handleWebSocket(self: *HttpServer, req: *std.http.Server.Request, target: []const u8) !void {
        const up = req.upgradeRequested();
        const ws_key = switch (up) {
            .websocket => |k| k orelse {
                return self.respondJsonError(req, .bad_request, "bad_request", "missing sec-websocket-key");
            },
            .other, .none => {
                return self.respondJsonError(req, .upgrade_required, "upgrade_required", "expected websocket upgrade");
            },
        };

        // `user` and `scope` are slices into the request's header buffer, which
        // gets reused for WS frame data once the connection is upgraded. Copy
        // them into owned memory BEFORE the upgrade or they turn into garbage
        // (e.g. a fragment of the first WS frame) by the time we read frames.
        const user: ?[]u8 = if (queryParam(target, "user")) |u| try self.allocator.dupe(u8, u) else null;
        defer if (user) |u| self.allocator.free(u);
        const domain = try self.allocator.dupe(u8, requestDomain(req));
        defer self.allocator.free(domain);
        const requested_context_name = requestContextName(req) orelse {
            std.log.warn("websocket refused before upgrade: missing context name (scope={s})", .{domain});
            return self.respondJsonError(req, .unprocessable_entity, "context_required", "missing context name");
        };
        const context_name = try self.allocator.dupe(u8, requested_context_name);
        defer self.allocator.free(context_name);
        const requested_language = requestContextLanguage(req);
        const language: ?[]u8 = if (requested_language) |lang| try self.allocator.dupe(u8, lang) else null;
        defer if (language) |lang| self.allocator.free(lang);

        const context = self.gateway.getContext(domain, context_name, language) catch |err| {
            std.log.warn("websocket refused before upgrade: context lookup failed (scope={s} context={s}): {s}", .{ domain, context_name, @errorName(err) });
            return self.respondJsonError(req, statusForError(err), "context_lookup_failed", @errorName(err));
        };
        if (context) |found| {
            var owned = found;
            owned.deinit(self.allocator);
        } else {
            std.log.warn("websocket refused before upgrade: context not found (scope={s} context={s})", .{ domain, context_name });
            return self.respondJsonError(req, .unprocessable_entity, "context_not_found", "context not found");
        }

        var ws = try req.respondWebSocket(.{ .key = ws_key });
        try ws.flush();
        try self.serveCompatWebSocket(&ws, user, domain, context_name, language);
    }

    fn serveCompatWebSocket(
        self: *HttpServer,
        ws: *std.http.Server.WebSocket,
        user: ?[]const u8,
        domain: []const u8,
        handshake_context_name: []const u8,
        handshake_language: ?[]const u8,
    ) !void {
        // session_id is set when a web bridge session is created; cleaned up on disconnect.
        var active_session_id: ?[]u8 = null;
        defer {
            if (active_session_id) |sid| {
                self.gateway.endWebBridgeSession(sid);
                self.allocator.free(sid);
            }
        }

        while (true) {
            const message = ws.readSmallMessage() catch |err| switch (err) {
                error.ConnectionClose => return,
                error.EndOfStream => return,
                else => return err,
            };

            switch (message.opcode) {
                .ping => {
                    try ws.writeMessage(message.data, .pong);
                },
                .text => {
                    try self.handleCompatWebSocketText(ws, message.data, user, domain, handshake_context_name, handshake_language, &active_session_id);
                },
                .binary, .continuation, .pong => {},
                .connection_close => return,
                _ => {},
            }
        }
    }

    fn handleCompatWebSocketText(
        self: *HttpServer,
        ws: *std.http.Server.WebSocket,
        payload: []const u8,
        user: ?[]const u8,
        domain: []const u8,
        handshake_context_name: []const u8,
        handshake_language: ?[]const u8,
        active_session_id: *?[]u8,
    ) !void {
        var parsed = std.json.parseFromSlice(std.json.Value, self.allocator, payload, .{}) catch {
            try self.sendCompatWsError(ws, "bad_json", "invalid websocket payload json");
            return;
        };
        defer parsed.deinit();

        if (parsed.value != .object) {
            try self.sendCompatWsError(ws, "bad_request", "websocket payload must be object");
            return;
        }

        const obj = &parsed.value.object;
        const msg_type = try optionalStringField(obj, "type") orelse {
            try self.sendCompatWsError(ws, "bad_request", "missing 'type'");
            return;
        };

        if (std.mem.eql(u8, msg_type, "hangup")) {
            if (active_session_id.*) |sid| {
                self.gateway.endWebBridgeSession(sid);
                self.allocator.free(sid);
                active_session_id.* = null;
            }
            try ws.writeMessage("{\"type\":\"hangup_ack\"}", .text);
            return;
        }

        if (std.mem.eql(u8, msg_type, "offer")) {
            const offer_sdp = try decodeOfferSdp(obj) orelse {
                try self.sendCompatWsError(ws, "bad_request", "missing offer sdp");
                return;
            };
            const phone = try optionalStringEither(obj, "phone", "phoneNumber");
            const payload_context_name = try optionalStringEither(obj, "contextName", "context_name");
            if (payload_context_name) |value| {
                if (!std.mem.eql(u8, value, handshake_context_name)) {
                    std.log.warn("websocket offer refused: context mismatch (scope={s} handshake={s} payload={s})", .{ domain, handshake_context_name, value });
                    try self.sendCompatWsError(ws, "context_mismatch", "offer context does not match websocket context");
                    return;
                }
            }
            // Caller language selects the "<lang>/<name>" context variant.
            const payload_language = try optionalStringEither(obj, "language", "lang");
            const language = payload_language orelse handshake_language;

            // Build a unique session id from current time + user
            const ts = @import("../util/clock.zig").nanoTimestamp();
            const session_id = try std.fmt.allocPrint(self.allocator, "ws-{x}", .{@as(u64, @bitCast(ts))});
            defer self.allocator.free(session_id);

            const identifier = phone orelse user orelse "anonymous";
            // Website calls are NOT telephony: the context is selected by its
            // alias (contextName) only — never by a phone number or the free-form
            // `user` label. No contextName → no context → the bridge refuses.
            const context_key: ?[]const u8 = handshake_context_name;

            // Create WebRTC media proxy: browser → gate → OpenAI
            // Returns SDP answer for the browser to connect to the gate
            const answer = self.gateway.createWebBridgeSession(
                session_id,
                identifier,
                domain,
                context_key,
                language,
                offer_sdp,
            ) catch |err| {
                // NO direct-signaling fallback. The gate MUST stay in the media
                // path so it can record + transcribe — that is its entire reason
                // to exist. If the bridge can't be established the call fails;
                // the caller must never be silently routed straight to OpenAI,
                // which would bypass the gate and look like it works while
                // recording nothing.
                std.log.err("web bridge failed (session={s}): {s} — call refused (no direct fallback)", .{ session_id, @errorName(err) });
                try self.sendCompatWsError(ws, "bridge_failed", @errorName(err));
                return;
            };
            defer self.allocator.free(answer);

            // Track session for cleanup when WS disconnects
            if (active_session_id.*) |old| {
                self.gateway.endWebBridgeSession(old);
                self.allocator.free(old);
            }
            active_session_id.* = try self.allocator.dupe(u8, session_id);

            var out = try std.ArrayList(u8).initCapacity(self.allocator, answer.len + 128);
            defer out.deinit(self.allocator);
            try out.appendSlice(self.allocator, "{\"type\":\"answer\",\"data\":{\"type\":\"answer\",\"sdp\":");
            try json_util.appendQuoted(&out, self.allocator, answer);
            try out.appendSlice(self.allocator, "}}");
            const response = try out.toOwnedSlice(self.allocator);
            defer self.allocator.free(response);
            try ws.writeMessage(response, .text);
            return;
        }

        if (std.mem.eql(u8, msg_type, "ice-candidate")) {
            return;
        }

        if (std.mem.eql(u8, msg_type, "ping")) {
            try ws.writeMessage("{\"type\":\"pong\"}", .text);
            return;
        }

        try self.sendCompatWsError(ws, "unsupported_type", "unsupported websocket message type");
    }

    fn sendCompatWsError(
        self: *HttpServer,
        ws: *std.http.Server.WebSocket,
        code: []const u8,
        message: []const u8,
    ) !void {
        var out = try std.ArrayList(u8).initCapacity(self.allocator, 192);
        defer out.deinit(self.allocator);

        try out.appendSlice(self.allocator, "{\"type\":\"error\",\"data\":{\"code\":");
        try json_util.appendQuoted(&out, self.allocator, code);
        try out.appendSlice(self.allocator, ",\"message\":");
        try json_util.appendQuoted(&out, self.allocator, message);
        try out.appendSlice(self.allocator, "}}");

        const payload = try out.toOwnedSlice(self.allocator);
        defer self.allocator.free(payload);

        try ws.writeMessage(payload, .text);
    }

    fn readBody(self: *HttpServer, req: *std.http.Server.Request, max_len: usize) ![]u8 {
        var body_buf: [8 * 1024]u8 = undefined;
        const body_reader = try req.readerExpectContinue(&body_buf);
        return try body_reader.allocRemaining(self.allocator, .limited(max_len));
    }

    fn respondJson(self: *HttpServer, req: *std.http.Server.Request, status: std.http.Status, body: []const u8) !void {
        _ = self;
        const headers = [_]std.http.Header{
            .{ .name = "content-type", .value = "application/json; charset=utf-8" },
            .{ .name = "cache-control", .value = "no-store" },
        };

        try req.respond(body, .{
            .status = status,
            .extra_headers = &headers,
        });
    }

    fn respondJsonError(self: *HttpServer, req: *std.http.Server.Request, status: std.http.Status, code: []const u8, message: []const u8) !void {
        var out = try std.ArrayList(u8).initCapacity(self.allocator, 192);
        defer out.deinit(self.allocator);

        try out.appendSlice(self.allocator, "{\"ok\":false,\"error\":{\"code\":");
        try json_util.appendQuoted(&out, self.allocator, code);
        try out.appendSlice(self.allocator, ",\"message\":");
        try json_util.appendQuoted(&out, self.allocator, message);
        try out.appendSlice(self.allocator, "}}");

        const payload = try out.toOwnedSlice(self.allocator);
        defer self.allocator.free(payload);

        return self.respondJson(req, status, payload);
    }
};

fn parseListenAddress(host: []const u8, port: u16) !std.Io.net.IpAddress {
    return std.Io.net.IpAddress.parse(host, port) catch |err| {
        if (err == error.InvalidAddress and std.mem.eql(u8, host, "localhost")) {
            return std.Io.net.IpAddress.parse("127.0.0.1", port);
        }
        return err;
    };
}

fn targetPath(target: []const u8) []const u8 {
    const query_idx = std.mem.indexOfScalar(u8, target, '?') orelse target.len;
    return target[0..query_idx];
}

fn decodeSignalInput(value: std.json.Value) !session_mod.SessionInput {
    if (value != .object) return error.InvalidPayload;

    const obj = &value.object;

    return .{
        .phone = try optionalStringEither(obj, "phone", "phoneNumber"),
        .context_name = try optionalStringEither(obj, "contextName", "context_name"),
        .language = try optionalStringEither(obj, "language", "lang"),
        .offer_sdp = try optionalStringEither(obj, "offer_sdp", "offerSdp"),
        .model = try optionalStringEither(obj, "model", "model"),
        .voice = try optionalStringEither(obj, "voice", "voice"),
        .instructions = try optionalStringEither(obj, "instructions", "instructions"),
    };
}

fn decodeOfferSdp(obj: *const std.json.ObjectMap) !?[]const u8 {
    if (try optionalStringField(obj, "sdp")) |value| return value;
    if (obj.get("data")) |data_value| {
        if (data_value != .object) return error.InvalidPayload;
        if (try optionalStringField(&data_value.object, "sdp")) |value| return value;
    }
    return null;
}

const ContextBody = struct {
    instructions: []const u8,
    language: []const u8,
};

fn decodeContextBody(value: std.json.Value) !ContextBody {
    if (value != .object) return error.InvalidPayload;
    const obj = &value.object;
    // Accept "instructions" (preferred) or legacy "context" for the prompt; the
    // language is mandatory — a context without it is rejected.
    const instructions = (try optionalStringEither(obj, "instructions", "context")) orelse return error.InvalidPayload;
    const language = (try optionalStringField(obj, "language")) orelse return error.InvalidPayload;
    if (instructions.len == 0 or language.len == 0) return error.InvalidPayload;
    return .{ .instructions = instructions, .language = language };
}

/// The storage mapping scope for a request. It must be passed explicitly by
/// the caller; the gate does not derive it from host/domain headers.
fn requestDomain(req: *std.http.Server.Request) []const u8 {
    return queryParam(req.head.target, "scope") orelse "";
}

fn requestContextName(req: *std.http.Server.Request) ?[]const u8 {
    return nonEmpty(queryParam(req.head.target, "context_name"));
}

fn requestContextLanguage(req: *std.http.Server.Request) ?[]const u8 {
    return nonEmpty(queryParam(req.head.target, "language"));
}

fn requestHeader(req: *std.http.Server.Request, name: []const u8) ?[]const u8 {
    var it = req.iterateHeaders();
    while (it.next()) |h| {
        if (std.ascii.eqlIgnoreCase(h.name, name)) return h.value;
    }
    return null;
}

fn queryParam(target: []const u8, key: []const u8) ?[]const u8 {
    const q_idx = std.mem.indexOfScalar(u8, target, '?') orelse return null;
    const query = target[q_idx + 1 ..];
    var it = std.mem.splitScalar(u8, query, '&');
    while (it.next()) |chunk| {
        if (chunk.len == 0) continue;
        const eq_idx = std.mem.indexOfScalar(u8, chunk, '=') orelse continue;
        const k = chunk[0..eq_idx];
        if (!std.mem.eql(u8, k, key)) continue;
        return chunk[eq_idx + 1 ..];
    }
    return null;
}

fn nonEmpty(value: ?[]const u8) ?[]const u8 {
    const found = value orelse return null;
    if (found.len == 0) return null;
    return found;
}

fn optionalStringEither(obj: *const std.json.ObjectMap, first: []const u8, second: []const u8) !?[]const u8 {
    if (try optionalStringField(obj, first)) |value| return value;
    return try optionalStringField(obj, second);
}

fn optionalStringField(obj: *const std.json.ObjectMap, key: []const u8) !?[]const u8 {
    if (obj.get(key)) |v| {
        if (v != .string) return error.InvalidPayload;
        return v.string;
    }
    return null;
}

fn appendQuotedOrNull(out: *std.ArrayList(u8), allocator: std.mem.Allocator, value: ?[]const u8) !void {
    if (value) |v| {
        try json_util.appendQuoted(out, allocator, v);
    } else {
        try out.appendSlice(allocator, "null");
    }
}

fn boolLiteral(value: bool) []const u8 {
    return if (value) "true" else "false";
}

fn statusForError(err: anyerror) std.http.Status {
    return switch (err) {
        error.MissingOfferSdp,
        error.InvalidPayload,
        error.OpenAIInvalidSessionResponse,
        error.GeminiSdpUrlNotConfigured,
        => .bad_request,

        // No valid call context (missing/incomplete: no instructions or no
        // language). The gate refuses rather than answer blind — surface it as a
        // clear, distinct status the caller can show.
        error.ContextRequired,
        => .unprocessable_entity,

        error.OpenAISessionRequestFailed,
        error.OpenAISdpExchangeFailed,
        error.GeminiSdpExchangeFailed,
        => .bad_gateway,

        error.TransportUnavailable,
        error.TransportConnectFailed,
        error.TransportSendFailed,
        error.TransportReceiveFailed,
        error.TransportResponseError,
        error.TransportRequestCreateFailed,
        error.TransportSymbolMissing,
        error.BaresipWrapperUnavailable,
        error.DataChannelWrapperUnavailable,
        error.DataChannelCallFailed,
        error.DataChannelTimedOut,
        => .service_unavailable,

        error.MissingOpenAIApiKey,
        error.MissingGeminiApiKey,
        => .internal_server_error,

        else => .internal_server_error,
    };
}
