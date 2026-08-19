const std = @import("std");
const control = @import("control.zig");
const endpoint = @import("endpoint.zig");
const envelope = @import("envelope.zig");

pub const Config = struct {
    endpoint: [:0]const u8,
    identity: []const u8,
    target: []const u8,
    limits: endpoint.Limits,
    recv_timeout_ms: i32,
    send_timeout_ms: i32,
};

/// A standard NRPC client over the same Fujin/ZMQ envelope transport used by
/// services. It owns one DEALER peer and does its own send+recv, so it is
/// self-contained: CLI/one-shot paths (no reactor loop running) can use it
/// directly. It permits one correlated request at a time.
pub const ClientRequest = struct {
    target: []const u8 = "services",
    service: []const u8,
    method: []const u8,
    scope: []const u8 = "",
    user: []const u8 = "",
    auth: []const u8 = "",
    body: []const u8,
    deadline_ms: u32 = 5_000,
};

pub const ClientResponse = struct {
    body: []u8,
    kind: envelope.Kind,
    error_code: []u8,

    pub fn ok(self: ClientResponse) bool {
        return self.kind == .response;
    }

    pub fn deinit(self: *ClientResponse, allocator: std.mem.Allocator) void {
        allocator.free(self.body);
        allocator.free(self.error_code);
        self.* = undefined;
    }
};

pub const Client = struct {
    allocator: std.mem.Allocator,
    peer: endpoint.Peer,
    target: []u8,
    sequence: std.atomic.Value(u64) = .init(0),
    mutex: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,

    pub fn init(allocator: std.mem.Allocator, config: Config) !Client {
        if (config.target.len == 0) return error.TargetRequired;
        var peer = try endpoint.Peer.initWithIdentity(config.endpoint, config.identity, config.limits);
        errdefer peer.deinit();
        try peer.setRecvTimeoutMs(config.recv_timeout_ms);
        try peer.setSendTimeoutMs(config.send_timeout_ms);

        var self = Client{
            .allocator = allocator,
            .peer = peer,
            .target = try allocator.dupe(u8, config.target),
        };
        errdefer allocator.free(self.target);
        try self.announce();
        return self;
    }

    pub fn deinit(self: *Client) void {
        self.allocator.free(self.target);
        self.peer.deinit();
        self.* = undefined;
    }

    pub fn call(self: *Client, allocator: std.mem.Allocator, request: ClientRequest) !ClientResponse {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);

        const sequence = self.sequence.fetchAdd(1, .monotonic);
        const request_id = try std.fmt.allocPrint(allocator, "{s}:nrpc:{x}", .{ self.target, sequence });
        const env = envelope.Envelope{
            .kind = .request,
            .request_id = request_id,
            .to = .{ .target = request.target, .service = request.service },
            .from = .{ .target = self.target, .service = request.service },
            .method = request.method,
            .scope = request.scope,
            .user = request.user,
            .auth = request.auth,
            .codec = .json,
            .deadline_ms = request.deadline_ms,
        };
        const env_bytes = try envelope.encodeAlloc(allocator, &env);
        defer allocator.free(env_bytes);
        try self.peer.send(env_bytes, request.body);

        while (true) {
            var incoming = (try self.peer.recv()) orelse return error.RequestTimedOut;
            defer incoming.deinit();
            const response = try incoming.parseEnvelope();
            if (!std.mem.eql(u8, response.request_id, request_id)) continue;
            if (response.kind != .response and response.kind != .@"error") return error.InvalidResponseKind;
            return .{
                .body = try allocator.dupe(u8, incoming.payload()),
                .kind = response.kind,
                .error_code = try allocator.dupe(u8, response.error_code),
            };
        }
    }

    fn announce(self: *Client) !void {
        var registration = try control.register(self.allocator, .{
            .target = self.target,
        });
        defer registration.deinit(self.allocator);
        try self.send(registration.envelope, registration.payload);
    }

    fn send(self: *Client, env: envelope.Envelope, payload: []const u8) !void {
        const bytes = try envelope.encodeAlloc(self.allocator, &env);
        defer self.allocator.free(bytes);
        try self.peer.send(bytes, payload);
    }
};
