const std = @import("std");

pub const Config = struct {
    allocator: std.mem.Allocator,
    zmq_endpoint: []u8,
    ws_host: []u8,
    ws_port: u16,
    max_control_bytes: usize,
    zimq_lib: []u8,
    qjs_lib: []u8,
    event_policy_path: ?[]u8,
    fluentbit_lib: []u8,
    fluentbit_enabled: bool,
    fluentbit_listen: []u8,
    fluentbit_port: u16,

    pub fn init(allocator: std.mem.Allocator, environ: *const std.process.Environ.Map) !Config {
        const root = environ.get("CONVERGED_ROOT") orelse "/home/alexstorm/distrib/4ir/gestalt/clarity/projects/converged-portal";
        return .{
            .allocator = allocator,
            .zmq_endpoint = try owned(allocator, environ, "FUJIN_ZMQ_BIND", "tcp://0.0.0.0:5557"),
            .ws_host = try owned(allocator, environ, "FUJIN_WS_HOST", "0.0.0.0"),
            .ws_port = try port(environ, "FUJIN_WS_PORT", 8087),
            .max_control_bytes = try number(environ, "FUJIN_MAX_CONTROL_BYTES", 60 * 1024),
            .zimq_lib = try ownedFormat(allocator, environ, "FUJIN_ZIMQ_LIB", "{s}/native/wrapers/zimq/zig-out/lib/libzimq.so", .{root}),
            .qjs_lib = try ownedFormat(allocator, environ, "FUJIN_QJS_LIB", "{s}/native/wrapers/qjs/zig-out/lib/libqjs.so", .{root}),
            .event_policy_path = if (environ.get("FUJIN_EVENT_POLICY")) |value| try allocator.dupe(u8, value) else null,
            .fluentbit_lib = try ownedFormat(allocator, environ, "FUJIN_FLUENTBIT_LIB", "{s}/native/wrapers/fluentbit/zig-out/lib/libfluentbit.so", .{root}),
            .fluentbit_enabled = std.mem.eql(u8, environ.get("FUJIN_FLUENTBIT") orelse "off", "on"),
            .fluentbit_listen = try owned(allocator, environ, "FUJIN_FLUENTBIT_HOST", "127.0.0.1"),
            .fluentbit_port = try port(environ, "FUJIN_FLUENTBIT_PORT", 24224),
        };
    }

    pub fn deinit(self: *Config) void {
        const a = self.allocator;
        a.free(self.zmq_endpoint);
        a.free(self.ws_host);
        a.free(self.zimq_lib);
        a.free(self.qjs_lib);
        if (self.event_policy_path) |path| a.free(path);
        a.free(self.fluentbit_lib);
        a.free(self.fluentbit_listen);
        self.* = undefined;
    }
};

fn owned(a: std.mem.Allocator, env: *const std.process.Environ.Map, key: []const u8, fallback: []const u8) ![]u8 {
    return a.dupe(u8, env.get(key) orelse fallback);
}

fn ownedFormat(a: std.mem.Allocator, env: *const std.process.Environ.Map, key: []const u8, comptime fmt: []const u8, args: anytype) ![]u8 {
    if (env.get(key)) |value| return a.dupe(u8, value);
    return std.fmt.allocPrint(a, fmt, args);
}

fn number(env: *const std.process.Environ.Map, key: []const u8, fallback: usize) !usize {
    return std.fmt.parseInt(usize, env.get(key) orelse return fallback, 10);
}

fn port(env: *const std.process.Environ.Map, key: []const u8, fallback: u16) !u16 {
    return std.fmt.parseInt(u16, env.get(key) orelse return fallback, 10);
}
