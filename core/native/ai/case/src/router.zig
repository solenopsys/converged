const std = @import("std");
const context = @import("context.zig");

pub const kernel_tau: f32 = 0.05;
pub const neighbor_limit: usize = 20;
pub const unknown_threshold: f32 = 0.65;
pub const execute_threshold: f32 = 0.85;
pub const surface_ratio: f32 = 1.5;
pub const command_margin: f32 = 0.01;

pub const RouteResult = struct {
    decision: []const u8,
    reason: []const u8,
    language: []const u8,
    section: ?[]const u8,
    command: ?[]const u8,
    score: f32,
    surface_weight: ?f32,
    surface_log_gap: ?f32,
};

const ScoredEntry = struct {
    entry: *const context.Entry,
    similarity: f32,
    weight: f32,
};

const CommandAggregate = struct {
    id: []const u8,
    weight_sum: f32 = 0,
    count: usize = 0,
    best_similarity: f32 = -1,
};

const SectionAggregate = struct {
    id: []const u8,
    commands: std.ArrayList(CommandAggregate) = .empty,

    fn deinit(self: *SectionAggregate, allocator: std.mem.Allocator) void {
        self.commands.deinit(allocator);
    }
};

pub fn route(allocator: std.mem.Allocator, index: *const context.Index, language: []const u8, query_vector: []const f32) !RouteResult {
    var scored: std.ArrayList(ScoredEntry) = .empty;
    defer scored.deinit(allocator);
    var global_best: f32 = -1;
    for (index.entries.items) |*entry| {
        if (!std.mem.eql(u8, language, entry.language)) continue;
        const similarity = dot(query_vector, entry.vector);
        global_best = @max(global_best, similarity);
        try scored.append(allocator, .{ .entry = entry, .similarity = similarity, .weight = @exp((similarity - 1.0) / kernel_tau) });
    }
    if (scored.items.len == 0 or global_best < unknown_threshold) return .{ .decision = "UNKNOWN", .reason = "no_examples", .language = language, .section = null, .command = null, .score = global_best, .surface_weight = null, .surface_log_gap = null };

    std.sort.block(ScoredEntry, scored.items, {}, lessSimilar);
    if (scored.items.len > neighbor_limit) scored.shrinkRetainingCapacity(neighbor_limit);

    var sections: std.ArrayList(SectionAggregate) = .empty;
    defer {
        for (sections.items) |*section| section.deinit(allocator);
        sections.deinit(allocator);
    }
    for (scored.items) |candidate| {
        const section_index = findOrAppendSection(allocator, &sections, candidate.entry.section) catch return error.OutOfMemory;
        const command_index = findOrAppendCommand(allocator, &sections.items[section_index].commands, candidate.entry.id) catch return error.OutOfMemory;
        var command = &sections.items[section_index].commands.items[command_index];
        command.weight_sum += candidate.weight;
        command.count += 1;
        command.best_similarity = @max(command.best_similarity, candidate.similarity);
    }

    var best_section: usize = 0;
    var second_section: ?usize = null;
    var best_section_score = sectionScore(sections.items, 0);
    var second_section_score: f32 = 0;
    for (sections.items[1..], 1..) |_, i| {
        const score = sectionScore(sections.items, i);
        if (score > best_section_score) {
            second_section = best_section;
            second_section_score = best_section_score;
            best_section = i;
            best_section_score = score;
        } else if (second_section == null or score > second_section_score) {
            second_section = i;
            second_section_score = score;
        }
    }
    const winning_section = &sections.items[best_section];
    const section_count = countSectionNeighbors(scored.items, winning_section.id);
    const section_gap = if (second_section) |i| @log(best_section_score / sectionScore(sections.items, i)) else @as(f32, 100.0);
    if (section_count < 2 or (second_section != null and section_gap < @log(surface_ratio))) return .{ .decision = "AMBIGUOUS", .reason = "surface_conflict", .language = language, .section = null, .command = null, .score = global_best, .surface_weight = best_section_score, .surface_log_gap = section_gap };

    var best_command: usize = 0;
    var second_command: ?usize = null;
    for (winning_section.commands.items[1..], 1..) |command, i| {
        if (command.best_similarity > winning_section.commands.items[best_command].best_similarity) {
            second_command = best_command;
            best_command = i;
        } else if (second_command == null or command.best_similarity > winning_section.commands.items[second_command.?].best_similarity) {
            second_command = i;
        }
    }
    const command_score = winning_section.commands.items[best_command].best_similarity;
    const command_gap = if (second_command) |i| command_score - winning_section.commands.items[i].best_similarity else @as(f32, 100.0);
    if (command_score < execute_threshold) return .{ .decision = "AMBIGUOUS", .reason = "weak_command", .language = language, .section = winning_section.id, .command = null, .score = command_score, .surface_weight = best_section_score, .surface_log_gap = section_gap };
    if (second_command != null and command_gap < command_margin) return .{ .decision = "AMBIGUOUS", .reason = "command_conflict", .language = language, .section = winning_section.id, .command = null, .score = command_score, .surface_weight = best_section_score, .surface_log_gap = section_gap };
    return .{ .decision = "EXECUTE", .reason = "confident_match", .language = language, .section = winning_section.id, .command = winning_section.commands.items[best_command].id, .score = command_score, .surface_weight = best_section_score, .surface_log_gap = section_gap };
}

fn findOrAppendSection(allocator: std.mem.Allocator, sections: *std.ArrayList(SectionAggregate), id: []const u8) !usize {
    for (sections.items, 0..) |section, i| if (std.mem.eql(u8, section.id, id)) return i;
    try sections.append(allocator, .{ .id = id });
    return sections.items.len - 1;
}

fn lessSimilar(_: void, left: ScoredEntry, right: ScoredEntry) bool {
    return left.similarity > right.similarity;
}

fn findOrAppendCommand(allocator: std.mem.Allocator, commands: *std.ArrayList(CommandAggregate), id: []const u8) !usize {
    for (commands.items, 0..) |command, i| if (std.mem.eql(u8, command.id, id)) return i;
    try commands.append(allocator, .{ .id = id });
    return commands.items.len - 1;
}

fn sectionScore(sections: []const SectionAggregate, index: usize) f32 {
    var score: f32 = 0;
    for (sections[index].commands.items) |command| score += command.weight_sum / @as(f32, @floatFromInt(command.count));
    return score / @as(f32, @floatFromInt(sections[index].commands.items.len));
}

fn countSectionNeighbors(scored: []const ScoredEntry, section: []const u8) usize {
    var count: usize = 0;
    for (scored) |candidate| {
        if (std.mem.eql(u8, section, candidate.entry.section)) count += 1;
    }
    return count;
}

pub fn detectLanguage(text: []const u8) []const u8 {
    if (containsAny(text, &.{ "открой", "покажи", "чат", "переписк", "удали", "измени" })) return "ru";
    if (containsAny(text, &.{ "öffne", "zeige", "chat", "unterhaltung", "lösche", "bearbeite" })) return "de";
    if (containsAny(text, &.{ "abre", "muestra", "chat", "conversación", "elimina", "edita" })) return "es";
    if (containsAny(text, &.{ "ouvre", "affiche", "discussion", "conversation", "supprime", "modifie" })) return "fr";
    if (containsAny(text, &.{ "apri", "mostra", "conversazione", "elimina", "modifica" })) return "it";
    if (containsAny(text, &.{ "abra", "mostre", "conversa", "exclua", "edite" })) return "pt";
    return "en";
}

fn containsAny(text: []const u8, words: []const []const u8) bool {
    for (words) |word| if (std.mem.indexOf(u8, text, word) != null) return true;
    return false;
}

fn dot(a: []const f32, b: []const f32) f32 {
    var value: f32 = 0;
    for (a, b) |left, right| value += left * right;
    return value;
}
