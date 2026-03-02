const std = @import("std");
const StorageCommands = @import("commands.zig").StorageCommands;
const Manifest = @import("manifest.zig").Manifest;
const StoreType = @import("manifest.zig").StoreType;
const Telemetry = @import("telemetry.zig").Telemetry;

const Allocator = std.mem.Allocator;
const MaxRequestBytes: usize = 1024 * 1024;
var shutdown_requested = std.atomic.Value(bool).init(false);

const ProcessResult = struct {
    response: []u8,
    shutdown: bool = false,
};

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

        const request = readRequest(client_fd, allocator) catch |err| {
            if (err == error.EndOfStream) continue;
            const err_response = try buildError(allocator, @errorName(err));
            defer allocator.free(err_response);
            writeAll(client_fd, err_response) catch {};
            continue;
        };
        defer allocator.free(request);

        const result = try processRequest(allocator, &commands, request);
        defer allocator.free(result.response);

        try writeAll(client_fd, result.response);
        should_shutdown = result.shutdown;
    }
}

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

            var manifest = Manifest.load(allocator, manifest_path) catch |err| switch (err) {
                error.FileNotFound => continue,
                else => {
                    std.debug.print(
                        "storage autoload skip {s}/{s}: {s}\n",
                        .{ ms_entry.name, store_entry.name, @errorName(err) },
                    );
                    continue;
                },
            };
            const store_type = manifest.store_type;
            manifest.deinit();

            commands.openStore(ms_entry.name, store_entry.name, store_type) catch |err| {
                std.debug.print(
                    "storage autoload failed {s}/{s}: {s}\n",
                    .{ ms_entry.name, store_entry.name, @errorName(err) },
                );
                continue;
            };
            opened += 1;
        }
    }

    std.debug.print("storage autoload complete, opened={d}\n", .{opened});
}

fn ensureSocketParent(socket_path: []const u8) !void {
    if (std.fs.path.dirname(socket_path)) |parent| {
        if (parent.len > 0) try std.fs.cwd().makePath(parent);
    }
}

fn writeAll(fd: std.posix.fd_t, data: []const u8) !void {
    var sent: usize = 0;
    while (sent < data.len) {
        const n = try std.posix.write(fd, data[sent..]);
        if (n == 0) return error.BrokenPipe;
        sent += n;
    }
}

fn readRequest(fd: std.posix.fd_t, allocator: Allocator) ![]u8 {
    var req: std.ArrayList(u8) = .{};
    defer req.deinit(allocator);

    var chunk: [4096]u8 = undefined;
    while (req.items.len < MaxRequestBytes) {
        const n = try std.posix.read(fd, &chunk);
        if (n == 0) break;
        try req.appendSlice(allocator, chunk[0..n]);

        if (std.mem.indexOfScalar(u8, chunk[0..n], '\n') != null) break;
    }

    if (req.items.len == 0) return error.EndOfStream;
    if (req.items.len >= MaxRequestBytes) return error.RequestTooLarge;

    const line_end = std.mem.indexOfScalar(u8, req.items, '\n') orelse req.items.len;
    const line = std.mem.trim(u8, req.items[0..line_end], " \t\r");
    return allocator.dupe(u8, line);
}

fn processRequest(allocator: Allocator, commands: *StorageCommands, request: []const u8) !ProcessResult {
    if (request.len == 0) {
        return .{ .response = try buildError(allocator, "empty request") };
    }

    if (std.mem.eql(u8, request, "ping")) {
        var tel = Telemetry.begin();
        tel.op_count += 1;
        return .{ .response = try buildSuccess(allocator, "{\"message\":\"pong\"}", &tel) };
    }

    if (std.mem.eql(u8, request, "shutdown")) {
        var tel = Telemetry.begin();
        tel.op_count += 1;
        return .{
            .response = try buildSuccess(allocator, "{\"message\":\"shutdown\"}", &tel),
            .shutdown = true,
        };
    }

    const parsed = std.json.parseFromSlice(std.json.Value, allocator, request, .{}) catch {
        return .{ .response = try buildError(allocator, "invalid request json") };
    };
    defer parsed.deinit();

    if (parsed.value != .object) {
        return .{ .response = try buildError(allocator, "request must be a json object") };
    }

    const obj = parsed.value.object;
    const cmd = getString(obj, "cmd") orelse return .{ .response = try buildError(allocator, "missing field: cmd") };

    if (std.mem.eql(u8, cmd, "ping")) {
        var tel = Telemetry.begin();
        tel.op_count += 1;
        return .{ .response = try buildSuccess(allocator, "{\"message\":\"pong\"}", &tel) };
    }

    if (std.mem.eql(u8, cmd, "shutdown")) {
        var tel = Telemetry.begin();
        tel.op_count += 1;
        return .{
            .response = try buildSuccess(allocator, "{\"message\":\"shutdown\"}", &tel),
            .shutdown = true,
        };
    }

    if (std.mem.eql(u8, cmd, "open")) {
        const ms = getString(obj, "ms") orelse return .{ .response = try buildError(allocator, "missing field: ms") };
        const store = getString(obj, "store") orelse return .{ .response = try buildError(allocator, "missing field: store") };
        const type_str = getString(obj, "type") orelse getString(obj, "store_type") orelse
            return .{ .response = try buildError(allocator, "missing field: type") };
        const store_type = StoreType.fromString(type_str) orelse return .{ .response = try buildError(allocator, "unknown type") };

        var tel = Telemetry.begin();
        commands.openStore(ms, store, store_type) catch |err| {
            return .{ .response = try buildErrorName(allocator, "open failed", err) };
        };
        tel.op_count += 1;
        return .{ .response = try buildSuccess(allocator, null, &tel) };
    }

    if (std.mem.eql(u8, cmd, "close")) {
        const key = try resolveStoreKey(allocator, obj);
        defer if (key.owned) allocator.free(key.value);

        var tel = Telemetry.begin();
        commands.closeStore(key.value);
        tel.op_count += 1;
        return .{ .response = try buildSuccess(allocator, null, &tel) };
    }

    if (std.mem.eql(u8, cmd, "exec")) {
        const key = try resolveStoreKey(allocator, obj);
        defer if (key.owned) allocator.free(key.value);
        const sql = getString(obj, "sql") orelse return .{ .response = try buildError(allocator, "missing field: sql") };

        const sql_z = try allocator.dupeZ(u8, sql);
        defer allocator.free(sql_z);

        var tel = Telemetry.begin();
        commands.execSql(key.value, sql_z) catch |err| {
            return .{ .response = try buildErrorName(allocator, "exec failed", err) };
        };
        tel.op_count += 1;
        return .{ .response = try buildSuccess(allocator, null, &tel) };
    }

    if (std.mem.eql(u8, cmd, "query")) {
        const key = try resolveStoreKey(allocator, obj);
        defer if (key.owned) allocator.free(key.value);
        const sql = getString(obj, "sql") orelse return .{ .response = try buildError(allocator, "missing field: sql") };

        const sql_z = try allocator.dupeZ(u8, sql);
        defer allocator.free(sql_z);

        var tel = Telemetry.begin();
        const data = commands.querySql(key.value, sql_z, &tel) catch |err| {
            return .{ .response = try buildErrorName(allocator, "query failed", err) };
        };
        defer allocator.free(data);

        return .{ .response = try buildSuccess(allocator, data, &tel) };
    }

    if (std.mem.eql(u8, cmd, "size")) {
        const key = try resolveStoreKey(allocator, obj);
        defer if (key.owned) allocator.free(key.value);

        var tel = Telemetry.begin();
        const size = commands.getStoreSize(key.value) catch |err| {
            return .{ .response = try buildErrorName(allocator, "size failed", err) };
        };
        tel.op_count += 1;

        const data = try std.fmt.allocPrint(allocator, "{}", .{size});
        defer allocator.free(data);

        return .{ .response = try buildSuccess(allocator, data, &tel) };
    }

    if (std.mem.eql(u8, cmd, "manifest")) {
        const key = try resolveStoreKey(allocator, obj);
        defer if (key.owned) allocator.free(key.value);

        const mfst = commands.getManifest(key.value) orelse return .{ .response = try buildError(allocator, "store not found") };

        var tel = Telemetry.begin();
        tel.op_count += 1;

        var buf: std.ArrayList(u8) = .{};
        defer buf.deinit(allocator);
        const w = buf.writer(allocator);
        try w.print("{{\"name\":\"{s}\",\"type\":\"{s}\",\"migrations\":[", .{ mfst.name, mfst.store_type.toString() });
        for (mfst.migrations.items, 0..) |m, i| {
            if (i > 0) try w.writeByte(',');
            try w.print("\"{s}\"", .{m});
        }
        try w.writeAll("]}");

        const data = try buf.toOwnedSlice(allocator);
        defer allocator.free(data);

        return .{ .response = try buildSuccess(allocator, data, &tel) };
    }

    if (std.mem.eql(u8, cmd, "migrate")) {
        const key = try resolveStoreKey(allocator, obj);
        defer if (key.owned) allocator.free(key.value);
        const migration_id = getString(obj, "migration_id") orelse return .{ .response = try buildError(allocator, "missing field: migration_id") };

        var tel = Telemetry.begin();
        commands.recordMigration(key.value, migration_id) catch |err| {
            return .{ .response = try buildErrorName(allocator, "migrate failed", err) };
        };
        tel.op_count += 1;
        return .{ .response = try buildSuccess(allocator, null, &tel) };
    }

    if (std.mem.eql(u8, cmd, "archive")) {
        const key = try resolveStoreKey(allocator, obj);
        defer if (key.owned) allocator.free(key.value);
        const output_path = getString(obj, "output_path") orelse return .{ .response = try buildError(allocator, "missing field: output_path") };

        var tel = Telemetry.begin();
        commands.createArchive(key.value, output_path) catch |err| {
            return .{ .response = try buildErrorName(allocator, "archive failed", err) };
        };
        tel.op_count += 1;
        return .{ .response = try buildSuccess(allocator, null, &tel) };
    }

    return .{ .response = try buildError(allocator, "unknown command") };
}

fn getString(obj: std.json.ObjectMap, field: []const u8) ?[]const u8 {
    const value = obj.get(field) orelse return null;
    if (value != .string) return null;
    return value.string;
}

const StoreKey = struct {
    value: []const u8,
    owned: bool,
};

fn resolveStoreKey(allocator: Allocator, obj: std.json.ObjectMap) !StoreKey {
    if (getString(obj, "key")) |key| {
        return .{ .value = key, .owned = false };
    }
    const ms = getString(obj, "ms") orelse return error.MissingStoreKey;
    const store = getString(obj, "store") orelse return error.MissingStoreKey;
    return .{
        .value = try std.fmt.allocPrint(allocator, "{s}/{s}", .{ ms, store }),
        .owned = true,
    };
}

fn buildSuccess(allocator: Allocator, data: ?[]const u8, tel: *const Telemetry) ![]u8 {
    var buf: std.ArrayList(u8) = .{};
    errdefer buf.deinit(allocator);
    const w = buf.writer(allocator);

    try w.writeAll("{\"ok\":true");
    if (data) |d| {
        try w.writeAll(",\"data\":");
        try w.writeAll(d);
    }
    try w.writeAll(",\"telemetry\":");
    try tel.writeJson(w);
    try w.writeAll("}\n");

    return buf.toOwnedSlice(allocator);
}

fn buildError(allocator: Allocator, msg: []const u8) ![]u8 {
    return std.fmt.allocPrint(allocator, "{{\"ok\":false,\"error\":\"{s}\"}}\n", .{msg});
}

fn buildErrorName(allocator: Allocator, prefix: []const u8, err: anyerror) ![]u8 {
    return std.fmt.allocPrint(
        allocator,
        "{{\"ok\":false,\"error\":\"{s}: {s}\"}}\n",
        .{ prefix, @errorName(err) },
    );
}
