const std = @import("std");

/// Log and telemetry ingest: the second of Fujin's three message streams.
///
/// Fluent Bit receives the raw streams on the forward port and hands them back
/// to this process in JSON batches. Records are classified, normalised into the
/// `rp-logs` / `rp-telemetry` row shapes and grouped into blocks, and each full
/// block is written with a single `writeBatch` call. Grouping is the entire
/// point: shipping records one at a time would make the ingest rate a function
/// of round-trips to `services` rather than of disk.
///
/// The collector never touches the ZMQ socket. HTTP ingest runs on the web
/// server's threads while the router is owned by the transport loop, so blocks
/// are queued here and the loop drains them — the same arrangement the browser
/// command queue already uses.
pub const Collector = struct {
    allocator: std.mem.Allocator,
    /// Records per block. A block leaves as one `writeBatch`.
    block_size: usize,
    /// Queued blocks waiting for the transport loop. Bounded: `services` being
    /// down must cost a fixed amount of memory and some old logs, not the
    /// router process.
    max_blocks: usize,
    streams: [2]Stream = .{ .{}, .{} },
    ready: std.ArrayList(Block) = .empty,
    /// Blocks discarded because the queue was full, for the health line.
    dropped_blocks: u64 = 0,
    mutex: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,

    pub const Kind = enum {
        logs,
        telemetry,

        /// NRPC service that owns this stream's repository.
        pub fn service(self: Kind) []const u8 {
            return switch (self) {
                .logs => "logs",
                .telemetry => "telemetry",
            };
        }
    };

    /// One kind's partially filled block: the encoded rows so far, joined by
    /// commas, plus how many of them there are.
    const Stream = struct {
        rows: std.ArrayList(u8) = .empty,
        count: usize = 0,
        /// When the first row of the current block arrived, so a quiet stream
        /// still ships eventually instead of waiting for a hundredth record.
        opened_at: i64 = 0,
    };

    pub const Block = struct {
        kind: Kind,
        count: usize,
        /// Ready-to-send NRPC argument body: `{"events":[…]}`.
        body: []u8,

        pub fn deinit(self: *Block, allocator: std.mem.Allocator) void {
            allocator.free(self.body);
            self.* = undefined;
        }
    };

    pub const Accepted = struct { logs: usize = 0, telemetry: usize = 0, rejected: usize = 0 };

    pub fn init(allocator: std.mem.Allocator, block_size: usize, max_blocks: usize) Collector {
        std.debug.assert(block_size > 0 and max_blocks > 0);
        return .{ .allocator = allocator, .block_size = block_size, .max_blocks = max_blocks };
    }

    pub fn deinit(self: *Collector) void {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        for (&self.streams) |*stream| stream.rows.deinit(self.allocator);
        for (self.ready.items) |*block| block.deinit(self.allocator);
        self.ready.deinit(self.allocator);
        self.* = undefined;
    }

    /// Consumes one Fluent Bit batch: a JSON array of records, or a single
    /// record object. Unparseable records are counted and skipped rather than
    /// failing the whole batch — one malformed line must not cost the other
    /// ninety-nine.
    pub fn ingestJson(self: *Collector, body: []const u8, default_source: []const u8) !Accepted {
        var parsed = try std.json.parseFromSlice(std.json.Value, self.allocator, body, .{});
        defer parsed.deinit();

        var accepted = Accepted{};
        switch (parsed.value) {
            .array => |records| for (records.items) |record| self.consume(record, default_source, &accepted),
            .object => self.consume(parsed.value, default_source, &accepted),
            else => return error.IngestBodyInvalid,
        }
        return accepted;
    }

    fn consume(self: *Collector, record: std.json.Value, default_source: []const u8, accepted: *Accepted) void {
        if (record != .object) {
            accepted.rejected += 1;
            return;
        }
        const kind: Kind = if (isTelemetry(record.object)) .telemetry else .logs;
        const row = switch (kind) {
            .telemetry => encodeTelemetry(self.allocator, record.object),
            .logs => encodeLog(self.allocator, record.object, default_source),
        } catch {
            accepted.rejected += 1;
            return;
        };
        defer self.allocator.free(row);

        self.append(kind, row) catch {
            accepted.rejected += 1;
            return;
        };
        switch (kind) {
            .logs => accepted.logs += 1,
            .telemetry => accepted.telemetry += 1,
        }
    }

    fn append(self: *Collector, kind: Kind, row: []const u8) !void {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        const stream = &self.streams[@intFromEnum(kind)];
        if (stream.count > 0) try stream.rows.append(self.allocator, ',') else stream.opened_at = milliTimestamp();
        try stream.rows.appendSlice(self.allocator, row);
        stream.count += 1;
        if (stream.count >= self.block_size) try self.sealLocked(kind);
    }

    /// Seals any block whose first record is older than `age_ms`. A deployment
    /// that emits four lines a minute still gets them stored; without this a
    /// partial block would sit here until the hundredth record arrived.
    pub fn flushStale(self: *Collector, age_ms: i64) void {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        const now = milliTimestamp();
        for ([_]Kind{ .logs, .telemetry }) |kind| {
            const stream = &self.streams[@intFromEnum(kind)];
            if (stream.count == 0 or now - stream.opened_at < age_ms) continue;
            self.sealLocked(kind) catch {};
        }
    }

    /// Caller holds the lock.
    fn sealLocked(self: *Collector, kind: Kind) !void {
        const stream = &self.streams[@intFromEnum(kind)];
        if (stream.count == 0) return;
        const body = try std.fmt.allocPrint(self.allocator, "{{\"events\":[{s}]}}", .{stream.rows.items});
        errdefer self.allocator.free(body);
        const block = Block{ .kind = kind, .count = stream.count, .body = body };

        if (self.ready.items.len >= self.max_blocks) {
            var oldest = self.ready.orderedRemove(0);
            oldest.deinit(self.allocator);
            self.dropped_blocks += 1;
        }
        try self.ready.append(self.allocator, block);
        stream.rows.clearRetainingCapacity();
        stream.count = 0;
    }

    pub fn takeBlock(self: *Collector) ?Block {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        if (self.ready.items.len == 0) return null;
        return self.ready.orderedRemove(0);
    }

    /// Re-queues a block the transport could not deliver, at the front so
    /// ordering survives a momentary `services` outage.
    pub fn returnBlock(self: *Collector, block: Block) void {
        _ = std.c.pthread_mutex_lock(&self.mutex);
        defer _ = std.c.pthread_mutex_unlock(&self.mutex);
        if (self.ready.items.len >= self.max_blocks) {
            var copy = block;
            copy.deinit(self.allocator);
            self.dropped_blocks += 1;
            return;
        }
        self.ready.insert(self.allocator, 0, block) catch {
            var copy = block;
            copy.deinit(self.allocator);
            self.dropped_blocks += 1;
        };
    }
};

/// A telemetry sample names a device and a parameter and carries a number.
/// Anything else is a log line — including a record that mentions a device but
/// has no reading, which is a log *about* a device.
fn isTelemetry(record: std.json.ObjectMap) bool {
    if (stringField(record, "device_id") == null) return false;
    if (stringField(record, "param") == null) return false;
    return numberField(record, "value") != null;
}

fn encodeTelemetry(allocator: std.mem.Allocator, record: std.json.ObjectMap) ![]u8 {
    const Row = struct {
        ts: i64,
        device_id: []const u8,
        param: []const u8,
        value: f64,
        unit: []const u8,
    };
    return std.json.Stringify.valueAlloc(allocator, Row{
        .ts = timestampMillis(record),
        .device_id = stringField(record, "device_id").?,
        .param = stringField(record, "param").?,
        .value = numberField(record, "value").?,
        .unit = stringField(record, "unit") orelse "",
    }, .{});
}

fn encodeLog(allocator: std.mem.Allocator, record: std.json.ObjectMap, default_source: []const u8) ![]u8 {
    // `log` is what Fluent Bit calls the line when nothing parsed it; `message`
    // is what a structured emitter uses. Falling back to the raw record keeps
    // an unrecognised shape searchable instead of storing an empty row.
    const fallback = try std.json.Stringify.valueAlloc(allocator, std.json.Value{ .object = record }, .{});
    defer allocator.free(fallback);

    const Row = struct {
        ts: i64,
        source: []const u8,
        level: i64,
        code: i64,
        message: []const u8,
    };
    return std.json.Stringify.valueAlloc(allocator, Row{
        .ts = timestampMillis(record),
        .source = stringField(record, "source") orelse default_source,
        .level = logLevel(record),
        .code = @intFromFloat(numberField(record, "code") orelse 0),
        .message = stringField(record, "message") orelse stringField(record, "log") orelse fallback,
    }, .{});
}

/// rp-logs stores a numeric level; Fluent Bit sources spell severity every way
/// there is. Unknown text is information, not an error — guessing "error"
/// there would fill the dashboard with false alarms.
fn logLevel(record: std.json.ObjectMap) i64 {
    if (numberField(record, "level")) |value| return @intFromFloat(value);
    const text = stringField(record, "level") orelse
        stringField(record, "severity") orelse
        stringField(record, "log_level") orelse return 1;
    if (eqlAny(text, &.{ "error", "err", "fatal", "critical", "crit" })) return 3;
    if (eqlAny(text, &.{ "warn", "warning" })) return 2;
    if (eqlAny(text, &.{ "debug", "trace" })) return 0;
    return 1;
}

/// Fluent Bit's `Json_date_format epoch` emits fractional seconds, while the
/// repositories store milliseconds. Values already large enough to be
/// milliseconds are passed through, so a structured emitter that sends
/// `Date.now()` is not multiplied into the year 57000.
fn timestampMillis(record: std.json.ObjectMap) i64 {
    const seconds_ceiling = 100_000_000_000; // ~year 5138 in ms, ~year 5138 in s is far past
    const raw = numberField(record, "ts") orelse
        numberField(record, "date") orelse
        numberField(record, "@timestamp") orelse
        return milliTimestamp();
    const value: i64 = @intFromFloat(if (raw < seconds_ceiling) raw * 1000 else raw);
    return value;
}

fn eqlAny(value: []const u8, candidates: []const []const u8) bool {
    for (candidates) |candidate| {
        if (std.ascii.eqlIgnoreCase(value, candidate)) return true;
    }
    return false;
}

fn stringField(object: std.json.ObjectMap, key: []const u8) ?[]const u8 {
    const value = object.get(key) orelse return null;
    return switch (value) {
        .string => |text| text,
        else => null,
    };
}

fn numberField(object: std.json.ObjectMap, key: []const u8) ?f64 {
    const value = object.get(key) orelse return null;
    return switch (value) {
        .integer => |number| @floatFromInt(number),
        .float => |number| number,
        else => null,
    };
}

/// Wall-clock milliseconds; std.time.milliTimestamp is gone in Zig 0.16.
fn milliTimestamp() i64 {
    var ts: std.c.timespec = undefined;
    _ = std.c.clock_gettime(.REALTIME, &ts);
    return ts.sec * std.time.ms_per_s + @divFloor(ts.nsec, std.time.ns_per_ms);
}

// ── Tests ────────────────────────────────────────────────────────────────────

const testing = std.testing;

fn parsedBody(body: []const u8) !std.json.Parsed(std.json.Value) {
    return std.json.parseFromSlice(std.json.Value, testing.allocator, body, .{});
}

test "records are split between the two repositories by shape" {
    var collector = Collector.init(testing.allocator, 100, 4);
    defer collector.deinit();

    const accepted = try collector.ingestJson(
        \\[{"ts":1757000000,"message":"started","level":"warn"},
        \\ {"ts":1757000001,"device_id":"printer-1","param":"temperature","value":214.5,"unit":"C"},
        \\ {"ts":1757000002,"device_id":"printer-1","message":"door opened"},
        \\ "not a record"]
    , "fujin");

    try testing.expectEqual(@as(usize, 2), accepted.logs);
    try testing.expectEqual(@as(usize, 1), accepted.telemetry);
    try testing.expectEqual(@as(usize, 1), accepted.rejected);
}

test "a block is sealed at the configured size and carries the writeBatch shape" {
    var collector = Collector.init(testing.allocator, 2, 4);
    defer collector.deinit();

    _ = try collector.ingestJson(
        \\[{"message":"one","level":"warn"},{"message":"two"},{"message":"three"}]
    , "fujin");

    var block = collector.takeBlock().?;
    defer block.deinit(testing.allocator);
    try testing.expectEqual(Collector.Kind.logs, block.kind);
    try testing.expectEqual(@as(usize, 2), block.count);
    try testing.expectEqualStrings("logs", block.kind.service());

    var doc = try parsedBody(block.body);
    defer doc.deinit();
    const events = doc.value.object.get("events").?.array;
    try testing.expectEqual(@as(usize, 2), events.items.len);
    try testing.expectEqualStrings("one", events.items[0].object.get("message").?.string);
    try testing.expectEqualStrings("fujin", events.items[0].object.get("source").?.string);
    try testing.expectEqual(@as(i64, 2), events.items[0].object.get("level").?.integer);

    // The third record is still open, so nothing else is queued yet.
    try testing.expect(collector.takeBlock() == null);
}

test "a partial block ships once it is old enough" {
    var collector = Collector.init(testing.allocator, 100, 4);
    defer collector.deinit();

    _ = try collector.ingestJson("[{\"message\":\"lonely\"}]", "fujin");
    collector.flushStale(60_000);
    try testing.expect(collector.takeBlock() == null);

    collector.flushStale(0);
    var block = collector.takeBlock().?;
    defer block.deinit(testing.allocator);
    try testing.expectEqual(@as(usize, 1), block.count);
}

test "a full queue drops the oldest block instead of growing without bound" {
    var collector = Collector.init(testing.allocator, 1, 2);
    defer collector.deinit();

    for ([_][]const u8{ "a", "b", "c" }) |message| {
        var buffer: [64]u8 = undefined;
        _ = try collector.ingestJson(try std.fmt.bufPrint(&buffer, "[{{\"message\":\"{s}\"}}]", .{message}), "fujin");
    }

    try testing.expectEqual(@as(u64, 1), collector.dropped_blocks);
    var first = collector.takeBlock().?;
    defer first.deinit(testing.allocator);
    var doc = try parsedBody(first.body);
    defer doc.deinit();
    try testing.expectEqualStrings("b", doc.value.object.get("events").?.array.items[0].object.get("message").?.string);
}

test "an undeliverable block returns to the front of the queue" {
    var collector = Collector.init(testing.allocator, 1, 4);
    defer collector.deinit();

    _ = try collector.ingestJson("[{\"message\":\"first\"},{\"message\":\"second\"}]", "fujin");
    const first = collector.takeBlock().?;
    collector.returnBlock(first);

    var again = collector.takeBlock().?;
    defer again.deinit(testing.allocator);
    var doc = try parsedBody(again.body);
    defer doc.deinit();
    try testing.expectEqualStrings("first", doc.value.object.get("events").?.array.items[0].object.get("message").?.string);
}

test "timestamps normalise to milliseconds without inflating one already in them" {
    const allocator = testing.allocator;
    var seconds = try parsedBody("{\"ts\":1757000000.5}");
    defer seconds.deinit();
    try testing.expectEqual(@as(i64, 1757000000500), timestampMillis(seconds.value.object));

    var millis = try parsedBody("{\"ts\":1757000000500}");
    defer millis.deinit();
    try testing.expectEqual(@as(i64, 1757000000500), timestampMillis(millis.value.object));

    var absent = try parsedBody("{}");
    defer absent.deinit();
    try testing.expect(timestampMillis(absent.value.object) > 0);
    _ = allocator;
}

test "severity words map to the numeric levels rp-logs stores" {
    for ([_]struct { text: []const u8, level: i64 }{
        .{ .text = "{\"level\":\"ERROR\"}", .level = 3 },
        .{ .text = "{\"severity\":\"warning\"}", .level = 2 },
        .{ .text = "{\"log_level\":\"debug\"}", .level = 0 },
        .{ .text = "{\"level\":\"chatty\"}", .level = 1 },
        .{ .text = "{}", .level = 1 },
        .{ .text = "{\"level\":3}", .level = 3 },
    }) |case| {
        var doc = try parsedBody(case.text);
        defer doc.deinit();
        try testing.expectEqual(case.level, logLevel(doc.value.object));
    }
}

test "an unstructured line keeps the record itself as the message" {
    const allocator = testing.allocator;
    var doc = try parsedBody("{\"weird\":\"shape\"}");
    defer doc.deinit();
    const row = try encodeLog(allocator, doc.value.object, "fujin");
    defer allocator.free(row);

    var parsed = try parsedBody(row);
    defer parsed.deinit();
    try testing.expectEqualStrings("{\"weird\":\"shape\"}", parsed.value.object.get("message").?.string);
}
