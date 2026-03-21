const std = @import("std");
const Allocator = std.mem.Allocator;
const manifest_mod = @import("manifest.zig");
const StoreType = manifest_mod.StoreType;

const SqlEngine = @import("engines/sql.zig").SqlEngine;
const KvEngine = @import("engines/kv.zig").KvEngine;
const ColumnEngine = @import("engines/column.zig").ColumnEngine;
const VectorEngine = @import("engines/vector.zig").VectorEngine;
const FilesEngine = @import("engines/files.zig").FilesEngine;
const GraphEngine = @import("engines/graph.zig").GraphEngine;

pub const WorkItem = struct {
    store_key: []const u8,
    op: Op,
    payload: []const u8,
    result: ?[]u8,
    done: std.Thread.ResetEvent,
    err: ?anyerror,
    exec_ctx: ?*anyopaque = null,
    exec_fn: ?*const fn (?*anyopaque) void = null,

    pub const Op = enum {
        exec_sql,
        query_sql,
        kv_put,
        kv_get,
        kv_delete,
        file_put,
        file_get,
        file_delete,
    };
};

/// Per-type worker thread — processes work items sequentially
pub const StoreWorker = struct {
    thread: ?std.Thread,
    queue: std.ArrayList(*WorkItem),
    allocator: Allocator,
    mutex: std.Thread.Mutex,
    cond: std.Thread.Condition,
    running: bool,
    store_type: StoreType,

    pub fn init(allocator: Allocator, store_type: StoreType) StoreWorker {
        return .{
            .thread = null,
            .queue = .{},
            .allocator = allocator,
            .mutex = .{},
            .cond = .{},
            .running = false,
            .store_type = store_type,
        };
    }

    pub fn start(self: *StoreWorker) !void {
        self.running = true;
        self.thread = try std.Thread.spawn(.{}, workerLoop, .{self});
    }

    pub fn stop(self: *StoreWorker) void {
        self.mutex.lock();
        self.running = false;
        self.cond.signal();
        self.mutex.unlock();

        if (self.thread) |t| {
            t.join();
            self.thread = null;
        }
    }

    pub fn submit(self: *StoreWorker, item: *WorkItem) void {
        self.mutex.lock();
        self.queue.append(self.allocator, item) catch {};
        self.cond.signal();
        self.mutex.unlock();
    }

    fn workerLoop(self: *StoreWorker) void {
        while (true) {
            self.mutex.lock();

            while (self.queue.items.len == 0 and self.running) {
                self.cond.wait(&self.mutex);
            }

            if (!self.running and self.queue.items.len == 0) {
                self.mutex.unlock();
                break;
            }

            const item = self.queue.orderedRemove(0);
            self.mutex.unlock();

            if (item.exec_fn) |exec_fn| {
                exec_fn(item.exec_ctx);
            }

            // Signal done
            item.done.set();
        }
    }

    pub fn deinit(self: *StoreWorker) void {
        self.queue.deinit(self.allocator);
    }
};

/// Thread pool — one worker per store type
pub const ThreadPool = struct {
    sql_worker: StoreWorker,
    kv_worker: StoreWorker,
    column_worker: StoreWorker,
    vector_worker: StoreWorker,
    files_worker: StoreWorker,
    graph_worker: StoreWorker,

    pub fn init(allocator: Allocator) ThreadPool {
        return .{
            .sql_worker = StoreWorker.init(allocator, .sql),
            .kv_worker = StoreWorker.init(allocator, .kv),
            .column_worker = StoreWorker.init(allocator, .column),
            .vector_worker = StoreWorker.init(allocator, .vector),
            .files_worker = StoreWorker.init(allocator, .files),
            .graph_worker = StoreWorker.init(allocator, .graph),
        };
    }

    pub fn start(self: *ThreadPool) !void {
        try self.sql_worker.start();
        try self.kv_worker.start();
        try self.column_worker.start();
        try self.vector_worker.start();
        try self.files_worker.start();
        try self.graph_worker.start();
    }

    pub fn stop(self: *ThreadPool) void {
        self.sql_worker.stop();
        self.kv_worker.stop();
        self.column_worker.stop();
        self.vector_worker.stop();
        self.files_worker.stop();
        self.graph_worker.stop();
    }

    pub fn getWorker(self: *ThreadPool, store_type: StoreType) *StoreWorker {
        return switch (store_type) {
            .sql => &self.sql_worker,
            .kv => &self.kv_worker,
            .column => &self.column_worker,
            .vector => &self.vector_worker,
            .files => &self.files_worker,
            .graph => &self.graph_worker,
        };
    }

    pub fn deinit(self: *ThreadPool) void {
        self.sql_worker.deinit();
        self.kv_worker.deinit();
        self.column_worker.deinit();
        self.vector_worker.deinit();
        self.files_worker.deinit();
        self.graph_worker.deinit();
    }
};
