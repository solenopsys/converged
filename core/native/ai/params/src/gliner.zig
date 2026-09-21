const std = @import("std");
const Tokenizer = @import("tokenizer.zig").Tokenizer;

pub const Classifier = struct { task: []const u8, labels: []const []const u8, prompt: ?[]const u8 = null };
pub const Schema = struct { entities: []const []const u8, classifiers: []const Classifier };

pub const Packed = struct {
    ids: []i64,
    words: []i64,
    queries: []i64,
    classes: []i64,
    starts: []usize,
    ends: []usize,
    entity_labels: []const []const u8,
    classifiers: []const Classifier,

    pub fn deinit(self: *Packed, allocator: std.mem.Allocator) void {
        allocator.free(self.ids); allocator.free(self.words); allocator.free(self.queries); allocator.free(self.classes);
        allocator.free(self.starts); allocator.free(self.ends);
    }
};

const Token = struct { text: []const u8, start: usize, end: usize };

pub fn pack(allocator: std.mem.Allocator, tokenizer: *const Tokenizer, text: []const u8, schema: Schema) !Packed {
    var words: std.ArrayList(Token) = .empty; defer words.deinit(allocator);
    try splitWords(allocator, text, &words);
    var starts: std.ArrayList(usize) = .empty; errdefer starts.deinit(allocator);
    var ends: std.ArrayList(usize) = .empty; errdefer ends.deinit(allocator);
    for (words.items) |word| { try starts.append(allocator, word.start); try ends.append(allocator, word.end); }

    var ids: std.ArrayList(i64) = .empty; errdefer ids.deinit(allocator);
    var word_positions: std.ArrayList(i64) = .empty; errdefer word_positions.deinit(allocator);
    var query_positions: std.ArrayList(i64) = .empty; errdefer query_positions.deinit(allocator);
    var class_positions: std.ArrayList(i64) = .empty; errdefer class_positions.deinit(allocator);
    if (schema.entities.len > 0) {
        try appendSchema(allocator, tokenizer, &ids, &query_positions, "entities", schema.entities, "[E]", null);
        if (schema.classifiers.len > 0) try appendToken(allocator, tokenizer, &ids, "[SEP_STRUCT]");
    }
    for (schema.classifiers, 0..) |classifier, i| {
        try appendSchema(allocator, tokenizer, &ids, &class_positions, classifier.task, classifier.labels, "[L]", classifier.prompt);
        if (i + 1 < schema.classifiers.len) try appendToken(allocator, tokenizer, &ids, "[SEP_STRUCT]");
    }
    try appendToken(allocator, tokenizer, &ids, "[SEP_TEXT]");
    for (words.items) |word| {
        try word_positions.append(allocator, @intCast(ids.items.len));
        try appendToken(allocator, tokenizer, &ids, word.text);
    }
    return .{
        .ids = try ids.toOwnedSlice(allocator), .words = try word_positions.toOwnedSlice(allocator),
        .queries = try query_positions.toOwnedSlice(allocator), .classes = try class_positions.toOwnedSlice(allocator),
        .starts = try starts.toOwnedSlice(allocator), .ends = try ends.toOwnedSlice(allocator),
        .entity_labels = schema.entities, .classifiers = schema.classifiers,
    };
}

fn appendSchema(allocator: std.mem.Allocator, tokenizer: *const Tokenizer, ids: *std.ArrayList(i64), routes: *std.ArrayList(i64), parent: []const u8, labels: []const []const u8, marker: []const u8, prompt: ?[]const u8) !void {
    try appendToken(allocator, tokenizer, ids, "(");
    try appendToken(allocator, tokenizer, ids, "[P]");
    // GLiNER routes children only; the parent marker is intentionally skipped.
    if (prompt) |value| {
        const prompt_text = try std.fmt.allocPrint(allocator, "{s}: {s}", .{ parent, value });
        defer allocator.free(prompt_text);
        try appendToken(allocator, tokenizer, ids, prompt_text);
    } else try appendToken(allocator, tokenizer, ids, parent);
    try appendToken(allocator, tokenizer, ids, "(");
    for (labels) |label| {
        try routes.append(allocator, @intCast(ids.items.len));
        try appendToken(allocator, tokenizer, ids, marker);
        try appendToken(allocator, tokenizer, ids, label);
    }
    try appendToken(allocator, tokenizer, ids, ")");
    try appendToken(allocator, tokenizer, ids, ")");
}

fn appendToken(allocator: std.mem.Allocator, tokenizer: *const Tokenizer, ids: *std.ArrayList(i64), token: []const u8) !void {
    const encoded = try tokenizer.encode(allocator, token);
    defer allocator.free(encoded);
    try ids.appendSlice(allocator, encoded);
}

fn splitWords(allocator: std.mem.Allocator, text: []const u8, output: *std.ArrayList(Token)) !void {
    var at: usize = 0;
    while (at < text.len) {
        while (at < text.len and std.ascii.isWhitespace(text[at])) : (at += 1) {}
        if (at == text.len) break;
        const start = at;
        if (isPunctuation(text[at])) {
            at += 1;
        } else {
            while (at < text.len and !std.ascii.isWhitespace(text[at]) and !isPunctuation(text[at])) : (at += 1) {}
        }
        try output.append(allocator, .{ .text = text[start..at], .start = start, .end = at });
    }
}

fn isPunctuation(byte: u8) bool {
    return switch (byte) {
        '.', ',', '!', '?', ':', ';', '(', ')', '[', ']', '{', '}', '"' => true,
        else => false,
    };
}
