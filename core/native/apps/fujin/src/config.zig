const std = @import("std");
const transport = @import("transport");

pub const AccessMode = enum { off, audit, required };

pub const JwtConfig = struct {
    allocator: std.mem.Allocator,
    mode: AccessMode,
    issuer: []u8,
    audience: []u8,
    key_set: ?transport.auth.jwks.KeySet,

    pub fn verifierConfig(self: *const JwtConfig) ?transport.auth.jwt.Config {
        const key_set = self.key_set orelse return null;
        return .{ .issuer = self.issuer, .audience = self.audience, .keys = key_set.keys };
    }

    pub fn deinit(self: *JwtConfig) void {
        self.allocator.free(self.issuer);
        self.allocator.free(self.audience);
        if (self.key_set) |*key_set| key_set.deinit(self.allocator);
        self.* = undefined;
    }
};

pub const Config = struct {
    allocator: std.mem.Allocator,
    zmq_endpoint: []u8,
    ws_host: []u8,
    ws_port: u16,
    /// Browser WebSocket handshakes cannot attach the x-storage-scope header.
    /// This is an explicit deployment setting, never inferred from Origin/Host.
    browser_scope: []u8,
    /// Ring size of the protected admin journal. The requested NRPC limit can
    /// never exceed it. Reads walk only the requested tail, so depth here costs
    /// memory (a few hundred bytes per entry), not response time.
    journal_capacity: usize,
    max_control_bytes: usize,
    max_payload_bytes: usize,
    qjs_lib: []u8,
    event_policy_path: ?[]u8,
    fluentbit_lib: []u8,
    fluentbit_enabled: bool,
    fluentbit_listen: []u8,
    fluentbit_port: u16,
    debug: bool,
    trace_packets: bool,
    jwt: JwtConfig,

    pub fn init(allocator: std.mem.Allocator, environ: *const std.process.Environ.Map) !Config {
        const root = environ.get("CONVERGED_ROOT") orelse "/home/alexstorm/distrib/4ir/gestalt/clarity/projects/converged-portal";
        var jwt = try initJwtConfig(allocator, environ);
        errdefer jwt.deinit();
        return .{
            .allocator = allocator,
            .zmq_endpoint = try owned(allocator, environ, "FUJIN_ZMQ_BIND", "tcp://0.0.0.0:5557"),
            .ws_host = try owned(allocator, environ, "FUJIN_WS_HOST", "0.0.0.0"),
            .ws_port = try port(environ, "FUJIN_WS_PORT", 8087),
            .browser_scope = try requiredOwned(allocator, environ, "FUJIN_BROWSER_SCOPE"),
            .journal_capacity = try positive(environ, "FUJIN_JOURNAL_CAPACITY", 4096),
            .max_control_bytes = try number(environ, "FUJIN_MAX_CONTROL_BYTES", 60 * 1024),
            .max_payload_bytes = try number(environ, "FUJIN_MAX_PAYLOAD_BYTES", 16 * 1024 * 1024),
            .qjs_lib = try ownedFormat(allocator, environ, "FUJIN_QJS_LIB", "{s}/native/wrapers/qjs/zig-out/lib/libqjs.so", .{root}),
            .event_policy_path = if (environ.get("FUJIN_EVENT_POLICY")) |value| try allocator.dupe(u8, value) else null,
            .fluentbit_lib = try ownedFormat(allocator, environ, "FUJIN_FLUENTBIT_LIB", "{s}/native/wrapers/fluentbit/zig-out/lib/libfluentbit.so", .{root}),
            .fluentbit_enabled = std.mem.eql(u8, environ.get("FUJIN_FLUENTBIT") orelse "off", "on"),
            .fluentbit_listen = try owned(allocator, environ, "FUJIN_FLUENTBIT_HOST", "127.0.0.1"),
            .fluentbit_port = try port(environ, "FUJIN_FLUENTBIT_PORT", 24224),
            .debug = std.mem.eql(u8, environ.get("FUJIN_DEBUG") orelse "off", "on"),
            .trace_packets = std.mem.eql(u8, environ.get("FUJIN_TRACE") orelse "", "packets"),
            .jwt = jwt,
        };
    }

    pub fn deinit(self: *Config) void {
        const a = self.allocator;
        a.free(self.zmq_endpoint);
        a.free(self.ws_host);
        a.free(self.browser_scope);
        a.free(self.qjs_lib);
        if (self.event_policy_path) |path| a.free(path);
        a.free(self.fluentbit_lib);
        a.free(self.fluentbit_listen);
        self.jwt.deinit();
        self.* = undefined;
    }
};

fn initJwtConfig(allocator: std.mem.Allocator, environ: *const std.process.Environ.Map) !JwtConfig {
    const mode = accessMode(environ.get("NRPC_ACCESS_MODE") orelse "off");
    const issuer = try owned(allocator, environ, "ACCESS_JWT_ISSUER", "ms-access");
    errdefer allocator.free(issuer);
    const audience = try owned(allocator, environ, "ACCESS_JWT_AUDIENCE", "cluster");
    errdefer allocator.free(audience);
    if (mode == .off) return .{ .allocator = allocator, .mode = mode, .issuer = issuer, .audience = audience, .key_set = null };

    const raw_jwks = environ.get("ACCESS_JWT_PUBLIC_JWKS") orelse return error.JwtPublicJwksRequired;
    var key_set = try transport.auth.jwks.KeySet.parse(allocator, raw_jwks);
    errdefer key_set.deinit(allocator);
    return .{ .allocator = allocator, .mode = mode, .issuer = issuer, .audience = audience, .key_set = key_set };
}

fn accessMode(raw: []const u8) AccessMode {
    if (std.ascii.eqlIgnoreCase(raw, "required") or std.ascii.eqlIgnoreCase(raw, "strict")) return .required;
    if (std.ascii.eqlIgnoreCase(raw, "audit") or std.ascii.eqlIgnoreCase(raw, "optional")) return .audit;
    return .off;
}

fn owned(a: std.mem.Allocator, env: *const std.process.Environ.Map, key: []const u8, fallback: []const u8) ![]u8 {
    return a.dupe(u8, env.get(key) orelse fallback);
}

fn requiredOwned(a: std.mem.Allocator, env: *const std.process.Environ.Map, key: []const u8) ![]u8 {
    const value = env.get(key) orelse return error.EnvironmentVariableNotFound;
    const trimmed = std.mem.trim(u8, value, " \t\r\n");
    if (trimmed.len == 0) return error.EnvironmentVariableEmpty;
    return a.dupe(u8, trimmed);
}

fn ownedFormat(a: std.mem.Allocator, env: *const std.process.Environ.Map, key: []const u8, comptime fmt: []const u8, args: anytype) ![]u8 {
    if (env.get(key)) |value| return a.dupe(u8, value);
    return std.fmt.allocPrint(a, fmt, args);
}

fn number(env: *const std.process.Environ.Map, key: []const u8, fallback: usize) !usize {
    return std.fmt.parseInt(usize, env.get(key) orelse return fallback, 10);
}

fn positive(env: *const std.process.Environ.Map, key: []const u8, fallback: usize) !usize {
    const value = try number(env, key, fallback);
    if (value == 0) return error.InvalidEnvironmentValue;
    return value;
}

fn port(env: *const std.process.Environ.Map, key: []const u8, fallback: u16) !u16 {
    return std.fmt.parseInt(u16, env.get(key) orelse return fallback, 10);
}
