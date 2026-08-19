const std = @import("std");

const Handle = opaque {};

const FnWrapperCreate = *const fn (*?*Handle, [*:0]const u8) callconv(.c) i32;
const FnWrapperDestroy = *const fn (*Handle) callconv(.c) void;
const FnVersion = *const fn (*Handle) callconv(.c) [*:0]const u8;
const FnLastError = *const fn (*Handle) callconv(.c) [*:0]const u8;

pub const Client = struct {
    allocator: std.mem.Allocator,
    lib: std.DynLib,
    handle: *Handle,

    fn_destroy: FnWrapperDestroy,
    fn_version: FnVersion,
    fn_last_error: FnLastError,

    pub fn init(allocator: std.mem.Allocator, wrapper_path: []const u8, core_path: []const u8) !Client {
        var lib = try std.DynLib.open(wrapper_path);
        errdefer lib.close();

        const fn_create = try lookupRequired(FnWrapperCreate, &lib, "bsw_wrapper_create");
        const fn_destroy = try lookupRequired(FnWrapperDestroy, &lib, "bsw_wrapper_destroy");

        const core_z = try toOwnedZ(allocator, core_path);
        defer allocator.free(core_z);

        var handle: ?*Handle = null;
        const rc = fn_create(&handle, core_z.ptr);
        if (rc != 0 or handle == null) return error.BaresipWrapperCreateFailed;
        errdefer fn_destroy(handle.?);

        return .{
            .allocator = allocator,
            .lib = lib,
            .handle = handle.?,
            .fn_destroy = fn_destroy,
            .fn_version = try lookupRequired(FnVersion, &lib, "bsw_version"),
            .fn_last_error = try lookupRequired(FnLastError, &lib, "bsw_last_error"),
        };
    }

    pub fn deinit(self: *Client) void {
        // baresip/libre are process-global runtimes. Keep them resident; call
        // explicit stop/hangup APIs for runtime resources instead of unloading.
        self.* = undefined;
    }

    pub fn version(self: *const Client, allocator: std.mem.Allocator) ![]u8 {
        const version_z = self.fn_version(self.handle);
        return try allocator.dupe(u8, std.mem.span(version_z));
    }

    pub fn lastError(self: *const Client) []const u8 {
        return std.mem.span(self.fn_last_error(self.handle));
    }
};

fn lookupRequired(comptime T: type, lib: *std.DynLib, symbol: [:0]const u8) !T {
    return lib.lookup(T, symbol) orelse error.BaresipSymbolMissing;
}

fn toOwnedZ(allocator: std.mem.Allocator, value: []const u8) ![:0]u8 {
    const out = try allocator.alloc(u8, value.len + 1);
    @memcpy(out[0..value.len], value);
    out[value.len] = 0;
    return out[0..value.len :0];
}
