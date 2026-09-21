const std = @import("std");

// Vocabulary for the CTC model: plain-text tokens, one per line as
// "<token> <id>". The token itself may be a single space (vocab id 4).
// Blank is index 0 ("<s>").
pub const blank_id: i64 = 0;

pub const Vocab = struct {
    allocator: std.mem.Allocator,
    tokens: [][]u8,
    size: usize,

    pub fn init(allocator: std.mem.Allocator, path: []const u8) !Vocab {
        const bytes = try std.Io.Dir.cwd().readFileAlloc(std.Options.debug_io, path, allocator, .limited(4 * 1024 * 1024));
        defer allocator.free(bytes);
        var count: usize = 0;
        var lines = std.mem.splitScalar(u8, bytes, '\n');
        while (lines.next()) |line| {
            if (line.len == 0) continue;
            count += 1;
        }
        var tokens = try allocator.alloc([]u8, count);
        errdefer {
            for (tokens) |entry| if (entry.len > 0) allocator.free(entry);
            allocator.free(tokens);
        }
        @memset(tokens, &.{});
        lines = std.mem.splitScalar(u8, bytes, '\n');
        while (lines.next()) |line| {
            if (line.len == 0) continue;
            const at = std.mem.lastIndexOfScalar(u8, line, ' ') orelse return error.VocabLineInvalid;
            const token = line[0..at];
            const token_id = try std.fmt.parseInt(usize, line[at + 1 ..], 10);
            if (token_id >= count) return error.VocabIdOutOfRange;
            tokens[token_id] = try allocator.dupe(u8, token);
        }
        return .{ .allocator = allocator, .tokens = tokens, .size = count };
    }

    pub fn deinit(self: *Vocab) void {
        for (self.tokens) |entry| if (entry.len > 0) self.allocator.free(entry);
        self.allocator.free(self.tokens);
    }

    pub fn lookup(self: *const Vocab, index: usize) []const u8 {
        return self.tokens[index];
    }
};

// Greedy CTC decode: argmax per frame, collapse repeats, drop blanks.
// Same rule as sherpa-onnx OfflineCtcGreedySearchDecoder and
// onnx-asr _AsrWithCtcDecoding (blank 0, prepend blank for dedupe).
pub fn decode(allocator: std.mem.Allocator, vocab: *const Vocab, logits: []const f32, frames: usize, vocab_size: usize, max_frames: usize) ![]u8 {
    var out: std.ArrayList(u8) = .empty;
    errdefer out.deinit(allocator);
    var previous: i64 = blank_id;
    const limit = @min(frames, max_frames);
    var frame: usize = 0;
    while (frame < limit) : (frame += 1) {
        const row = logits[frame * vocab_size ..][0..vocab_size];
        var best: usize = 0;
        var best_value = row[0];
        for (row[1..], 1..) |value, index| {
            if (value > best_value) {
                best_value = value;
                best = index;
            }
        }
        const id: i64 = @intCast(best);
        if (id != blank_id and id != previous) {
            if (best >= vocab.size) return error.VocabIdOutOfRange;
            try out.appendSlice(allocator, vocab.lookup(best));
        }
        previous = id;
    }
    const text = try out.toOwnedSlice(allocator);
    return trimSpaces(allocator, text);
}

fn trimSpaces(allocator: std.mem.Allocator, text: []u8) ![]u8 {
    const trimmed = std.mem.trim(u8, text, " \t\r\n");
    if (trimmed.len == text.len) return text;
    defer allocator.free(text);
    return allocator.dupe(u8, trimmed);
}
