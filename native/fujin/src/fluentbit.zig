const std = @import("std");

const Engine = opaque {};
const Start = *const fn (*const Input) callconv(.c) ?*Engine;
const Stop = *const fn (?*Engine) callconv(.c) c_int;
const Destroy = *const fn (?*Engine) callconv(.c) void;

const Input = extern struct {
    config: [*]const u8,
    config_len: usize,
    config_name: [*:0]const u8,
    files: ?*const anyopaque,
    files_len: usize,
};

pub const Receiver = struct {
    lib: std.DynLib,
    engine: ?*Engine,
    stop_fn: Stop,
    destroy_fn: Destroy,

    pub fn init(allocator: std.mem.Allocator, path: []const u8, listen: []const u8, port: u16) !Receiver {
        var lib = try std.DynLib.open(path);
        errdefer lib.close();
        const start = lib.lookup(Start, "fluentbit_engine_start") orelse return error.FluentBitStartSymbolMissing;
        const config = try std.fmt.allocPrint(
            allocator,
            "[SERVICE]\n    Flush 1\n    Log_Level info\n\n[INPUT]\n    Name forward\n    Listen {s}\n    Port {d}\n\n[OUTPUT]\n    Name stdout\n    Match *\n",
            .{ listen, port },
        );
        defer allocator.free(config);
        const input = Input{
            .config = config.ptr,
            .config_len = config.len,
            .config_name = "fluent-bit.conf",
            .files = null,
            .files_len = 0,
        };
        const engine = start(&input) orelse return error.FluentBitStartFailed;
        return .{
            .lib = lib,
            .engine = engine,
            .stop_fn = lib.lookup(Stop, "fluentbit_engine_stop") orelse return error.FluentBitStopSymbolMissing,
            .destroy_fn = lib.lookup(Destroy, "fluentbit_engine_destroy") orelse return error.FluentBitDestroySymbolMissing,
        };
    }

    pub fn deinit(self: *Receiver) void {
        if (self.engine) |engine| {
            _ = self.stop_fn(engine);
            self.destroy_fn(engine);
        }
        self.lib.close();
        self.* = undefined;
    }
};
