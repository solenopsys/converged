const std = @import("std");
const Config = @import("config.zig").Config;
const Policy = @import("qjs_policy.zig").Policy;
const Hub = @import("hub.zig").Hub;
const transport = @import("transport");
const FluentBit = @import("fluentbit.zig").Receiver;
const WebSocket = @import("websocket.zig").Server;
const Registry = @import("registry.zig").Registry;
const Journal = @import("messages.zig").Journal;
const Notifications = @import("notifications.zig").Store;
const pushrouter = @import("pushrouter.zig");
const Collector = @import("ingest.zig").Collector;
const topics = @import("topics.zig");
const bus = @import("bus.zig");
const scheduler_mod = @import("scheduler.zig");
const fujin_nrpc = @import("generated/fujin_nrpc.zig");

/// Fujin's own address. Packets carrying it terminate here instead of being
/// looked up in the peer registry — that is what makes `pushrouter` reachable
/// from a backend service and not only from a browser session.
const local_target = "fujin";

/// Peer that owns the repositories Fujin ships collected rows to.
const services_target = "services";

/// Where Fluent Bit posts its batches back to this process.
const ingest_path = "/ingest/fluentbit";

/// A container runs this binary as PID 1, and the kernel gives PID 1 no default
/// signal disposition: with no handler installed SIGTERM is discarded outright,
/// so `docker stop` and a pod eviction both sit out the whole grace period and
/// end in SIGKILL. The loops below park in accept() and clock_nanosleep(), and
/// both restart themselves after EINTR, so there is no cooperative unwind to
/// hand a flag to — the handler leaves through exit_group, which is the only
/// exit safe to call from signal context (std.c.exit would run atexit handlers
/// and can deadlock on the stdio lock the interrupted thread is holding).
fn onSignal(_: std.posix.SIG) callconv(.c) void {
    const notice = "fujin: signal received, shutting down\n";
    _ = std.os.linux.write(2, notice, notice.len);
    std.os.linux.exit_group(0);
}

fn installSignalHandlers() void {
    const action = std.posix.Sigaction{
        .handler = .{ .handler = onSignal },
        .mask = std.posix.sigemptyset(),
        .flags = 0,
    };
    std.posix.sigaction(std.posix.SIG.TERM, &action, null);
    std.posix.sigaction(std.posix.SIG.INT, &action, null);
}

pub fn main(init: std.process.Init) !void {
    installSignalHandlers();
    const allocator = init.gpa;
    var config = try Config.init(allocator, init.environ_map);
    defer config.deinit();

    var policy = try Policy.init(allocator, config.qjs_lib, config.event_policy_path);
    defer policy.deinit();
    var hub = Hub.init(allocator, &policy, config.max_control_bytes, config.jwt.mode == .required);
    defer hub.deinit();

    var collector = Collector.init(allocator, config.ingest_block_size, config.ingest_max_blocks);
    defer collector.deinit();

    var fluentbit: ?FluentBit = null;
    if (config.fluentbit_enabled) {
        // The engine posts back to this process over loopback regardless of the
        // address the browser socket is published on: the ingest hop never has
        // to leave the pod.
        fluentbit = try FluentBit.init(allocator, config.fluentbit_lib, .{
            .listen = config.fluentbit_listen,
            .port = config.fluentbit_port,
            .shared_key = config.fluentbit_shared_key,
            .ingest_host = "127.0.0.1",
            .ingest_port = config.ws_port,
            .ingest_path = ingest_path,
            .ingest_key = config.ingest_key,
        });
        std.log.info("Fluent Bit forward receiver listening on {s}:{d}, blocks of {d} to rp-logs/rp-telemetry scope={s}", .{
            config.fluentbit_listen,
            config.fluentbit_port,
            config.ingest_block_size,
            config.ingest_scope,
        });
        if (config.service_token.len == 0) {
            std.log.warn("SERVICE_TOKEN is empty: collected blocks will be refused by the repositories", .{});
        }
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
    var notifications = try Notifications.init(allocator, config.push_capacity);
    defer notifications.deinit();
    var subscriptions = topics.Table.init(allocator, config.subscriptions_max);
    defer subscriptions.deinit();
    // The hub clears a session's topic interests when its socket closes; that
    // is the whole expiry mechanism the bus has.
    hub.subscriptions = &subscriptions;
    const event_bus = Bus{ .table = &subscriptions, .auth = config.service_token };
    if (config.debug) std.log.info("debug mode enabled: compact external RPC activity", .{});
    if (config.trace_packets) std.log.info("packet trace enabled: logging every routed envelope", .{});
    const shipping = Shipping{
        .collector = &collector,
        .scope = config.ingest_scope,
        .auth = config.service_token,
        .flush_ms = config.ingest_flush_ms,
    };
    const worker = try std.Thread.spawn(.{}, transportLoop, .{ &router, &hub, &registry, &messages, &notifications, shipping, event_bus, &config.jwt, config.debug, config.trace_packets });
    worker.detach();

    if (isScheduleLeader(&config)) try startScheduler(allocator, &config);

    var websocket = WebSocket{
        .hub = &hub,
        .host = config.ws_host,
        .port = config.ws_port,
        .browser_scope = config.browser_scope,
        .jwt = &config.jwt,
        .ingest = if (config.fluentbit_enabled) .{
            .collector = &collector,
            .path = ingest_path,
            .key = config.ingest_key,
        } else null,
    };
    try websocket.serve();
}

/// Whether this process owns the schedule.
///
/// The single question the ticker asks, and the only place the answer lives.
/// Today it is a deployment flag, because there is one Fujin. When several
/// nodes balance the cluster and Raft elects one of them, this function is what
/// changes — not the scheduler, which will keep asking exactly this.
fn isScheduleLeader(config: *const Config) bool {
    return config.scheduler_enabled;
}

/// Starts the ticker as an ordinary peer of this very bus.
///
/// It gets its own DEALER connection and its own routing target, and talks NRPC
/// like everything else does — the router learned nothing new to make this
/// work. It lives in this process only because a schedule needs exactly one
/// clock, and Fujin is the component there is exactly one of.
fn startScheduler(allocator: std.mem.Allocator, config: *const Config) !void {
    const endpoint = try allocator.dupeZ(u8, config.scheduler_endpoint);
    const runtime = try allocator.create(transport.Runtime);
    runtime.* = transport.Runtime.init(allocator, .{
        .endpoint = endpoint,
        .target = config.scheduler_target,
        .limits = .{ .max_envelope_bytes = config.max_control_bytes, .max_payload_bytes = config.max_payload_bytes },
        .recv_timeout_ms = 1_000,
        .send_timeout_ms = 1_000,
        .workers = 0,
    }) catch |err| {
        allocator.destroy(runtime);
        allocator.free(endpoint);
        return err;
    };

    const scheduler = try allocator.create(scheduler_mod.Scheduler);
    scheduler.* = scheduler_mod.Scheduler.init(allocator, runtime, .{
        .endpoint = endpoint,
        .target = config.scheduler_target,
        .scope = config.ingest_scope,
        .auth = config.service_token,
        .refresh_ms = config.scheduler_refresh_ms,
    });

    (try std.Thread.spawn(.{}, transport.Runtime.run, .{runtime})).detach();
    (try std.Thread.spawn(.{}, scheduler_mod.Scheduler.run, .{scheduler})).detach();
    std.log.info("schedule ticker enabled target={s}", .{config.scheduler_target});
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

/// Compact RPC activity line. Full packet-level logging is gated behind
/// FUJIN_TRACE=packets; FUJIN_DEBUG=on must remain readable during normal dev.
fn logEnvelope(comptime verb: []const u8, env: anytype, payload_len: usize, detail: []const u8) void {
    std.log.info(
        "rpc {s} {s} {s}→{s}/{s}.{s} id={s} {d}B{s}{s}",
        .{
            verb,
            kindName(env.kind),
            env.from.target,
            env.to.target,
            env.to.service,
            env.method,
            shortId(env.request_id),
            payload_len,
            if (detail.len > 0) " " else "",
            detail,
        },
    );
}

fn isBrowserTarget(target: []const u8) bool {
    return std.mem.startsWith(u8, target, "ws:");
}

fn isWorkflowEnvelope(env: anytype) bool {
    return std.mem.eql(u8, env.to.target, "centimanus") or
        std.mem.eql(u8, env.from.target, "centimanus");
}

fn isCompactDebugEnvelope(env: anytype) bool {
    if (env.kind == .stream_chunk) return false;
    return isBrowserTarget(env.to.target) or
        isBrowserTarget(env.from.target) or
        isWorkflowEnvelope(env);
}

/// What the event bus needs from the process: the subscription table and the
/// token Fujin signs its own outbound events with. Small enough to pass by
/// value, which keeps it out of the loop's growing parameter list.
const Bus = struct {
    table: *topics.Table,
    auth: []const u8,
};

/// Everything the transport loop needs to hand collected blocks to the
/// repositories. The collector is filled by the HTTP ingest threads; only this
/// loop ever touches the ZMQ socket.
const Shipping = struct {
    collector: *Collector,
    scope: []const u8,
    auth: []const u8,
    flush_ms: i64,
};

fn transportLoop(router: *transport.Router, hub: *Hub, registry: *Registry, messages: *Journal, notifications: *Notifications, shipping: Shipping, event_bus: Bus, jwt: *const @import("config.zig").JwtConfig, debug: bool, trace_packets: bool) void {
    while (true) {
        drainBrowserCommands(router, hub, registry, messages, notifications, event_bus, jwt, debug, trace_packets);
        shipCollectedBlocks(router, hub, registry, shipping);

        var incoming = (router.recv() catch |err| {
            std.log.warn("transport receive rejected: {s}", .{@errorName(err)});
            continue;
        }) orelse continue;
        defer incoming.deinit();

        // ZMQ_ROUTER_NOTIFY disconnect: bare [identity][empty], no real
        // envelope ever legitimately empty. Cascade-remove everything this
        // peer registered before it can leave stale routes behind.
        if (incoming.envelopeBytes().len == 0) {
            dropPeer(registry, event_bus, hub.allocator, incoming.identity());
            continue;
        }

        const env = incoming.parseEnvelope() catch |err| {
            std.log.warn("transport envelope rejected: {s}", .{@errorName(err)});
            continue;
        };

        if (env.kind != .system) {
            messages.recordEnvelope("zmq", "received", env, incoming.payload().len);
            if (trace_packets) logEnvelope("recv", env, incoming.payload().len, "");
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
        // Fujin's own services terminate here. Without this branch a backend
        // service could only reach `pushrouter` if something had registered
        // "fujin" as a peer target, which nothing does and the routing contract
        // forbids — the packet would be answered with service_unavailable.
        if (std.mem.eql(u8, env.to.target, local_target)) {
            if (env.kind == .request) {
                handleLocalEnvelope(router, hub, registry, messages, notifications, event_bus, jwt, incoming.identity(), env, incoming.payload());
            } else if (env.kind == .@"error") {
                // Fujin originates requests of its own (log shipping). A failed
                // one is worth a line; a successful one is not.
                std.log.warn("fujin call failed {s}.{s} id={s}: {s}", .{ env.to.service, env.method, shortId(env.request_id), env.error_code });
            }
            continue;
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
            if (err == error.PeerUnreachable) dropPeer(registry, event_bus, hub.allocator, identity);
            replyUnroutable(router, incoming.identity(), env, routeErrorCode(err));
            continue;
        };
        messages.recordEnvelope("zmq", "routed", env, incoming.payload().len);
        if (trace_packets or (debug and isCompactDebugEnvelope(env)))
            logEnvelope("route", env, incoming.payload().len, "");
    }
}

/// Hands each sealed block to the repository that owns it, as one `writeBatch`
/// request per block. Sent fire-and-forget: the reply carries only a row count,
/// and blocking the router on a storage round-trip would stall every other
/// message. A block that cannot be handed over goes back on the queue, so a
/// `services` restart costs latency rather than logs.
fn shipCollectedBlocks(router: *transport.Router, hub: *Hub, registry: *Registry, shipping: Shipping) void {
    shipping.collector.flushStale(shipping.flush_ms);
    while (shipping.collector.takeBlock()) |taken| {
        var block = taken;
        const identity = registry.identityFor(services_target) orelse {
            shipping.collector.returnBlock(block);
            return;
        };
        // A real id so the block can be followed through the journal and the
        // repository's own logs; the reply itself is not awaited.
        var id_buffer: [32]u8 = undefined;
        var id_bytes: [16]u8 = undefined;
        std.Options.debug_io.random(&id_bytes);
        const request_id = std.fmt.bufPrint(&id_buffer, "{x}", .{&id_bytes}) catch "ingest";
        const env = transport.Envelope{
            .kind = .request,
            .request_id = request_id,
            .to = .{ .target = services_target, .service = block.kind.service() },
            .from = .{ .target = local_target },
            .method = "writeBatch",
            .scope = shipping.scope,
            .auth = shipping.auth,
            .codec = .json,
        };
        const bytes = transport.envelope.encodeAlloc(hub.allocator, &env) catch {
            block.deinit(hub.allocator);
            return;
        };
        defer hub.allocator.free(bytes);
        router.send(identity, bytes, block.body) catch |err| {
            if (err == error.PeerUnreachable) registry.removePeer(identity);
            shipping.collector.returnBlock(block);
            std.log.warn("ingest block held: {s}/{s} {d} records: {s}", .{
                services_target,
                block.kind.service(),
                block.count,
                @errorName(err),
            });
            return;
        };
        std.log.info("ingest shipped {s} {d} records", .{ block.kind.service(), block.count });
        block.deinit(hub.allocator);
    }
}

fn drainBrowserCommands(router: *transport.Router, hub: *Hub, registry: *Registry, messages: *Journal, notifications: *Notifications, event_bus: Bus, jwt: *const @import("config.zig").JwtConfig, debug: bool, trace_packets: bool) void {
    while (hub.takePending()) |pending_value| {
        var pending = pending_value;
        defer pending.deinit();
        messages.recordWebSocket("received", pending.client_id, pending.target, pending.service, pending.method, pending.request_id, pending.payload.len);
        if (std.mem.eql(u8, pending.target, local_target)) {
            handleBrowserLocalCall(router, hub, registry, messages, notifications, event_bus, jwt, &pending) catch |err| {
                hub.sendAdminError(pending.client_id, pending.request_id, adminErrorCode(err), @errorName(err));
                // Auth outcome, not just "rejected": who was refused, for what,
                // and why. Without user/scope an access denial is unactionable.
                std.log.warn("deny ws:{d}→fujin/{s}.{s} id={s} user={s} scope={s} reason={s}", .{
                    pending.client_id,
                    pending.service,
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
            if (err == error.PeerUnreachable) dropPeer(registry, event_bus, hub.allocator, identity);
            continue;
        };
        messages.recordWebSocket("routed", pending.client_id, pending.target, pending.service, pending.method, pending.request_id, pending.payload.len);
        if (trace_packets or debug) logEnvelope("ws-route", env, pending.payload.len, "");
    }
}

/// One NRPC call addressed at Fujin itself, from either transport.
///
/// The browser and a backend service reach the same handlers, so the identity
/// checks live here once rather than in two loops that could drift apart.
const LocalCall = struct {
    service: []const u8,
    method: []const u8,
    auth: []const u8,
    scope: []const u8,
    user: []const u8,
    payload: []const u8,
    /// A WebSocket command is bound to an authenticated session, so the token
    /// must still be the one that session presented. A ZMQ peer has no session
    /// and states its identity in the token alone, so there is nothing to
    /// cross-check — demanding a match there would reject every service call.
    session_bound: bool,
    /// Which connection is speaking, for the bus: a subscription belongs to it
    /// and dies with it. One of the two is always empty.
    client_id: u64 = 0,
    source_target: []const u8 = "",
};

const LocalReply = struct {
    body: []u8,
    /// `logs` answers as a single terminal stream chunk, not a response.
    streamed: bool = false,
};

fn handleLocalCall(
    router: *transport.Router,
    hub: *Hub,
    registry: *Registry,
    messages: *Journal,
    notifications: *Notifications,
    event_bus: Bus,
    jwt: *const @import("config.zig").JwtConfig,
    call: LocalCall,
) !LocalReply {
    if (jwt.mode != .required) return error.AdminAuthRequired;
    const verifier = jwt.verifierConfig() orelse return error.JwtVerifierUnavailable;
    const now = std.Io.Timestamp.now(std.Options.debug_io, .real).toSeconds();
    var token = try transport.auth.jwt.verify(hub.allocator, call.auth, verifier, now);
    defer token.deinit(hub.allocator);
    if (call.session_bound and
        (!std.mem.eql(u8, token.subject, call.user) or !std.mem.eql(u8, token.scope, call.scope)))
    {
        return error.SessionClaimsMismatch;
    }
    const policy = localMethodPolicy(call.service, call.method) orelse return error.MethodUnavailable;
    try transport.auth.authorize.authorize(token.toClaims(), policy);

    if (std.mem.eql(u8, call.service, pushrouter.service)) {
        const context = pushrouter.Context{
            .allocator = hub.allocator,
            .hub = hub,
            .store = notifications,
            .policy = hub.policy,
        };
        // A service token is cluster-wide and carries no scope of its own, so
        // the envelope's scope is the only tenant it can be speaking for.
        const caller = pushrouter.Caller{
            .scope = if (token.scope.len > 0) token.scope else call.scope,
            .user = token.subject,
            .is_service = token.token_type == .service,
        };
        if (std.mem.eql(u8, call.method, "publish")) {
            var published = try pushrouter.publish(context, caller, call.payload);
            errdefer published.deinit(hub.allocator);
            std.log.info("push {s} delivered={d}{s}", .{
                caller.scope,
                published.delivered,
                if (published.accepted) "" else " dropped=policy",
            });
            return .{ .body = published.response };
        }
        if (std.mem.eql(u8, call.method, "history")) {
            return .{ .body = try pushrouter.history(context, caller, call.payload) };
        }
        return error.MethodUnavailable;
    }

    if (std.mem.eql(u8, call.service, bus.service)) {
        return handleBusCall(router, hub, registry, event_bus, &token, call);
    }

    if (std.mem.eql(u8, call.service, fujin_nrpc.service)) {
        if (std.mem.eql(u8, call.method, "state")) return .{ .body = try adminStateJson(hub, registry) };
        if (std.mem.eql(u8, call.method, "messages")) {
            return .{ .body = try messages.snapshotJson(try messagesLimit(call.payload)) };
        }
        if (std.mem.eql(u8, call.method, "logs")) {
            return .{ .body = try messages.snapshotJson(try messagesLimit(call.payload)), .streamed = true };
        }
    }
    return error.MethodUnavailable;
}

/// One call to the `bus` service: publish, subscribe, or read what is live.
///
/// The owner of a subscription is the connection that made the call, taken from
/// the transport and never from the body — otherwise a client could subscribe
/// somebody else, or unsubscribe them.
fn handleBusCall(
    router: *transport.Router,
    hub: *Hub,
    registry: *Registry,
    event_bus: Bus,
    token: *const transport.auth.jwt.VerifiedToken,
    call: LocalCall,
) !LocalReply {
    const allocator = hub.allocator;
    if (std.mem.eql(u8, call.method, "publish")) {
        const caller = bus.Caller{
            // A service token is cluster-wide and carries no scope of its own,
            // so the envelope's scope is the only tenant it speaks for.
            .scope = if (token.scope.len > 0) token.scope else call.scope,
            .user = token.subject,
            .is_service = token.token_type == .service,
        };
        var prepared = try bus.prepare(.{
            .allocator = allocator,
            .table = event_bus.table,
            .policy = hub.policy,
        }, caller, call.payload);
        defer prepared.deinit();
        if (prepared.dropped) {
            std.log.info("event {s} dropped=policy", .{prepared.topic});
            return .{ .body = try bus.publishResponseJson(allocator, prepared.id, 0, 0) };
        }
        const peers = deliverToPeers(router, registry, allocator, event_bus, &prepared);
        const sessions = hub.deliverToSessions(prepared.sessions, prepared.scope, prepared.thin_frame);
        std.log.info("event {s} scope={s} peers={d} sessions={d}", .{ prepared.topic, prepared.scope, peers, sessions });
        return .{ .body = try bus.publishResponseJson(allocator, prepared.id, peers, sessions) };
    }

    const adding = std.mem.eql(u8, call.method, "subscribe");
    if (adding or std.mem.eql(u8, call.method, "unsubscribe")) {
        const owner = try busOwner(call);
        const body = try bus.subscribe(allocator, event_bus.table, owner, call.payload, adding);
        std.log.info("bus {s} owner={s} live={d}", .{
            call.method,
            switch (owner) {
                .peer => |name| name,
                .session => "session",
            },
            event_bus.table.count(),
        });
        return .{ .body = body };
    }

    if (std.mem.eql(u8, call.method, "subscriptions")) {
        return .{ .body = try event_bus.table.snapshotJson(allocator) };
    }
    return error.MethodUnavailable;
}

/// A ZMQ peer subscribes as its target; a browser as its session. A peer that
/// has not registered a target has nothing to be addressed by, so it cannot
/// hold a subscription either.
fn busOwner(call: LocalCall) !topics.Owner {
    if (call.session_bound) return .{ .session = call.client_id };
    if (call.source_target.len == 0) return error.SubscriberUnaddressable;
    if (isBrowserTarget(call.source_target)) {
        const id = webSocketConnectionId(call.source_target) orelse return error.SubscriberUnaddressable;
        return .{ .session = id };
    }
    return .{ .peer = call.source_target };
}

/// Hands one event to every subscribed peer, as an ordinary request they may
/// answer or ignore. Fire-and-forget: the bus is not a queue, and a peer that
/// is mid-restart is expected to catch up from the journal rather than hold the
/// router hostage while it comes back.
fn deliverToPeers(
    router: *transport.Router,
    registry: *Registry,
    allocator: std.mem.Allocator,
    event_bus: Bus,
    prepared: *const bus.Prepared,
) usize {
    var delivered: usize = 0;
    for (prepared.peers) |target| {
        const identity = registry.identityFor(target) orelse {
            std.log.info("event {s} skipped target={s} reason=no_route", .{ prepared.topic, target });
            continue;
        };
        var id_buffer: [32]u8 = undefined;
        var id_bytes: [16]u8 = undefined;
        std.Options.debug_io.random(&id_bytes);
        const request_id = std.fmt.bufPrint(&id_buffer, "{x}", .{&id_bytes}) catch "event";
        const env = transport.Envelope{
            .kind = .request,
            .request_id = request_id,
            .to = .{ .target = target, .service = bus.service },
            .from = .{ .target = local_target },
            .method = "onEvent",
            .scope = prepared.scope,
            .auth = event_bus.auth,
            .codec = .json,
        };
        const bytes = transport.envelope.encodeAlloc(allocator, &env) catch continue;
        defer allocator.free(bytes);
        router.send(identity, bytes, prepared.frame) catch |err| {
            if (err == error.PeerUnreachable) dropPeer(registry, event_bus, allocator, identity);
            std.log.warn("event {s} not delivered target={s}: {s}", .{ prepared.topic, target, @errorName(err) });
            continue;
        };
        delivered += 1;
    }
    return delivered;
}

/// Drops a peer's route and, with it, everything that peer had subscribed to.
/// Only the identity that still owns the target clears anything, so a late
/// disconnect cannot unsubscribe its own replacement.
fn dropPeer(registry: *Registry, event_bus: Bus, allocator: std.mem.Allocator, identity: []const u8) void {
    const target = registry.takePeerTarget(identity, allocator) catch {
        registry.removePeer(identity);
        return;
    };
    const owned = target orelse return;
    defer allocator.free(owned);
    event_bus.table.removeOwner(.{ .peer = owned });
}

fn localMethodPolicy(service: []const u8, method: []const u8) ?transport.auth.authorize.MethodPolicy {
    if (std.mem.eql(u8, service, pushrouter.service)) return pushrouter.policy(method);
    if (std.mem.eql(u8, service, bus.service)) return bus.policy(method);
    if (std.mem.eql(u8, service, fujin_nrpc.service)) return fujin_nrpc.policy(method);
    return null;
}

fn handleBrowserLocalCall(
    router: *transport.Router,
    hub: *Hub,
    registry: *Registry,
    messages: *Journal,
    notifications: *Notifications,
    event_bus: Bus,
    jwt: *const @import("config.zig").JwtConfig,
    pending: *const Hub.PendingCommand,
) !void {
    const reply = try handleLocalCall(router, hub, registry, messages, notifications, event_bus, jwt, .{
        .service = pending.service,
        .method = pending.method,
        .auth = pending.auth,
        .scope = pending.scope,
        .user = pending.user,
        .payload = pending.payload,
        .session_bound = true,
        .client_id = pending.client_id,
    });
    defer hub.allocator.free(reply.body);
    if (reply.streamed) return hub.sendAdminStreamChunk(pending.client_id, pending.request_id, 0, reply.body, true);
    return hub.sendAdminResponse(pending.client_id, pending.request_id, reply.body);
}

fn handleLocalEnvelope(
    router: *transport.Router,
    hub: *Hub,
    registry: *Registry,
    messages: *Journal,
    notifications: *Notifications,
    event_bus: Bus,
    jwt: *const @import("config.zig").JwtConfig,
    identity: []const u8,
    env: transport.Envelope,
    payload: []const u8,
) void {
    const reply = handleLocalCall(router, hub, registry, messages, notifications, event_bus, jwt, .{
        .service = env.to.service,
        .method = env.method,
        .auth = env.auth,
        .scope = env.scope,
        .user = env.user,
        .payload = payload,
        .session_bound = false,
        .source_target = env.from.target,
    }) catch |err| {
        messages.recordEnvelope("zmq", "dropped", env, payload.len);
        logDecision("deny", env, payload.len, @errorName(err));
        replyUnroutable(router, identity, env, adminErrorCode(err));
        return;
    };
    defer hub.allocator.free(reply.body);

    const answer = transport.Envelope{
        // Streamed replies start at seq 1: the NRPC client counts from there
        // and fails a stream that opens on 0.
        .kind = if (reply.streamed) .stream_chunk else .response,
        .request_id = env.request_id,
        .to = env.from,
        .from = .{ .target = local_target, .service = env.to.service },
        .method = env.method,
        .scope = env.scope,
        .codec = .json,
        .seq = if (reply.streamed) 1 else 0,
        .fin = reply.streamed,
    };
    const bytes = transport.envelope.encodeAlloc(hub.allocator, &answer) catch |err| {
        logDecision("fail", env, reply.body.len, @errorName(err));
        return;
    };
    defer hub.allocator.free(bytes);
    router.send(identity, bytes, reply.body) catch |err| {
        messages.recordEnvelope("zmq", "failed", env, payload.len);
        logDecision("fail", env, reply.body.len, @errorName(err));
        return;
    };
    messages.recordEnvelope("zmq", "handled", env, payload.len);
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
        error.PermissionDenied, error.PushScopeForbidden, error.EventScopeForbidden => "forbidden",
        error.SubscriptionLimitReached => "overloaded",
        error.SubscriberUnaddressable => "invalid_request",
        error.UserTokenRequired, error.ServiceTokenRequired => "unauthenticated",
        error.MethodUnavailable => "method_unavailable",
        // A malformed notification is the caller's bug, not a refusal: saying
        // "unauthenticated" would send them off checking their token instead.
        error.EventNameMissing,
        error.EventScopeMissing,
        error.EventBodyMissing,
        error.PatternsMissing,
        error.PatternEmpty,
        error.PatternSegmentEmpty,
        error.PatternTailNotLast,
        error.TopicEmpty,
        error.TopicSegmentEmpty,
        error.TopicWildcard,
        error.TopicCharInvalid,
        error.PushNameMissing,
        error.PushScopeMissing,
        error.PushLevelInvalid,
        error.PushMessageMissing,
        error.InvalidHistoryLimit,
        error.InvalidMessageLimit,
        error.SyntaxError,
        error.UnexpectedEndOfInput,
        => "invalid_request",
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

test "the local target resolves both of Fujin's own services and nothing else" {
    try std.testing.expectEqual(
        transport.auth.authorize.Level.any,
        localMethodPolicy("pushrouter", "publish").?.level,
    );
    try std.testing.expectEqual(
        transport.auth.authorize.Level.user,
        localMethodPolicy("fujin", "state").?.level,
    );
    // A browser naming an arbitrary service on the fujin target must not reach
    // a handler by accident; it gets method_unavailable, not a route.
    try std.testing.expect(localMethodPolicy("services", "state") == null);
    try std.testing.expect(localMethodPolicy("pushrouter", "state") == null);
}

test "the bus is reachable on the local target and states its own owner rules" {
    try std.testing.expectEqual(
        transport.auth.authorize.Level.any,
        localMethodPolicy("bus", "publish").?.level,
    );
    try std.testing.expect(localMethodPolicy("bus", "nonsense") == null);

    // A browser subscribes as its session, a peer as its target, and a peer
    // that never registered one cannot subscribe at all.
    const session = try busOwner(.{ .service = "bus", .method = "subscribe", .auth = "", .scope = "club", .user = "alice", .payload = "[]", .session_bound = true, .client_id = 7 });
    try std.testing.expectEqual(@as(u64, 7), session.session);
    const peer = try busOwner(.{ .service = "bus", .method = "subscribe", .auth = "", .scope = "club", .user = "", .payload = "[]", .session_bound = false, .source_target = "centimanus" });
    try std.testing.expectEqualStrings("centimanus", peer.peer);
    try std.testing.expectError(
        error.SubscriberUnaddressable,
        busOwner(.{ .service = "bus", .method = "subscribe", .auth = "", .scope = "club", .user = "", .payload = "[]", .session_bound = false }),
    );
}

test "a malformed notification is reported as a bad request, not a refusal" {
    try std.testing.expectEqualStrings("invalid_request", adminErrorCode(error.PushNameMissing));
    try std.testing.expectEqualStrings("forbidden", adminErrorCode(error.PushScopeForbidden));
    try std.testing.expectEqualStrings("method_unavailable", adminErrorCode(error.MethodUnavailable));
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
