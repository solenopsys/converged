const std = @import("std");

// Pure-Zig codec for schema/envelope.capnp. Wire-compatible with Cap'n Proto
// (single-segment canonical messages); layout constants below are verified
// against `capnp compile -ocapnp` and the golden bytes in the tests were
// produced by `capnp encode`. Any change to schema/envelope.capnp must be
// mirrored here — the golden test fails otherwise.
//
// Field layout (struct Envelope — data 2 words, 7 pointers):
//   version    UInt8   data byte 0
//   fin        Bool    data bit 8
//   kind       UInt16  data bytes 2..3
//   codec      UInt16  data bytes 4..5
//   seq        UInt32  data bytes 8..11
//   deadlineMs UInt32  data bytes 12..15
//   requestId ptr0, to ptr1, from ptr2, method ptr3,
//   scope ptr4, user ptr5, errorCode ptr6, auth ptr7
// struct Address — data 0 words, 2 pointers: target ptr0, service ptr1.

pub const envelope_version: u8 = 1;

pub const Kind = enum(u16) {
    request = 0,
    response = 1,
    @"error" = 2,
    event = 3,
    stream_chunk = 4,
    system = 5,
};

pub const PayloadCodec = enum(u16) {
    json = 0,
    capnp = 1,
    raw = 2,
};

pub const Address = struct {
    target: []const u8 = "",
    service: []const u8 = "",

    pub fn isEmpty(self: Address) bool {
        return self.target.len == 0 and self.service.len == 0;
    }
};

pub const Envelope = struct {
    version: u8 = envelope_version,
    kind: Kind,
    request_id: []const u8 = "",
    to: Address = .{},
    from: Address = .{},
    method: []const u8 = "",
    scope: []const u8 = "",
    user: []const u8 = "",
    auth: []const u8 = "",
    codec: PayloadCodec = .json,
    seq: u32 = 0,
    fin: bool = false,
    deadline_ms: u32 = 0,
    error_code: []const u8 = "",
};

pub const DecodeError = error{
    MessageTruncated,
    MultiSegmentUnsupported,
    RootPointerInvalid,
    PointerInvalid,
    PointerOutOfBounds,
    TextInvalid,
    KindInvalid,
    CodecInvalid,
};

pub const ValidationError = error{
    UnsupportedVersion,
    RequestIdRequired,
    TargetRequired,
    ServiceRequired,
    MethodRequired,
    DeadlineRequired,
};

const envelope_data_words: u16 = 2;
const legacy_envelope_ptr_words: u16 = 7;
const envelope_ptr_words: u16 = 8;

fn pointerWords(env: *const Envelope) u16 {
    return if (env.auth.len == 0) legacy_envelope_ptr_words else envelope_ptr_words;
}

fn headerWords(env: *const Envelope) usize {
    return 1 + envelope_data_words + pointerWords(env); // root ptr + data + ptrs
}

// ── Size ─────────────────────────────────────────────────────────────────────

fn textWords(text: []const u8) usize {
    if (text.len == 0) return 0;
    return (text.len + 1 + 7) / 8; // + NUL terminator, padded to a word
}

fn addressWords(address: Address) usize {
    if (address.isEmpty()) return 0;
    return 2 + textWords(address.target) + textWords(address.service);
}

fn segmentWords(env: *const Envelope) usize {
    return headerWords(env) +
        textWords(env.request_id) +
        addressWords(env.to) +
        addressWords(env.from) +
        textWords(env.method) +
        textWords(env.scope) +
        textWords(env.user) +
        textWords(env.error_code) +
        textWords(env.auth);
}

/// Total encoded size in bytes, including the 8-byte segment table.
pub fn encodedSize(env: *const Envelope) usize {
    return 8 + segmentWords(env) * 8;
}

// ── Encode ───────────────────────────────────────────────────────────────────

fn structPointer(offset_words: usize, data_words: u16, ptr_words: u16) u64 {
    const lower: u32 = @as(u32, @intCast(offset_words)) << 2; // kind bits 0..1 = 0
    return @as(u64, lower) | (@as(u64, data_words) << 32) | (@as(u64, ptr_words) << 48);
}

fn textPointer(offset_words: usize, byte_len: usize) u64 {
    const lower: u32 = (@as(u32, @intCast(offset_words)) << 2) | 1; // list
    const count: u64 = byte_len + 1; // + NUL
    return @as(u64, lower) | (@as(u64, 2) << 32) | (count << 35); // elem size 2 = byte
}

const Writer = struct {
    words: [][8]u8,
    cursor: usize, // next free word index

    fn putWord(self: *Writer, index: usize, value: u64) void {
        std.mem.writeInt(u64, &self.words[index], value, .little);
    }

    fn putText(self: *Writer, ptr_word: usize, text: []const u8) void {
        if (text.len == 0) return; // null pointer, buffer is pre-zeroed
        self.putWord(ptr_word, textPointer(self.cursor - (ptr_word + 1), text.len));
        const bytes: []u8 = @as([*]u8, @ptrCast(self.words.ptr))[self.cursor * 8 .. (self.cursor + textWords(text)) * 8];
        @memcpy(bytes[0..text.len], text);
        self.cursor += textWords(text);
    }

    fn putAddress(self: *Writer, ptr_word: usize, address: Address) void {
        if (address.isEmpty()) return; // null pointer
        const body = self.cursor;
        self.putWord(ptr_word, structPointer(body - (ptr_word + 1), 0, 2));
        self.cursor = body + 2;
        self.putText(body, address.target);
        self.putText(body + 1, address.service);
    }
};

/// Encode into a caller buffer of at least encodedSize(env) bytes.
/// Returns the encoded slice (prefix of `buf`).
pub fn encode(env: *const Envelope, buf: []u8) ![]u8 {
    const total = encodedSize(env);
    if (buf.len < total) return error.BufferTooSmall;
    const out = buf[0..total];
    @memset(out, 0);

    const seg_words = segmentWords(env);
    std.mem.writeInt(u32, out[0..4], 0, .little); // segment count - 1
    std.mem.writeInt(u32, out[4..8], @intCast(seg_words), .little);

    var writer = Writer{
        .words = @as([*][8]u8, @ptrCast(out.ptr + 8))[0..seg_words],
        .cursor = headerWords(env),
    };

    writer.putWord(0, structPointer(0, envelope_data_words, pointerWords(env)));

    // data word 0
    var data0: u64 = env.version;
    if (env.fin) data0 |= @as(u64, 1) << 8;
    data0 |= @as(u64, @intFromEnum(env.kind)) << 16;
    data0 |= @as(u64, @intFromEnum(env.codec)) << 32;
    writer.putWord(1, data0);

    // data word 1
    writer.putWord(2, @as(u64, env.seq) | (@as(u64, env.deadline_ms) << 32));

    // pointers, contents emitted in pointer order (canonical form)
    writer.putText(3, env.request_id);
    writer.putAddress(4, env.to);
    writer.putAddress(5, env.from);
    writer.putText(6, env.method);
    writer.putText(7, env.scope);
    writer.putText(8, env.user);
    writer.putText(9, env.error_code);
    if (env.auth.len > 0) writer.putText(10, env.auth);

    std.debug.assert(writer.cursor == seg_words);
    return out;
}

/// Convenience allocator variant.
pub fn encodeAlloc(allocator: std.mem.Allocator, env: *const Envelope) ![]u8 {
    const buf = try allocator.alloc(u8, encodedSize(env));
    errdefer allocator.free(buf);
    return try encode(env, buf);
}

// ── Decode ───────────────────────────────────────────────────────────────────

const Reader = struct {
    seg: []const u8, // segment bytes, length is a multiple of 8

    fn wordCount(self: *const Reader) usize {
        return self.seg.len / 8;
    }

    fn word(self: *const Reader, index: usize) u64 {
        return std.mem.readInt(u64, self.seg[index * 8 ..][0..8], .little);
    }

    const StructRef = struct { start: usize, data_words: u16, ptr_words: u16 };

    fn readStructPointer(self: *const Reader, ptr_word: usize) DecodeError!?StructRef {
        const raw = self.word(ptr_word);
        if (raw == 0) return null;
        if (raw & 0b11 != 0) return DecodeError.PointerInvalid; // struct pointers only
        const offset = @as(i32, @bitCast(@as(u32, @truncate(raw)))) >> 2;
        const data_words: u16 = @truncate(raw >> 32);
        const ptr_words: u16 = @truncate(raw >> 48);
        const base = ptr_word + 1;
        if (offset < 0) return DecodeError.PointerOutOfBounds;
        const start = base + @as(usize, @intCast(offset));
        if (start + @as(usize, data_words) + @as(usize, ptr_words) > self.wordCount())
            return DecodeError.PointerOutOfBounds;
        return .{ .start = start, .data_words = data_words, .ptr_words = ptr_words };
    }

    fn readText(self: *const Reader, ptr_word: usize) DecodeError![]const u8 {
        const raw = self.word(ptr_word);
        if (raw == 0) return "";
        if (raw & 0b11 != 1) return DecodeError.PointerInvalid; // list pointers only
        const offset = @as(i32, @bitCast(@as(u32, @truncate(raw)))) >> 2;
        const elem_size: u3 = @truncate(raw >> 32);
        if (elem_size != 2) return DecodeError.TextInvalid; // bytes
        const count: usize = @intCast(raw >> 35);
        if (count == 0) return DecodeError.TextInvalid; // text always carries NUL
        if (offset < 0) return DecodeError.PointerOutOfBounds;
        const start_byte = (ptr_word + 1 + @as(usize, @intCast(offset))) * 8;
        if (start_byte + count > self.seg.len) return DecodeError.PointerOutOfBounds;
        const bytes = self.seg[start_byte .. start_byte + count];
        if (bytes[count - 1] != 0) return DecodeError.TextInvalid;
        return bytes[0 .. count - 1];
    }

    fn readAddress(self: *const Reader, ptr_word: usize) DecodeError!Address {
        const ref = (try self.readStructPointer(ptr_word)) orelse return .{};
        const ptr_base = ref.start + ref.data_words;
        return .{
            .target = if (ref.ptr_words >= 1) try self.readText(ptr_base) else "",
            .service = if (ref.ptr_words >= 2) try self.readText(ptr_base + 1) else "",
        };
    }
};

/// Decode an envelope. Zero-copy: all text fields are slices into `bytes`,
/// valid only while `bytes` is alive.
pub fn decode(bytes: []const u8) DecodeError!Envelope {
    if (bytes.len < 16) return DecodeError.MessageTruncated;
    const segment_count = std.mem.readInt(u32, bytes[0..4], .little) + 1;
    if (segment_count != 1) return DecodeError.MultiSegmentUnsupported;
    const seg_words: usize = std.mem.readInt(u32, bytes[4..8], .little);
    if (bytes.len < 8 + seg_words * 8) return DecodeError.MessageTruncated;
    if (seg_words == 0) return DecodeError.RootPointerInvalid;

    const reader = Reader{ .seg = bytes[8 .. 8 + seg_words * 8] };
    const root = (reader.readStructPointer(0) catch return DecodeError.RootPointerInvalid) orelse
        return DecodeError.RootPointerInvalid;

    var env = Envelope{ .kind = .request, .version = 0, .codec = .json };

    // data section (tolerate shorter structs from older schema revisions)
    const data = reader.seg[root.start * 8 .. (root.start + root.data_words) * 8];
    if (data.len >= 8) {
        env.version = data[0];
        env.fin = data[1] & 1 != 0;
        const kind_raw = std.mem.readInt(u16, data[2..4], .little);
        env.kind = std.enums.fromInt(Kind, kind_raw) orelse return DecodeError.KindInvalid;
        const codec_raw = std.mem.readInt(u16, data[4..6], .little);
        env.codec = std.enums.fromInt(PayloadCodec, codec_raw) orelse return DecodeError.CodecInvalid;
    }
    if (data.len >= 16) {
        env.seq = std.mem.readInt(u32, data[8..12], .little);
        env.deadline_ms = std.mem.readInt(u32, data[12..16], .little);
    }

    const ptr_base = root.start + root.data_words;
    if (root.ptr_words >= 1) env.request_id = try reader.readText(ptr_base);
    if (root.ptr_words >= 2) env.to = try reader.readAddress(ptr_base + 1);
    if (root.ptr_words >= 3) env.from = try reader.readAddress(ptr_base + 2);
    if (root.ptr_words >= 4) env.method = try reader.readText(ptr_base + 3);
    if (root.ptr_words >= 5) env.scope = try reader.readText(ptr_base + 4);
    if (root.ptr_words >= 6) env.user = try reader.readText(ptr_base + 5);
    if (root.ptr_words >= 7) env.error_code = try reader.readText(ptr_base + 6);
    if (root.ptr_words >= 8) env.auth = try reader.readText(ptr_base + 7);

    return env;
}

// ── Protocol invariants ──────────────────────────────────────────────────────

/// Routing invariants from cluster-messaging.md §5: a malformed envelope is
/// rejected loudly, never repaired. The codec itself encodes whatever it is
/// given; call this before sending.
pub fn validateForSend(env: *const Envelope) ValidationError!void {
    if (env.version != envelope_version) return ValidationError.UnsupportedVersion;
    switch (env.kind) {
        .request => {
            if (env.request_id.len == 0) return ValidationError.RequestIdRequired;
            if (env.to.target.len == 0) return ValidationError.TargetRequired;
            if (env.to.service.len == 0) return ValidationError.ServiceRequired;
            if (env.method.len == 0) return ValidationError.MethodRequired;
            if (env.deadline_ms == 0) return ValidationError.DeadlineRequired;
        },
        .response, .@"error", .stream_chunk => {
            if (env.request_id.len == 0) return ValidationError.RequestIdRequired;
            if (env.to.target.len == 0) return ValidationError.TargetRequired;
        },
        .event => {
            if (env.method.len == 0) return ValidationError.MethodRequired; // event name
        },
        .system => {
            if (env.method.len == 0) return ValidationError.MethodRequired; // control op
        },
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

const golden_full_hex =
    "00000000190000000000000002000700010000000000000000000000983a0000" ++
    "190000002a000000180000000000020028000000000002003500000072000000" ++
    "390000004a0000003d000000220000000000000000000000722d343200000000" ++
    "050000002a000000050000005a000000636f726500000000617373697374616e" ++
    "7473000000000000050000001a000000050000001a0000007773000000000000" ++
    "313700000000000063726561746553657373696f6e00000074656e616e742d61" ++
    "0000000000000000752d370000000000";

// segment table + root pointer + 9 zero words (2 data + 7 null pointers)
const golden_empty_hex = "000000000a0000000000000002000700" ++ ("00" ** 72);

const golden_full_env = Envelope{
    .version = 1,
    .kind = .request,
    .request_id = "r-42",
    .to = .{ .target = "core", .service = "assistants" },
    .from = .{ .target = "ws", .service = "17" },
    .method = "createSession",
    .scope = "tenant-a",
    .user = "u-7",
    .codec = .json,
    .seq = 0,
    .fin = false,
    .deadline_ms = 15000,
};

fn hexBytes(comptime hex: []const u8) [hex.len / 2]u8 {
    var out: [hex.len / 2]u8 = undefined;
    _ = std.fmt.hexToBytes(&out, hex) catch unreachable;
    return out;
}

fn expectEnvelopeEqual(expected: *const Envelope, actual: *const Envelope) !void {
    try std.testing.expectEqual(expected.version, actual.version);
    try std.testing.expectEqual(expected.kind, actual.kind);
    try std.testing.expectEqualStrings(expected.request_id, actual.request_id);
    try std.testing.expectEqualStrings(expected.to.target, actual.to.target);
    try std.testing.expectEqualStrings(expected.to.service, actual.to.service);
    try std.testing.expectEqualStrings(expected.from.target, actual.from.target);
    try std.testing.expectEqualStrings(expected.from.service, actual.from.service);
    try std.testing.expectEqualStrings(expected.method, actual.method);
    try std.testing.expectEqualStrings(expected.scope, actual.scope);
    try std.testing.expectEqualStrings(expected.user, actual.user);
    try std.testing.expectEqualStrings(expected.auth, actual.auth);
    try std.testing.expectEqual(expected.codec, actual.codec);
    try std.testing.expectEqual(expected.seq, actual.seq);
    try std.testing.expectEqual(expected.fin, actual.fin);
    try std.testing.expectEqual(expected.deadline_ms, actual.deadline_ms);
    try std.testing.expectEqualStrings(expected.error_code, actual.error_code);
}

test "decodes capnp-encoded golden bytes" {
    const bytes = hexBytes(golden_full_hex);
    const env = try decode(&bytes);
    try expectEnvelopeEqual(&golden_full_env, &env);
}

test "encodes to canonical capnp bytes" {
    const golden = hexBytes(golden_full_hex);
    var buf: [512]u8 = undefined;
    const encoded = try encode(&golden_full_env, &buf);
    try std.testing.expectEqualSlices(u8, &golden, encoded);
}

test "all-default envelope matches capnp empty encoding" {
    const golden = hexBytes(golden_empty_hex);
    const empty = Envelope{ .kind = .request, .version = 0 };
    var buf: [128]u8 = undefined;
    const encoded = try encode(&empty, &buf);
    try std.testing.expectEqualSlices(u8, &golden, encoded);

    const decoded = try decode(&golden);
    try expectEnvelopeEqual(&empty, &decoded);
}

test "round-trip with every field set" {
    const env = Envelope{
        .version = 3,
        .kind = .stream_chunk,
        .request_id = "req-стрим-1",
        .to = .{ .target = "storage-acme", .service = "kv" },
        .from = .{ .target = "core", .service = "threads" },
        .method = "scroll",
        .scope = "acme",
        .user = "user@example.com",
        .auth = "eyJhbGciOiJFZERTQSJ9.payload.signature",
        .codec = .capnp,
        .seq = 42_000,
        .fin = true,
        .deadline_ms = 30_000,
        .error_code = "upstream_gone",
    };
    var buf: [1024]u8 = undefined;
    const encoded = try encode(&env, &buf);
    const decoded = try decode(encoded);
    try expectEnvelopeEqual(&env, &decoded);
}

test "auth extends the envelope without changing legacy encoding" {
    const legacy = Envelope{ .kind = .request, .version = 0 };
    var legacy_buf: [128]u8 = undefined;
    const legacy_bytes = try encode(&legacy, &legacy_buf);
    const legacy_decoded = try decode(legacy_bytes);
    try std.testing.expectEqualStrings("", legacy_decoded.auth);

    const authenticated = Envelope{
        .kind = .request,
        .request_id = "request",
        .to = .{ .target = "ms:test", .service = "test" },
        .method = "getState",
        .deadline_ms = 1,
        .auth = "signed.jwt",
    };
    var auth_buf: [256]u8 = undefined;
    const auth_bytes = try encode(&authenticated, &auth_buf);
    const decoded = try decode(auth_bytes);
    try std.testing.expectEqualStrings("signed.jwt", decoded.auth);
}

test "round-trip with sparse fields" {
    const env = Envelope{
        .kind = .event,
        .method = "job.updated",
        .from = .{ .target = "centimanus", .service = "" },
        .scope = "tenant-b",
    };
    var buf: [512]u8 = undefined;
    const encoded = try encode(&env, &buf);
    const decoded = try decode(encoded);
    try expectEnvelopeEqual(&env, &decoded);
}

test "rejects malformed input" {
    try std.testing.expectError(DecodeError.MessageTruncated, decode(""));
    try std.testing.expectError(DecodeError.MessageTruncated, decode(&[_]u8{0} ** 12));

    // multi-segment
    var multi = hexBytes(golden_empty_hex);
    std.mem.writeInt(u32, multi[0..4], 1, .little);
    try std.testing.expectError(DecodeError.MultiSegmentUnsupported, decode(&multi));

    // segment length larger than the buffer
    var oversize = hexBytes(golden_empty_hex);
    std.mem.writeInt(u32, oversize[4..8], 1000, .little);
    try std.testing.expectError(DecodeError.MessageTruncated, decode(&oversize));

    // unknown enum value
    var bad_kind = hexBytes(golden_full_hex);
    std.mem.writeInt(u16, bad_kind[8 + 8 + 2 ..][0..2], 99, .little);
    try std.testing.expectError(DecodeError.KindInvalid, decode(&bad_kind));

    // text pointer escaping the segment
    var bad_ptr = hexBytes(golden_full_hex);
    std.mem.writeInt(u32, bad_ptr[8 + 3 * 8 ..][0..4], (10_000 << 2) | 1, .little);
    try std.testing.expectError(DecodeError.PointerOutOfBounds, decode(&bad_ptr));
}

test "validateForSend enforces routing invariants" {
    var env = golden_full_env;
    try validateForSend(&env);

    env.deadline_ms = 0;
    try std.testing.expectError(ValidationError.DeadlineRequired, validateForSend(&env));

    env.deadline_ms = 1000;
    env.request_id = "";
    try std.testing.expectError(ValidationError.RequestIdRequired, validateForSend(&env));

    const event = Envelope{ .kind = .event };
    try std.testing.expectError(ValidationError.MethodRequired, validateForSend(&event));
}

test "encodedSize matches encoded output" {
    var buf: [1024]u8 = undefined;
    const encoded = try encode(&golden_full_env, &buf);
    try std.testing.expectEqual(encoded.len, encodedSize(&golden_full_env));
}
