const std = @import("std");
const cmds = @import("commands.zig");
const mfst = @import("manifest.zig");
const tel_mod = @import("telemetry.zig");
const threads_mod = @import("threads.zig");

const StorageCommands = cmds.StorageCommands;
const StoreType = mfst.StoreType;
const Telemetry = tel_mod.Telemetry;
const ThreadPool = threads_mod.ThreadPool;
const WorkItem = threads_mod.WorkItem;
const KvEngine = @import("engines/kv.zig").KvEngine;
const Allocator = std.mem.Allocator;

// C API from capnp_wrap.cpp (compiled directly into the exe via build.zig)
const c = @cImport(@cInclude("transport.h"));

// Framing: 4-byte LE length prefix (same as transport/src/codec.zig)
const max_msg: u32 = 64 * 1024 * 1024;

var shutdown_requested = std.atomic.Value(bool).init(false);
var active_clients = std.atomic.Value(usize).init(0);
var stores_rwlock: std.Thread.RwLock = .{};
var pool: ThreadPool = undefined;

const ClientContext = struct {
    allocator: Allocator,
    commands: *StorageCommands,
    fd: std.posix.fd_t,
};

/// Transport binding configuration — choose Unix domain socket or TCP.
pub const BindConfig = union(enum) {
    unix: []const u8,
    tcp: struct { host: []const u8, port: u16 },
};

fn createUnixServer(socket_path: []const u8) !std.posix.fd_t {
    try ensureSocketParent(socket_path);
    std.posix.unlink(socket_path) catch |err| switch (err) {
        error.FileNotFound => {},
        else => return err,
    };
    const fd = try std.posix.socket(
        std.posix.AF.UNIX,
        std.posix.SOCK.STREAM | std.posix.SOCK.NONBLOCK,
        0,
    );
    errdefer std.posix.close(fd);
    var addr: std.posix.sockaddr.un = std.mem.zeroes(std.posix.sockaddr.un);
    addr.family = std.posix.AF.UNIX;
    if (socket_path.len + 1 > addr.path.len) return error.SocketPathTooLong;
    @memcpy(addr.path[0..socket_path.len], socket_path);
    addr.path[socket_path.len] = 0;
    try std.posix.bind(fd, @ptrCast(&addr), @sizeOf(std.posix.sockaddr.un));
    try std.posix.listen(fd, 128);
    return fd;
}

fn createTcpServer(host: []const u8, port: u16) !std.posix.fd_t {
    const fd = try std.posix.socket(
        std.posix.AF.INET,
        std.posix.SOCK.STREAM | std.posix.SOCK.NONBLOCK,
        std.posix.IPPROTO.TCP,
    );
    errdefer std.posix.close(fd);
    const one: c_int = 1;
    try std.posix.setsockopt(fd, std.posix.SOL.SOCKET, std.posix.SO.REUSEADDR, std.mem.asBytes(&one));
    const ip4 = try std.net.Address.parseIp4(host, port);
    try std.posix.bind(fd, &ip4.any, ip4.getOsSockLen());
    try std.posix.listen(fd, 128);
    return fd;
}

pub fn start(allocator: Allocator, data_dir: []const u8, cfg: BindConfig) !void {
    try std.fs.cwd().makePath(data_dir);
    installSignalHandlers();
    shutdown_requested.store(false, .seq_cst);

    const server_fd: std.posix.fd_t = switch (cfg) {
        .unix => |path| try createUnixServer(path),
        .tcp  => |t|    try createTcpServer(t.host, t.port),
    };
    defer std.posix.close(server_fd);
    // Remove unix socket file on exit; nothing to clean up for TCP.
    const unix_path: ?[]const u8 = switch (cfg) {
        .unix => |p| p,
        .tcp  => null,
    };
    defer if (unix_path) |p| std.posix.unlink(p) catch {};

    var commands = StorageCommands.init(allocator, data_dir);
    defer commands.deinit();
    try autoOpenStores(allocator, &commands, data_dir);

    pool = ThreadPool.init(allocator);
    try pool.start();
    defer {
        pool.stop();
        pool.deinit();
    }

    switch (cfg) {
        .unix => |path| std.debug.print("storage server listening on unix:{s}\n", .{path}),
        .tcp  => |t|    std.debug.print("storage server listening on tcp:{s}:{d}\n", .{ t.host, t.port }),
    }

    active_clients.store(0, .seq_cst);

    while (true) {
        if (shutdown_requested.load(.seq_cst)) {
            std.debug.print("storage signal received, shutting down\n", .{});
            break;
        }

        const client_fd = std.posix.accept(server_fd, null, null, 0) catch |err| switch (err) {
            error.WouldBlock => {
                std.Thread.sleep(25 * std.time.ns_per_ms);
                continue;
            },
            else => return err,
        };
        try setSocketBlocking(client_fd);

        const ctx = try allocator.create(ClientContext);
        ctx.* = .{
            .allocator = allocator,
            .commands = &commands,
            .fd = client_fd,
        };
        _ = active_clients.fetchAdd(1, .seq_cst);

        const thread = std.Thread.spawn(.{}, handleClientThread, .{ctx}) catch |err| {
            _ = active_clients.fetchSub(1, .seq_cst);
            allocator.destroy(ctx);
            std.posix.close(client_fd);
            return err;
        };
        thread.detach();
    }

    const wait_step_ms: usize = 25;
    const max_wait_ms: usize = 2000;
    var waited_ms: usize = 0;
    while (active_clients.load(.seq_cst) != 0 and waited_ms < max_wait_ms) : (waited_ms += wait_step_ms) {
        std.Thread.sleep(wait_step_ms * std.time.ns_per_ms);
    }

    const clients_left = active_clients.load(.seq_cst);
    if (clients_left != 0) {
        std.debug.print("storage shutdown forced with active clients={d}\n", .{clients_left});
    }
}

fn setSocketBlocking(fd: std.posix.fd_t) !void {
    var flags = try std.posix.fcntl(fd, std.posix.F.GETFL, 0);
    flags &= ~(@as(usize, 1) << @bitOffsetOf(std.posix.O, "NONBLOCK"));
    _ = try std.posix.fcntl(fd, std.posix.F.SETFL, flags);
}

// ── Client handler ────────────────────────────────────────────────────────────

fn handleClientThread(ctx: *ClientContext) void {
    const allocator = ctx.allocator;
    const commands = ctx.commands;
    const fd = ctx.fd;
    defer {
        std.posix.close(fd);
        allocator.destroy(ctx);
        _ = active_clients.fetchSub(1, .seq_cst);
    }

    const should_shutdown = handleClient(allocator, commands, fd) catch |err| blk: {
        std.debug.print("storage client error: {s}\n", .{@errorName(err)});
        break :blk false;
    };
    if (should_shutdown) {
        shutdown_requested.store(true, .seq_cst);
    }
}

fn handleClient(allocator: Allocator, commands: *StorageCommands, fd: std.posix.fd_t) !bool {
    while (true) {
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

        if (resp.ptr) |p| {
            sendMessage(fd, p[0..resp.len]) catch |err| {
                std.debug.print("storage send error: {s}\n", .{@errorName(err)});
                return false;
            };
        } else {
            // encodeError failed — send a hardcoded fallback so the client doesn't hang
            sendErrorMsg(fd, "internal storage error");
        }
        if (shutdown) return true;
    }
}

// ── Store operation context (runs in per-type worker thread) ──────────────────

const StoreOp = struct {
    commands: *StorageCommands,
    allocator: Allocator,
    cmd: c_uint,
    store_key: []const u8,
    ms: []const u8,
    store: []const u8,
    // Params (borrowed — safe because client thread waits for done)
    sql_ptr: [*:0]const u8 = "",
    key: []const u8 = "",
    value: []const u8 = "",
    prefix: []const u8 = "",
    migration_id: []const u8 = "",
    output_path: []const u8 = "",
    // Result
    result: CBytes = .{ .ptr = null, .len = 0 },
    op_err: ?anyerror = null,

    fn execute(ctx: ?*anyopaque) void {
        const self: *StoreOp = @ptrCast(@alignCast(ctx));
        stores_rwlock.lockShared();
        defer stores_rwlock.unlockShared();
        self.run() catch |e| {
            self.op_err = e;
        };
    }

    fn run(self: *StoreOp) !void {
        var tel = Telemetry.begin();

        switch (self.cmd) {
            c.REQ_EXEC_SQL => {
                try self.commands.execSql(self.store_key, self.sql_ptr);
                tel.op_count += 1;
                self.result = encodeAffected(tel, 0);
            },
            c.REQ_QUERY_SQL => {
                const json = try self.commands.querySql(self.store_key, self.sql_ptr, &tel);
                defer self.allocator.free(json);
                self.result = encodeData(tel, json);
            },
            c.REQ_SIZE => {
                const size = try self.commands.getStoreSize(self.store_key);
                tel.op_count += 1;
                self.result = encodeSize(tel, size);
            },
            c.REQ_MANIFEST => {
                const m = self.commands.getManifest(self.store_key) orelse return error.StoreNotFound;
                tel.op_count += 1;
                const mig_z = try self.allocator.alloc([:0]u8, m.migrations.items.len);
                defer {
                    for (mig_z) |item| self.allocator.free(item);
                    self.allocator.free(mig_z);
                }
                const mig_ptrs = try self.allocator.alloc([*:0]const u8, m.migrations.items.len);
                defer self.allocator.free(mig_ptrs);
                for (m.migrations.items, 0..) |mig, i| {
                    mig_z[i] = try self.allocator.dupeZ(u8, mig);
                    mig_ptrs[i] = mig_z[i].ptr;
                }
                const version = std.fmt.parseUnsigned(u32, m.version, 10) catch 1;
                self.result = encodeManifest(tel, m.name, @intFromEnum(m.store_type), version, mig_ptrs);
            },
            c.REQ_MIGRATE => {
                try self.commands.recordMigration(self.store_key, self.migration_id);
                tel.op_count += 1;
                self.result = encodeOk(tel);
            },
            c.REQ_ARCHIVE => {
                try self.commands.createArchive(self.store_key, self.output_path);
                tel.op_count += 1;
                self.result = encodeOk(tel);
            },
            c.REQ_KV_PUT => {
                try self.commands.kvPut(self.store_key, self.key, self.value, &tel);
                self.result = encodeOk(tel);
            },
            c.REQ_KV_GET => {
                const data = try self.commands.kvGet(self.store_key, self.key, &tel);
                if (data) |d| {
                    defer self.allocator.free(d);
                    self.result = encodeFound(tel, 1, d);
                } else {
                    self.result = encodeFound(tel, 0, &[_]u8{});
                }
            },
            c.REQ_KV_DELETE => {
                try self.commands.kvDelete(self.store_key, self.key, &tel);
                self.result = encodeFound(tel, 1, &[_]u8{});
            },
            c.REQ_KV_LIST => {
                const pairs = try self.commands.kvGetRange(self.store_key, self.prefix, &tel);
                defer {
                    for (pairs) |p| {
                        self.allocator.free(p.key);
                        self.allocator.free(p.value);
                    }
                    self.allocator.free(pairs);
                }
                const n = pairs.len;
                const key_ptrs = try self.allocator.alloc([*c]const u8, n);
                defer self.allocator.free(key_ptrs);
                const key_lens = try self.allocator.alloc(usize, n);
                defer self.allocator.free(key_lens);
                const val_ptrs = try self.allocator.alloc([*c]const u8, n);
                defer self.allocator.free(val_ptrs);
                const val_lens = try self.allocator.alloc(usize, n);
                defer self.allocator.free(val_lens);
                for (pairs, 0..) |p, i| {
                    key_ptrs[i] = p.key.ptr;
                    key_lens[i] = p.key.len;
                    val_ptrs[i] = p.value.ptr;
                    val_lens[i] = p.value.len;
                }
                var out_p: ?[*]u8 = null;
                var out_l: usize = 0;
                _ = c.transport_encode_kv_pairs(
                    &out_p, &out_l, telC(tel),
                    @ptrCast(key_ptrs.ptr), @ptrCast(key_lens.ptr),
                    @ptrCast(val_ptrs.ptr), @ptrCast(val_lens.ptr),
                    @intCast(n),
                );
                self.result = .{ .ptr = out_p, .len = out_l };
            },
            c.REQ_FILE_PUT => {
                try self.commands.filePut(self.store_key, self.key, self.value, &tel);
                self.result = encodeOk(tel);
            },
            c.REQ_FILE_GET => {
                const data = try self.commands.fileGet(self.store_key, self.key, &tel);
                if (data) |d| {
                    defer self.allocator.free(d);
                    self.result = encodeFound(tel, 1, d);
                } else {
                    self.result = encodeFound(tel, 0, &[_]u8{});
                }
            },
            c.REQ_FILE_DELETE => {
                _ = try self.commands.fileDelete(self.store_key, self.key, &tel);
                self.result = encodeFound(tel, 1, &[_]u8{});
            },
            c.REQ_FILE_LIST => {
                tel.op_count += 1;
                self.result = encodeKeys(tel, &[_][*:0]const u8{});
            },
            else => return error.UnknownCommand,
        }
    }
};

// ── Dispatch ──────────────────────────────────────────────────────────────────

const CBytes = struct { ptr: ?[*]u8, len: usize };

fn dispatch(
    allocator: Allocator,
    commands: *StorageCommands,
    reader: ?*c.TransportRequestReader,
    shutdown: *bool,
) !CBytes {
    const cmd = c.transport_req_reader_cmd(reader);
    const ms = std.mem.span(c.transport_req_reader_ms(reader));
    const store = std.mem.span(c.transport_req_reader_store(reader));

    var tel = Telemetry.begin();

    // ── Inline commands (no store worker needed) ──
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
            stores_rwlock.lock();
            defer stores_rwlock.unlock();
            const raw = @as(u8, @intCast(c.transport_req_reader_store_type(reader)));
            const st: StoreType = @enumFromInt(raw);
            try commands.openStore(ms, store, st);
            tel.op_count += 1;
            return encodeOk(tel);
        },
        c.REQ_CLOSE => {
            stores_rwlock.lock();
            defer stores_rwlock.unlock();
            const store_key = try std.fmt.allocPrint(allocator, "{s}/{s}", .{ ms, store });
            defer allocator.free(store_key);
            commands.closeStore(store_key);
            tel.op_count += 1;
            return encodeOk(tel);
        },
        c.REQ_FILE_LIST => {
            // Global list (ms="" && store="") — handled inline with read lock
            if (ms.len == 0 and store.len == 0) {
                stores_rwlock.lockShared();
                defer stores_rwlock.unlockShared();
                tel.op_count += 1;
                const count = commands.stores.count();
                const key_z_arr = try allocator.alloc([:0]u8, count);
                defer {
                    for (key_z_arr) |k| allocator.free(k);
                    allocator.free(key_z_arr);
                }
                const key_ptrs = try allocator.alloc([*:0]const u8, count);
                defer allocator.free(key_ptrs);
                var i: usize = 0;
                var it = commands.stores.keyIterator();
                while (it.next()) |key| : (i += 1) {
                    key_z_arr[i] = try allocator.dupeZ(u8, key.*);
                    key_ptrs[i] = key_z_arr[i].ptr;
                }
                return encodeKeys(tel, key_ptrs[0..i]);
            }
            // Store-specific FILE_LIST falls through to worker dispatch
        },
        else => {},
    }

    // ── Store operations: route through per-type worker ──
    const store_key = try std.fmt.allocPrint(allocator, "{s}/{s}", .{ ms, store });
    defer allocator.free(store_key);

    // Brief read lock to determine store type for routing
    stores_rwlock.lockShared();
    const store_type = commands.getStoreType(store_key);
    stores_rwlock.unlockShared();

    if (store_type == null) return error.StoreNotFound;

    // Extract command-specific params from reader (before submitting to worker)
    var sql_z: ?[:0]u8 = null;
    if (cmd == c.REQ_EXEC_SQL or cmd == c.REQ_QUERY_SQL) {
        sql_z = try allocator.dupeZ(u8, std.mem.span(c.transport_req_reader_sql(reader)));
    }
    defer if (sql_z) |z| allocator.free(z);

    var op = StoreOp{
        .commands = commands,
        .allocator = allocator,
        .cmd = cmd,
        .store_key = store_key,
        .ms = ms,
        .store = store,
    };

    if (sql_z) |z| {
        op.sql_ptr = z.ptr;
    }

    if (cmd == c.REQ_KV_PUT or cmd == c.REQ_KV_GET or cmd == c.REQ_KV_DELETE or
        cmd == c.REQ_FILE_PUT or cmd == c.REQ_FILE_GET or cmd == c.REQ_FILE_DELETE)
    {
        op.key = std.mem.span(c.transport_req_reader_key(reader));
    }

    if (cmd == c.REQ_KV_PUT or cmd == c.REQ_FILE_PUT) {
        const v_ptr = c.transport_req_reader_value_ptr(reader);
        const v_len = c.transport_req_reader_value_len(reader);
        op.value = if (v_ptr) |p| p[0..v_len] else &[_]u8{};
    }

    if (cmd == c.REQ_KV_LIST) {
        op.prefix = std.mem.span(c.transport_req_reader_prefix(reader));
    }

    if (cmd == c.REQ_MIGRATE) {
        op.migration_id = std.mem.span(c.transport_req_reader_migration_id(reader));
    }

    if (cmd == c.REQ_ARCHIVE) {
        op.output_path = std.mem.span(c.transport_req_reader_output_path(reader));
    }

    // Submit to per-type worker and wait
    var item = WorkItem{
        .store_key = store_key,
        .op = .exec_sql,
        .payload = &[_]u8{},
        .result = null,
        .done = .{},
        .err = null,
        .exec_ctx = @ptrCast(&op),
        .exec_fn = StoreOp.execute,
    };

    pool.getWorker(store_type.?).submit(&item);
    item.done.wait();

    if (op.op_err) |e| return e;
    return op.result;
}

// ── Encode helpers ────────────────────────────────────────────────────────────

fn telC(tel: Telemetry) c.TelemetryC {
    return .{ .dur_us = tel.durationUs(), .op_count = @as(u32, @intCast(tel.op_count)) };
}

fn encodeOk(tel: Telemetry) CBytes {
    var p: ?[*]u8 = null;
    var l: usize = 0;
    _ = c.transport_encode_ok(&p, &l, telC(tel));
    return .{ .ptr = p, .len = l };
}
fn encodeError(msg: []const u8) CBytes {
    var p: ?[*]u8 = null;
    var l: usize = 0;
    const owned_msg: ?[:0]u8 = std.heap.c_allocator.dupeZ(u8, msg) catch null;
    defer if (owned_msg) |buf| std.heap.c_allocator.free(buf);
    const c_msg: [*:0]const u8 = if (owned_msg) |buf| buf.ptr else "unknown error";
    _ = c.transport_encode_error(&p, &l, c_msg);
    return .{ .ptr = p, .len = l };
}
fn encodeAffected(tel: Telemetry, n: i64) CBytes {
    var p: ?[*]u8 = null;
    var l: usize = 0;
    _ = c.transport_encode_affected(&p, &l, telC(tel), n);
    return .{ .ptr = p, .len = l };
}
fn encodeSize(tel: Telemetry, size: u64) CBytes {
    var p: ?[*]u8 = null;
    var l: usize = 0;
    _ = c.transport_encode_size(&p, &l, telC(tel), size);
    return .{ .ptr = p, .len = l };
}
fn encodeFound(tel: Telemetry, found: i32, data: []const u8) CBytes {
    var p: ?[*]u8 = null;
    var l: usize = 0;
    _ = c.transport_encode_found(&p, &l, telC(tel), found, data.ptr, data.len);
    return .{ .ptr = p, .len = l };
}
fn encodeKeys(tel: Telemetry, keys: []const [*:0]const u8) CBytes {
    var p: ?[*]u8 = null;
    var l: usize = 0;
    const key_ptrs: [*c][*c]const u8 = @ptrCast(@constCast(keys.ptr));
    _ = c.transport_encode_keys(&p, &l, telC(tel), key_ptrs, @intCast(keys.len));
    return .{ .ptr = p, .len = l };
}
fn encodeData(tel: Telemetry, data: []const u8) CBytes {
    var p: ?[*]u8 = null;
    var l: usize = 0;
    _ = c.transport_encode_data(&p, &l, telC(tel), data.ptr, data.len);
    return .{ .ptr = p, .len = l };
}
fn encodeManifest(tel: Telemetry, name: []const u8, store_type: u8, version: u32, migs: [][*:0]const u8) CBytes {
    var p: ?[*]u8 = null;
    var l: usize = 0;
    _ = c.transport_encode_manifest(&p, &l, telC(tel), name.ptr, store_type, version, @ptrCast(migs.ptr), @intCast(migs.len));
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
    std.posix.sigaction(std.posix.SIG.INT, &act, null);
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
                allocator,
                "{s}/{s}/{s}/manifest.json",
                .{ data_dir, ms_entry.name, store_entry.name },
            );
            defer allocator.free(manifest_path);

            var manifest = mfst.Manifest.load(allocator, manifest_path) catch |err| switch (err) {
                error.FileNotFound => continue,
                else => {
                    std.debug.print("storage autoload skip {s}/{s}: {s}\n", .{ ms_entry.name, store_entry.name, @errorName(err) });
                    continue;
                },
            };
            const store_type = manifest.store_type;
            manifest.deinit();

            commands.openStore(ms_entry.name, store_entry.name, store_type) catch |err| {
                std.debug.print("storage autoload failed {s}/{s}: {s}\n", .{ ms_entry.name, store_entry.name, @errorName(err) });
                continue;
            };
            opened += 1;
        }
    }
    std.debug.print("storage autoload complete, opened={d}\n", .{opened});
}
