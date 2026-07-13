const std = @import("std");
const json = @import("../json.zig");
const Plugin = @import("../plugin.zig").Plugin;

const max_model_bytes = 512 * 1024 * 1024;
const max_definition_bytes = 16 * 1024 * 1024;

const NamedFile = extern struct {
    name: ?[*:0]const u8,
    data: ?[*]const u8,
    data_len: usize,
};

const SliceInput = extern struct {
    model_stl: ?[*]const u8,
    model_stl_len: usize,
    definition_json: ?[*]const u8,
    definition_json_len: usize,
    model_name: ?[*:0]const u8,
    definition_name: ?[*:0]const u8,
    engine_path: ?[*:0]const u8,
    settings: ?[*]const ?[*:0]const u8,
    settings_len: usize,
    search_files: ?[*]const NamedFile,
    search_files_len: usize,
    threads: u32,
};

const SliceResult = extern struct {
    gcode: ?[*]u8,
    gcode_len: usize,
    exit_code: c_int,
};

const SliceFn = *const fn (*const SliceInput, *SliceResult) callconv(.c) c_int;
const FreeFn = *const fn (*SliceResult) callconv(.c) void;
const LastErrorFn = *const fn () callconv(.c) ?[*:0]const u8;

pub const CuraEnginePlugin = struct {
    allocator: std.mem.Allocator,
    library_path: []u8,
    lib: ?std.DynLib = null,
    slice_fn: ?SliceFn = null,
    free_fn: ?FreeFn = null,
    last_error_fn: ?LastErrorFn = null,

    pub fn init(allocator: std.mem.Allocator, library_path: []const u8) !CuraEnginePlugin {
        return .{
            .allocator = allocator,
            .library_path = try allocator.dupe(u8, library_path),
        };
    }

    pub fn deinit(self: *CuraEnginePlugin) void {
        self.stop();
        self.allocator.free(self.library_path);
        self.* = undefined;
    }

    pub fn plugin(self: *CuraEnginePlugin) Plugin {
        return .{
            .name = "curaengine",
            .ctx = self,
            .start_fn = startOpaque,
            .stop_fn = stopOpaque,
            .execute_fn = executeOpaque,
        };
    }

    fn start(self: *CuraEnginePlugin) !void {
        if (self.lib != null) return;
        var lib = try std.DynLib.open(self.library_path);
        errdefer lib.close();
        self.slice_fn = lib.lookup(SliceFn, "curaengine_slice") orelse return error.CuraEngineSliceSymbolMissing;
        self.free_fn = lib.lookup(FreeFn, "curaengine_slice_result_free") orelse return error.CuraEngineFreeSymbolMissing;
        self.last_error_fn = lib.lookup(LastErrorFn, "curaengine_wrapper_last_error") orelse return error.CuraEngineErrorSymbolMissing;
        self.lib = lib;
    }

    fn stop(self: *CuraEnginePlugin) void {
        _ = self;
        // Wrapper libraries may contain C/C++ static runtime state. Keeping a
        // successfully loaded image mapped until process exit avoids dlclose
        // invalidating a runtime atexit/TLS handler. The hub still releases all
        // task and worker state when the plugin becomes idle.
    }

    fn execute(self: *CuraEnginePlugin, allocator: std.mem.Allocator, request_json: []const u8) ![]u8 {
        var parsed = try std.json.parseFromSlice(std.json.Value, allocator, request_json, .{});
        defer parsed.deinit();
        const object = switch (parsed.value) {
            .object => |value| value,
            else => return error.InvalidJsonObject,
        };
        const model_path = json.stringField(object, "stlPath") orelse return error.StlPathRequired;
        const definition_path = json.stringField(object, "definitionPath") orelse return error.DefinitionPathRequired;
        const output_path = json.stringField(object, "gcodePath") orelse return error.GcodePathRequired;
        const model_name = json.stringField(object, "modelName") orelse "model.stl";
        const definition_name = json.stringField(object, "definitionName") orelse "definition.def.json";
        const engine_path = json.stringField(object, "enginePath");

        const stl = try json.readFile(allocator, model_path, max_model_bytes);
        defer allocator.free(stl);
        const definition = try json.readFile(allocator, definition_path, max_definition_bytes);
        defer allocator.free(definition);

        var settings = try readSettings(allocator, object);
        defer settings.deinit(allocator);
        var search_files = try readSearchFiles(allocator, object);
        defer search_files.deinit(allocator);

        const model_name_z = try allocator.dupeZ(u8, model_name);
        defer allocator.free(model_name_z);
        const definition_name_z = try allocator.dupeZ(u8, definition_name);
        defer allocator.free(definition_name_z);
        const engine_path_z = if (engine_path) |path| try allocator.dupeZ(u8, path) else null;
        defer if (engine_path_z) |path| allocator.free(path);

        var result = std.mem.zeroes(SliceResult);
        defer self.free_fn.?(&result);
        const rc = self.slice_fn.?(&.{
            .model_stl = stl.ptr,
            .model_stl_len = stl.len,
            .definition_json = definition.ptr,
            .definition_json_len = definition.len,
            .model_name = model_name_z.ptr,
            .definition_name = definition_name_z.ptr,
            .engine_path = if (engine_path_z) |path| path.ptr else null,
            .settings = if (settings.ptrs.items.len == 0) null else settings.ptrs.items.ptr,
            .settings_len = settings.ptrs.items.len,
            .search_files = if (search_files.files.items.len == 0) null else search_files.files.items.ptr,
            .search_files_len = search_files.files.items.len,
            .threads = json.u32Field(object, "threads", 0),
        }, &result);
        if (rc != 0) {
            if (self.last_error_fn.?()) |message| std.log.err("curaengine: {s}", .{std.mem.span(message)});
            return error.CuraEngineFailed;
        }

        const gcode = if (result.gcode) |ptr| ptr[0..result.gcode_len] else "";
        try json.writeFile(output_path, gcode);
        const output_json = try json.jsonString(allocator, output_path);
        defer allocator.free(output_json);
        return std.fmt.allocPrint(allocator,
            "{{\"gcodePath\":{s},\"gcodeBytes\":{d},\"exitCode\":{d}}}",
            .{ output_json, result.gcode_len, result.exit_code },
        );
    }

    fn startOpaque(ctx: *anyopaque) !void {
        const self: *CuraEnginePlugin = @ptrCast(@alignCast(ctx));
        try self.start();
    }

    fn stopOpaque(ctx: *anyopaque) void {
        const self: *CuraEnginePlugin = @ptrCast(@alignCast(ctx));
        self.stop();
    }

    fn executeOpaque(ctx: *anyopaque, allocator: std.mem.Allocator, request_json: []const u8) ![]u8 {
        const self: *CuraEnginePlugin = @ptrCast(@alignCast(ctx));
        return self.execute(allocator, request_json);
    }
};

const Settings = struct {
    values: std.ArrayList([:0]u8) = .empty,
    ptrs: std.ArrayList(?[*:0]const u8) = .empty,

    fn deinit(self: *Settings, allocator: std.mem.Allocator) void {
        for (self.values.items) |value| allocator.free(value);
        self.values.deinit(allocator);
        self.ptrs.deinit(allocator);
    }
};

fn readSettings(allocator: std.mem.Allocator, object: std.json.ObjectMap) !Settings {
    var out = Settings{};
    errdefer out.deinit(allocator);
    const values = switch (object.get("settings") orelse return out) {
        .array => |array| array.items,
        else => return error.SettingsMustBeArray,
    };
    for (values) |value| {
        const text = switch (value) {
            .string => |string| string,
            else => return error.SettingMustBeString,
        };
        const z = try allocator.dupeZ(u8, text);
        out.values.append(allocator, z) catch |err| {
            allocator.free(z);
            return err;
        };
        try out.ptrs.append(allocator, z.ptr);
    }
    return out;
}

const SearchFiles = struct {
    files: std.ArrayList(NamedFile) = .empty,
    names: std.ArrayList([:0]u8) = .empty,
    data: std.ArrayList([]u8) = .empty,

    fn deinit(self: *SearchFiles, allocator: std.mem.Allocator) void {
        for (self.names.items) |name| allocator.free(name);
        for (self.data.items) |file_data| allocator.free(file_data);
        self.files.deinit(allocator);
        self.names.deinit(allocator);
        self.data.deinit(allocator);
    }
};

fn readSearchFiles(allocator: std.mem.Allocator, object: std.json.ObjectMap) !SearchFiles {
    var out = SearchFiles{};
    errdefer out.deinit(allocator);
    const values = switch (object.get("searchFiles") orelse return out) {
        .array => |array| array.items,
        else => return error.SearchFilesMustBeArray,
    };
    for (values) |value| {
        const item = switch (value) {
            .object => |entry| entry,
            else => return error.SearchFileMustBeObject,
        };
        const name = json.stringField(item, "name") orelse return error.SearchFileNameRequired;
        const path = json.stringField(item, "path") orelse return error.SearchFilePathRequired;
        const name_z = try allocator.dupeZ(u8, name);
        const data = json.readFile(allocator, path, max_definition_bytes) catch |err| {
            allocator.free(name_z);
            return err;
        };
        out.names.append(allocator, name_z) catch |err| {
            allocator.free(name_z);
            allocator.free(data);
            return err;
        };
        out.data.append(allocator, data) catch |err| {
            allocator.free(data);
            return err;
        };
        try out.files.append(allocator, .{ .name = name_z.ptr, .data = data.ptr, .data_len = data.len });
    }
    return out;
}
