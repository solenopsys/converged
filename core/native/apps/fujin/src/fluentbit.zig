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

pub const Options = struct {
    listen: []const u8,
    port: u16,
    /// Forward-protocol shared key. Empty leaves the handshake unauthenticated.
    shared_key: []const u8,
    /// Where the engine posts the batches it has collected: this process's own
    /// HTTP server. Records have to come back into Fujin to be grouped and
    /// written, and the engine offers no in-process callback — an HTTP hop to
    /// ourselves is the seam the wrapper already supports.
    ingest_host: []const u8,
    ingest_port: u16,
    ingest_path: []const u8,
    ingest_key: []const u8,
};

pub const Receiver = struct {
    lib: std.DynLib,
    engine: ?*Engine,
    stop_fn: Stop,
    destroy_fn: Destroy,

    pub fn init(allocator: std.mem.Allocator, path: []const u8, options: Options) !Receiver {
        var lib = try std.DynLib.open(path);
        errdefer lib.close();
        const start = lib.lookup(Start, "fluentbit_engine_start") orelse return error.FluentBitStartSymbolMissing;
        const config = try buildConfig(allocator, options);
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

    /// `Json_date_key ts` / `epoch` is what the collector's timestamp handling
    /// expects, and `header_tag` is what gives an unstructured line a source:
    /// with `format json` the tag is otherwise dropped, and every log row would
    /// be attributed to Fujin itself.
    fn buildConfig(allocator: std.mem.Allocator, options: Options) ![]u8 {
        var out: std.Io.Writer.Allocating = .init(allocator);
        errdefer out.deinit();
        const writer = &out.writer;

        try writer.print(
            "[SERVICE]\n    Flush 1\n    Log_Level info\n\n[INPUT]\n    Name forward\n    Listen {s}\n    Port {d}\n",
            .{ options.listen, options.port },
        );
        if (options.shared_key.len > 0) {
            try writer.print("    Shared_Key {s}\n    Self_Hostname fujin\n", .{options.shared_key});
        }
        try writer.print(
            "\n[OUTPUT]\n    Name http\n    Match *\n    Host {s}\n    Port {d}\n    URI {s}\n" ++
                "    Format json\n    Json_date_key ts\n    Json_date_format epoch\n" ++
                "    header_tag X-Fluentbit-Tag\n    Header Authorization Bearer {s}\n" ++
                "    Retry_Limit 3\n",
            .{ options.ingest_host, options.ingest_port, options.ingest_path, options.ingest_key },
        );
        return out.toOwnedSlice();
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

// ── Tests ────────────────────────────────────────────────────────────────────

const testing = std.testing;

test "the generated config authenticates both hops when keys are configured" {
    const config = try Receiver.buildConfig(testing.allocator, .{
        .listen = "127.0.0.1",
        .port = 24224,
        .shared_key = "forward-secret",
        .ingest_host = "127.0.0.1",
        .ingest_port = 8087,
        .ingest_path = "/ingest/fluentbit",
        .ingest_key = "ingest-secret",
    });
    defer testing.allocator.free(config);

    try testing.expect(std.mem.indexOf(u8, config, "Shared_Key forward-secret") != null);
    try testing.expect(std.mem.indexOf(u8, config, "Header Authorization Bearer ingest-secret") != null);
    try testing.expect(std.mem.indexOf(u8, config, "URI /ingest/fluentbit") != null);
    // Records must arrive as one JSON array with an epoch `ts`, which is the
    // shape the collector parses.
    try testing.expect(std.mem.indexOf(u8, config, "Format json") != null);
    try testing.expect(std.mem.indexOf(u8, config, "Json_date_key ts") != null);
    // Nothing goes to stdout any more: that was the old dead end.
    try testing.expect(std.mem.indexOf(u8, config, "Name stdout") == null);
}

test "an unset shared key leaves the forward handshake open rather than broken" {
    const config = try Receiver.buildConfig(testing.allocator, .{
        .listen = "127.0.0.1",
        .port = 24224,
        .shared_key = "",
        .ingest_host = "127.0.0.1",
        .ingest_port = 8087,
        .ingest_path = "/ingest/fluentbit",
        .ingest_key = "ingest-secret",
    });
    defer testing.allocator.free(config);

    try testing.expect(std.mem.indexOf(u8, config, "Shared_Key") == null);
    try testing.expect(std.mem.indexOf(u8, config, "Name forward") != null);
}
