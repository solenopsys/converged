const std = @import("std");

const c_allocator = std.heap.c_allocator;

const c = @cImport({
    @cInclude("md4c.h");
    @cInclude("md4c-html.h");
});

// --- HTML Rendering ---

const HtmlContext = struct {
    list: std.ArrayListUnmanaged(u8),
    failed: bool,
};

fn html_process_output(data: [*c]const u8, size: c.MD_SIZE, userdata: ?*anyopaque) callconv(.c) void {
    const ctx: *HtmlContext = @ptrCast(@alignCast(userdata));
    if (ctx.failed) return;

    if (size > 0) {
        ctx.list.appendSlice(c_allocator, data[0..size]) catch {
            ctx.failed = true;
        };
    }
}

export fn md4c_to_html(input: [*]const u8, input_len: usize, output_ptr: *?[*]u8, output_len: *usize, parser_flags: u32, renderer_flags: u32) c_int {
    var ctx = HtmlContext{
        .list = .{},
        .failed = false,
    };

    const rc = c.md_html(input, @intCast(input_len), html_process_output, &ctx, parser_flags, renderer_flags);

    if (rc != 0 or ctx.failed) {
        ctx.list.deinit(c_allocator);
        return -1;
    }

    const slice = ctx.list.toOwnedSlice(c_allocator) catch {
        ctx.list.deinit(c_allocator);
        return -1;
    };

    output_ptr.* = slice.ptr;
    output_len.* = slice.len;

    return 0;
}

// --- JSON AST Generation ---

const JsonNodeType = enum {
    root,
    block,
    span,
    text,
};

// Simple key-value pair for details
const DetailEntry = struct {
    key: []const u8,
    value: DetailValue,
};

const DetailValue = union(enum) {
    integer: i64,
    string: []const u8,
    boolean: bool,
};

const JsonNode = struct {
    node_type: JsonNodeType,
    type_name: []const u8,
    text: ?[]const u8 = null,
    children: std.ArrayListUnmanaged(*JsonNode),
    details: std.ArrayListUnmanaged(DetailEntry) = .{},

    pub fn init(allocator: std.mem.Allocator, node_type: JsonNodeType, type_name: []const u8) !*JsonNode {
        const node = try allocator.create(JsonNode);
        node.* = .{
            .node_type = node_type,
            .type_name = type_name,
            .children = .{},
        };
        return node;
    }

    pub fn addDetail(self: *JsonNode, allocator: std.mem.Allocator, key: []const u8, value: DetailValue) !void {
        try self.details.append(allocator, .{ .key = key, .value = value });
    }
};

const JsonContext = struct {
    allocator: std.mem.Allocator,
    root: *JsonNode,
    stack: std.ArrayListUnmanaged(*JsonNode),
    failed: bool,
};

fn get_block_type_name(t: c.MD_BLOCKTYPE) []const u8 {
    return switch (t) {
        c.MD_BLOCK_DOC => "doc",
        c.MD_BLOCK_QUOTE => "quote",
        c.MD_BLOCK_UL => "ul",
        c.MD_BLOCK_OL => "ol",
        c.MD_BLOCK_LI => "li",
        c.MD_BLOCK_HR => "hr",
        c.MD_BLOCK_H => "h",
        c.MD_BLOCK_CODE => "code",
        c.MD_BLOCK_HTML => "html",
        c.MD_BLOCK_P => "p",
        c.MD_BLOCK_TABLE => "table",
        c.MD_BLOCK_THEAD => "thead",
        c.MD_BLOCK_TBODY => "tbody",
        c.MD_BLOCK_TR => "tr",
        c.MD_BLOCK_TH => "th",
        c.MD_BLOCK_TD => "td",
        else => "unknown",
    };
}

fn get_span_type_name(t: c.MD_SPANTYPE) []const u8 {
    return switch (t) {
        c.MD_SPAN_EM => "em",
        c.MD_SPAN_STRONG => "strong",
        c.MD_SPAN_A => "a",
        c.MD_SPAN_IMG => "img",
        c.MD_SPAN_CODE => "code",
        c.MD_SPAN_DEL => "del",
        c.MD_SPAN_LATEXMATH => "latexmath",
        c.MD_SPAN_LATEXMATH_DISPLAY => "latexmath_display",
        c.MD_SPAN_WIKILINK => "wikilink",
        c.MD_SPAN_U => "u",
        else => "unknown",
    };
}

fn get_text_type_name(t: c.MD_TEXTTYPE) []const u8 {
    return switch (t) {
        c.MD_TEXT_NORMAL => "text",
        c.MD_TEXT_NULLCHAR => "nullchar",
        c.MD_TEXT_BR => "br",
        c.MD_TEXT_SOFTBR => "softbr",
        c.MD_TEXT_ENTITY => "entity",
        c.MD_TEXT_CODE => "code",
        c.MD_TEXT_HTML => "html",
        c.MD_TEXT_LATEXMATH => "latexmath",
        else => "unknown",
    };
}

// Helper to convert MD_ATTRIBUTE to string
fn attr_to_string(allocator: std.mem.Allocator, attr: c.MD_ATTRIBUTE) ![]u8 {
    // For simplicity, we just use the text content.
    // A full implementation would process substrings (entities).
    if (attr.size == 0) return try allocator.dupe(u8, "");
    return try allocator.dupe(u8, attr.text[0..attr.size]);
}

fn enter_block(t: c.MD_BLOCKTYPE, detail: ?*anyopaque, userdata: ?*anyopaque) callconv(.c) c_int {
    const ctx: *JsonContext = @ptrCast(@alignCast(userdata));
    if (ctx.failed) return 1;

    const node = JsonNode.init(ctx.allocator, .block, get_block_type_name(t)) catch {
        ctx.failed = true;
        return 1;
    };

    // Process details
    if (detail) |d| {
        switch (t) {
            c.MD_BLOCK_H => {
                const h: *c.MD_BLOCK_H_DETAIL = @ptrCast(@alignCast(d));
                node.addDetail(ctx.allocator, "level", .{ .integer = h.level }) catch {};
            },
            c.MD_BLOCK_CODE => {
                const code: *c.MD_BLOCK_CODE_DETAIL = @ptrCast(@alignCast(d));
                if (code.lang.text != null) {
                    const lang = attr_to_string(ctx.allocator, code.lang) catch "";
                    node.addDetail(ctx.allocator, "lang", .{ .string = lang }) catch {};
                }
            },
            c.MD_BLOCK_UL => {
                const ul: *c.MD_BLOCK_UL_DETAIL = @ptrCast(@alignCast(d));
                node.addDetail(ctx.allocator, "is_tight", .{ .boolean = ul.is_tight != 0 }) catch {};
            },
            c.MD_BLOCK_OL => {
                const ol: *c.MD_BLOCK_OL_DETAIL = @ptrCast(@alignCast(d));
                node.addDetail(ctx.allocator, "start", .{ .integer = ol.start }) catch {};
                node.addDetail(ctx.allocator, "is_tight", .{ .boolean = ol.is_tight != 0 }) catch {};
            },
            c.MD_BLOCK_LI => {
                const li: *c.MD_BLOCK_LI_DETAIL = @ptrCast(@alignCast(d));
                node.addDetail(ctx.allocator, "is_task", .{ .boolean = li.is_task != 0 }) catch {};
            },
            c.MD_BLOCK_TABLE => {
                const tbl: *c.MD_BLOCK_TABLE_DETAIL = @ptrCast(@alignCast(d));
                node.addDetail(ctx.allocator, "col_count", .{ .integer = tbl.col_count }) catch {};
            },
            c.MD_BLOCK_TH, c.MD_BLOCK_TD => {
                const td: *c.MD_BLOCK_TD_DETAIL = @ptrCast(@alignCast(d));
                const align_str = switch (td.@"align") {
                    c.MD_ALIGN_LEFT => "left",
                    c.MD_ALIGN_CENTER => "center",
                    c.MD_ALIGN_RIGHT => "right",
                    else => "default",
                };
                node.addDetail(ctx.allocator, "align", .{ .string = align_str }) catch {};
            },
            else => {},
        }
    }

    const parent = ctx.stack.getLast();
    parent.children.append(ctx.allocator, node) catch {
        ctx.failed = true;
        return 1;
    };

    ctx.stack.append(ctx.allocator, node) catch {
        ctx.failed = true;
        return 1;
    };

    return 0;
}

fn leave_block(t: c.MD_BLOCKTYPE, detail: ?*anyopaque, userdata: ?*anyopaque) callconv(.c) c_int {
    _ = t;
    _ = detail;
    const ctx: *JsonContext = @ptrCast(@alignCast(userdata));
    if (ctx.failed) return 1;
    _ = ctx.stack.pop();
    return 0;
}

fn enter_span(t: c.MD_SPANTYPE, detail: ?*anyopaque, userdata: ?*anyopaque) callconv(.c) c_int {
    const ctx: *JsonContext = @ptrCast(@alignCast(userdata));
    if (ctx.failed) return 1;

    const node = JsonNode.init(ctx.allocator, .span, get_span_type_name(t)) catch {
        ctx.failed = true;
        return 1;
    };

    if (detail) |d| {
        switch (t) {
            c.MD_SPAN_A => {
                const a: *c.MD_SPAN_A_DETAIL = @ptrCast(@alignCast(d));
                if (a.href.text != null) {
                    const href = attr_to_string(ctx.allocator, a.href) catch "";
                    node.addDetail(ctx.allocator, "href", .{ .string = href }) catch {};
                }
                if (a.title.text != null) {
                    const title = attr_to_string(ctx.allocator, a.title) catch "";
                    node.addDetail(ctx.allocator, "title", .{ .string = title }) catch {};
                }
            },
            c.MD_SPAN_IMG => {
                const img: *c.MD_SPAN_IMG_DETAIL = @ptrCast(@alignCast(d));
                if (img.src.text != null) {
                    const src = attr_to_string(ctx.allocator, img.src) catch "";
                    node.addDetail(ctx.allocator, "src", .{ .string = src }) catch {};
                }
                if (img.title.text != null) {
                    const title = attr_to_string(ctx.allocator, img.title) catch "";
                    node.addDetail(ctx.allocator, "title", .{ .string = title }) catch {};
                }
            },
            c.MD_SPAN_WIKILINK => {
                const wiki: *c.MD_SPAN_WIKILINK_DETAIL = @ptrCast(@alignCast(d));
                if (wiki.target.text != null) {
                    const target = attr_to_string(ctx.allocator, wiki.target) catch "";
                    node.addDetail(ctx.allocator, "target", .{ .string = target }) catch {};
                }
            },
            else => {},
        }
    }

    const parent = ctx.stack.getLast();
    parent.children.append(ctx.allocator, node) catch {
        ctx.failed = true;
        return 1;
    };

    ctx.stack.append(ctx.allocator, node) catch {
        ctx.failed = true;
        return 1;
    };

    return 0;
}

fn leave_span(t: c.MD_SPANTYPE, detail: ?*anyopaque, userdata: ?*anyopaque) callconv(.c) c_int {
    _ = t;
    _ = detail;
    const ctx: *JsonContext = @ptrCast(@alignCast(userdata));
    if (ctx.failed) return 1;
    _ = ctx.stack.pop();
    return 0;
}

fn text_callback(t: c.MD_TEXTTYPE, text: [*c]const c.MD_CHAR, size: c.MD_SIZE, userdata: ?*anyopaque) callconv(.c) c_int {
    const ctx: *JsonContext = @ptrCast(@alignCast(userdata));
    if (ctx.failed) return 1;

    const node = JsonNode.init(ctx.allocator, .text, get_text_type_name(t)) catch {
        ctx.failed = true;
        return 1;
    };

    node.text = ctx.allocator.dupe(u8, text[0..size]) catch {
        ctx.failed = true;
        return 1;
    };

    const parent = ctx.stack.getLast();
    parent.children.append(ctx.allocator, node) catch {
        ctx.failed = true;
        return 1;
    };

    return 0;
}

fn writeJsonString(w: anytype, s: []const u8) !void {
    try w.writeByte('"');
    for (s) |byte| {
        switch (byte) {
            '"' => try w.writeAll("\\\""),
            '\\' => try w.writeAll("\\\\"),
            '\n' => try w.writeAll("\\n"),
            '\r' => try w.writeAll("\\r"),
            '\t' => try w.writeAll("\\t"),
            else => {
                if (byte < 0x20) {
                    try w.print("\\u{x:0>4}", .{byte});
                } else {
                    try w.writeByte(byte);
                }
            },
        }
    }
    try w.writeByte('"');
}

fn json_stringify_node(allocator: std.mem.Allocator, node: *JsonNode, w: anytype) !void {
    try w.writeByte('{');

    try w.writeAll("\"type\":");
    try writeJsonString(w, node.type_name);

    if (node.text) |txt| {
        try w.writeAll(",\"text\":");
        try writeJsonString(w, txt);
    }

    if (node.details.items.len > 0) {
        try w.writeAll(",\"details\":{");
        for (node.details.items, 0..) |entry, i| {
            if (i > 0) try w.writeByte(',');
            try writeJsonString(w, entry.key);
            try w.writeByte(':');
            switch (entry.value) {
                .integer => |int_val| try w.print("{d}", .{int_val}),
                .string => |str_val| try writeJsonString(w, str_val),
                .boolean => |bool_val| try w.writeAll(if (bool_val) "true" else "false"),
            }
        }
        try w.writeByte('}');
    }

    if (node.children.items.len > 0) {
        try w.writeAll(",\"children\":[");
        for (node.children.items, 0..) |child, i| {
            if (i > 0) try w.writeByte(',');
            try json_stringify_node(allocator, child, w);
        }
        try w.writeByte(']');
    }

    try w.writeByte('}');
}

export fn md4c_to_json(input: [*]const u8, input_len: usize, output_ptr: *?[*]u8, output_len: *usize, parser_flags: u32) c_int {
    var arena = std.heap.ArenaAllocator.init(c_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();

    const root = JsonNode.init(allocator, .root, "root") catch return -1;

    var ctx = JsonContext{
        .allocator = allocator,
        .root = root,
        .stack = .{},
        .failed = false,
    };
    ctx.stack.append(allocator, root) catch return -1;

    var parser = c.MD_PARSER{
        .abi_version = 0,
        .flags = parser_flags,
        .enter_block = enter_block,
        .leave_block = leave_block,
        .enter_span = enter_span,
        .leave_span = leave_span,
        .text = text_callback,
        .debug_log = null,
        .syntax = null,
    };

    const rc = c.md_parse(input, @intCast(input_len), &parser, &ctx);

    if (rc != 0 or ctx.failed) {
        return -1;
    }

    // Serialize to string
    var json_list: std.ArrayListUnmanaged(u8) = .{};
    defer json_list.deinit(c_allocator);

    // We only want children of root
    json_stringify_node(c_allocator, ctx.root, json_list.writer(c_allocator)) catch {
        return -1;
    };

    const slice = json_list.toOwnedSlice(c_allocator) catch {
        return -1;
    };
    output_ptr.* = slice.ptr;
    output_len.* = slice.len;

    return 0;
}

export fn md4c_free(ptr: ?[*]u8, len: usize) void {
    if (ptr) |p| {
        c_allocator.free(p[0..len]);
    }
}
