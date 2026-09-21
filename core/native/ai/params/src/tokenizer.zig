const std = @import("std");

const Piece = struct { text: []u8, id: u32, score: f32 };

pub const Tokenizer = struct {
    allocator: std.mem.Allocator,
    pieces: []Piece,
    buckets: [256]std.ArrayListUnmanaged(u32) = [_]std.ArrayListUnmanaged(u32){.empty} ** 256,
    special: std.StringHashMapUnmanaged(u32) = .empty,
    unk_id: u32,

    pub fn init(allocator: std.mem.Allocator, path: []const u8) !Tokenizer {
        const bytes = try std.Io.Dir.cwd().readFileAlloc(std.Options.debug_io, path, allocator, .limited(64 * 1024 * 1024));
        defer allocator.free(bytes);
        var parsed = try std.json.parseFromSlice(std.json.Value, allocator, bytes, .{});
        defer parsed.deinit();
        const root = switch (parsed.value) { .object => |v| v, else => return error.TokenizerRootInvalid };
        const model = switch (root.get("model") orelse return error.TokenizerModelMissing) { .object => |v| v, else => return error.TokenizerModelInvalid };
        const kind = switch (model.get("type") orelse return error.TokenizerModelMissing) { .string => |v| v, else => return error.TokenizerModelInvalid };
        if (!std.mem.eql(u8, kind, "Unigram")) return error.UnsupportedTokenizer;
        const vocab = switch (model.get("vocab") orelse return error.TokenizerVocabMissing) { .array => |v| v.items, else => return error.TokenizerVocabInvalid };
        const unknown = switch (model.get("unk_id") orelse return error.TokenizerModelMissing) { .integer => |v| std.math.cast(u32, v) orelse return error.TokenIdInvalid, else => return error.TokenIdInvalid };
        var result = Tokenizer{ .allocator = allocator, .pieces = try allocator.alloc(Piece, vocab.len), .unk_id = unknown };
        errdefer result.deinit();
        for (vocab, 0..) |entry, i| {
            const pair = switch (entry) { .array => |v| v.items, else => return error.TokenizerVocabInvalid };
            const text = switch (pair[0]) { .string => |v| v, else => return error.TokenizerVocabInvalid };
            const score: f32 = switch (pair[1]) { .float => |v| @floatCast(v), .integer => |v| @floatFromInt(v), else => return error.TokenizerVocabInvalid };
            result.pieces[i] = .{ .text = try allocator.dupe(u8, text), .id = @intCast(i), .score = score };
            if (text.len > 0) try result.buckets[text[0]].append(allocator, @intCast(i));
        }
        const added = switch (root.get("added_tokens") orelse return result) { .array => |v| v.items, else => return error.TokenizerRootInvalid };
        for (added) |entry| {
            const object = switch (entry) { .object => |v| v, else => continue };
            const text = switch (object.get("content") orelse continue) { .string => |v| v, else => continue };
            const id = switch (object.get("id") orelse continue) { .integer => |v| std.math.cast(u32, v) orelse continue, else => continue };
            try result.special.put(allocator, try allocator.dupe(u8, text), id);
        }
        return result;
    }

    pub fn deinit(self: *Tokenizer) void {
        for (self.pieces) |piece| self.allocator.free(piece.text);
        self.allocator.free(self.pieces);
        for (&self.buckets) |*bucket| bucket.deinit(self.allocator);
        var it = self.special.iterator();
        while (it.next()) |entry| self.allocator.free(entry.key_ptr.*);
        self.special.deinit(self.allocator);
    }

    pub fn encode(self: *const Tokenizer, allocator: std.mem.Allocator, text: []const u8) ![]i64 {
        if (self.special.get(text)) |id| return allocator.dupe(i64, &.{@intCast(id)});
        var input: std.ArrayList(u8) = .empty;
        defer input.deinit(allocator);
        try input.appendSlice(allocator, "\xe2\x96\x81");
        for (text) |byte| {
            if (byte == ' ') try input.appendSlice(allocator, "\xe2\x96\x81") else try input.append(allocator, byte);
        }
        const n = input.items.len;
        var score = try allocator.alloc(f32, n + 1); defer allocator.free(score);
        var previous = try allocator.alloc(usize, n + 1); defer allocator.free(previous);
        var chosen = try allocator.alloc(u32, n + 1); defer allocator.free(chosen);
        @memset(score, -std.math.inf(f32)); score[0] = 0;
        for (0..n) |start| {
            if (!std.math.isFinite(score[start])) continue;
            for (self.buckets[input.items[start]].items) |index| {
                const piece = self.pieces[index]; const end = start + piece.text.len;
                if (end <= n and std.mem.eql(u8, input.items[start..end], piece.text) and score[start] + piece.score > score[end]) { score[end] = score[start] + piece.score; previous[end] = start; chosen[end] = piece.id; }
            }
            if (!std.math.isFinite(score[start + 1])) { score[start + 1] = score[start] - 20; previous[start + 1] = start; chosen[start + 1] = self.unk_id; }
        }
        var ids: std.ArrayList(i64) = .empty; errdefer ids.deinit(allocator);
        var at = n; while (at > 0) { try ids.append(allocator, @intCast(chosen[at])); at = previous[at]; }
        std.mem.reverse(i64, ids.items);
        return ids.toOwnedSlice(allocator);
    }
};
