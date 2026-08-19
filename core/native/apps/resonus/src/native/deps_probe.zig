const std = @import("std");
const config_mod = @import("../config.zig");

pub const Report = struct {
    baresip_loaded: bool = false,
    libdatachannel_loaded: bool = false,
    mbedtls_loaded: bool = false,

    baresip_error: ?[]u8 = null,
    libdatachannel_error: ?[]u8 = null,
    mbedtls_error: ?[]u8 = null,

    mbedtls_version: ?[]u8 = null,
};

pub const DepsProbe = struct {
    allocator: std.mem.Allocator,

    baresip: ?std.DynLib = null,
    libdatachannel: ?std.DynLib = null,
    mbedtls: ?std.DynLib = null,

    report: Report = .{},

    pub fn init(allocator: std.mem.Allocator, cfg: *const config_mod.Config) !DepsProbe {
        var self = DepsProbe{ .allocator = allocator };

        self.loadBaresip(cfg.baresip_lib_path);
        self.loadLibDataChannel(cfg.libdatachannel_lib_path);
        self.loadMbedTls(cfg.mbedtls_lib_path);

        return self;
    }

    pub fn deinit(self: *DepsProbe) void {
        if (self.baresip) |*lib| lib.close();
        if (self.libdatachannel) |*lib| lib.close();
        if (self.mbedtls) |*lib| lib.close();

        if (self.report.baresip_error) |v| self.allocator.free(v);
        if (self.report.libdatachannel_error) |v| self.allocator.free(v);
        if (self.report.mbedtls_error) |v| self.allocator.free(v);
        if (self.report.mbedtls_version) |v| self.allocator.free(v);

        self.* = undefined;
    }

    fn loadBaresip(self: *DepsProbe, path: []const u8) void {
        self.baresip = std.DynLib.open(path) catch |err| {
            self.report.baresip_error = std.fmt.allocPrint(self.allocator, "{s}: {s}", .{ path, @errorName(err) }) catch null;
            return;
        };
        self.report.baresip_loaded = true;
    }

    fn loadLibDataChannel(self: *DepsProbe, path: []const u8) void {
        self.libdatachannel = std.DynLib.open(path) catch |err| {
            self.report.libdatachannel_error = std.fmt.allocPrint(self.allocator, "{s}: {s}", .{ path, @errorName(err) }) catch null;
            return;
        };
        self.report.libdatachannel_loaded = true;
    }

    fn loadMbedTls(self: *DepsProbe, path: []const u8) void {
        self.mbedtls = std.DynLib.open(path) catch |err| {
            self.report.mbedtls_error = std.fmt.allocPrint(self.allocator, "{s}: {s}", .{ path, @errorName(err) }) catch null;
            return;
        };
        self.report.mbedtls_loaded = true;

        const lib = &self.mbedtls.?;

        const FnVersionString = *const fn ([*]u8) callconv(.c) void;
        if (lib.lookup(FnVersionString, "mbedtls_version_get_string")) |fn_ver| {
            var buf: [128]u8 = [_]u8{0} ** 128;
            fn_ver(&buf);
            const end = std.mem.indexOfScalar(u8, buf[0..], 0) orelse buf.len;
            if (end > 0) {
                self.report.mbedtls_version = self.allocator.dupe(u8, buf[0..end]) catch null;
                return;
            }
        }

        const FnVersionNumber = *const fn () callconv(.c) u32;
        if (lib.lookup(FnVersionNumber, "mbedtls_version_get_number")) |fn_num| {
            const num = fn_num();
            const major = (num >> 24) & 0xff;
            const minor = (num >> 16) & 0xff;
            const patch = (num >> 8) & 0xff;
            self.report.mbedtls_version = std.fmt.allocPrint(self.allocator, "{d}.{d}.{d}", .{ major, minor, patch }) catch null;
        }
    }
};
