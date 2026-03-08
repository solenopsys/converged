const std = @import("std");
const commands = @import("commands.zig");
const manifest_mod = @import("manifest.zig");
const build_options = @import("build_options");
const StoreType = manifest_mod.StoreType;
const Telemetry = @import("telemetry.zig").Telemetry;
const StorageCommands = commands.StorageCommands;
const with_transport = build_options.with_transport;
const c = if (with_transport) @cImport(@cInclude("transport.h")) else struct {};
const server = if (with_transport) @import("server.zig") else struct {
    pub const BindConfig = union(enum) {
        unix: []const u8,
        tcp: struct { host: []const u8, port: u16 },
    };
    pub fn start(_: std.mem.Allocator, _: []const u8, _: BindConfig) !void {
        return error.TransportDisabled;
    }
};
const health_checker = if (with_transport) struct {
    fn run(allocator: std.mem.Allocator, bind_cfg: server.BindConfig, timeout_ms: u32) !bool {
        const fd: std.posix.fd_t = switch (bind_cfg) {
            .unix => |path| connectUnixSocket(path, timeout_ms) catch return false,
            .tcp => |tcp| connectTcpSocket(tcp.host, tcp.port, timeout_ms) catch return false,
        };
        defer std.posix.close(fd);

        const req = c.transport_req_ping() orelse return false;
        defer c.transport_req_free(req);

        var out_buf: ?[*]u8 = null;
        var out_len: usize = 0;
        if (c.transport_req_encode(req, @ptrCast(&out_buf), &out_len) != 0) return false;
        const raw = out_buf orelse return false;
        defer c.transport_free_buf(raw, out_len);
        sendFramed(fd, raw[0..out_len]) catch return false;

        const resp_msg = recvFramed(fd, allocator) catch return false;
        defer allocator.free(resp_msg);
        const resp = c.transport_resp_decode(resp_msg.ptr, resp_msg.len) orelse return false;
        defer c.transport_resp_free(resp);

        return c.transport_resp_ok(resp) == 1;
    }
} else struct {
    fn run(_: std.mem.Allocator, _: server.BindConfig, _: u32) !bool {
        return error.TransportDisabled;
    }
};

const max_probe_message_size: u32 = 64 * 1024 * 1024;

fn setSocketTimeout(fd: std.posix.fd_t, timeout_ms: u32) !void {
    var tv = std.posix.timeval{
        .sec = @intCast(timeout_ms / 1000),
        .usec = @intCast((timeout_ms % 1000) * 1000),
    };
    const opt = std.mem.asBytes(&tv);
    try std.posix.setsockopt(fd, std.posix.SOL.SOCKET, std.posix.SO.RCVTIMEO, opt);
    try std.posix.setsockopt(fd, std.posix.SOL.SOCKET, std.posix.SO.SNDTIMEO, opt);
}

fn connectUnixSocket(path: []const u8, timeout_ms: u32) !std.posix.fd_t {
    const fd = try std.posix.socket(std.posix.AF.UNIX, std.posix.SOCK.STREAM, 0);
    errdefer std.posix.close(fd);

    var addr: std.posix.sockaddr.un = std.mem.zeroes(std.posix.sockaddr.un);
    addr.family = std.posix.AF.UNIX;
    if (path.len + 1 > addr.path.len) return error.SocketPathTooLong;
    @memcpy(addr.path[0..path.len], path);
    addr.path[path.len] = 0;

    try std.posix.connect(fd, @ptrCast(&addr), @sizeOf(std.posix.sockaddr.un));
    try setSocketTimeout(fd, timeout_ms);
    return fd;
}

fn connectTcpSocket(host: []const u8, port: u16, timeout_ms: u32) !std.posix.fd_t {
    const fd = try std.posix.socket(std.posix.AF.INET, std.posix.SOCK.STREAM, std.posix.IPPROTO.TCP);
    errdefer std.posix.close(fd);

    const ip4 = try std.net.Address.parseIp4(host, port);
    try std.posix.connect(fd, &ip4.any, ip4.getOsSockLen());
    try setSocketTimeout(fd, timeout_ms);
    return fd;
}

fn sendFramed(fd: std.posix.fd_t, payload: []const u8) !void {
    if (payload.len > max_probe_message_size) return error.MessageTooLarge;
    var len_buf: [4]u8 = undefined;
    std.mem.writeInt(u32, &len_buf, @intCast(payload.len), .little);
    try writeAll(fd, &len_buf);
    try writeAll(fd, payload);
}

fn recvFramed(fd: std.posix.fd_t, allocator: std.mem.Allocator) ![]u8 {
    var len_buf: [4]u8 = undefined;
    try readAll(fd, &len_buf);
    const len = std.mem.readInt(u32, &len_buf, .little);
    if (len > max_probe_message_size) return error.MessageTooLarge;
    const payload = try allocator.alloc(u8, len);
    errdefer allocator.free(payload);
    try readAll(fd, payload);
    return payload;
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
    if (std.mem.eql(u8, cmd, "health")) {
        if (!with_transport) {
            printError("health is disabled in this build (transport=false)");
            std.process.exit(1);
        }
        const bind_cfg = getBindConfig(allocator, args, data_dir) catch |err| {
            printErrorName("health failed", err);
            std.process.exit(1);
        };
        defer switch (bind_cfg) {
            .unix => |p| allocator.free(p),
            .tcp  => |t| allocator.free(t.host),
        };
        const timeout_ms = getHealthTimeoutMs(args) catch |err| {
            printErrorName("health failed", err);
            std.process.exit(1);
        };
        const healthy = health_checker.run(allocator, bind_cfg, timeout_ms) catch |err| {
            printErrorName("health failed", err);
            std.process.exit(1);
        };
        if (!healthy) {
            printError("health failed");
            std.process.exit(1);
        }

        var tel = Telemetry.begin();
        tel.op_count += 1;
        printJson(allocator, true, null, &tel);
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

fn getHealthTimeoutMs(args: []const []const u8) !u32 {
    for (args, 0..) |arg, i| {
        if (std.mem.eql(u8, arg, "--timeout-ms") and i + 1 < args.len) {
            const timeout = std.fmt.parseUnsigned(u32, args[i + 1], 10) catch return error.InvalidTimeoutMs;
            if (timeout == 0) return error.InvalidTimeoutMs;
            return timeout;
        }
    }
    return 1000;
}

fn printUsage() void {
    if (with_transport) {
        std.debug.print(
            \\storage - native storage engine
            \\
            \\usage: storage <command> [args...] [--data-dir <path>]
            \\       storage start [--data-dir <path>] [--socket <path>|--tcp <host>:<port>]
            \\       storage health [--socket <path>|--tcp <host>:<port>] [--timeout-ms <ms>]
            \\
            \\commands:
            \\  start                                  (unix socket json server)
            \\  health                                 (transport ping probe)
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
