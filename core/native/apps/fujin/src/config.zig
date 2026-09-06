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
    /// Ring size of the user notification replay window, shared by every
    /// recipient. Sized in messages, not per user: it bounds Fujin's memory
    /// regardless of how many sessions connect.
    push_capacity: usize,
    /// Ceiling on live bus subscriptions across every connection. A client
    /// cannot subscribe the router out of memory, and the limit is per process
    /// rather than per client because the memory is.
    subscriptions_max: usize,
    max_control_bytes: usize,
    max_payload_bytes: usize,
    qjs_lib: []u8,
    event_policy_path: ?[]u8,
    fluentbit_lib: []u8,
    fluentbit_enabled: bool,
    fluentbit_listen: []u8,
    fluentbit_port: u16,
    /// Fluent Bit forward-protocol shared key. Producers that cannot present it
    /// are refused at the handshake, before a single record is accepted. Empty
    /// leaves the port open, which is only defensible on a loopback bind.
    fluentbit_shared_key: []u8,
    /// Bearer key Fluent Bit puts on the batches it posts back to this process.
    /// The ingest route listens on the same address as the browser WebSocket,
    /// so without it anything that can reach the port could forge log rows.
    ingest_key: []u8,
    /// Tenant the collected rows are stored under.
    ingest_scope: []u8,
    /// Records per `writeBatch`. The whole reason the collector exists.
    ingest_block_size: usize,
    /// Blocks that may wait for `services`; beyond this the oldest is dropped.
    ingest_max_blocks: usize,
    /// How long a partial block may wait before it ships anyway.
    ingest_flush_ms: i64,
    /// Service JWT used for Fujin's own outbound calls to the repositories.
    service_token: []u8,
    /// The schedule ticker. Off by default: it is the one component of this
    /// process that must exist exactly once in the cluster, so switching it on
    /// is a deployment decision rather than a default.
    scheduler_enabled: bool,
    /// Where the ticker's own NRPC client connects. Fujin's bind address is a
    /// listen address and need not be connectable, so this is derived from it
    /// (0.0.0.0 → 127.0.0.1) unless stated.
    scheduler_endpoint: []u8,
    /// Routing target the ticker registers as. It is an ordinary peer of the
    /// bus, not part of the router, and `fujin` itself may never be reused.
    scheduler_target: []u8,
    scheduler_refresh_ms: i64,
    debug: bool,
    trace_packets: bool,
    jwt: JwtConfig,

    pub fn init(allocator: std.mem.Allocator, environ: *const std.process.Environ.Map) !Config {
        const root = environ.get("CONVERGED_ROOT") orelse "/home/alexstorm/distrib/4ir/gestalt/clarity/projects/converged-portal";
        var jwt = try initJwtConfig(allocator, environ);
        errdefer jwt.deinit();
        const browser_scope = try requiredOwned(allocator, environ, "FUJIN_BROWSER_SCOPE");
        errdefer allocator.free(browser_scope);
        const fluentbit_enabled = std.mem.eql(u8, environ.get("FUJIN_FLUENTBIT") orelse "off", "on");
        // Refused at startup rather than at the first batch: an ingest port
        // that silently accepts unauthenticated rows is worse than one that
        // never came up, because nothing about the running system reveals it.
        if (fluentbit_enabled and trimmedValue(environ, "FUJIN_INGEST_KEY").len == 0) return error.IngestKeyRequired;
        return .{
            .allocator = allocator,
            .zmq_endpoint = try owned(allocator, environ, "FUJIN_ZMQ_BIND", "tcp://0.0.0.0:5557"),
            .ws_host = try owned(allocator, environ, "FUJIN_WS_HOST", "0.0.0.0"),
            .ws_port = try port(environ, "FUJIN_WS_PORT", 8087),
            .browser_scope = browser_scope,
            .journal_capacity = try positive(environ, "FUJIN_JOURNAL_CAPACITY", 4096),
            .push_capacity = try positive(environ, "FUJIN_PUSH_CAPACITY", 1024),
            .subscriptions_max = try positive(environ, "FUJIN_SUBSCRIPTIONS_MAX", 4096),
            .max_control_bytes = try number(environ, "FUJIN_MAX_CONTROL_BYTES", 60 * 1024),
            .max_payload_bytes = try number(environ, "FUJIN_MAX_PAYLOAD_BYTES", 16 * 1024 * 1024),
            .qjs_lib = try ownedFormat(allocator, environ, "FUJIN_QJS_LIB", "{s}/native/wrapers/qjs/zig-out/lib/libqjs.so", .{root}),
            .event_policy_path = if (environ.get("FUJIN_EVENT_POLICY")) |value| try allocator.dupe(u8, value) else null,
            .fluentbit_lib = try ownedFormat(allocator, environ, "FUJIN_FLUENTBIT_LIB", "{s}/native/wrapers/fluentbit/zig-out/lib/libfluentbit.so", .{root}),
            .fluentbit_enabled = fluentbit_enabled,
            .fluentbit_listen = try owned(allocator, environ, "FUJIN_FLUENTBIT_HOST", "127.0.0.1"),
            .fluentbit_port = try port(environ, "FUJIN_FLUENTBIT_PORT", 24224),
            .fluentbit_shared_key = try owned(allocator, environ, "FUJIN_FLUENTBIT_SHARED_KEY", ""),
            .ingest_key = try owned(allocator, environ, "FUJIN_INGEST_KEY", ""),
            .ingest_scope = try owned(allocator, environ, "FUJIN_INGEST_SCOPE", browser_scope),
            .ingest_block_size = try positive(environ, "FUJIN_INGEST_BLOCK_SIZE", 100),
            .ingest_max_blocks = try positive(environ, "FUJIN_INGEST_MAX_BLOCKS", 64),
            .ingest_flush_ms = @intCast(try positive(environ, "FUJIN_INGEST_FLUSH_MS", 5_000)),
            .service_token = try owned(allocator, environ, "SERVICE_TOKEN", ""),
            .scheduler_enabled = std.mem.eql(u8, environ.get("FUJIN_SCHEDULER") orelse "off", "on"),
            .scheduler_endpoint = try schedulerEndpoint(allocator, environ),
            .scheduler_target = try owned(allocator, environ, "FUJIN_SCHEDULER_TARGET", "scheduler"),
            .scheduler_refresh_ms = @intCast(try positive(environ, "FUJIN_SCHEDULE_REFRESH_MS", 30_000)),
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
        a.free(self.fluentbit_shared_key);
        a.free(self.ingest_key);
        a.free(self.ingest_scope);
        a.free(self.service_token);
        a.free(self.scheduler_endpoint);
        a.free(self.scheduler_target);
        self.jwt.deinit();
        self.* = undefined;
    }
};

/// A bind address is not a connect address: `tcp://0.0.0.0:5557` means "every
/// interface" to a server and nothing usable to a client. The ticker connects
/// over loopback because it lives in this very process.
fn schedulerEndpoint(a: std.mem.Allocator, env: *const std.process.Environ.Map) ![]u8 {
    if (env.get("FUJIN_SCHEDULER_ENDPOINT")) |value| return a.dupe(u8, value);
    const bind = env.get("FUJIN_ZMQ_BIND") orelse "tcp://0.0.0.0:5557";
    const wildcard = "0.0.0.0";
    if (std.mem.indexOf(u8, bind, wildcard)) |index| {
        return std.fmt.allocPrint(a, "{s}127.0.0.1{s}", .{ bind[0..index], bind[index + wildcard.len ..] });
    }
    return a.dupe(u8, bind);
}

test "the ticker connects over loopback rather than to a wildcard bind" {
    const allocator = std.testing.allocator;
    var env = std.process.Environ.Map.init(allocator);
    defer env.deinit();
    const derived = try schedulerEndpoint(allocator, &env);
    defer allocator.free(derived);
    try std.testing.expectEqualStrings("tcp://127.0.0.1:5557", derived);
}

fn initJwtConfig(allocator: std.mem.Allocator, environ: *const std.process.Environ.Map) !JwtConfig {
    const mode = accessMode(environ.get("NRPC_ACCESS_MODE") orelse "off");
    const issuer = try requiredOwned(allocator, environ, "ACCESS_JWT_ISSUER");
    errdefer allocator.free(issuer);
    const audience = try requiredOwned(allocator, environ, "ACCESS_JWT_AUDIENCE");
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

fn trimmedValue(env: *const std.process.Environ.Map, key: []const u8) []const u8 {
    return std.mem.trim(u8, env.get(key) orelse "", " \t\r\n");
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
