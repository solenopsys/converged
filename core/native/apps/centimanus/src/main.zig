//! centimanus — the workflow virtual-machine service.
//!
//! Workflows execute only through the shared Fujin transport route
//! `centimanus`. There is intentionally no HTTP listener or HTTP fallback.

const std = @import("std");
const transport = @import("transport");
const env = @import("env.zig");
const Engine = @import("engine.zig").Engine;
const StateStore = @import("state.zig").StateStore;
const triggers = @import("triggers.zig");
const dag_log = @import("dag_log.zig");
const signal_provider = @import("signal_provider.zig");
const centimanus_nrpc = @import("generated/centimanus_nrpc.zig");

/// A container runs this binary as PID 1, and the kernel gives PID 1 no default
/// signal disposition: with no handler installed SIGTERM is discarded outright,
/// so `docker stop` and a pod eviction both sit out the whole grace period and
/// end in SIGKILL. The loops below park in accept() and clock_nanosleep(), and
/// both restart themselves after EINTR, so there is no cooperative unwind to
/// hand a flag to — the handler leaves through exit_group, which is the only
/// exit safe to call from signal context (std.c.exit would run atexit handlers
/// and can deadlock on the stdio lock the interrupted thread is holding).
fn onSignal(_: std.posix.SIG) callconv(.c) void {
    const notice = "centimanus: signal received, shutting down\n";
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
    const io = init.io;
    const gpa = init.gpa;
    var auth_receiver = try transport.auth.receiver.Receiver.init(gpa, init.environ_map);
    defer auth_receiver.deinit();

    var store = try StateStore.init(gpa);
    defer store.deinit();

    const endpoint_value = init.environ_map.get("CENTIMANUS_FUJIN_ZMQ_ENDPOINT") orelse
        init.environ_map.get("FUJIN_ZMQ_ENDPOINT") orelse "tcp://127.0.0.1:5557";
    const endpoint = try gpa.dupeZ(u8, endpoint_value);
    const target = init.environ_map.get("FUJIN_TARGET") orelse "centimanus";
    const service_token = init.environ_map.get("SERVICE_TOKEN") orelse {
        std.debug.print("centimanus: missing required env SERVICE_TOKEN\n", .{});
        return error.EnvironmentVariableNotFound;
    };

    const runtime = try gpa.create(transport.Runtime);
    runtime.* = transport.Runtime.init(gpa, .{
        .endpoint = endpoint,
        .target = target,
        .limits = .{ .max_envelope_bytes = 64 * 1024, .max_payload_bytes = 16 * 1024 * 1024 },
        .recv_timeout_ms = 1_000,
        .send_timeout_ms = 1_000,
        // One handler thread: workflow/chat handlers make nested NRPC calls
        // (dag/scripts), so they must run off the reactor thread. A single
        // worker keeps handler state single-threaded (histories, current_scope
        // via run_mutex) while the reactor stays free to service I/O.
        .workers = 1,
    }) catch |err| {
        gpa.destroy(runtime);
        gpa.free(endpoint);
        return err;
    };
    var engine = try Engine.init(gpa, io, &store, runtime, service_token);

    // The log writer. Attached before the transport thread starts, so the very
    // first run already has somewhere to put its entries. It writes to the same
    // Valkey the state store uses; without one configured it stays inert and
    // the runtime simply keeps no log.
    const log_port: u16 = if (env.opt("VALKEY_PORT")) |raw|
        std.fmt.parseInt(u16, raw, 10) catch 0
    else
        0;
    var log_writer = dag_log.Logger.init(gpa, &engine, env.opt("VALKEY_HOST") orelse "", log_port);
    defer log_writer.deinit();
    engine.log = &log_writer;
    // Built before the transport thread so the request handler can already see
    // it: an event that arrives during startup must find the trigger list, not
    // a null pointer.
    var registry = triggers.Registry.init(gpa, &engine, init.environ_map.get("RT_SCOPE") orelse "");
    defer registry.deinit();
    const fujin_thread = std.Thread.spawn(.{}, fujinLoop, .{ runtime, endpoint, gpa, &engine, &auth_receiver, &registry }) catch |err| {
        runtime.deinit();
        gpa.destroy(runtime);
        gpa.free(endpoint);
        return err;
    };
    fujin_thread.detach();
    // Let the reactor arm before other threads start sending, so their frames
    // funnel to it instead of racing the DEALER socket during startup.
    while (!runtime.isRunning()) io.sleep(std.Io.Duration.fromMilliseconds(1), .awake) catch {};
    std.debug.print("[fujin] service registered target={s} endpoint={s}\n", .{ target, endpoint });

    // Timing belongs to Fujin now: it reads the schedule and emits `cron.*`
    // events, and a scheduled workflow is an ordinary trigger on one of them.
    // This runtime no longer owns a clock of its own.
    // Started after the reactor: its first act is to commit whatever a previous
    // process left uncommitted, and that is an ordinary NRPC call.
    const log_thread = std.Thread.spawn(.{}, dag_log.Logger.run, .{&log_writer}) catch |err| {
        std.debug.print("centimanus: dag log writer not started: {s}\n", .{@errorName(err)});
        return err;
    };
    log_thread.detach();

    const triggers_on = if (env.opt("RT_TRIGGERS")) |value| std.mem.eql(u8, value, "on") else true;
    const trigger_thread = if (triggers_on)
        try std.Thread.spawn(.{}, triggers.Registry.run, .{&registry})
    else
        null;
    defer if (trigger_thread) |thread| thread.join();

    std.debug.print("centimanus: RT VM ready (transport=Fujin, backend={s}, triggers={})\n", .{ @tagName(store.backend), triggers_on });
    while (true) {
        io.sleep(std.Io.Duration.fromMilliseconds(1_000), .awake) catch {};
    }
}

fn fujinLoop(runtime: *transport.Runtime, endpoint: [:0]u8, allocator: std.mem.Allocator, engine: *Engine, auth_receiver: *transport.auth.receiver.Receiver, registry: *triggers.Registry) void {
    defer allocator.free(endpoint);
    defer allocator.destroy(runtime);
    defer runtime.deinit();
    var provider = signal_provider.Provider.init(allocator, engine, auth_receiver);
    provider.triggers = registry;
    defer provider.deinit();
    centimanus_nrpc.bind(runtime, provider.transportHandler()) catch |err| {
        std.log.err("centimanus transport handler registration failed: {s}", .{@errorName(err)});
        return;
    };
    runtime.run();
}
