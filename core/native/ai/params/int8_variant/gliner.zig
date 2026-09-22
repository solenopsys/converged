const std = @import("std");
const Tokenizer = @import("tokenizer.zig").Tokenizer;

pub const Packed = struct {
    ids: []i64,
    words_mask: []i64,
    text_length: i64,
    task_type: i64,
    label_positions: []i64,
    label_mask: []i64,
    starts: []usize,
    ends: []usize,

    pub fn deinit(self: *Packed, allocator: std.mem.Allocator) void {
        allocator.free(self.ids);
        allocator.free(self.words_mask);
        allocator.free(self.label_positions);
        allocator.free(self.label_mask);
        allocator.free(self.starts);
        allocator.free(self.ends);
    }
};

const Token = struct { text: []const u8, start: usize, end: usize };
const max_seq_len = 512;

pub fn pack(allocator: std.mem.Allocator, tokenizer: *const Tokenizer, text: []const u8, labels: []const []const u8, marker: []const u8, prompt: []const u8, task_type: i64) !Packed {
    var words: std.ArrayList(Token) = .empty;
    defer words.deinit(allocator);
    try splitWords(allocator, text, &words);
    var ids: std.ArrayList(i64) = .empty;
    errdefer ids.deinit(allocator);
    var words_mask: std.ArrayList(i64) = .empty;
    errdefer words_mask.deinit(allocator);
    var label_positions: std.ArrayList(i64) = .empty;
    errdefer label_positions.deinit(allocator);

    try appendToken(allocator, tokenizer, &ids, &words_mask, "(", false);
    try appendToken(allocator, tokenizer, &ids, &words_mask, "[P]", false);
    try appendToken(allocator, tokenizer, &ids, &words_mask, prompt, false);
    try appendToken(allocator, tokenizer, &ids, &words_mask, "(", false);
    for (labels, 0..) |label, index| {
        try label_positions.append(allocator, @intCast(ids.items.len));
        try appendToken(allocator, tokenizer, &ids, &words_mask, marker, false);
        try appendToken(allocator, tokenizer, &ids, &words_mask, label, false);
        _ = index;
    }
    try appendToken(allocator, tokenizer, &ids, &words_mask, ")", false);
    try appendToken(allocator, tokenizer, &ids, &words_mask, ")", false);
    try appendToken(allocator, tokenizer, &ids, &words_mask, "[SEP_TEXT]", false);

    var starts: std.ArrayList(usize) = .empty;
    errdefer starts.deinit(allocator);
    var ends: std.ArrayList(usize) = .empty;
    errdefer ends.deinit(allocator);
    for (words.items) |word| {
        try starts.append(allocator, word.start);
        try ends.append(allocator, word.end);
        try appendToken(allocator, tokenizer, &ids, &words_mask, word.text, true);
    }
    if (ids.items.len > max_seq_len) return error.InputTooLong;

    const label_mask = try allocator.alloc(i64, labels.len);
    @memset(label_mask, 1);
    return .{
        .ids = try ids.toOwnedSlice(allocator),
        .words_mask = try words_mask.toOwnedSlice(allocator),
        .text_length = @intCast(words.items.len),
        .task_type = task_type,
        .label_positions = try label_positions.toOwnedSlice(allocator),
        .label_mask = label_mask,
        .starts = try starts.toOwnedSlice(allocator),
        .ends = try ends.toOwnedSlice(allocator),
    };
}

fn appendToken(allocator: std.mem.Allocator, tokenizer: *const Tokenizer, ids: *std.ArrayList(i64), words_mask: *std.ArrayList(i64), token: []const u8, is_word: bool) !void {
    const encoded = try tokenizer.encode(allocator, token);
    defer allocator.free(encoded);
    for (encoded, 0..) |id, index| {
        try ids.append(allocator, id);
        try words_mask.append(allocator, if (is_word and index == 0) 1 else 0);
    }
}

fn splitWords(allocator: std.mem.Allocator, text: []const u8, output: *std.ArrayList(Token)) !void {
    var at: usize = 0;
    while (at < text.len) {
        while (at < text.len and std.ascii.isWhitespace(text[at])) : (at += 1) {}
        if (at == text.len) break;
        const start = at;
        if (isPunctuation(text[at])) at += 1 else while (at < text.len and !std.ascii.isWhitespace(text[at]) and !isPunctuation(text[at])) : (at += 1) {}
        try output.append(allocator, .{ .text = text[start..at], .start = start, .end = at });
    }
}

fn isPunctuation(byte: u8) bool {
    return switch (byte) { '.', ',', '!', '?', ':', ';', '(', ')', '[', ']', '{', '}', '"' => true, else => false };
}
