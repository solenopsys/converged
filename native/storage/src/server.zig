const std     = @import("std");
const cmds    = @import("commands.zig");
const mfst    = @import("manifest.zig");
const tel_mod = @import("telemetry.zig");

const StorageCommands = cmds.StorageCommands;
const StoreType       = mfst.StoreType;
const Telemetry       = tel_mod.Telemetry;
const Allocator       = std.mem.Allocator;

// C API from capnp_wrap.cpp (compiled directly into the exe via build.zig)
const c = @cImport(@cInclude("transport.h"));

// Framing: 4-byte LE length prefix (same as transport/src/codec.zig)
const max_msg: u32 = 64 * 1024 * 1024;

var shutdown_requested = std.atomic.Value(bool).init(false);

pub fn start(allocator: Allocator, data_dir: []const u8, socket_path: []const u8) !void {
    try std.fs.cwd().makePath(data_dir);
    try ensureSocketParent(socket_path);
    installSignalHandlers();
    shutdown_requested.store(false, .seq_cst);

    std.posix.unlink(socket_path) catch |err| switch (err) {
        error.FileNotFound => {},
        else => return err,
    };

    const server_fd = try std.posix.socket(
        std.posix.AF.UNIX,
        std.posix.SOCK.STREAM | std.posix.SOCK.NONBLOCK,
        0,
    );
    defer std.posix.close(server_fd);
    defer std.posix.unlink(socket_path) catch {};

    var addr: std.posix.sockaddr.un = std.mem.zeroes(std.posix.sockaddr.un);
    addr.family = std.posix.AF.UNIX;
    if (socket_path.len + 1 > addr.path.len) return error.SocketPathTooLong;
    @memcpy(addr.path[0..socket_path.len], socket_path);
    addr.path[socket_path.len] = 0;

    try std.posix.bind(server_fd, @ptrCast(&addr), @sizeOf(std.posix.sockaddr.un));
    try std.posix.listen(server_fd, 128);

    var commands = StorageCommands.init(allocator, data_dir);
    defer commands.deinit();
    try autoOpenStores(allocator, &commands, data_dir);

    std.debug.print("storage server listening on {s}\n", .{socket_path});

    var should_shutdown = false;
    while (!should_shutdown) {
        if (shutdown_requested.load(.seq_cst)) {
            std.debug.print("storage signal received, shutting down\n", .{});
            break;
        }

        const client_fd = std.posix.accept(server_fd, null, null, 0) catch |err| switch (err) {
            error.WouldBlock => {
                std.Thread.sleep(100 * std.time.ns_per_ms);
                continue;
            },
            else => return err,
        };
        defer std.posix.close(client_fd);

        should_shutdown = handleClient(allocator, &commands, client_fd) catch |err| blk: {
            std.debug.print("storage client error: {s}\n", .{@errorName(err)});
            break :blk false;
        };
    }
}

// ── Client handler ────────────────────────────────────────────────────────────

fn handleClient(allocator: Allocator, commands: *StorageCommands, fd: std.posix.fd_t) !bool {
    const req_bytes = recvMessage(fd, allocator) catch |err| {
        if (err == error.EndOfStream) return false;
        return err;
    };
    defer allocator.free(req_bytes);

    const reader = c.transport_req_reader_decode(req_bytes.ptr, req_bytes.len);
    if (reader == null) {
        sendErrorMsg(fd, "invalid capnp message");
        return false;
    }
    defer c.transport_req_reader_free(reader);

    var shutdown = false;
    const resp = dispatch(allocator, commands, reader, &shutdown) catch |err| blk: {
        std.debug.print("storage dispatch error: {s}\n", .{@errorName(err)});
        break :blk encodeError(@errorName(err));
    };
    defer if (resp.ptr) |p| c.transport_free_buf(p, resp.len);

    if (resp.ptr) |p| try sendMessage(fd, p[0..resp.len]);
    return shutdown;
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

const CBytes = struct { ptr: ?[*]u8, len: usize };

fn dispatch(
    allocator: Allocator,
    commands: *StorageCommands,
    reader: ?*c.TransportRequestReader,
    shutdown: *bool,
) !CBytes {
    const cmd       = c.transport_req_reader_cmd(reader);
    const ms        = std.mem.span(c.transport_req_reader_ms(reader));
    const store     = std.mem.span(c.transport_req_reader_store(reader));
    const store_key = try std.fmt.allocPrint(allocator, "{s}/{s}", .{ ms, store });
    defer allocator.free(store_key);

    var tel = Telemetry.begin();

    switch (cmd) {
        c.REQ_PING => {
            tel.op_count += 1;
            return encodeOk(tel);
        },
        c.REQ_SHUTDOWN => {
            tel.op_count += 1;
            shutdown.* = true;
            return encodeOk(tel);
        },
        c.REQ_OPEN => {
            const raw      = @as(u8, @intCast(@intFromEnum(c.transport_req_reader_store_type(reader))));
            const st: StoreType = @enumFromInt(raw);
            try commands.openStore(ms, store, st);
            tel.op_count += 1;
            return encodeOk(tel);
        },
        c.REQ_CLOSE => {
            commands.closeStore(store_key);
            tel.op_count += 1;
            return encodeOk(tel);
        },
        c.REQ_EXEC_SQL => {
            const sql_z = try allocator.dupeZ(u8, std.mem.span(c.transport_req_reader_sql(reader)));
            defer allocator.free(sql_z);
            try commands.execSql(store_key, sql_z);
            tel.op_count += 1;
            return encodeAffected(tel, 0);
        },
        c.REQ_QUERY_SQL => {
            const sql_z = try allocator.dupeZ(u8, std.mem.span(c.transport_req_reader_sql(reader)));
            defer allocator.free(sql_z);
            // queryJson returns JSON bytes — packed into capnp data field
            const json = try commands.querySql(store_key, sql_z, &tel);
            defer allocator.free(json);
            return encodeData(tel, json);
        },
        c.REQ_SIZE => {
            const size = try commands.getStoreSize(store_key);
            tel.op_count += 1;
            return encodeSize(tel, size);
        },
        c.REQ_MANIFEST => {
            const m = commands.getManifest(store_key) orelse return error.StoreNotFound;
            tel.op_count += 1;
            const mig_ptrs = try allocator.alloc([*:0]const u8, m.migrations.items.len);
            defer allocator.free(mig_ptrs);
            for (m.migrations.items, 0..) |mig, i| mig_ptrs[i] = mig.ptr;
            return encodeManifest(tel, m.name, @intFromEnum(m.store_type), m.version, mig_ptrs);
        },
        c.REQ_MIGRATE => {
            const mid = std.mem.span(c.transport_req_reader_migration_id(reader));
            try commands.recordMigration(store_key, mid);
            tel.op_count += 1;
            return encodeOk(tel);
        },
        c.REQ_ARCHIVE => {
            const out_path = std.mem.span(c.transport_req_reader_output_path(reader));
            try commands.createArchive(store_key, out_path);
            tel.op_count += 1;
            return encodeOk(tel);
        },
        c.REQ_KV_PUT => {
            const key   = std.mem.span(c.transport_req_reader_key(reader));
            const v_ptr = c.transport_req_reader_value_ptr(reader);
            const v_len = c.transport_req_reader_value_len(reader);
            const value = if (v_ptr) |p| p[0..v_len] else &[_]u8{};
            try commands.kvPut(store_key, key, value, &tel);
            return encodeOk(tel);
        },
        c.REQ_KV_GET => {
            const key  = std.mem.span(c.transport_req_reader_key(reader));
            const data = try commands.kvGet(store_key, key, &tel);
            if (data) |d| { defer allocator.free(d); return encodeFound(tel, 1, d); }
            return encodeFound(tel, 0, &[_]u8{});
        },
        c.REQ_KV_DELETE => {
            const key = std.mem.span(c.transport_req_reader_key(reader));
            try commands.kvDelete(store_key, key, &tel);
            return encodeFound(tel, 1, &[_]u8{});
        },
        c.REQ_FILE_PUT => {
            const key   = std.mem.span(c.transport_req_reader_key(reader));
            const d_ptr = c.transport_req_reader_value_ptr(reader);
            const d_len = c.transport_req_reader_value_len(reader);
            const data  = if (d_ptr) |p| p[0..d_len] else &[_]u8{};
            try commands.filePut(store_key, key, data, &tel);
            return encodeOk(tel);
        },
        c.REQ_FILE_GET => {
            const key  = std.mem.span(c.transport_req_reader_key(reader));
            const data = try commands.fileGet(store_key, key, &tel);
            if (data) |d| { defer allocator.free(d); return encodeFound(tel, 1, d); }
            return encodeFound(tel, 0, &[_]u8{});
        },
        c.REQ_FILE_DELETE => {
            const key = std.mem.span(c.transport_req_reader_key(reader));
            _ = try commands.fileDelete(store_key, key, &tel);
            return encodeFound(tel, 1, &[_]u8{});
        },
        c.REQ_KV_LIST, c.REQ_FILE_LIST => {
            tel.op_count += 1;
            return encodeKeys(tel, &[_][*:0]const u8{});
        },
        else => return error.UnknownCommand,
    }
}

// ── Encode helpers ────────────────────────────────────────────────────────────

fn telC(tel: Telemetry) c.TelemetryC {
    return .{ .dur_us = tel.durationUs(), .op_count = tel.op_count };
}

fn encodeOk(tel: Telemetry) CBytes {
    var p: ?[*]u8 = null; var l: usize = 0;
    _ = c.transport_encode_ok(&p, &l, telC(tel));
    return .{ .ptr = p, .len = l };
}
fn encodeError(msg: []const u8) CBytes {
    var p: ?[*]u8 = null; var l: usize = 0;
    _ = c.transport_encode_error(&p, &l, msg.ptr);
    return .{ .ptr = p, .len = l };
}
fn encodeAffected(tel: Telemetry, n: i64) CBytes {
    var p: ?[*]u8 = null; var l: usize = 0;
    _ = c.transport_encode_affected(&p, &l, telC(tel), n);
    return .{ .ptr = p, .len = l };
}
fn encodeSize(tel: Telemetry, size: u64) CBytes {
    var p: ?[*]u8 = null; var l: usize = 0;
    _ = c.transport_encode_size(&p, &l, telC(tel), size);
    return .{ .ptr = p, .len = l };
}
fn encodeFound(tel: Telemetry, found: i32, data: []const u8) CBytes {
    var p: ?[*]u8 = null; var l: usize = 0;
    _ = c.transport_encode_found(&p, &l, telC(tel), found, data.ptr, data.len);
    return .{ .ptr = p, .len = l };
}
fn encodeKeys(tel: Telemetry, keys: []const [*:0]const u8) CBytes {
    var p: ?[*]u8 = null; var l: usize = 0;
    _ = c.transport_encode_keys(&p, &l, telC(tel), @ptrCast(keys.ptr), @intCast(keys.len));
    return .{ .ptr = p, .len = l };
}
fn encodeData(tel: Telemetry, data: []const u8) CBytes {
    var p: ?[*]u8 = null; var l: usize = 0;
    _ = c.transport_encode_data(&p, &l, telC(tel), data.ptr, data.len);
    return .{ .ptr = p, .len = l };
}
fn encodeManifest(tel: Telemetry, name: []const u8, store_type: u8, version: u32, migs: [][*:0]const u8) CBytes {
    var p: ?[*]u8 = null; var l: usize = 0;
    _ = c.transport_encode_manifest(&p, &l, telC(tel),
        name.ptr, store_type, version,
        @ptrCast(migs.ptr), @intCast(migs.len));
    return .{ .ptr = p, .len = l };
}

fn sendErrorMsg(fd: std.posix.fd_t, msg: []const u8) void {
    const resp = encodeError(msg);
    defer if (resp.ptr) |p| c.transport_free_buf(p, resp.len);
    if (resp.ptr) |p| sendMessage(fd, p[0..resp.len]) catch {};
}

// ── Framing (mirrors transport/src/codec.zig) ─────────────────────────────────

fn sendMessage(fd: std.posix.fd_t, data: []const u8) !void {
    var len_buf: [4]u8 = undefined;
    std.mem.writeInt(u32, &len_buf, @intCast(data.len), .little);
    try writeAll(fd, &len_buf);
    try writeAll(fd, data);
}

fn recvMessage(fd: std.posix.fd_t, allocator: Allocator) ![]u8 {
    var len_buf: [4]u8 = undefined;
    try readAll(fd, &len_buf);
    const len = std.mem.readInt(u32, &len_buf, .little);
    if (len > max_msg) return error.MessageTooLarge;
    const buf = try allocator.alloc(u8, len);
    errdefer allocator.free(buf);
    try readAll(fd, buf);
    return buf;
}

fn writeAll(fd: std.posix.fd_t, data: []const u8) !void {
    var sent: usize = 0;
    while (sent < data.len) {
        const n = try std.posix.write(fd, data[sent..]);
        if (n == 0) return error.BrokenPipe;
        sent += n;
    }
}

fn readAll(fd: std.posix.fd_t, buf: []u8) !void {
    var got: usize = 0;
    while (got < buf.len) {
        const n = try std.posix.read(fd, buf[got..]);
        if (n == 0) return error.EndOfStream;
        got += n;
    }
}

// ── Signal / socket helpers ───────────────────────────────────────────────────

fn installSignalHandlers() void {
    const act: std.posix.Sigaction = .{
        .handler = .{ .handler = onSignal },
        .mask = std.posix.sigemptyset(),
        .flags = 0,
    };
    std.posix.sigaction(std.posix.SIG.TERM, &act, null);
    std.posix.sigaction(std.posix.SIG.INT,  &act, null);
}

fn onSignal(_: i32) callconv(.c) void {
    shutdown_requested.store(true, .seq_cst);
}

fn ensureSocketParent(socket_path: []const u8) !void {
    if (std.fs.path.dirname(socket_path)) |parent| {
        if (parent.len > 0) try std.fs.cwd().makePath(parent);
    }
}

fn autoOpenStores(allocator: Allocator, commands: *StorageCommands, data_dir: []const u8) !void {
    var root = std.fs.cwd().openDir(data_dir, .{ .iterate = true }) catch |err| switch (err) {
        error.FileNotFound => return,
        else => return err,
    };
    defer root.close();

    var opened: usize = 0;
    var ms_iter = root.iterate();
    while (try ms_iter.next()) |ms_entry| {
        if (ms_entry.kind != .directory) continue;
        var ms_dir = root.openDir(ms_entry.name, .{ .iterate = true }) catch continue;
        defer ms_dir.close();

        var store_iter = ms_dir.iterate();
        while (try store_iter.next()) |store_entry| {
            if (store_entry.kind != .directory) continue;

            const manifest_path = try std.fmt.allocPrint(
                allocator, "{s}/{s}/{s}/manifest.json",
                .{ data_dir, ms_entry.name, store_entry.name },
            );
            defer allocator.free(manifest_path);

            var manifest = mfst.Manifest.load(allocator, manifest_path) catch |err| switch (err) {
                error.FileNotFound => continue,
                else => {
                    std.debug.print("storage autoload skip {s}/{s}: {s}\n",
                        .{ ms_entry.name, store_entry.name, @errorName(err) });
                    continue;
                },
            };
            const store_type = manifest.store_type;
            manifest.deinit();

            commands.openStore(ms_entry.name, store_entry.name, store_type) catch |err| {
                std.debug.print("storage autoload failed {s}/{s}: {s}\n",
                    .{ ms_entry.name, store_entry.name, @errorName(err) });
                continue;
            };
            opened += 1;
        }
    }
    std.debug.print("storage autoload complete, opened={d}\n", .{opened});
}
