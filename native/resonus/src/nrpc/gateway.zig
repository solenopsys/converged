const std = @import("std");
const http = @import("../util/http.zig");

pub const Response = http.Response;

pub const Request = struct {
    service: []const u8,
    method: []const u8,
    scope: []const u8,
    body: []const u8,
};

/// Transport-neutral port used by generated NRPC clients.
pub const Provider = struct {
    context: *anyopaque,
    call_fn: *const fn (*anyopaque, Request) anyerror!Response,
    deinit_fn: *const fn (*anyopaque) void,

    pub fn call(self: *Provider, request: Request) !Response {
        return self.call_fn(self.context, request);
    }

    pub fn deinit(self: *Provider) void {
        self.deinit_fn(self.context);
        self.* = undefined;
    }
};

const HttpProvider = struct {
    allocator: std.mem.Allocator,
    base_url: []u8,
    service_token: ?[]u8,

    fn callOpaque(context: *anyopaque, request: Request) !Response {
        const self: *HttpProvider = @ptrCast(@alignCast(context));
        const url = try std.fmt.allocPrint(
            self.allocator,
            "{s}/{s}/{s}",
            .{ self.base_url, request.service, request.method },
        );
        defer self.allocator.free(url);

        var header_storage: [2]http.SimpleHeader = undefined;
        var header_count: usize = 0;
        if (request.scope.len > 0) {
            header_storage[header_count] = .{ .name = "scope", .value = request.scope };
            header_count += 1;
            header_storage[header_count] = .{ .name = "workspace", .value = request.scope };
            header_count += 1;
        }

        var auth_buffer: [1024]u8 = undefined;
        const authorization = if (self.service_token) |token|
            if (std.mem.startsWith(u8, token, "Bearer "))
                token
            else
                std.fmt.bufPrint(&auth_buffer, "Bearer {s}", .{token}) catch token
        else
            null;

        return http.post(
            self.allocator,
            url,
            request.body,
            "application/json",
            authorization,
            header_storage[0..header_count],
        );
    }

    fn deinitOpaque(context: *anyopaque) void {
        const self: *HttpProvider = @ptrCast(@alignCast(context));
        const allocator = self.allocator;
        allocator.free(self.base_url);
        if (self.service_token) |token| allocator.free(token);
        allocator.destroy(self);
    }
};

pub fn httpProvider(
    allocator: std.mem.Allocator,
    services_url: []const u8,
    service_token: ?[]const u8,
) !Provider {
    const provider = try allocator.create(HttpProvider);
    errdefer allocator.destroy(provider);
    provider.* = .{
        .allocator = allocator,
        .base_url = try trimTrailingSlashOwned(allocator, services_url),
        .service_token = if (service_token) |token| try allocator.dupe(u8, token) else null,
    };
    errdefer {
        allocator.free(provider.base_url);
        if (provider.service_token) |token| allocator.free(token);
    }
    return .{
        .context = provider,
        .call_fn = HttpProvider.callOpaque,
        .deinit_fn = HttpProvider.deinitOpaque,
    };
}

fn trimTrailingSlashOwned(allocator: std.mem.Allocator, value: []const u8) ![]u8 {
    const clean = std.mem.trim(u8, value, " \t\r\n");
    var end = clean.len;
    while (end > 0 and clean[end - 1] == '/') end -= 1;
    if (end == 0) return error.MissingServicesUrl;
    return allocator.dupe(u8, clean[0..end]);
}
