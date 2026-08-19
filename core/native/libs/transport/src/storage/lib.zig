const std = @import("std");
const socket = @import("socket.zig");

// Import the C header — gives us all transport_req_* / transport_resp_* symbols
// that are implemented in capnp_wrap.cpp.
const c = @cImport(@cInclude("transport.h"));

const Mutex = struct {
    raw: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,

    fn lock(self: *Mutex) void {
        _ = std.c.pthread_mutex_lock(&self.raw);
    }

    fn unlock(self: *Mutex) void {
        _ = std.c.pthread_mutex_unlock(&self.raw);
    }
};

// Re-export the full C API so the dynamic library surface is visible.
// Zig re-exports each symbol from the linked C++ object.

pub const transport_req_ping = c.transport_req_ping;
pub const transport_req_shutdown = c.transport_req_shutdown;
pub const transport_req_create = c.transport_req_create;
pub const transport_req_open = c.transport_req_open;
pub const transport_req_close = c.transport_req_close;
pub const transport_req_exec_sql = c.transport_req_exec_sql;
pub const transport_req_query_sql = c.transport_req_query_sql;
pub const transport_req_size = c.transport_req_size;
pub const transport_req_store_stats = c.transport_req_store_stats;
pub const transport_req_manifest = c.transport_req_manifest;
pub const transport_req_migrate = c.transport_req_migrate;
pub const transport_req_archive = c.transport_req_archive;
pub const transport_req_kv_put = c.transport_req_kv_put;
pub const transport_req_kv_put_from_cache = c.transport_req_kv_put_from_cache;
pub const transport_req_kv_get = c.transport_req_kv_get;
pub const transport_req_kv_get_to_cache = c.transport_req_kv_get_to_cache;
pub const transport_req_kv_delete = c.transport_req_kv_delete;
pub const transport_req_kv_list = c.transport_req_kv_list;
pub const transport_req_file_put = c.transport_req_file_put;
pub const transport_req_file_get_to_cache = c.transport_req_file_get_to_cache;
pub const transport_req_file_delete = c.transport_req_file_delete;
pub const transport_req_file_list = c.transport_req_file_list;
pub const transport_req_encode = c.transport_req_encode;
pub const transport_req_free = c.transport_req_free;
pub const transport_resp_decode = c.transport_resp_decode;
pub const transport_resp_free = c.transport_resp_free;
pub const transport_resp_ok = c.transport_resp_ok;
pub const transport_resp_error = c.transport_resp_error;
pub const transport_resp_duration_us = c.transport_resp_duration_us;
pub const transport_resp_op_count = c.transport_resp_op_count;
pub const transport_resp_affected = c.transport_resp_affected;
pub const transport_resp_size = c.transport_resp_size;
pub const transport_resp_row_count = c.transport_resp_row_count;
pub const transport_resp_col_count = c.transport_resp_col_count;
pub const transport_resp_col_name = c.transport_resp_col_name;
pub const transport_resp_value_type = c.transport_resp_value_type;
pub const transport_resp_value_int = c.transport_resp_value_int;
pub const transport_resp_value_real = c.transport_resp_value_real;
pub const transport_resp_value_text = c.transport_resp_value_text;
pub const transport_resp_key_count = c.transport_resp_key_count;
pub const transport_resp_key_at = c.transport_resp_key_at;
pub const transport_resp_found = c.transport_resp_found;
pub const transport_resp_data_ptr = c.transport_resp_data_ptr;
pub const transport_resp_data_len = c.transport_resp_data_len;
pub const transport_resp_manifest_name = c.transport_resp_manifest_name;
pub const transport_resp_manifest_type = c.transport_resp_manifest_type;
pub const transport_resp_manifest_version = c.transport_resp_manifest_version;
pub const transport_resp_manifest_migration_count = c.transport_resp_manifest_migration_count;
pub const transport_resp_manifest_migration_at = c.transport_resp_manifest_migration_at;
pub const transport_free_buf = c.transport_free_buf;

// ── Transport config ──────────────────────────────────────────────────────────

/// Socket kind used in TransportConfig.
/// 0 = Unix domain socket (addr is filesystem path).
/// 1 = TCP socket         (addr is IPv4 host string, port is used).
pub const TransportKind = enum(c_int) { unix = 0, tcp = 1 };

/// Configuration passed to transport_connect_cfg / transport_listen_cfg.
/// Extern layout so it is usable directly from C / TypeScript N-API.
pub const TransportConfig = extern struct {
    /// Socket variant: 0 = unix, 1 = tcp.
    kind: TransportKind,
    /// Unix: filesystem path (e.g. "/run/storage.sock").
    /// TCP:  IPv4 host       (e.g. "127.0.0.1").
    addr: [*:0]const u8,
    /// TCP only.  Ignored for unix sockets.
    port: u16,
};

const default_pool_key = "__default__";

const PooledConfig = struct {
    kind: TransportKind,
    addr: [:0]u8,
    port: u16,

    fn init(allocator: std.mem.Allocator, cfg: *const TransportConfig) !PooledConfig {
        return .{
            .kind = cfg.kind,
            .addr = try allocator.dupeZ(u8, std.mem.span(cfg.addr)),
            .port = cfg.port,
        };
    }

    fn deinit(self: *PooledConfig, allocator: std.mem.Allocator) void {
        allocator.free(self.addr);
        self.* = undefined;
    }
};

const PoolEntry = struct {
    cfg: PooledConfig,
    fd: i32 = -1,
    mutex: Mutex = .{},

    fn close(self: *PoolEntry) void {
        if (self.fd >= 0) {
            transport_close(self.fd);
            self.fd = -1;
        }
    }

    fn connect(self: *PoolEntry) !void {
        if (self.fd >= 0) return;
        const fd = switch (self.cfg.kind) {
            .unix => transport_connect(self.cfg.addr.ptr),
            .tcp => transport_connect_tcp(self.cfg.addr.ptr, self.cfg.port),
        };
        if (fd < 0) return error.TransportConnectFailed;
        self.fd = fd;
    }

    fn deinit(self: *PoolEntry, allocator: std.mem.Allocator) void {
        self.close();
        self.cfg.deinit(allocator);
        allocator.destroy(self);
    }
};

const TransportPool = struct {
    allocator: std.mem.Allocator,
    mutex: Mutex = .{},
    entries: std.StringHashMap(*PoolEntry),

    fn init(allocator: std.mem.Allocator) TransportPool {
        return .{
            .allocator = allocator,
            .entries = std.StringHashMap(*PoolEntry).init(allocator),
        };
    }

    fn deinit(self: *TransportPool) void {
        var it = self.entries.valueIterator();
        while (it.next()) |entry| {
            entry.*.deinit(self.allocator);
        }
        self.entries.deinit();
        self.* = undefined;
    }

    fn upsert(self: *TransportPool, key_raw: []const u8, cfg_raw: *const TransportConfig) !void {
        const key = if (key_raw.len == 0) default_pool_key else key_raw;
        self.mutex.lock();
        defer self.mutex.unlock();

        if (self.entries.get(key)) |entry| {
            entry.mutex.lock();
            defer entry.mutex.unlock();
            entry.close();
            entry.cfg.deinit(self.allocator);
            entry.cfg = try PooledConfig.init(self.allocator, cfg_raw);
            return;
        }

        const entry = try self.allocator.create(PoolEntry);
        errdefer self.allocator.destroy(entry);
        entry.* = .{
            .cfg = try PooledConfig.init(self.allocator, cfg_raw),
        };
        errdefer entry.cfg.deinit(self.allocator);

        const key_owned = try self.allocator.dupe(u8, key);
        errdefer self.allocator.free(key_owned);
        try self.entries.put(key_owned, entry);
    }

    fn remove(self: *TransportPool, key_raw: []const u8) bool {
        const key = if (key_raw.len == 0) default_pool_key else key_raw;
        self.mutex.lock();
        defer self.mutex.unlock();

        if (self.entries.fetchRemove(key)) |kv| {
            kv.value.mutex.lock();
            kv.value.close();
            kv.value.mutex.unlock();
            self.allocator.free(kv.key);
            kv.value.deinit(self.allocator);
            return true;
        }
        return false;
    }

    fn closeAll(self: *TransportPool) void {
        self.mutex.lock();
        defer self.mutex.unlock();

        var it = self.entries.valueIterator();
        while (it.next()) |entry| {
            entry.*.mutex.lock();
            entry.*.close();
            entry.*.mutex.unlock();
        }
    }

    fn request(self: *TransportPool, key_raw: ?[*:0]const u8, req: ?*anyopaque) ?*anyopaque {
        if (req == null) return null;
        const key = blk: {
            if (key_raw) |k| {
                const span = std.mem.span(k);
                if (span.len != 0) break :blk span;
            }
            break :blk default_pool_key;
        };

        self.mutex.lock();
        const entry = self.entries.get(key) orelse {
            self.mutex.unlock();
            return null;
        };
        entry.mutex.lock();
        self.mutex.unlock();
        defer entry.mutex.unlock();

        entry.connect() catch return null;

        if (transport_send_req(entry.fd, req) != 0) {
            entry.close();
            return null;
        }

        const resp = transport_recv_resp(entry.fd) orelse {
            entry.close();
            return null;
        };
        return resp;
    }
};

pub export fn transport_pool_create() ?*TransportPool {
    const allocator = std.heap.c_allocator;
    const pool = allocator.create(TransportPool) catch return null;
    pool.* = TransportPool.init(allocator);
    return pool;
}

pub export fn transport_pool_free(pool: ?*TransportPool) void {
    const p = pool orelse return;
    const allocator = p.allocator;
    p.deinit();
    allocator.destroy(p);
}

pub export fn transport_pool_set_default(pool: ?*TransportPool, cfg: ?*const TransportConfig) i32 {
    const p = pool orelse return -1;
    const c_cfg = cfg orelse return -1;
    p.upsert(default_pool_key, c_cfg) catch return -1;
    return 0;
}

pub export fn transport_pool_add(pool: ?*TransportPool, key: ?[*:0]const u8, cfg: ?*const TransportConfig) i32 {
    const p = pool orelse return -1;
    const key_z = key orelse return -1;
    const c_cfg = cfg orelse return -1;
    p.upsert(std.mem.span(key_z), c_cfg) catch return -1;
    return 0;
}

pub export fn transport_pool_set_default_unix(pool: ?*TransportPool, path: ?[*:0]const u8) i32 {
    const path_z = path orelse return -1;
    const cfg = TransportConfig{ .kind = .unix, .addr = path_z, .port = 0 };
    return transport_pool_set_default(pool, &cfg);
}

pub export fn transport_pool_set_default_tcp(pool: ?*TransportPool, host: ?[*:0]const u8, port: u16) i32 {
    const host_z = host orelse return -1;
    const cfg = TransportConfig{ .kind = .tcp, .addr = host_z, .port = port };
    return transport_pool_set_default(pool, &cfg);
}

pub export fn transport_pool_add_unix(pool: ?*TransportPool, key: ?[*:0]const u8, path: ?[*:0]const u8) i32 {
    const key_z = key orelse return -1;
    const path_z = path orelse return -1;
    const cfg = TransportConfig{ .kind = .unix, .addr = path_z, .port = 0 };
    return transport_pool_add(pool, key_z, &cfg);
}

pub export fn transport_pool_add_tcp(pool: ?*TransportPool, key: ?[*:0]const u8, host: ?[*:0]const u8, port: u16) i32 {
    const key_z = key orelse return -1;
    const host_z = host orelse return -1;
    const cfg = TransportConfig{ .kind = .tcp, .addr = host_z, .port = port };
    return transport_pool_add(pool, key_z, &cfg);
}

pub export fn transport_pool_remove(pool: ?*TransportPool, key: ?[*:0]const u8) i32 {
    const p = pool orelse return -1;
    const key_z = key orelse return -1;
    return if (p.remove(std.mem.span(key_z))) 1 else 0;
}

pub export fn transport_pool_close_all(pool: ?*TransportPool) void {
    const p = pool orelse return;
    p.closeAll();
}

pub export fn transport_pool_request(pool: ?*TransportPool, key: ?[*:0]const u8, req: ?*anyopaque) ?*anyopaque {
    const p = pool orelse return null;
    return p.request(key, req);
}

// ── ZeroMQ transport (IPC and TCP carry one Cap'n Proto buffer per message) ──

/// Connect to a storage IPC endpoint. Returns an opaque handle or -1 on error.
pub export fn transport_connect(path: [*:0]const u8) i32 {
    return socket.connectUnix(path) catch -1;
}

/// Set per-ZMQ-socket send/receive timeout in milliseconds.
/// Returns 0 on success, -1 on error.
pub export fn transport_set_timeout_ms(fd: i32, timeout_ms: u32) i32 {
    socket.setOperationTimeout(fd, timeout_ms) catch return -1;
    return 0;
}

/// Bind a storage IPC endpoint. Returns an opaque server handle or -1 on error.
pub export fn transport_listen(path: [*:0]const u8) i32 {
    return socket.listenUnix(path) catch -1;
}

/// Connect to a TCP endpoint at host:port. Returns an opaque handle or -1 on error.
pub export fn transport_connect_tcp(host: [*:0]const u8, port: u16) i32 {
    return socket.connectTcp(host, port) catch -1;
}

/// Bind a TCP endpoint at host:port. Returns an opaque server handle or -1 on error.
pub export fn transport_listen_tcp(host: [*:0]const u8, port: u16) i32 {
    return socket.listenTcp(host, port) catch return -1;
}

/// Config-based connect: selects unix or tcp based on cfg.kind.
/// Returns an opaque handle or -1 on error.
pub export fn transport_connect_cfg(cfg: *const TransportConfig) i32 {
    return switch (cfg.kind) {
        .unix => transport_connect(cfg.addr),
        .tcp => transport_connect_tcp(cfg.addr, cfg.port),
    };
}

/// Config-based listen: selects unix or tcp based on cfg.kind.
/// Returns server fd or -1 on error.
pub export fn transport_listen_cfg(cfg: *const TransportConfig) i32 {
    return switch (cfg.kind) {
        .unix => transport_listen(cfg.addr),
        .tcp => transport_listen_tcp(cfg.addr, cfg.port),
    };
}

/// ZeroMQ accepts peers internally; returns the listener handle or -1 on error.
pub export fn transport_accept(server_fd: i32) i32 {
    return socket.accept(server_fd) catch -1;
}

/// Close an opaque ZeroMQ handle.
pub export fn transport_close(fd: i32) void {
    socket.close(fd);
}

/// Encode a request with Cap'n Proto and send it as a single ZeroMQ message.
/// Returns 0 on success, -1 on encode error, -2 on send error.
pub export fn transport_send_req(fd: i32, req: ?*anyopaque) i32 {
    var out_buf: ?[*]u8 = null;
    var out_len: usize = 0;
    const rc = c.transport_req_encode(
        @ptrCast(req),
        @ptrCast(&out_buf),
        &out_len,
    );
    if (rc != 0) return -1;
    defer c.transport_free_buf(out_buf, out_len);

    socket.sendMessage(fd, out_buf.?[0..out_len]) catch return -2;
    return 0;
}

/// Receive one Cap'n Proto response from ZeroMQ.
/// Returns a TransportResponse* (opaque) or null on error.
/// Caller must free with transport_resp_free().
pub export fn transport_recv_resp(fd: i32) ?*anyopaque {
    const allocator = std.heap.c_allocator;
    const msg = socket.recvMessage(fd, allocator) catch return null;
    defer allocator.free(msg);
    return @ptrCast(c.transport_resp_decode(msg.ptr, msg.len));
}
