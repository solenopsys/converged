const std = @import("std");
const commands = @import("commands.zig");
const manifest_mod = @import("manifest.zig");
const build_options = @import("build_options");
const StoreType = manifest_mod.StoreType;
const Telemetry = @import("telemetry.zig").Telemetry;
const StorageCommands = commands.StorageCommands;
const with_transport = build_options.with_transport;
const server = if (with_transport) @import("server.zig") else struct {
    pub const BindConfig = union(enum) {
        unix: []const u8,
        tcp: struct { host: []const u8, port: u16 },
    };
    pub fn start(_: std.mem.Allocator, _: []const u8, _: BindConfig) !void {
        return error.TransportDisabled;
    }
};

comptime {
    if (@import("builtin").is_test) {
        _ = @import("internal_tests.zig");
    }
}

fn writeStdout(data: []const u8) void {
    _ = std.posix.write(std.posix.STDOUT_FILENO, data) catch {};
}

fn printJson(allocator: std.mem.Allocator, ok: bool, data: ?[]const u8, tel: *const Telemetry) void {
    var buf: std.ArrayList(u8) = .{};
    defer buf.deinit(allocator);
    const w = buf.writer(allocator);

    if (ok) {
        w.writeAll("{\"ok\":true") catch return;
    } else {
        w.writeAll("{\"ok\":false") catch return;
    }
    if (data) |d| {
        w.writeAll(",\"data\":") catch return;
        w.writeAll(d) catch return;
    }
    w.writeAll(",\"telemetry\":") catch return;
    tel.writeJson(w) catch return;
    w.writeAll("}\n") catch return;

    writeStdout(buf.items);
}

fn printError(msg: []const u8) void {
    std.debug.print("{{\"ok\":false,\"error\":\"{s}\"}}\n", .{msg});
}

fn printErrorName(prefix: []const u8, err: anyerror) void {
    std.debug.print("{{\"ok\":false,\"error\":\"{s}: {s}\"}}\n", .{ prefix, @errorName(err) });
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const args = try std.process.argsAlloc(allocator);
    defer std.process.argsFree(allocator, args);

    if (args.len < 2) {
        printUsage();
        return;
    }

    const data_dir = getDataDir(args);
    var cmds = StorageCommands.init(allocator, data_dir);
    defer cmds.deinit();

    const cmd = args[1];

    if (std.mem.eql(u8, cmd, "start")) {
        if (!with_transport) {
            printError("start is disabled in this build (transport=false)");
            return;
        }
        const bind_cfg = try getBindConfig(allocator, args, data_dir);
        defer switch (bind_cfg) {
            .unix => |p| allocator.free(p),
            .tcp  => |t| allocator.free(t.host),
        };
        try server.start(allocator, data_dir, bind_cfg);
        return;
    }

    if (std.mem.eql(u8, cmd, "open")) {
        if (args.len < 5) return printError("usage: open <ms> <store> <type>");
        const store_type = StoreType.fromString(args[4]) orelse return printError("unknown type");
        var tel = Telemetry.begin();
        cmds.openStore(args[2], args[3], store_type) catch |err|
            return printErrorName("open failed", err);
        tel.op_count += 1;
        printJson(allocator, true, null, &tel);
    } else if (std.mem.eql(u8, cmd, "close")) {
        if (args.len < 4) return printError("usage: close <ms> <store>");
        var tel = Telemetry.begin();
        const key = try std.fmt.allocPrint(allocator, "{s}/{s}", .{ args[2], args[3] });
        defer allocator.free(key);
        cmds.closeStore(key);
        tel.op_count += 1;
        printJson(allocator, true, null, &tel);
    } else if (std.mem.eql(u8, cmd, "exec")) {
        if (args.len < 4) return printError("usage: exec <ms/store> <sql>");
        var tel = Telemetry.begin();
        const sql_z = try allocator.dupeZ(u8, args[3]);
        defer allocator.free(sql_z);
        cmds.execSql(args[2], sql_z) catch |err|
            return printErrorName("exec failed", err);
        tel.op_count += 1;
        printJson(allocator, true, null, &tel);
    } else if (std.mem.eql(u8, cmd, "query")) {
        if (args.len < 4) return printError("usage: query <ms/store> <sql>");
        var tel = Telemetry.begin();
        const sql_z = try allocator.dupeZ(u8, args[3]);
        defer allocator.free(sql_z);
        const data = cmds.querySql(args[2], sql_z, &tel) catch |err|
            return printErrorName("query failed", err);
        defer allocator.free(data);
        printJson(allocator, true, data, &tel);
    } else if (std.mem.eql(u8, cmd, "size")) {
        if (args.len < 3) return printError("usage: size <ms/store>");
        var tel = Telemetry.begin();
        const size = cmds.getStoreSize(args[2]) catch |err|
            return printErrorName("size failed", err);
        tel.op_count += 1;
        const data = try std.fmt.allocPrint(allocator, "{}", .{size});
        defer allocator.free(data);
        printJson(allocator, true, data, &tel);
    } else if (std.mem.eql(u8, cmd, "manifest")) {
        if (args.len < 3) return printError("usage: manifest <ms/store>");
        if (cmds.getManifest(args[2])) |mfst| {
            var tel = Telemetry.begin();
            tel.op_count += 1;

            var buf: std.ArrayList(u8) = .{};
            errdefer buf.deinit(allocator);
            const w = buf.writer(allocator);
            w.print("{{\"name\":\"{s}\",\"type\":\"{s}\",\"migrations\":[", .{ mfst.name, mfst.store_type.toString() }) catch return;
            for (mfst.migrations.items, 0..) |m, i| {
                if (i > 0) w.writeByte(',') catch return;
                w.print("\"{s}\"", .{m}) catch return;
            }
            w.writeAll("]}") catch return;
            const data = buf.toOwnedSlice(allocator) catch null;
            defer if (data) |d| allocator.free(d);
            printJson(allocator, true, data, &tel);
        } else {
            return printError("store not found");
        }
    } else if (std.mem.eql(u8, cmd, "migrate")) {
        if (args.len < 4) return printError("usage: migrate <ms/store> <migration_id>");
        var tel = Telemetry.begin();
        cmds.recordMigration(args[2], args[3]) catch |err|
            return printErrorName("migrate failed", err);
        tel.op_count += 1;
        printJson(allocator, true, null, &tel);
    } else if (std.mem.eql(u8, cmd, "archive")) {
        if (args.len < 4) return printError("usage: archive <ms/store> <output_path>");
        var tel = Telemetry.begin();
        cmds.createArchive(args[2], args[3]) catch |err|
            return printErrorName("archive failed", err);
        tel.op_count += 1;
        printJson(allocator, true, null, &tel);
    } else {
        printUsage();
    }
}

fn getDataDir(args: []const []const u8) []const u8 {
    for (args, 0..) |arg, i| {
        if (std.mem.eql(u8, arg, "--data-dir") and i + 1 < args.len) {
            return args[i + 1];
        }
    }
    return std.posix.getenv("DATA_DIR") orelse "./data";
}

fn getBindConfig(allocator: std.mem.Allocator, args: []const []const u8, data_dir: []const u8) !server.BindConfig {
    for (args, 0..) |arg, i| {
        if (std.mem.eql(u8, arg, "--socket") and i + 1 < args.len) {
            return .{ .unix = try allocator.dupe(u8, args[i + 1]) };
        }
        if (std.mem.eql(u8, arg, "--tcp") and i + 1 < args.len) {
            const addr = args[i + 1];
            const colon = std.mem.lastIndexOf(u8, addr, ":") orelse return error.InvalidTcpAddress;
            const host = try allocator.dupe(u8, addr[0..colon]);
            const port = std.fmt.parseUnsigned(u16, addr[colon + 1 ..], 10) catch return error.InvalidTcpPort;
            return .{ .tcp = .{ .host = host, .port = port } };
        }
    }
    return .{ .unix = try std.fmt.allocPrint(allocator, "{s}/storage.sock", .{data_dir}) };
}

fn printUsage() void {
    if (with_transport) {
        std.debug.print(
            \\storage - native storage engine
            \\
            \\usage: storage <command> [args...] [--data-dir <path>]
            \\       storage start [--data-dir <path>] [--socket <path>|--tcp <host>:<port>]
            \\
            \\commands:
            \\  start                                  (unix socket json server)
            \\  open <ms> <store> <SQL|KEY_VALUE|COLUMN|VECTOR|FILES>
            \\  close <ms> <store>
            \\  exec <ms/store> <sql>
            \\  query <ms/store> <sql>
            \\  size <ms/store>
            \\  manifest <ms/store>
            \\  migrate <ms/store> <migration_id>
            \\  archive <ms/store> <output_path>
            \\
        , .{});
    } else {
        std.debug.print(
            \\storage - native storage engine
            \\
            \\usage: storage <command> [args...] [--data-dir <path>]
            \\
            \\commands:
            \\  open <ms> <store> <SQL|KEY_VALUE|COLUMN|VECTOR|FILES>
            \\  close <ms> <store>
            \\  exec <ms/store> <sql>
            \\  query <ms/store> <sql>
            \\  size <ms/store>
            \\  manifest <ms/store>
            \\  migrate <ms/store> <migration_id>
            \\  archive <ms/store> <output_path>
            \\
        , .{});
    }
}
