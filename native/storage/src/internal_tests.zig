const std = @import("std");
const commands_mod = @import("commands.zig");
const manifest_mod = @import("manifest.zig");
const telemetry_mod = @import("telemetry.zig");
const threads_mod = @import("threads.zig");

const StorageCommands = commands_mod.StorageCommands;
const StoreType = manifest_mod.StoreType;
const Telemetry = telemetry_mod.Telemetry;
const ThreadPool = threads_mod.ThreadPool;
const WorkItem = threads_mod.WorkItem;

const Iterations = 120;

const SqlCtx = struct {
    commands: *StorageCommands,
    failed: *std.atomic.Value(bool),
};

const KvCtx = struct {
    commands: *StorageCommands,
    failed: *std.atomic.Value(bool),
};

const FilesCtx = struct {
    commands: *StorageCommands,
    failed: *std.atomic.Value(bool),
};

const BlockCtx = struct {
    entered: std.atomic.Value(bool) = std.atomic.Value(bool).init(false),
    release: std.Thread.ResetEvent = .{},
};

const MarkerCtx = struct {
    done: *std.atomic.Value(bool),
};

fn blockExec(ctx_ptr: ?*anyopaque) void {
    const ctx: *BlockCtx = @ptrCast(@alignCast(ctx_ptr.?));
    ctx.entered.store(true, .seq_cst);
    ctx.release.wait();
}

fn markExec(ctx_ptr: ?*anyopaque) void {
    const ctx: *MarkerCtx = @ptrCast(@alignCast(ctx_ptr.?));
    ctx.done.store(true, .seq_cst);
}

fn prepareDataDir(tmp: *std.testing.TmpDir, path_buf: []u8) ![]const u8 {
    try tmp.dir.makeDir("data");
    return tmp.dir.realpath("data", path_buf);
}

test "open is idempotent and store can close/reopen" {
    var tmp = std.testing.tmpDir(.{});
    defer tmp.cleanup();

    var path_buf: [std.fs.max_path_bytes]u8 = undefined;
    const data_dir = try prepareDataDir(&tmp, &path_buf);

    var commands = StorageCommands.init(std.testing.allocator, data_dir);
    defer commands.deinit();

    try commands.openStore("assistant-ms", "metadata", StoreType.sql);
    try std.testing.expectEqual(@as(usize, 1), commands.stores.count());

    // Same store open must be a no-op.
    try commands.openStore("assistant-ms", "metadata", StoreType.sql);
    try std.testing.expectEqual(@as(usize, 1), commands.stores.count());

    try commands.execSql("assistant-ms/metadata", "CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY, v TEXT)");
    try commands.execSql("assistant-ms/metadata", "INSERT INTO t(id, v) VALUES (1, 'ok')");

    commands.closeStore("assistant-ms/metadata");
    try std.testing.expectEqual(@as(usize, 0), commands.stores.count());
    try std.testing.expectError(error.StoreNotFound, commands.execSql("assistant-ms/metadata", "SELECT 1"));

    try commands.openStore("assistant-ms", "metadata", StoreType.sql);
    var tel = Telemetry.begin();
    const json = try commands.querySql("assistant-ms/metadata", "SELECT COUNT(*) AS count FROM t", &tel);
    defer std.testing.allocator.free(json);
    try std.testing.expect(std.mem.indexOf(u8, json, "\"count\":1") != null);
}

test "error in one store type does not break others" {
    var tmp = std.testing.tmpDir(.{});
    defer tmp.cleanup();

    var path_buf: [std.fs.max_path_bytes]u8 = undefined;
    const data_dir = try prepareDataDir(&tmp, &path_buf);

    var commands = StorageCommands.init(std.testing.allocator, data_dir);
    defer commands.deinit();

    try commands.openStore("sql-ms", "sql", StoreType.sql);
    try commands.openStore("kv-ms", "kv", StoreType.kv);
    try commands.execSql("sql-ms/sql", "CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY, v TEXT)");

    var tel = Telemetry.begin();
    try std.testing.expectError(error.UnsupportedOperation, commands.execSql("kv-ms/kv", "SELECT 1"));
    try std.testing.expectError(error.UnsupportedOperation, commands.kvPut("sql-ms/sql", "k", "v", &tel));

    // KV still operational after sql/kv mismatch errors.
    try commands.kvPut("kv-ms/kv", "k1", "v1", &tel);
    const kv_data = try commands.kvGet("kv-ms/kv", "k1", &tel);
    try std.testing.expect(kv_data != null);
    defer std.testing.allocator.free(kv_data.?);
    try std.testing.expectEqualStrings("v1", kv_data.?);

    // SQL still operational after mismatch errors.
    try commands.execSql("sql-ms/sql", "INSERT INTO t(id, v) VALUES (1, 'ok')");
    const sql_data = try commands.querySql("sql-ms/sql", "SELECT COUNT(*) AS count FROM t", &tel);
    defer std.testing.allocator.free(sql_data);
    try std.testing.expect(std.mem.indexOf(u8, sql_data, "\"count\":1") != null);
}

fn sqlWorker(store_key: []const u8, table_name: []const u8, ctx: *SqlCtx) void {
    var i: usize = 0;
    while (i < Iterations) : (i += 1) {
        var sql_buf: [192]u8 = undefined;
        const stmt = std.fmt.bufPrintZ(
            &sql_buf,
            "INSERT INTO {s}(id, value) VALUES ({d}, 'v-{d}')",
            .{ table_name, i, i },
        ) catch {
            ctx.failed.store(true, .seq_cst);
            return;
        };
        ctx.commands.execSql(store_key, stmt) catch {
            ctx.failed.store(true, .seq_cst);
            return;
        };
    }
}

fn kvWorker(ctx: *KvCtx) void {
    var i: usize = 0;
    while (i < Iterations) : (i += 1) {
        var key_buf: [64]u8 = undefined;
        var val_buf: [64]u8 = undefined;
        const key = std.fmt.bufPrint(&key_buf, "k-{d}", .{i}) catch {
            ctx.failed.store(true, .seq_cst);
            return;
        };
        const value = std.fmt.bufPrint(&val_buf, "v-{d}", .{i}) catch {
            ctx.failed.store(true, .seq_cst);
            return;
        };

        var tel = Telemetry.begin();
        ctx.commands.kvPut("kv-ms/kv", key, value, &tel) catch {
            ctx.failed.store(true, .seq_cst);
            return;
        };

        const got = ctx.commands.kvGet("kv-ms/kv", key, &tel) catch {
            ctx.failed.store(true, .seq_cst);
            return;
        };
        if (got) |data| {
            defer std.testing.allocator.free(data);
            if (!std.mem.eql(u8, data, value)) {
                ctx.failed.store(true, .seq_cst);
                return;
            }
        } else {
            ctx.failed.store(true, .seq_cst);
            return;
        }
    }
}

fn filesWorker(ctx: *FilesCtx) void {
    var i: usize = 0;
    while (i < Iterations) : (i += 1) {
        var key_buf: [64]u8 = undefined;
        var val_buf: [64]u8 = undefined;
        const key = std.fmt.bufPrint(&key_buf, "f-{d}.txt", .{i}) catch {
            ctx.failed.store(true, .seq_cst);
            return;
        };
        const value = std.fmt.bufPrint(&val_buf, "blob-{d}", .{i}) catch {
            ctx.failed.store(true, .seq_cst);
            return;
        };

        var tel = Telemetry.begin();
        ctx.commands.filePut("files-ms/files", key, value, &tel) catch {
            ctx.failed.store(true, .seq_cst);
            return;
        };

        const got = ctx.commands.fileGet("files-ms/files", key, &tel) catch {
            ctx.failed.store(true, .seq_cst);
            return;
        };
        if (got) |data| {
            defer std.testing.allocator.free(data);
            if (!std.mem.eql(u8, data, value)) {
                ctx.failed.store(true, .seq_cst);
                return;
            }
        } else {
            ctx.failed.store(true, .seq_cst);
            return;
        }
    }
}

test "store controllers process sql/kv/vector/files independently across threads" {
    var tmp = std.testing.tmpDir(.{});
    defer tmp.cleanup();

    try tmp.dir.makeDir("data");
    var path_buf: [std.fs.max_path_bytes]u8 = undefined;
    const data_dir = try tmp.dir.realpath("data", &path_buf);

    var commands = StorageCommands.init(std.testing.allocator, data_dir);
    defer commands.deinit();

    try commands.openStore("sql-ms", "sql", StoreType.sql);
    try commands.openStore("kv-ms", "kv", StoreType.kv);
    try commands.openStore("vec-ms", "vec", StoreType.vector);
    try commands.openStore("files-ms", "files", StoreType.files);

    try commands.execSql("sql-ms/sql", "CREATE TABLE IF NOT EXISTS t_sql (id INTEGER PRIMARY KEY, value TEXT)");
    try commands.execSql("vec-ms/vec", "CREATE TABLE IF NOT EXISTS t_vec (id INTEGER PRIMARY KEY, value TEXT)");

    var failed = std.atomic.Value(bool).init(false);

    var sql_ctx = SqlCtx{ .commands = &commands, .failed = &failed };
    var vec_ctx = SqlCtx{ .commands = &commands, .failed = &failed };
    var kv_ctx = KvCtx{ .commands = &commands, .failed = &failed };
    var files_ctx = FilesCtx{ .commands = &commands, .failed = &failed };

    const sql_thread = try std.Thread.spawn(.{}, sqlWorker, .{"sql-ms/sql", "t_sql", &sql_ctx});
    const vec_thread = try std.Thread.spawn(.{}, sqlWorker, .{"vec-ms/vec", "t_vec", &vec_ctx});
    const kv_thread = try std.Thread.spawn(.{}, kvWorker, .{&kv_ctx});
    const files_thread = try std.Thread.spawn(.{}, filesWorker, .{&files_ctx});

    sql_thread.join();
    vec_thread.join();
    kv_thread.join();
    files_thread.join();

    try std.testing.expect(!failed.load(.seq_cst));

    var tel = Telemetry.begin();
    const sql_json = try commands.querySql("sql-ms/sql", "SELECT COUNT(*) as count FROM t_sql", &tel);
    defer std.testing.allocator.free(sql_json);
    try std.testing.expect(std.mem.indexOf(u8, sql_json, "\"count\":120") != null);

    const vec_json = try commands.querySql("vec-ms/vec", "SELECT COUNT(*) as count FROM t_vec", &tel);
    defer std.testing.allocator.free(vec_json);
    try std.testing.expect(std.mem.indexOf(u8, vec_json, "\"count\":120") != null);
}

test "thread pool keeps store-type workers isolated" {
    var pool = ThreadPool.init(std.testing.allocator);
    defer pool.deinit();
    try pool.start();
    defer pool.stop();

    var blocker = BlockCtx{};
    var sql_item = WorkItem{
        .store_key = "sql-ms/sql",
        .op = .exec_sql,
        .payload = &[_]u8{},
        .result = null,
        .done = .{},
        .err = null,
        .exec_ctx = &blocker,
        .exec_fn = blockExec,
    };
    pool.getWorker(.sql).submit(&sql_item);

    const enter_deadline_ms = 500;
    var waited_ms: usize = 0;
    while (!blocker.entered.load(.seq_cst) and waited_ms < enter_deadline_ms) : (waited_ms += 1) {
        std.Thread.sleep(std.time.ns_per_ms);
    }
    try std.testing.expect(blocker.entered.load(.seq_cst));

    var kv_done = std.atomic.Value(bool).init(false);
    var marker = MarkerCtx{ .done = &kv_done };
    var kv_item = WorkItem{
        .store_key = "kv-ms/kv",
        .op = .kv_get,
        .payload = &[_]u8{},
        .result = null,
        .done = .{},
        .err = null,
        .exec_ctx = &marker,
        .exec_fn = markExec,
    };
    pool.getWorker(.kv).submit(&kv_item);

    try kv_item.done.timedWait(200 * std.time.ns_per_ms);
    try std.testing.expect(kv_done.load(.seq_cst));
    try std.testing.expect(!sql_item.done.isSet());

    blocker.release.set();
    try sql_item.done.timedWait(200 * std.time.ns_per_ms);
    try std.testing.expect(sql_item.done.isSet());
}
