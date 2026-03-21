const std = @import("std");
const Allocator = std.mem.Allocator;
const Telemetry = @import("../telemetry.zig").Telemetry;

const RyuState = enum(c_int) {
    RyuSuccess = 0,
    RyuError = 1,
};

const RyuSystemConfig = extern struct {
    buffer_pool_size: u64,
    max_num_threads: u64,
    enable_compression: bool,
    read_only: bool,
    max_db_size: u64,
    auto_checkpoint: bool,
    checkpoint_threshold: u64,
};

const RyuDatabase = extern struct {
    _database: ?*anyopaque,
};

const RyuConnection = extern struct {
    _connection: ?*anyopaque,
};

const RyuQueryResult = extern struct {
    _query_result: ?*anyopaque,
    _is_owned_by_cpp: bool,
};

const FnDefaultSystemConfig = *const fn () callconv(.c) RyuSystemConfig;
const FnDatabaseInit = *const fn ([*:0]const u8, RyuSystemConfig, *RyuDatabase) callconv(.c) RyuState;
const FnDatabaseDestroy = *const fn (*RyuDatabase) callconv(.c) void;
const FnConnectionInit = *const fn (*RyuDatabase, *RyuConnection) callconv(.c) RyuState;
const FnConnectionDestroy = *const fn (*RyuConnection) callconv(.c) void;
const FnConnectionQuery = *const fn (*RyuConnection, [*:0]const u8, *RyuQueryResult) callconv(.c) RyuState;
const FnQueryResultDestroy = *const fn (*RyuQueryResult) callconv(.c) void;
const FnQueryResultIsSuccess = *const fn (*RyuQueryResult) callconv(.c) bool;
const FnQueryResultGetErrorMessage = *const fn (*RyuQueryResult) callconv(.c) ?[*:0]u8;
const FnQueryResultToString = *const fn (*RyuQueryResult) callconv(.c) ?[*:0]u8;
const FnDestroyString = *const fn ([*:0]u8) callconv(.c) void;

const RyuApi = struct {
    default_system_config: FnDefaultSystemConfig,
    database_init: FnDatabaseInit,
    database_destroy: FnDatabaseDestroy,
    connection_init: FnConnectionInit,
    connection_destroy: FnConnectionDestroy,
    connection_query: FnConnectionQuery,
    query_result_destroy: FnQueryResultDestroy,
    query_result_is_success: FnQueryResultIsSuccess,
    query_result_get_error_message: FnQueryResultGetErrorMessage,
    query_result_to_string: FnQueryResultToString,
    destroy_string: FnDestroyString,
};

const default_lib_paths = [_][]const u8{
    "../wrapers/ryugraph/zig-out/lib/libryugraph.so",
    "../wrapers/ryugraph/zig-out/lib/libryugraph-x86_64-gnu.so",
    "../wrapers/ryugraph/zig-out/lib/libryugraph-x86_64-musl.so",
    "../wrapers/ryugraph/zig-out/lib/libryugraph-aarch64-gnu.so",
    "../wrapers/ryugraph/zig-out/lib/libryugraph-aarch64-musl.so",
};

pub const GraphEngine = struct {
    lib: ?std.DynLib,
    api: ?RyuApi,
    db: RyuDatabase,
    conn: RyuConnection,
    path: [:0]const u8,
    allocator: Allocator,

    pub fn init(allocator: Allocator, path: [:0]const u8) GraphEngine {
        return .{
            .lib = null,
            .api = null,
            .db = .{ ._database = null },
            .conn = .{ ._connection = null },
            .path = path,
            .allocator = allocator,
        };
    }

    pub fn open(self: *GraphEngine) !void {
        if (self.api != null) return;

        const db_path = self.path[0..self.path.len];
        if (std.fs.path.dirname(db_path)) |parent| {
            if (parent.len != 0) try std.fs.cwd().makePath(parent);
        }

        var lib = try openRyuLib();
        errdefer lib.close();

        const api = try loadApi(&lib);
        errdefer lib.close();

        var config = api.default_system_config();
        config.read_only = false;

        var db = RyuDatabase{ ._database = null };
        if (api.database_init(self.path.ptr, config, &db) != .RyuSuccess) {
            return error.GraphOpenFailed;
        }
        errdefer api.database_destroy(&db);

        var conn = RyuConnection{ ._connection = null };
        if (api.connection_init(&db, &conn) != .RyuSuccess) {
            return error.GraphConnectionInitFailed;
        }
        errdefer api.connection_destroy(&conn);

        self.lib = lib;
        self.api = api;
        self.db = db;
        self.conn = conn;
    }

    pub fn close(self: *GraphEngine) void {
        const api = self.api orelse return;
        api.connection_destroy(&self.conn);
        api.database_destroy(&self.db);
        self.conn = .{ ._connection = null };
        self.db = .{ ._database = null };
        if (self.lib) |*lib| {
            lib.close();
        }
        self.lib = null;
        self.api = null;
    }

    pub fn execSql(self: *GraphEngine, query: [*:0]const u8) !void {
        const api = self.api orelse return error.NotOpen;
        var result = RyuQueryResult{ ._query_result = null, ._is_owned_by_cpp = false };

        if (api.connection_query(&self.conn, query, &result) != .RyuSuccess) {
            return error.GraphQueryFailed;
        }
        defer api.query_result_destroy(&result);

        if (!api.query_result_is_success(&result)) {
            logQueryError(api, &result);
            return error.GraphQueryFailed;
        }
    }

    pub fn queryJson(self: *GraphEngine, allocator: Allocator, query: [*:0]const u8, tel: *Telemetry) ![]u8 {
        const api = self.api orelse return error.NotOpen;
        var result = RyuQueryResult{ ._query_result = null, ._is_owned_by_cpp = false };

        if (api.connection_query(&self.conn, query, &result) != .RyuSuccess) {
            return error.GraphQueryFailed;
        }
        defer api.query_result_destroy(&result);

        if (!api.query_result_is_success(&result)) {
            logQueryError(api, &result);
            return error.GraphQueryFailed;
        }

        const raw_ptr = api.query_result_to_string(&result) orelse return error.GraphQueryFailed;
        defer api.destroy_string(raw_ptr);
        const raw = std.mem.span(raw_ptr);

        var out: std.ArrayList(u8) = .{};
        errdefer out.deinit(allocator);
        const writer = out.writer(allocator);
        try writer.writeAll("[{\"graph\":\"");
        try writeJsonEscaped(writer, raw);
        try writer.writeAll("\"}]");

        tel.addRead(out.items.len);
        tel.op_count += 1;
        return out.toOwnedSlice(allocator);
    }

    pub fn getSize(self: *GraphEngine) !u64 {
        const db_path = self.path[0..self.path.len];
        if (std.fs.cwd().statFile(db_path)) |st| {
            return st.size;
        } else |_| {}

        var total: u64 = 0;
        var dir = std.fs.cwd().openDir(self.path, .{ .iterate = true }) catch return 0;
        defer dir.close();

        var walker = try dir.walk(self.allocator);
        defer walker.deinit();

        while (try walker.next()) |entry| {
            if (entry.kind != .file) continue;
            const stat = try dir.statFile(entry.path);
            total += stat.size;
        }
        return total;
    }
};

fn openRyuLib() !std.DynLib {
    if (std.posix.getenv("RYUGRAPH_LIBRARY_PATH")) |path_z| {
        if (path_z.len != 0) return std.DynLib.open(path_z);
    }

    for (default_lib_paths) |path| {
        const lib = std.DynLib.open(path) catch continue;
        return lib;
    }

    return error.RyuLibraryNotFound;
}

fn loadApi(lib: *std.DynLib) !RyuApi {
    return .{
        .default_system_config = lib.lookup(FnDefaultSystemConfig, "ryu_default_system_config") orelse return error.RyuSymbolMissing,
        .database_init = lib.lookup(FnDatabaseInit, "ryu_database_init") orelse return error.RyuSymbolMissing,
        .database_destroy = lib.lookup(FnDatabaseDestroy, "ryu_database_destroy") orelse return error.RyuSymbolMissing,
        .connection_init = lib.lookup(FnConnectionInit, "ryu_connection_init") orelse return error.RyuSymbolMissing,
        .connection_destroy = lib.lookup(FnConnectionDestroy, "ryu_connection_destroy") orelse return error.RyuSymbolMissing,
        .connection_query = lib.lookup(FnConnectionQuery, "ryu_connection_query") orelse return error.RyuSymbolMissing,
        .query_result_destroy = lib.lookup(FnQueryResultDestroy, "ryu_query_result_destroy") orelse return error.RyuSymbolMissing,
        .query_result_is_success = lib.lookup(FnQueryResultIsSuccess, "ryu_query_result_is_success") orelse return error.RyuSymbolMissing,
        .query_result_get_error_message = lib.lookup(FnQueryResultGetErrorMessage, "ryu_query_result_get_error_message") orelse return error.RyuSymbolMissing,
        .query_result_to_string = lib.lookup(FnQueryResultToString, "ryu_query_result_to_string") orelse return error.RyuSymbolMissing,
        .destroy_string = lib.lookup(FnDestroyString, "ryu_destroy_string") orelse return error.RyuSymbolMissing,
    };
}

fn logQueryError(api: RyuApi, result: *RyuQueryResult) void {
    const msg_ptr = api.query_result_get_error_message(result) orelse return;
    defer api.destroy_string(msg_ptr);
    const msg = std.mem.span(msg_ptr);
    std.debug.print("graph query failed: {s}\n", .{msg});
}

fn writeJsonEscaped(writer: anytype, s: []const u8) !void {
    for (s) |ch| {
        switch (ch) {
            '"' => try writer.writeAll("\\\""),
            '\\' => try writer.writeAll("\\\\"),
            '\n' => try writer.writeAll("\\n"),
            '\r' => try writer.writeAll("\\r"),
            '\t' => try writer.writeAll("\\t"),
            else => {
                if (ch < 0x20) {
                    try writer.print("\\u{x:0>4}", .{ch});
                } else {
                    try writer.writeByte(ch);
                }
            },
        }
    }
}
