const std = @import("std");
const fujin_client = @import("fujin-client");

pub const std_options: std.Options = .{
    .logFn = logWithTimestamp,
    // Force info-level (and above) regardless of optimize mode, so transcript
    // and audio-stats lines are always visible in the container logs.
    .log_level = .info,
};

fn logWithTimestamp(
    comptime level: std.log.Level,
    comptime scope: @TypeOf(.enum_literal),
    comptime fmt: []const u8,
    args: anytype,
) void {
    _ = scope;
    var ts: std.c.timespec = undefined;
    _ = std.c.clock_gettime(.REALTIME, &ts);
    const secs = @rem(ts.sec, 86400);
    const h = @divTrunc(secs, 3600);
    const m = @divTrunc(@rem(secs, 3600), 60);
    const s = @rem(secs, 60);
    const ms = @divTrunc(ts.nsec, 1_000_000);
    std.debug.print("{d:0>2}:{d:0>2}:{d:0>2}.{d:0>3} {s}: ", .{ h, m, s, ms, @tagName(level) });
    std.debug.print(fmt ++ "\n", args);
}

const config_mod = @import("config.zig");
const gateway_mod = @import("gate/gateway.zig");
const session_mod = @import("gate/session.zig");
const adapter_mod = @import("signaling/adapter.zig");
const signaling_types = @import("signaling/types.zig");
const http_server_mod = @import("server/http_server.zig");

pub fn main(init: std.process.Init) !void {
    const allocator = init.gpa;

    var cfg = try config_mod.Config.init(allocator, init.environ_map);
    defer cfg.deinit();

    var gateway = try gateway_mod.Gateway.init(allocator, &cfg);
    defer gateway.deinit();

    var args_iter = try std.process.Args.Iterator.initAllocator(init.minimal.args, allocator);
    defer args_iter.deinit();

    var args_list = std.array_list.Managed([]const u8).init(allocator);
    defer args_list.deinit();
    while (args_iter.next()) |arg| {
        try args_list.append(arg);
    }
    const args: []const []const u8 = args_list.items;

    if (args.len <= 1 or std.mem.eql(u8, args[1], "serve")) {
        var fujin_config = try fujin_client.Config.init(allocator, init.environ_map, "RESONUS", "resonus");
        const fujin = try allocator.create(fujin_client.Client);
        fujin.* = fujin_client.Client.init(&fujin_config) catch |err| {
            allocator.destroy(fujin);
            fujin_config.deinit();
            return err;
        };
        fujin_config.deinit();
        fujin.sendReady("resonus") catch |err| {
            fujin.deinit();
            allocator.destroy(fujin);
            return err;
        };
        const fujin_thread = std.Thread.spawn(.{}, fujinLoop, .{fujin}) catch |err| {
            fujin.deinit();
            allocator.destroy(fujin);
            return err;
        };
        fujin_thread.detach();

        try gateway.startReaper();
        gateway.startSip() catch |err| {
            std.log.warn("SIP server not started: {s}", .{@errorName(err)});
        };
        var http_server = http_server_mod.HttpServer.init(allocator, &cfg, &gateway);
        return http_server.serve();
    }

    const cmd = args[1];

    if (std.mem.eql(u8, cmd, "probe-libs")) {
        return printProbe(&gateway);
    }

    if (std.mem.eql(u8, cmd, "native-smoke")) {
        return runNativeSmoke(&gateway);
    }

    if (std.mem.eql(u8, cmd, "policy-check")) {
        return runPolicyCheck(allocator, &gateway, args[2..]);
    }

    if (std.mem.eql(u8, cmd, "context-set")) {
        return runContextSet(init.io, allocator, &gateway, args[2..]);
    }

    if (std.mem.eql(u8, cmd, "context-get")) {
        return runContextGet(&gateway, args[2..]);
    }

    if (std.mem.eql(u8, cmd, "signal-openai")) {
        return runSignal(init.io, allocator, &gateway, .openai, args[2..]);
    }

    if (std.mem.eql(u8, cmd, "signal-gemini")) {
        return runSignal(init.io, allocator, &gateway, .gemini, args[2..]);
    }

    printUsage();
    return error.UnknownCommand;
}

fn fujinLoop(client: *fujin_client.Client) void {
    client.listen("resonus");
}

fn runNativeSmoke(gateway: *gateway_mod.Gateway) !void {
    var smoke = try gateway.nativeSmoke();
    defer smoke.deinit(gateway.allocator);

    std.debug.print("baresip_version={s}\n", .{smoke.baresip_version});
    std.debug.print("datachannel_peer_connection_id={d}\n", .{smoke.datachannel_offer.peer_connection_id});
    std.debug.print("datachannel_data_channel_id={d}\n", .{smoke.datachannel_offer.data_channel_id});
    std.debug.print("datachannel_track_id={d}\n", .{smoke.datachannel_offer.track_id});
    std.debug.print("datachannel_offer_type={s}\n", .{smoke.datachannel_offer.offer_type});
    std.debug.print("datachannel_offer_bytes={d}\n", .{smoke.datachannel_offer.offer_sdp.len});
}

fn runPolicyCheck(allocator: std.mem.Allocator, gateway: *gateway_mod.Gateway, args: []const []const u8) !void {
    if (args.len < 2) {
        printUsage();
        return error.InvalidArguments;
    }
    const policy = gateway.policy orelse return error.PolicyUnavailable;
    var plan = try policy.planIncoming(.{
        .call_id = "policy-check",
        .caller = args[0],
        .dialed = args[1],
        .route_context_id = if (args.len > 2 and args[2].len > 0) args[2] else null,
        .route_transfer_uri = if (args.len > 3 and args[3].len > 0) args[3] else null,
    });
    defer plan.deinit(allocator);

    std.debug.print("action={s}\n", .{@tagName(plan.action)});
    if (plan.context_id) |v| std.debug.print("context_id={s}\n", .{v});
    if (plan.transfer_uri) |v| std.debug.print("transfer_uri={s}\n", .{v});
    if (plan.provider) |v| std.debug.print("provider={s}\n", .{v});
    if (plan.model) |v| std.debug.print("model={s}\n", .{v});
    if (plan.voice) |v| std.debug.print("voice={s}\n", .{v});
    if (plan.transcription_model) |v| std.debug.print("transcription_model={s}\n", .{v});
    if (plan.human_transfer_uri) |v| std.debug.print("human_transfer_uri={s}\n", .{v});
    if (plan.vad_threshold) |v| std.debug.print("vad_threshold={d:.2}\n", .{v});
    if (plan.vad_silence_ms) |v| std.debug.print("vad_silence_ms={d}\n", .{v});
    if (plan.vad_interrupt) |v| std.debug.print("interrupt_response={}\n", .{v});
}

fn runContextSet(io: std.Io, allocator: std.mem.Allocator, gateway: *gateway_mod.Gateway, args: []const []const u8) !void {
    // <key> <instructions|@file> <language>
    if (args.len < 3) {
        printUsage();
        return error.InvalidArguments;
    }

    const key = args[0];
    const value = try readArgOrFile(io, allocator, args[1]);
    defer allocator.free(value);
    const language = args[2];

    try gateway.setContext("", key, language, value);
    std.debug.print("ok\n", .{});
}

fn runContextGet(gateway: *gateway_mod.Gateway, args: []const []const u8) !void {
    if (args.len < 1) {
        printUsage();
        return error.InvalidArguments;
    }

    const key = args[0];
    const value = try gateway.getContext("", key, null);
    if (value) |found| {
        var context = found;
        defer context.deinit(gateway.allocator);
        std.debug.print("language={s}\n{s}\n", .{ context.language, context.instructions });
        return;
    }

    std.debug.print("not found\n", .{});
}

fn runSignal(
    io: std.Io,
    allocator: std.mem.Allocator,
    gateway: *gateway_mod.Gateway,
    provider: adapter_mod.Provider,
    args: []const []const u8,
) !void {
    var input = session_mod.SessionInput{};
    var owned_offer: ?[]u8 = null;
    defer if (owned_offer) |value| allocator.free(value);

    for (args) |arg| {
        if (std.mem.startsWith(u8, arg, "--phone=")) {
            input.phone = arg["--phone=".len..];
            continue;
        }
        if (std.mem.startsWith(u8, arg, "--context-name=")) {
            input.context_name = arg["--context-name=".len..];
            continue;
        }
        if (std.mem.startsWith(u8, arg, "--scope=")) {
            input.domain = arg["--scope=".len..];
            continue;
        }
        if (std.mem.startsWith(u8, arg, "--model=")) {
            input.model = arg["--model=".len..];
            continue;
        }
        if (std.mem.startsWith(u8, arg, "--voice=")) {
            input.voice = arg["--voice=".len..];
            continue;
        }
        if (std.mem.startsWith(u8, arg, "--instructions=")) {
            input.instructions = arg["--instructions=".len..];
            continue;
        }

        if (input.offer_sdp == null) {
            owned_offer = try readArgOrFile(io, allocator, arg);
            input.offer_sdp = owned_offer.?.ptr[0..owned_offer.?.len];
            continue;
        }

        return error.InvalidArguments;
    }

    if (provider == .openai and input.offer_sdp == null) {
        printUsage();
        return error.InvalidArguments;
    }

    var outcome = try gateway.negotiate(provider, input);
    defer signaling_types.deinitResult(allocator, &outcome.result);

    switch (outcome.result) {
        .sdp_answer => |answer| {
            std.debug.print("{s}\n", .{answer});
        },
        .session_descriptor => |descriptor| {
            std.debug.print("{s}\n", .{descriptor});
        },
    }
}

fn printProbe(gateway: *gateway_mod.Gateway) !void {
    const report = gateway.health();

    std.debug.print("baresip_loaded={s}\n", .{boolLiteral(report.baresip_loaded)});
    std.debug.print("baresip_wrapper_loaded={s}\n", .{boolLiteral(report.baresip_wrapper_loaded)});
    std.debug.print("libdatachannel_loaded={s}\n", .{boolLiteral(report.libdatachannel_loaded)});
    std.debug.print("libdatachannel_wrapper_loaded={s}\n", .{boolLiteral(report.libdatachannel_wrapper_loaded)});
    std.debug.print("mbedtls_loaded={s}\n", .{boolLiteral(report.mbedtls_loaded)});
    if (report.mbedtls_version) |v| {
        std.debug.print("mbedtls_version={s}\n", .{v});
    }
    if (report.baresip_error) |v| {
        std.debug.print("baresip_error={s}\n", .{v});
    }
    if (report.baresip_wrapper_error) |v| {
        std.debug.print("baresip_wrapper_error={s}\n", .{v});
    }
    if (report.libdatachannel_error) |v| {
        std.debug.print("libdatachannel_error={s}\n", .{v});
    }
    if (report.libdatachannel_wrapper_error) |v| {
        std.debug.print("libdatachannel_wrapper_error={s}\n", .{v});
    }
    if (report.mbedtls_error) |v| {
        std.debug.print("mbedtls_error={s}\n", .{v});
    }
    std.debug.print("valkey_loaded={s}\n", .{boolLiteral(report.valkey_loaded)});
    if (report.valkey_error) |v| {
        std.debug.print("valkey_error={s}\n", .{v});
    }
}

fn readArgOrFile(io: std.Io, allocator: std.mem.Allocator, arg: []const u8) ![]u8 {
    if (arg.len > 1 and arg[0] == '@') {
        return try std.Io.Dir.cwd().readFileAlloc(io, arg[1..], allocator, .limited(16 * 1024 * 1024));
    }
    return try allocator.dupe(u8, arg);
}

fn boolLiteral(value: bool) []const u8 {
    return if (value) "true" else "false";
}

fn printUsage() void {
    std.debug.print(
        "usage:\n" ++
            "  resonus [serve]\n" ++
            "  resonus probe-libs\n" ++
            "  resonus native-smoke\n" ++
            "  resonus policy-check <caller> <dialed> [context-id] [transfer-uri]\n" ++
            "  resonus context-set <key> <value|@file>\n" ++
            "  resonus context-get <key>\n" ++
            "  resonus signal-openai <offer|@file> [--phone=..] [--context-name=..] [--model=..] [--voice=..] [--instructions=..]\n" ++
            "  resonus signal-gemini [offer|@file] [--phone=..] [--context-name=..] [--model=..] [--voice=..] [--instructions=..]\n",
        .{},
    );
}

// Aggregate unit tests of transitively-used modules: `zig build test` only
// discovers tests referenced from the root file.
test {
    _ = @import("signaling/openai.zig");
    _ = @import("store/store.zig");
    _ = @import("sip/sip_msg.zig");
    _ = @import("sip/sip_client.zig");
    _ = @import("sip/rtp.zig");
    _ = @import("policy/types.zig");
    _ = @import("policy/realtime_event.zig");
}
