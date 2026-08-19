//! In-memory mock of the behemoth transport shared library.
//!
//! Exports the same C ABI surface as the real lib (lib.zig + capnp_wrap.cpp)
//! that service clients dlopen, but keeps all KV/file data in process memory:
//! no sockets, no capnp, no storage backend. Use it to run unit/e2e tests of
//! services against "storage" without infrastructure:
//!
//!     zig build mock        →  zig-out/lib/libtransport-mock.so
//!
//! then point the consumer's transport lib path (e.g. LLM_GATE_TRANSPORT_LIB)
//! at the .so and exercise the service; afterwards read the data back through
//! the same API (kv_get / kv_list / file_get) to assert what was written.
//!
//! Pool semantics mirror the real lib: set_default*/add* register pool
//! entries ("" → default); a request for an unregistered key returns null.
//! Each pool entry has its own isolated state, so multi-tenant routing
//! (domain → storage) is observable in tests. close_all / re-add keep data,
//! like reconnecting to the same external storage.

const std = @import("std");

const gpa = std.heap.c_allocator;
var cache_key_counter = std.atomic.Value(u64).init(0);

/// pthread mutex — same rationale as lib.zig (works in every consumer build).
const Mutex = struct {
    raw: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,

    fn lock(self: *Mutex) void {
        _ = std.c.pthread_mutex_lock(&self.raw);
    }

    fn unlock(self: *Mutex) void {
        _ = std.c.pthread_mutex_unlock(&self.raw);
    }
};

const default_pool_key = "__default__";

// ── Storage model ─────────────────────────────────────────────────────────────
// PoolEntry = one storage instance. Two spaces (kv / files) of
// "namespace\x1fstore" buckets, each bucket maps key → value bytes.

const Bucket = std.StringHashMap([]u8);
const SpaceMap = std.StringHashMap(*Bucket);

const PoolEntry = struct {
    kv: SpaceMap,
    files: SpaceMap,
    cache: Bucket,

    fn create() !*PoolEntry {
        const entry = try gpa.create(PoolEntry);
        entry.* = .{ .kv = SpaceMap.init(gpa), .files = SpaceMap.init(gpa), .cache = Bucket.init(gpa) };
        return entry;
    }

    fn destroy(self: *PoolEntry) void {
        deinitSpace(&self.kv);
        deinitSpace(&self.files);
        deinitBucket(&self.cache);
        gpa.destroy(self);
    }
};

fn deinitBucket(bucket: *Bucket) void {
    var it = bucket.iterator();
    while (it.next()) |kv| {
        gpa.free(kv.key_ptr.*);
        gpa.free(kv.value_ptr.*);
    }
    bucket.deinit();
}

fn deinitSpace(space: *SpaceMap) void {
    var it = space.iterator();
    while (it.next()) |entry| {
        gpa.free(entry.key_ptr.*);
        const bucket = entry.value_ptr.*;
        deinitBucket(bucket);
        gpa.destroy(bucket);
    }
    space.deinit();
}

fn spaceKey(namespace: []const u8, store: []const u8) ![]u8 {
    return std.fmt.allocPrint(gpa, "{s}\x1f{s}", .{ namespace, store });
}

fn bucketFor(space: *SpaceMap, namespace: []const u8, store: []const u8, create: bool) !?*Bucket {
    const key = try spaceKey(namespace, store);
    if (space.get(key)) |bucket| {
        gpa.free(key);
        return bucket;
    }
    if (!create) {
        gpa.free(key);
        return null;
    }
    errdefer gpa.free(key);
    const bucket = try gpa.create(Bucket);
    errdefer gpa.destroy(bucket);
    bucket.* = Bucket.init(gpa);
    try space.put(key, bucket);
    return bucket;
}

const Pool = struct {
    mutex: Mutex = .{},
    entries: std.StringHashMap(*PoolEntry),

    fn create() !*Pool {
        const pool = try gpa.create(Pool);
        pool.* = .{ .entries = std.StringHashMap(*PoolEntry).init(gpa) };
        return pool;
    }

    fn destroy(self: *Pool) void {
        var it = self.entries.iterator();
        while (it.next()) |entry| {
            gpa.free(entry.key_ptr.*);
            entry.value_ptr.*.destroy();
        }
        self.entries.deinit();
        gpa.destroy(self);
    }

    /// Register a pool key; existing data is kept (re-adding the same key is
    /// like reconnecting to the same external storage).
    fn ensure(self: *Pool, key_raw: []const u8) !void {
        const key = if (key_raw.len == 0) default_pool_key else key_raw;
        self.mutex.lock();
        defer self.mutex.unlock();
        if (self.entries.contains(key)) return;
        const key_owned = try gpa.dupe(u8, key);
        errdefer gpa.free(key_owned);
        const entry = try PoolEntry.create();
        errdefer entry.destroy();
        try self.entries.put(key_owned, entry);
    }

    fn remove(self: *Pool, key_raw: []const u8) bool {
        const key = if (key_raw.len == 0) default_pool_key else key_raw;
        self.mutex.lock();
        defer self.mutex.unlock();
        if (self.entries.fetchRemove(key)) |kv| {
            gpa.free(kv.key);
            kv.value.destroy();
            return true;
        }
        return false;
    }
};

// ── Requests / responses ─────────────────────────────────────────────────────

const Op = enum {
    ping,
    create,
    exec_sql,
    query_sql,
    kv_put,
    kv_put_from_cache,
    kv_get,
    kv_get_to_cache,
    kv_delete,
    kv_list,
    file_put,
    file_get_to_cache,
    file_delete,
    file_list,
};

const Request = struct {
    op: Op,
    namespace: []u8,
    store: []u8,
    /// Item key; doubles as the prefix for kv_list. Empty for file_list/ping.
    key: []u8,
    value: []u8,

    fn create(op: Op, namespace: []const u8, store: []const u8, key: []const u8, value: []const u8) ?*Request {
        const req = gpa.create(Request) catch return null;
        req.* = .{
            .op = op,
            .namespace = gpa.dupe(u8, namespace) catch {
                gpa.destroy(req);
                return null;
            },
            .store = &.{},
            .key = &.{},
            .value = &.{},
        };
        req.store = gpa.dupe(u8, store) catch {
            req.destroy();
            return null;
        };
        req.key = gpa.dupe(u8, key) catch {
            req.destroy();
            return null;
        };
        req.value = gpa.dupe(u8, value) catch {
            req.destroy();
            return null;
        };
        return req;
    }

    fn destroy(self: *Request) void {
        gpa.free(self.namespace);
        gpa.free(self.store);
        gpa.free(self.key);
        gpa.free(self.value);
        gpa.destroy(self);
    }
};

const Response = struct {
    ok: bool = true,
    err: ?[:0]u8 = null,
    found: bool = false,
    data: ?[]u8 = null,
    keys: ?[][:0]u8 = null,
    affected: i64 = 0,

    fn create() ?*Response {
        const resp = gpa.create(Response) catch return null;
        resp.* = .{};
        return resp;
    }

    fn destroy(self: *Response) void {
        if (self.err) |e| gpa.free(e);
        if (self.data) |d| gpa.free(d);
        if (self.keys) |keys| {
            for (keys) |k| gpa.free(k);
            gpa.free(keys);
        }
        gpa.destroy(self);
    }

    fn fail(self: *Response, msg: []const u8) *Response {
        self.ok = false;
        self.err = gpa.dupeZ(u8, msg) catch null;
        return self;
    }
};

fn keyLessThan(_: void, a: [:0]u8, b: [:0]u8) bool {
    return std.mem.order(u8, a, b) == .lt;
}

fn makeCacheKey() ![]u8 {
    var ts: std.c.timespec = undefined;
    _ = std.c.clock_gettime(.MONOTONIC, &ts);
    const nanos: u128 = @as(u128, @intCast(ts.sec)) * std.time.ns_per_s + @as(u128, @intCast(ts.nsec));
    const n = cache_key_counter.fetchAdd(1, .monotonic);
    return std.fmt.allocPrint(gpa, "cache:files:{x}:{x}", .{ nanos, n });
}

fn putOwned(bucket: *Bucket, key: []const u8, owned_value: []u8) !void {
    const gop = bucket.getOrPut(key) catch |err| {
        gpa.free(owned_value);
        return err;
    };
    if (gop.found_existing) {
        gpa.free(gop.value_ptr.*);
    } else {
        gop.key_ptr.* = gpa.dupe(u8, key) catch {
            _ = bucket.remove(key);
            gpa.free(owned_value);
            return error.OutOfMemory;
        };
    }
    gop.value_ptr.* = owned_value;
}

/// Execute a request against one pool entry. Caller holds the pool mutex.
fn execute(entry: *PoolEntry, req: *Request) ?*Response {
    const resp = Response.create() orelse return null;

    switch (req.op) {
        .ping, .exec_sql => {}, // ok; SQL is a stub — the mock covers KV/files

        .create => {},

        .query_sql => {
            // ok with zero rows
        },

        .kv_put, .file_put => {
            const space = if (req.op == .kv_put) &entry.kv else &entry.files;
            const bucket = (bucketFor(space, req.namespace, req.store, true) catch return resp.fail("oom")) orelse unreachable;
            const value = gpa.dupe(u8, req.value) catch return resp.fail("oom");
            putOwned(bucket, req.key, value) catch return resp.fail("oom");
            resp.affected = 1;
        },

        .kv_put_from_cache => {
            const cached = entry.cache.get(req.value) orelse return resp.fail("cache key not found");
            const bucket = (bucketFor(&entry.kv, req.namespace, req.store, true) catch return resp.fail("oom")) orelse unreachable;
            const value = gpa.dupe(u8, cached) catch return resp.fail("oom");
            putOwned(bucket, req.key, value) catch return resp.fail("oom");
            resp.affected = 1;
        },

        .kv_get => {
            const space = &entry.kv;
            const bucket = bucketFor(space, req.namespace, req.store, false) catch return resp.fail("oom");
            if (bucket) |b| {
                if (b.get(req.key)) |value| {
                    resp.found = true;
                    resp.data = gpa.dupe(u8, value) catch return resp.fail("oom");
                }
            }
        },

        .kv_get_to_cache => {
            const bucket = bucketFor(&entry.kv, req.namespace, req.store, false) catch return resp.fail("oom");
            if (bucket) |b| {
                if (b.get(req.key)) |value| {
                    const cache_key = makeCacheKey() catch return resp.fail("oom");
                    errdefer gpa.free(cache_key);
                    const cached_value = gpa.dupe(u8, value) catch return resp.fail("oom");
                    putOwned(&entry.cache, cache_key, cached_value) catch return resp.fail("oom");
                    resp.found = true;
                    resp.data = cache_key;
                }
            }
        },

        .file_get_to_cache => {
            const bucket = bucketFor(&entry.files, req.namespace, req.store, false) catch return resp.fail("oom");
            if (bucket) |b| {
                if (b.get(req.key)) |value| {
                    const cache_key = makeCacheKey() catch return resp.fail("oom");
                    errdefer gpa.free(cache_key);
                    const cached_value = gpa.dupe(u8, value) catch return resp.fail("oom");
                    putOwned(&entry.cache, cache_key, cached_value) catch return resp.fail("oom");
                    resp.found = true;
                    resp.data = cache_key;
                }
            }
        },

        .kv_delete, .file_delete => {
            const space = if (req.op == .kv_delete) &entry.kv else &entry.files;
            const bucket = bucketFor(space, req.namespace, req.store, false) catch return resp.fail("oom");
            if (bucket) |b| {
                if (b.fetchRemove(req.key)) |kv| {
                    gpa.free(kv.key);
                    gpa.free(kv.value);
                    resp.affected = 1;
                }
            }
        },

        .kv_list, .file_list => {
            const space = if (req.op == .kv_list) &entry.kv else &entry.files;
            const bucket = bucketFor(space, req.namespace, req.store, false) catch return resp.fail("oom");
            var keys: std.ArrayList([:0]u8) = .empty;
            errdefer {
                for (keys.items) |k| gpa.free(k);
                keys.deinit(gpa);
            }
            if (bucket) |b| {
                var it = b.keyIterator();
                while (it.next()) |k| {
                    // kv_list filters by prefix; file_list returns everything.
                    if (req.op == .kv_list and !std.mem.startsWith(u8, k.*, req.key)) continue;
                    const owned = gpa.dupeZ(u8, k.*) catch return resp.fail("oom");
                    keys.append(gpa, owned) catch {
                        gpa.free(owned);
                        return resp.fail("oom");
                    };
                }
            }
            std.mem.sort([:0]u8, keys.items, {}, keyLessThan);
            resp.keys = keys.toOwnedSlice(gpa) catch return resp.fail("oom");
        },
    }

    return resp;
}

// ── C ABI: pool ───────────────────────────────────────────────────────────────

pub export fn transport_pool_create() ?*Pool {
    return Pool.create() catch null;
}

pub export fn transport_pool_free(pool: ?*Pool) void {
    const p = pool orelse return;
    p.destroy();
}

pub export fn transport_pool_set_default_unix(pool: ?*Pool, path: ?[*:0]const u8) i32 {
    const p = pool orelse return -1;
    if (path == null) return -1;
    p.ensure(default_pool_key) catch return -1;
    return 0;
}

pub export fn transport_pool_set_default_tcp(pool: ?*Pool, host: ?[*:0]const u8, port: u16) i32 {
    _ = port;
    const p = pool orelse return -1;
    if (host == null) return -1;
    p.ensure(default_pool_key) catch return -1;
    return 0;
}

pub export fn transport_pool_add_unix(pool: ?*Pool, key: ?[*:0]const u8, path: ?[*:0]const u8) i32 {
    const p = pool orelse return -1;
    const key_z = key orelse return -1;
    if (path == null) return -1;
    p.ensure(std.mem.span(key_z)) catch return -1;
    return 0;
}

pub export fn transport_pool_add_tcp(pool: ?*Pool, key: ?[*:0]const u8, host: ?[*:0]const u8, port: u16) i32 {
    _ = port;
    const p = pool orelse return -1;
    const key_z = key orelse return -1;
    if (host == null) return -1;
    p.ensure(std.mem.span(key_z)) catch return -1;
    return 0;
}

pub export fn transport_pool_remove(pool: ?*Pool, key: ?[*:0]const u8) i32 {
    const p = pool orelse return -1;
    const key_z = key orelse return -1;
    return if (p.remove(std.mem.span(key_z))) 1 else 0;
}

/// No-op: the mock has no connections; data is kept (external storage model).
pub export fn transport_pool_close_all(pool: ?*Pool) void {
    _ = pool;
}

pub export fn transport_pool_request(pool: ?*Pool, key: ?[*:0]const u8, req: ?*Request) ?*Response {
    const p = pool orelse return null;
    const r = req orelse return null;
    const key_span = blk: {
        if (key) |k| {
            const span = std.mem.span(k);
            if (span.len != 0) break :blk span;
        }
        break :blk default_pool_key;
    };

    p.mutex.lock();
    defer p.mutex.unlock();
    // Unregistered pool key → null, like the real pool with no entry.
    const entry = p.entries.get(key_span) orelse return null;
    return execute(entry, r);
}

// ── C ABI: request constructors ───────────────────────────────────────────────

pub export fn transport_req_ping() ?*Request {
    return Request.create(.ping, "", "", "", "");
}

pub export fn transport_req_create(ms: ?[*:0]const u8, store: ?[*:0]const u8, store_type: u8) ?*Request {
    _ = store_type;
    const ms_z = ms orelse return null;
    const store_z = store orelse return null;
    return Request.create(.create, std.mem.span(ms_z), std.mem.span(store_z), "", "");
}

pub export fn transport_req_exec_sql(ms: ?[*:0]const u8, store: ?[*:0]const u8, sql: ?[*:0]const u8) ?*Request {
    const ms_z = ms orelse return null;
    const store_z = store orelse return null;
    const sql_z = sql orelse return null;
    return Request.create(.exec_sql, std.mem.span(ms_z), std.mem.span(store_z), "", std.mem.span(sql_z));
}

pub export fn transport_req_query_sql(ms: ?[*:0]const u8, store: ?[*:0]const u8, sql: ?[*:0]const u8) ?*Request {
    const ms_z = ms orelse return null;
    const store_z = store orelse return null;
    const sql_z = sql orelse return null;
    return Request.create(.query_sql, std.mem.span(ms_z), std.mem.span(store_z), "", std.mem.span(sql_z));
}

pub export fn transport_req_kv_put(ms: ?[*:0]const u8, store: ?[*:0]const u8, key: ?[*:0]const u8, value: ?[*]const u8, value_len: usize) ?*Request {
    const ms_z = ms orelse return null;
    const store_z = store orelse return null;
    const key_z = key orelse return null;
    const data: []const u8 = if (value) |v| v[0..value_len] else if (value_len == 0) "" else return null;
    return Request.create(.kv_put, std.mem.span(ms_z), std.mem.span(store_z), std.mem.span(key_z), data);
}

pub export fn transport_req_kv_put_from_cache(ms: ?[*:0]const u8, store: ?[*:0]const u8, key: ?[*:0]const u8, cache_key: ?[*:0]const u8) ?*Request {
    const ms_z = ms orelse return null;
    const store_z = store orelse return null;
    const key_z = key orelse return null;
    const cache_key_z = cache_key orelse return null;
    return Request.create(.kv_put_from_cache, std.mem.span(ms_z), std.mem.span(store_z), std.mem.span(key_z), std.mem.span(cache_key_z));
}

pub export fn transport_req_kv_get(ms: ?[*:0]const u8, store: ?[*:0]const u8, key: ?[*:0]const u8) ?*Request {
    const ms_z = ms orelse return null;
    const store_z = store orelse return null;
    const key_z = key orelse return null;
    return Request.create(.kv_get, std.mem.span(ms_z), std.mem.span(store_z), std.mem.span(key_z), "");
}

pub export fn transport_req_kv_get_to_cache(ms: ?[*:0]const u8, store: ?[*:0]const u8, key: ?[*:0]const u8) ?*Request {
    const ms_z = ms orelse return null;
    const store_z = store orelse return null;
    const key_z = key orelse return null;
    return Request.create(.kv_get_to_cache, std.mem.span(ms_z), std.mem.span(store_z), std.mem.span(key_z), "");
}

pub export fn transport_req_kv_delete(ms: ?[*:0]const u8, store: ?[*:0]const u8, key: ?[*:0]const u8) ?*Request {
    const ms_z = ms orelse return null;
    const store_z = store orelse return null;
    const key_z = key orelse return null;
    return Request.create(.kv_delete, std.mem.span(ms_z), std.mem.span(store_z), std.mem.span(key_z), "");
}

pub export fn transport_req_kv_list(ms: ?[*:0]const u8, store: ?[*:0]const u8, prefix: ?[*:0]const u8) ?*Request {
    const ms_z = ms orelse return null;
    const store_z = store orelse return null;
    const prefix_z = prefix orelse return null;
    return Request.create(.kv_list, std.mem.span(ms_z), std.mem.span(store_z), std.mem.span(prefix_z), "");
}

pub export fn transport_req_file_put(ms: ?[*:0]const u8, store: ?[*:0]const u8, key: ?[*:0]const u8, value: ?[*]const u8, value_len: usize) ?*Request {
    const ms_z = ms orelse return null;
    const store_z = store orelse return null;
    const key_z = key orelse return null;
    const data: []const u8 = if (value) |v| v[0..value_len] else if (value_len == 0) "" else return null;
    return Request.create(.file_put, std.mem.span(ms_z), std.mem.span(store_z), std.mem.span(key_z), data);
}

pub export fn transport_req_file_get_to_cache(ms: ?[*:0]const u8, store: ?[*:0]const u8, key: ?[*:0]const u8) ?*Request {
    const ms_z = ms orelse return null;
    const store_z = store orelse return null;
    const key_z = key orelse return null;
    return Request.create(.file_get_to_cache, std.mem.span(ms_z), std.mem.span(store_z), std.mem.span(key_z), "");
}

pub export fn transport_req_file_delete(ms: ?[*:0]const u8, store: ?[*:0]const u8, key: ?[*:0]const u8) ?*Request {
    const ms_z = ms orelse return null;
    const store_z = store orelse return null;
    const key_z = key orelse return null;
    return Request.create(.file_delete, std.mem.span(ms_z), std.mem.span(store_z), std.mem.span(key_z), "");
}

pub export fn transport_req_file_list(ms: ?[*:0]const u8, store: ?[*:0]const u8) ?*Request {
    const ms_z = ms orelse return null;
    const store_z = store orelse return null;
    return Request.create(.file_list, std.mem.span(ms_z), std.mem.span(store_z), "", "");
}

pub export fn transport_req_free(req: ?*Request) void {
    const r = req orelse return;
    r.destroy();
}

// ── C ABI: response accessors ─────────────────────────────────────────────────

pub export fn transport_resp_free(resp: ?*Response) void {
    const r = resp orelse return;
    r.destroy();
}

pub export fn transport_resp_ok(resp: ?*Response) i32 {
    const r = resp orelse return 0;
    return if (r.ok) 1 else 0;
}

pub export fn transport_resp_error(resp: ?*Response) ?[*:0]const u8 {
    const r = resp orelse return null;
    return if (r.err) |e| e.ptr else null;
}

pub export fn transport_resp_found(resp: ?*Response) i32 {
    const r = resp orelse return 0;
    return if (r.found) 1 else 0;
}

pub export fn transport_resp_data_ptr(resp: ?*Response) ?[*]const u8 {
    const r = resp orelse return null;
    return if (r.data) |d| d.ptr else null;
}

pub export fn transport_resp_data_len(resp: ?*Response) usize {
    const r = resp orelse return 0;
    return if (r.data) |d| d.len else 0;
}

pub export fn transport_resp_key_count(resp: ?*Response) u32 {
    const r = resp orelse return 0;
    return if (r.keys) |keys| @intCast(keys.len) else 0;
}

pub export fn transport_resp_key_at(resp: ?*Response, i: u32) ?[*:0]const u8 {
    const r = resp orelse return null;
    const keys = r.keys orelse return null;
    if (i >= keys.len) return null;
    return keys[i].ptr;
}

// Parity stubs so generic consumers don't crash on missing symbols.

pub export fn transport_resp_duration_us(resp: ?*Response) u64 {
    _ = resp;
    return 0;
}

pub export fn transport_resp_op_count(resp: ?*Response) u32 {
    _ = resp;
    return 1;
}

pub export fn transport_resp_affected(resp: ?*Response) i64 {
    const r = resp orelse return 0;
    return r.affected;
}

pub export fn transport_resp_size(resp: ?*Response) u64 {
    _ = resp;
    return 0;
}

pub export fn transport_resp_row_count(resp: ?*Response) u32 {
    _ = resp;
    return 0;
}

pub export fn transport_resp_col_count(resp: ?*Response, row: u32) u32 {
    _ = resp;
    _ = row;
    return 0;
}

/// Marker so tests/tools can verify they loaded the mock, not the real lib.
pub export fn transport_mock_marker() i32 {
    return 1;
}
