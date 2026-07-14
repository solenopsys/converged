//! centimanus — the RT virtual machine service.
//!
//! A thin Zig VM that runs *flow-only* workflow scripts (QuickJS) and launches
//! them on time. Business logic lives in microservices; branching lives in TS
//! scripts; durable state lives in Valkey. Zig only executes — fast, reliably.
//!
//!   GET  /healthz                 -> "ok"
//!   POST /run                     body {"script","params"} -> execution result
//!
//! Config (env only; missing required values fail at startup, no defaults):
//!   RT_BIND          host:port to listen on (or argv[1])
//!   SERVICES_BASE    microservice gateway (nrpc: <base>/<service>/<method>)
//!   RT_STATE_BACKEND memory | valkey   (+ VALKEY_HOST/VALKEY_PORT for valkey)
//!   RT_SCHEDULER     "on" to run the periodic scheduler loop (periods come
//!                    formalized from the scheduler microservice)
//!   RT_SERVICE_TOKEN / RT_SCOPE   optional nrpc headers

const std = @import("std");
const net = std.Io.net;
const fujin_client = @import("fujin-client");
const env = @import("env.zig");
const Engine = @import("engine.zig").Engine;
const StateStore = @import("state.zig").StateStore;
const Scheduler = @import("cron.zig").Scheduler;
const signal_provider = @import("signal_provider.zig");

const Request = struct {
    method: []const u8,
    path: []const u8,
    body: []const u8,
};

fn parseRequest(alloc: std.mem.Allocator, r: *std.Io.Reader) !Request {
    const request_line = try r.takeDelimiterInclusive('\n');
    var rl = std.mem.tokenizeScalar(u8, std.mem.trimEnd(u8, request_line, "\r\n"), ' ');
    const method = try alloc.dupe(u8, rl.next() orelse return error.BadRequest);
    const path = try alloc.dupe(u8, rl.next() orelse return error.BadRequest);

    var content_length: usize = 0;
    while (true) {
        const line = try r.takeDelimiterInclusive('\n');
        const trimmed = std.mem.trimEnd(u8, line, "\r\n");
        if (trimmed.len == 0) break;
        if (std.ascii.startsWithIgnoreCase(trimmed, "content-length:")) {
            const v = std.mem.trim(u8, trimmed["content-length:".len..], " ");
            content_length = std.fmt.parseInt(usize, v, 10) catch 0;
        }
    }

    const body = if (content_length > 0)
        try alloc.dupe(u8, try r.take(content_length))
    else
        try alloc.dupe(u8, "");

    return .{ .method = method, .path = path, .body = body };
}

fn writeResponse(io: std.Io, stream: net.Stream, status: []const u8, content_type: []const u8, body: []const u8) !void {
    var wbuf: [4096]u8 = undefined;
    var sw = stream.writer(io, &wbuf);
    try sw.interface.print(
        "HTTP/1.1 {s}\r\nContent-Type: {s}\r\nContent-Length: {d}\r\nConnection: close\r\n\r\n{s}",
        .{ status, content_type, body.len, body },
    );
    try sw.interface.flush();
}

fn strField(o: std.json.ObjectMap, key: []const u8) ?[]const u8 {
    const v = o.get(key) orelse return null;
    return switch (v) {
        .string => |s| s,
        else => null,
    };
}

fn handleRun(io: std.Io, alloc: std.mem.Allocator, engine: *Engine, stream: net.Stream, body: []const u8) !void {
    const parsed = std.json.parseFromSliceLeaky(std.json.Value, alloc, body, .{}) catch
        return writeResponse(io, stream, "400 Bad Request", "application/json", "{\"error\":\"bad json\"}");
    const obj = switch (parsed) {
        .object => |o| o,
        else => return writeResponse(io, stream, "400 Bad Request", "application/json", "{\"error\":\"expected object\"}"),
    };
    const script = strField(obj, "script") orelse
        return writeResponse(io, stream, "400 Bad Request", "application/json", "{\"error\":\"missing script\"}");
    const params_json = if (obj.get("params")) |p|
        try std.json.Stringify.valueAlloc(alloc, p, .{})
    else
        "{}";

    const result = engine.runWorkflow(alloc, script, params_json) catch |e| {
        const msg = std.fmt.allocPrint(alloc, "{{\"error\":\"{s}\"}}", .{@errorName(e)}) catch "{\"error\":\"run failed\"}";
        const status = if (e == error.WorkflowNotFound) "404 Not Found" else "500 Internal Server Error";
        return writeResponse(io, stream, status, "application/json", msg);
    };

    const id_json = try std.json.Stringify.valueAlloc(alloc, std.json.Value{ .string = result.exec_id }, .{});
    const out = if (result.ok)
        try std.fmt.allocPrint(alloc, "{{\"executionId\":{s},\"ok\":true,\"result\":{s}}}", .{ id_json, result.output })
    else blk: {
        const err_json = try std.json.Stringify.valueAlloc(alloc, std.json.Value{ .string = result.output }, .{});
        break :blk try std.fmt.allocPrint(alloc, "{{\"executionId\":{s},\"ok\":false,\"error\":{s}}}", .{ id_json, err_json });
    };
    const status = if (result.ok) "200 OK" else "500 Internal Server Error";
    return writeResponse(io, stream, status, "application/json", out);
}

fn handleConn(io: std.Io, alloc: std.mem.Allocator, engine: *Engine, stream: net.Stream) !void {
    var rbuf: [1 << 16]u8 = undefined;
    var sr = stream.reader(io, &rbuf);
    const req = parseRequest(alloc, &sr.interface) catch
        return writeResponse(io, stream, "400 Bad Request", "text/plain", "bad request");

    if (std.mem.eql(u8, req.method, "GET") and std.mem.eql(u8, req.path, "/healthz"))
        return writeResponse(io, stream, "200 OK", "text/plain", "ok");

    if (std.mem.eql(u8, req.method, "POST") and std.mem.eql(u8, req.path, "/run"))
        return handleRun(io, alloc, engine, stream, req.body);

    return writeResponse(io, stream, "404 Not Found", "text/plain", "not found");
}

fn parseBind(bind: []const u8) !struct { host: []const u8, port: u16 } {
    const colon = std.mem.lastIndexOfScalar(u8, bind, ':') orelse return error.MissingPort;
    const port = try std.fmt.parseInt(u16, bind[colon + 1 ..], 10);
    return .{ .host = bind[0..colon], .port = port };
}

pub fn main(init: std.process.Init) !void {
    const io = init.io;
    const gpa = init.gpa;

    const args = try std.process.Args.toSlice(init.minimal.args, init.arena.allocator());
    const bind = if (args.len > 1) args[1] else try env.require("RT_BIND");

    var store = try StateStore.init(gpa);
    defer store.deinit();
    var engine = try Engine.init(gpa, io, &store);

    var fujin_config = try fujin_client.Config.init(gpa, init.environ_map, "CENTIMANUS", "centimanus");
    const fujin = try gpa.create(fujin_client.Client);
    fujin.* = fujin_client.Client.init(&fujin_config) catch |err| {
        gpa.destroy(fujin);
        fujin_config.deinit();
        return err;
    };
    fujin_config.deinit();
    fujin.sendReady("centimanus") catch |err| {
        fujin.deinit();
        gpa.destroy(fujin);
        return err;
    };
    const fujin_thread = std.Thread.spawn(.{}, fujinLoop, .{ fujin, gpa, &engine }) catch |err| {
        fujin.deinit();
        gpa.destroy(fujin);
        return err;
    };
    fujin_thread.detach();

    var scheduler = Scheduler.init(gpa, &engine);
    const scheduler_on = if (env.opt("RT_SCHEDULER")) |v| std.mem.eql(u8, v, "on") else false;
    const sched_thread = if (scheduler_on)
        try std.Thread.spawn(.{}, Scheduler.run, .{&scheduler})
    else
        null;
    defer if (sched_thread) |t| t.join();

    const parsed = try parseBind(bind);
    const addr = try net.IpAddress.parse(parsed.host, parsed.port);
    var server = try addr.listen(io, .{ .reuse_address = true });
    defer server.deinit(io);

    std.debug.print("centimanus: RT VM listening on {s} (backend={s}, scheduler={})\n", .{ bind, @tagName(store.backend), scheduler_on });

    var req_arena = std.heap.ArenaAllocator.init(gpa);
    defer req_arena.deinit();

    while (true) {
        const stream = server.accept(io) catch |err| {
            std.debug.print("centimanus: accept failed: {s}\n", .{@errorName(err)});
            continue;
        };
        defer stream.close(io);

        _ = req_arena.reset(.retain_capacity);
        handleConn(io, req_arena.allocator(), &engine, stream) catch |err| {
            std.debug.print("centimanus: request failed: {s}\n", .{@errorName(err)});
        };
    }
}

fn fujinLoop(client: *fujin_client.Client, allocator: std.mem.Allocator, engine: *Engine) void {
    var provider = signal_provider.Provider{ .engine = engine };
    client.serve(allocator, "centimanus", provider.fujin());
}
