const std = @import("std");

pub const Tokenizer = struct {
    allocator: std.mem.Allocator,
    vocab: std.StringHashMapUnmanaged(u32) = .empty,
    ranks: std.StringHashMapUnmanaged(u32) = .empty,

    pub fn init(allocator: std.mem.Allocator, path: []const u8) !Tokenizer {
        const source = try std.Io.Dir.cwd().readFileAlloc(
            std.Options.debug_io,
            path,
            allocator,
            .limited(64 * 1024 * 1024),
        );
        defer allocator.free(source);
        var parsed = try std.json.parseFromSlice(std.json.Value, allocator, source, .{});
        defer parsed.deinit();
        const root = switch (parsed.value) {
            .object => |object| object,
            else => return error.TokenizerRootInvalid,
        };
        const model = switch (root.get("model") orelse return error.TokenizerModelMissing) {
            .object => |object| object,
            else => return error.TokenizerModelInvalid,
        };
        var result = Tokenizer{ .allocator = allocator };
        errdefer result.deinit();
        const vocab = switch (model.get("vocab") orelse return error.TokenizerVocabMissing) {
            .object => |object| object,
            else => return error.TokenizerVocabInvalid,
        };
        var vocab_it = vocab.iterator();
        while (vocab_it.next()) |item| {
            const id: u32 = switch (item.value_ptr.*) {
                .integer => |value| std.math.cast(u32, value) orelse return error.TokenIdInvalid,
                else => return error.TokenIdInvalid,
            };
            const key = try allocator.dupe(u8, item.key_ptr.*);
            try result.vocab.put(allocator, key, id);
        }
        const merges = switch (model.get("merges") orelse return error.TokenizerMergesMissing) {
            .array => |array| array.items,
            else => return error.TokenizerMergesInvalid,
        };
        for (merges, 0..) |merge, rank| {
            const pair = switch (merge) {
                .array => |array| array.items,
                else => return error.TokenizerMergeInvalid,
            };
            if (pair.len != 2) return error.TokenizerMergeInvalid;
            const left = switch (pair[0]) {
                .string => |value| value,
                else => return error.TokenizerMergeInvalid,
            };
            const right = switch (pair[1]) {
                .string => |value| value,
                else => return error.TokenizerMergeInvalid,
            };
            const key = try std.fmt.allocPrint(allocator, "{s}\x00{s}", .{ left, right });
            try result.ranks.put(allocator, key, @intCast(rank));
        }
        return result;
    }

    pub fn deinit(self: *Tokenizer) void {
        var vocab_it = self.vocab.iterator();
        while (vocab_it.next()) |item| self.allocator.free(item.key_ptr.*);
        self.vocab.deinit(self.allocator);
        var rank_it = self.ranks.iterator();
        while (rank_it.next()) |item| self.allocator.free(item.key_ptr.*);
        self.ranks.deinit(self.allocator);
    }

    pub fn encode(self: *const Tokenizer, allocator: std.mem.Allocator, text: []const u8, max_tokens: usize) ![]i64 {
        var arena = std.heap.ArenaAllocator.init(allocator);
        defer arena.deinit();
        const temp = arena.allocator();
        var pieces: std.ArrayList([]const u8) = .empty;
        for (text) |byte| try pieces.append(temp, try byteSymbol(temp, byte));
        while (pieces.items.len > 1) {
            var best_rank: ?u32 = null;
            var best_index: usize = 0;
            for (pieces.items[0 .. pieces.items.len - 1], 0..) |left, i| {
                const key = try std.fmt.allocPrint(temp, "{s}\x00{s}", .{ left, pieces.items[i + 1] });
                if (self.ranks.get(key)) |rank| {
                    if (best_rank == null or rank < best_rank.?) {
                        best_rank = rank;
                        best_index = i;
                    }
                }
            }
            if (best_rank == null) break;
            const combined = try std.fmt.allocPrint(temp, "{s}{s}", .{ pieces.items[best_index], pieces.items[best_index + 1] });
            pieces.items[best_index] = combined;
            _ = pieces.orderedRemove(best_index + 1);
        }
        var ids: std.ArrayList(i64) = .empty;
        errdefer ids.deinit(allocator);
        try ids.append(allocator, 179934);
        const capacity = max_tokens - 1;
        for (pieces.items) |piece| {
            if (ids.items.len >= capacity) break;
            const id = self.vocab.get(piece) orelse {
                std.log.err("token not in vocab: {s}", .{piece});
                return error.TokenNotInVocab;
            };
            try ids.append(allocator, @intCast(id));
        }
        try ids.append(allocator, 179938);
        return ids.toOwnedSlice(allocator);
    }
};

fn byteSymbol(allocator: std.mem.Allocator, byte: u8) ![]u8 {
    const codepoint: u21 = if ((byte >= 33 and byte <= 126) or (byte >= 161 and byte <= 172) or (byte >= 174))
        byte
    else if (byte < 33)
        @as(u21, byte) + 256
    else if (byte < 161)
        @as(u21, byte) + 162
    else
        323;
    var bytes: [4]u8 = undefined;
    const length = try std.unicode.utf8Encode(codepoint, &bytes);
    return allocator.dupe(u8, bytes[0..length]);
}
