const std = @import("std");
const Config = @import("config.zig").Config;
const Policy = @import("qjs_policy.zig").Policy;
const Hub = @import("hub.zig").Hub;
const transport = @import("transport");
const FluentBit = @import("fluentbit.zig").Receiver;
const WebSocket = @import("websocket.zig").Server;
const Registry = @import("registry.zig").Registry;
const Journal = @import("messages.zig").Journal;
const fujin_nrpc = @import("generated/fujin_nrpc.zig");

pub fn main(init: std.process.Init) !void {
    const allocator = init.gpa;
    var config = try Config.init(allocator, init.environ_map);
    defer config.deinit();

    var policy = try Policy.init(allocator, config.qjs_lib, config.event_policy_path);
    defer policy.deinit();
    var hub = Hub.init(allocator, &policy, config.max_control_bytes, config.jwt.mode == .required);
    defer hub.deinit();

    var fluentbit: ?FluentBit = null;
    if (config.fluentbit_enabled) {
        fluentbit = try FluentBit.init(allocator, config.fluentbit_lib, config.fluentbit_listen, config.fluentbit_port);
        std.log.info("Fluent Bit forward receiver listening on {s}:{d}", .{ config.fluentbit_listen, config.fluentbit_port });
    }
    defer if (fluentbit) |*receiver| receiver.deinit();

    const endpoint = try allocator.dupeZ(u8, config.zmq_endpoint);
    defer allocator.free(endpoint);
    var router = try transport.Router.init(endpoint, .{
        .max_envelope_bytes = config.max_control_bytes,
        .max_payload_bytes = config.max_payload_bytes,
    });
    defer router.deinit();
    try router.setRecvTimeoutMs(25);
    try router.setSendTimeoutMs(1000);
    var registry = Registry.init(allocator);
    defer registry.deinit();
    var messages = try Journal.init(allocator, config.journal_capacity);
    defer messages.deinit();
    if (config.debug) std.log.info("debug mode enabled: logging every envelope routed through fujin", .{});
    const worker = try std.Thread.spawn(.{}, transportLoop, .{ &router, &hub, &registry, &messages, &config.jwt, config.debug });
    worker.detach();

    var websocket = WebSocket{
        .hub = &hub,
        .host = config.ws_host,
        .port = config.ws_port,
        .browser_scope = config.browser_scope,
        .jwt = &config.jwt,
    };
    try websocket.serve();
}

fn kindName(kind: transport.envelope.Kind) []const u8 {
    return @tagName(kind);
}

/// Short request id for logs: the full UUID is noise at a glance, the first
/// segment is enough to correlate a drop with a caller's timeout.
fn shortId(request_id: []const u8) []const u8 {
    const cut = std.mem.indexOfScalar(u8, request_id, '-') orelse request_id.len;
    return request_id[0..@min(cut, 8)];
}

/// One line per routing decision, always on — this is what tells you *why* a
/// caller is hanging. Deliberately compact: `verb from→to.service.method id
/// size [reason]`, one line, no wrapping.
fn logDecision(verb: []const u8, env: anytype, payload_len: usize, reason: []const u8) void {
    std.log.info("{s} {s}→{s}/{s}.{s} id={s} {d}B{s}{s}", .{
        verb,
        if (env.from.target.len > 0) env.from.target else "?",
        if (env.to.target.len > 0) env.to.target else "?",
        env.to.service,
        env.method,
        shortId(env.request_id),
        payload_len,
        if (reason.len > 0) " " else "",
        reason,
    });
}

/// Every request gets an answer: a router that cannot deliver says so, so the
/// caller fails immediately instead of waiting out its own deadline. Replies
/// to the sender's ZMQ identity rather than from.target — that frame is
/// known-good, while from.target need not be registered (browser bridges,
/// one-shot clients).
fn replyUnroutable(
    router: *transport.Router,
    identity: []const u8,
    env: anytype,
    code: []const u8,
) void {
    // Only requests await an answer; replying to a reply would loop.
    if (env.kind != .request) return;
    const reply = transport.Envelope{
        .kind = .@"error",
        .request_id = env.request_id,
        .to = env.from,
        .from = .{ .target = "fujin" },
        .method = env.method,
        .scope = env.scope,
        .user = env.user,
        .codec = .json,
        .error_code = code,
    };
    var buffer: [512]u8 = undefined;
    var allocator_state = std.heap.FixedBufferAllocator.init(&buffer);
    const bytes = transport.envelope.encodeAlloc(allocator_state.allocator(), &reply) catch |err| {
        std.log.warn("unroutable reply not encoded id={s}: {s}", .{ shortId(env.request_id), @errorName(err) });
        return;
    };
    router.send(identity, bytes, "") catch |err| {
        std.log.warn("unroutable reply not sent id={s}: {s}", .{ shortId(env.request_id), @errorName(err) });
    };
}

/// Debug-mode trace of a single envelope decision (routed, dropped, or
/// rejected). Gated behind FUJIN_DEBUG=on — this is the "why is my request
/// stuck" tool: every message fujin sees is logged with enough routing
/// context (kind/to/from/method/requestId/payload size) to tell whether it
/// arrived, where it was headed, and why it didn't reach its target.
fn logEnvelope(comptime verb: []const u8, env: anytype, payload_len: usize, detail: []const u8) void {
    std.log.info(
        "[debug] {s} kind={s} to={s}/{s} from={s}/{s} method={s} requestId={s} payload={d}B{s}{s}",
        .{
            verb,
            kindName(env.kind),
            env.to.target,
            env.to.service,
            env.from.target,
            env.from.service,
            env.method,
            env.request_id,
            payload_len,
            if (detail.len > 0) " " else "",
            detail,
        },
    );
}

fn transportLoop(router: *transport.Router, hub: *Hub, registry: *Registry, messages: *Journal, jwt: *const @import("config.zig").JwtConfig, debug: bool) void {
    while (true) {
        drainBrowserCommands(router, hub, registry, messages, jwt, debug);

        var incoming = (router.recv() catch |err| {
            std.log.warn("transport receive rejected: {s}", .{@errorName(err)});
            continue;
        }) orelse continue;
        defer incoming.deinit();

        // ZMQ_ROUTER_NOTIFY disconnect: bare [identity][empty], no real
        // envelope ever legitimately empty. Cascade-remove everything this
        // peer registered before it can leave stale routes behind.
        if (incoming.envelopeBytes().len == 0) {
            registry.removePeer(incoming.identity());
            continue;
        }

        const env = incoming.parseEnvelope() catch |err| {
            std.log.warn("transport envelope rejected: {s}", .{@errorName(err)});
            continue;
        };

        if (env.kind != .system) {
            messages.recordEnvelope("zmq", "received", env, incoming.payload().len);
            if (debug) logEnvelope("recv", env, incoming.payload().len, "");
        }

        if (env.kind == .system) {
            if (std.mem.eql(u8, env.method, "register")) {
                registry.registerPeer(incoming.identity(), env.from.target) catch |err| {
                    std.log.warn("peer registration failed: {s}", .{@errorName(err)});
                    continue;
                };
                replySystem(router, incoming.identity(), env, "registered");
                continue;
            }
            if (std.mem.eql(u8, env.method, "ping")) {
                _ = registry.refreshPeer(incoming.identity(), env.from.target) catch |err| {
                    std.log.warn("peer target refresh failed: {s}", .{@errorName(err)});
                    continue;
                };
                replySystem(router, incoming.identity(), env, "pong");
                continue;
            }
            std.log.warn("unknown system method {s}", .{env.method});
            continue;
        }
        // The first application packet after a Fujin restart restores its
        // absent return target before the destination can answer it. It never
        // steals a target already owned by a newer connection.
        if (env.from.target.len > 0) {
            const owns_source = registry.refreshPeer(incoming.identity(), env.from.target) catch |err| {
                std.log.warn("peer target refresh failed: {s}", .{@errorName(err)});
                continue;
            };
            if (!owns_source) {
                messages.recordEnvelope("zmq", "dropped", env, incoming.payload().len);
                logDecision("drop", env, incoming.payload().len, "reason=target_conflict");
                replyUnroutable(router, incoming.identity(), env, "target_conflict");
                continue;
            }
        }
        if (webSocketConnectionId(env.to.target)) |client_id| {
            hub.sendTransportReply(client_id, env, incoming.payload()) catch |err| {
                std.log.warn("websocket reply failed client={d}: {s}", .{ client_id, @errorName(err) });
                if (debug) logEnvelope("drop", env, incoming.payload().len, @errorName(err));
            };
            continue;
        }
        if (env.kind == .event and env.to.target.len == 0) {
            hub.onTransportEvent(incoming.payload()) catch |err|
                std.log.warn("transport event rejected: {s}", .{@errorName(err)});
            continue;
        }

        const identity = registry.identityFor(env.to.target) orelse {
            messages.recordEnvelope("zmq", "dropped", env, incoming.payload().len);
            logDecision("drop", env, incoming.payload().len, "reason=no_route");
            replyUnroutable(router, incoming.identity(), env, "service_unavailable");
            continue;
        };
        router.send(identity, incoming.envelopeBytes(), incoming.payload()) catch |err| {
            messages.recordEnvelope("zmq", "failed", env, incoming.payload().len);
            logDecision("fail", env, incoming.payload().len, @errorName(err));
            // A peer that is gone leaves a route behind until its disconnect
            // notification lands, so drop the stale entry here rather than
            // handing the next caller the same dead identity.
            if (err == error.PeerUnreachable) registry.removePeer(identity);
            replyUnroutable(router, incoming.identity(), env, routeErrorCode(err));
            continue;
        };
        messages.recordEnvelope("zmq", "routed", env, incoming.payload().len);
        if (debug) logEnvelope("route", env, incoming.payload().len, "");
    }
}

fn drainBrowserCommands(router: *transport.Router, hub: *Hub, registry: *Registry, messages: *Journal, jwt: *const @import("config.zig").JwtConfig, debug: bool) void {
    while (hub.takePending()) |pending_value| {
        var pending = pending_value;
        defer pending.deinit();
        messages.recordWebSocket("received", pending.client_id, pending.target, pending.service, pending.method, pending.request_id, pending.payload.len);
        if (debug) {
            std.log.info(
                "[debug] ws-recv target={s}/{s} from=ws:{d} method={s} requestId={s} payload={d}B",
                .{ pending.target, pending.service, pending.client_id, pending.method, pending.request_id, pending.payload.len },
            );
        }
        if (std.mem.eql(u8, pending.target, "fujin")) {
            handleAdminCommand(hub, registry, messages, jwt, &pending) catch |err| {
                hub.sendAdminError(pending.client_id, pending.request_id, adminErrorCode(err), @errorName(err));
                // Auth outcome, not just "rejected": who was refused, for what,
                // and why. Without user/scope an access denial is unactionable.
                std.log.warn("deny ws:{d}→fujin.{s} id={s} user={s} scope={s} reason={s}", .{
                    pending.client_id,
                    pending.method,
                    shortId(pending.request_id),
                    if (pending.user.len > 0) pending.user else "-",
                    if (pending.scope.len > 0) pending.scope else "-",
                    @errorName(err),
                });
            };
            continue;
        }
        const identity = registry.identityFor(pending.target) orelse {
            messages.recordWebSocket("dropped", pending.client_id, pending.target, pending.service, pending.method, pending.request_id, pending.payload.len);
            hub.serviceUnavailable(&pending);
            std.log.info("drop ws:{d}→{s}/{s}.{s} id={s} {d}B reason=no_route", .{
                pending.client_id,
                pending.target,
                pending.service,
                pending.method,
                shortId(pending.request_id),
                pending.payload.len,
            });
            continue;
        };
        var from_buffer: [64]u8 = undefined;
        const from_target = std.fmt.bufPrint(&from_buffer, "ws:{d}", .{pending.client_id}) catch {
            hub.serviceUnavailable(&pending);
            continue;
        };
        const env = transport.Envelope{
            .kind = .request,
            .request_id = pending.request_id,
            .to = .{ .target = pending.target, .service = pending.service },
            .from = .{ .target = from_target },
            .method = pending.method,
            .scope = pending.scope,
            .user = pending.user,
            .auth = pending.auth,
            .codec = .json,
        };
        const env_bytes = transport.envelope.encodeAlloc(hub.allocator, &env) catch {
            hub.serviceUnavailable(&pending);
            continue;
        };
        defer hub.allocator.free(env_bytes);
        router.send(identity, env_bytes, pending.payload) catch |err| {
            messages.recordWebSocket("failed", pending.client_id, pending.target, pending.service, pending.method, pending.request_id, pending.payload.len);
            hub.serviceUnavailable(&pending);
            logDecision("fail", env, pending.payload.len, @errorName(err));
            if (err == error.PeerUnreachable) registry.removePeer(identity);
            continue;
        };
        messages.recordWebSocket("routed", pending.client_id, pending.target, pending.service, pending.method, pending.request_id, pending.payload.len);
        if (debug) logEnvelope("ws-route", env, pending.payload.len, "");
    }
}

fn handleAdminCommand(hub: *Hub, registry: *Registry, messages: *Journal, jwt: *const @import("config.zig").JwtConfig, pending: *const Hub.PendingCommand) !void {
    if (jwt.mode != .required) return error.AdminAuthRequired;
    const verifier = jwt.verifierConfig() orelse return error.JwtVerifierUnavailable;
    const now = std.Io.Timestamp.now(std.Options.debug_io, .real).toSeconds();
    var token = try transport.auth.jwt.verify(hub.allocator, pending.auth, verifier, now);
    defer token.deinit(hub.allocator);
    if (!std.mem.eql(u8, token.subject, pending.user) or !std.mem.eql(u8, token.scope, pending.scope)) return error.SessionClaimsMismatch;
    const policy: transport.auth.authorize.MethodPolicy = switchMethodPolicy(pending.method) orelse return error.MethodUnavailable;
    try transport.auth.authorize.authorize(token.toClaims(), policy);

    if (std.mem.eql(u8, pending.method, "state")) {
        const payload = try adminStateJson(hub, registry);
        defer hub.allocator.free(payload);
        return hub.sendAdminResponse(pending.client_id, pending.request_id, payload);
    }
    if (std.mem.eql(u8, pending.method, "messages")) {
        const limit = try messagesLimit(pending.payload);
        const payload = try messages.snapshotJson(limit);
        defer hub.allocator.free(payload);
        return hub.sendAdminResponse(pending.client_id, pending.request_id, payload);
    }
    if (std.mem.eql(u8, pending.method, "logs")) {
        const limit = try messagesLimit(pending.payload);
        const payload = try messages.snapshotJson(limit);
        defer hub.allocator.free(payload);
        return hub.sendAdminStreamChunk(pending.client_id, pending.request_id, 0, payload, true);
    }
    return error.MethodUnavailable;
}

fn switchMethodPolicy(method: []const u8) ?transport.auth.authorize.MethodPolicy {
    return fujin_nrpc.policy(method);
}

fn adminStateJson(hub: *Hub, registry: *Registry) ![]u8 {
    const clients = try hub.clientsJson();
    defer hub.allocator.free(clients);
    const routes = try registry.snapshotJson();
    defer hub.allocator.free(routes);
    return std.fmt.allocPrint(hub.allocator, "{{\"websocketClients\":{s},\"peers\":{s}}}", .{ clients, routes });
}

fn messagesLimit(payload: []const u8) !usize {
    if (payload.len == 0) return Journal.default_limit;
    var parsed = try std.json.parseFromSlice(std.json.Value, std.heap.page_allocator, payload, .{});
    defer parsed.deinit();
    if (parsed.value != .object) return Journal.default_limit;
    const value = parsed.value.object.get("limit") orelse return Journal.default_limit;
    if (value != .integer or value.integer <= 0) return error.InvalidMessageLimit;
    return std.math.cast(usize, value.integer) orelse error.InvalidMessageLimit;
}

/// Names the failure for the caller: a dead peer is retryable elsewhere, a
/// backlogged one means slow down, anything else is a transport fault.
fn routeErrorCode(err: anyerror) []const u8 {
    return switch (err) {
        error.PeerUnreachable => "service_unavailable",
        error.PeerBacklogged => "overloaded",
        else => "route_failed",
    };
}

fn adminErrorCode(err: anyerror) []const u8 {
    return switch (err) {
        error.PermissionDenied => "forbidden",
        error.UserTokenRequired, error.ServiceTokenRequired => "unauthenticated",
        error.MethodUnavailable => "method_unavailable",
        else => "unauthenticated",
    };
}

test "Fujin admin contract has user methods and validates message limit" {
    const state = fujin_nrpc.policy("state").?;
    try std.testing.expectEqual(transport.auth.authorize.Level.user, state.level);
    try std.testing.expectEqual(transport.auth.access.Mode.read, fujin_nrpc.policy("logs").?.mode.?);
    try std.testing.expectEqual(Journal.default_limit, try messagesLimit("{}"));
    try std.testing.expectEqual(@as(usize, 10), try messagesLimit("{\"limit\":10}"));
    try std.testing.expectError(error.InvalidMessageLimit, messagesLimit("{\"limit\":0}"));
}

/// System packets terminate at Fujin. They are never passed through the
/// target registry, so liveness and registration do not depend on NRPC.
fn replySystem(router: *transport.Router, identity: []const u8, inbound: transport.Envelope, method: []const u8) void {
    const env = transport.Envelope{
        .kind = .system,
        .to = inbound.from,
        .from = .{ .target = "fujin" },
        .method = method,
        .codec = .json,
    };
    var buffer: [256]u8 = undefined;
    const bytes = transport.envelope.encode(&env, &buffer) catch |err| {
        std.log.warn("system reply not encoded: {s}", .{@errorName(err)});
        return;
    };
    router.send(identity, bytes, "{}") catch |err|
        std.log.debug("system reply not sent: {s}", .{@errorName(err)});
}

fn webSocketConnectionId(target: []const u8) ?u64 {
    const prefix = "ws:";
    if (!std.mem.startsWith(u8, target, prefix)) return null;
    return std.fmt.parseUnsigned(u64, target[prefix.len..], 10) catch null;
}
