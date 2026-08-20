//! OpenCAMLib over its C++ wrapper (`wrappers/slicers/opencamlib`).
//!
//! Everything specific to milling lives here: the FFI structs, the task
//! schema, and the tool defaults. The shared package knows none of it — it
//! only ever sees task JSON in and result JSON out.

const std = @import("std");
const iface = @import("processor");

const json = iface.json;
const Processor = iface.Processor;
const Progress = iface.Progress;

const max_model_bytes = 512 * 1024 * 1024;

const MillingInput = extern struct {
    stl_data: ?[*]const u8,
    stl_len: usize,
    tool_diameter: f64,
    tool_length: f64,
    stepover: f64,
    sampling: f64,
    min_sampling: f64,
    feed: f64,
    rapid: f64,
    safe_z: f64,
    include_gcode: u8,
};

const MillingResult = extern struct {
    triangles: u32,
    min_x: f64,
    min_y: f64,
    min_z: f64,
    max_x: f64,
    max_y: f64,
    max_z: f64,
    safe_z: f64,
    passes: u32,
    points: u64,
    cut_length_mm: f64,
    rapid_length_mm: f64,
    cut_time_sec: f64,
    rapid_time_sec: f64,
    total_time_sec: f64,
    gcode: ?[*]u8,
    gcode_len: usize,
};

const ExtractFn = *const fn (*const MillingInput, *MillingResult) callconv(.c) c_int;
const FreeFn = *const fn (*MillingResult) callconv(.c) void;
const LastErrorFn = *const fn () callconv(.c) ?[*:0]const u8;

pub const OpenCamLib = struct {
    allocator: std.mem.Allocator,
    library_path: []u8,
    lib: ?std.DynLib = null,
    extract_fn: ?ExtractFn = null,
    free_fn: ?FreeFn = null,
    last_error_fn: ?LastErrorFn = null,

    pub fn init(allocator: std.mem.Allocator, library_path: []const u8) !OpenCamLib {
        return .{
            .allocator = allocator,
            .library_path = try allocator.dupe(u8, library_path),
        };
    }

    pub fn deinit(self: *OpenCamLib) void {
        self.stop();
        self.allocator.free(self.library_path);
        self.* = undefined;
    }

    pub fn processor(self: *OpenCamLib) Processor {
        return .{
            .name = "opencamlib",
            .ctx = self,
            .start_fn = startOpaque,
            .stop_fn = stopOpaque,
            .execute_fn = executeOpaque,
        };
    }

    /// Idempotent: the server calls this before every request, and the .so is
    /// mapped once for the lifetime of the process.
    fn start(self: *OpenCamLib) !void {
        if (self.lib != null) return;
        var lib = try std.DynLib.open(self.library_path);
        errdefer lib.close();
        self.extract_fn = lib.lookup(ExtractFn, "opencamlib_milling_extract") orelse return error.OpenCamLibExtractSymbolMissing;
        self.free_fn = lib.lookup(FreeFn, "opencamlib_milling_result_free") orelse return error.OpenCamLibFreeSymbolMissing;
        self.last_error_fn = lib.lookup(LastErrorFn, "opencamlib_wrapper_last_error") orelse return error.OpenCamLibErrorSymbolMissing;
        self.lib = lib;
    }

    fn stop(self: *OpenCamLib) void {
        _ = self;
        // OpenCAMLib carries C++ static runtime state. Do not dlclose a
        // completed wrapper: its registered exit/TLS handlers must remain in
        // mapped code until process shutdown.
    }

    fn execute(self: *OpenCamLib, allocator: std.mem.Allocator, request_json: []const u8, progress: ?Progress) ![]u8 {
        var parsed = try std.json.parseFromSlice(std.json.Value, allocator, request_json, .{});
        defer parsed.deinit();
        const object = switch (parsed.value) {
            .object => |value| value,
            else => return error.InvalidJsonObject,
        };
        const model_path = json.stringField(object, "stlPath") orelse return error.StlPathRequired;
        const gcode_path = json.stringField(object, "gcodePath");
        emitPhase(progress, "reading");
        const stl = try json.readFile(allocator, model_path, max_model_bytes);
        defer allocator.free(stl);
        emitPhase(progress, "toolpath");

        var result = std.mem.zeroes(MillingResult);
        defer self.free_fn.?(&result);
        const rc = self.extract_fn.?(&.{
            .stl_data = stl.ptr,
            .stl_len = stl.len,
            .tool_diameter = json.f64Field(object, "toolDiameter", 3.175),
            .tool_length = json.f64Field(object, "toolLength", 20),
            .stepover = json.f64Field(object, "stepover", 1),
            .sampling = json.f64Field(object, "sampling", 0.5),
            .min_sampling = json.f64Field(object, "minSampling", 0.1),
            .feed = json.f64Field(object, "feed", 300),
            .rapid = json.f64Field(object, "rapid", 1000),
            .safe_z = json.f64Field(object, "safeZ", 5),
            // No output path means the caller wants an estimate only, so the
            // wrapper skips g-code generation entirely.
            .include_gcode = if (gcode_path != null) 1 else 0,
        }, &result);
        if (rc != 0) {
            if (self.last_error_fn.?()) |message| std.log.err("opencamlib: {s}", .{std.mem.span(message)});
            return error.OpenCamLibFailed;
        }

        if (gcode_path) |path| {
            const gcode = if (result.gcode) |ptr| ptr[0..result.gcode_len] else "";
            try json.writeFile(path, gcode);
        }
        const output_json = if (gcode_path) |path| try json.jsonString(allocator, path) else null;
        defer if (output_json) |value| allocator.free(value);
        return if (output_json) |path|
            std.fmt.allocPrint(
                allocator,
                "{{\"gcodePath\":{s},\"gcodeBytes\":{d},\"triangles\":{d},\"passes\":{d},\"points\":{d},\"totalTimeSec\":{d}}}",
                .{ path, result.gcode_len, result.triangles, result.passes, result.points, result.total_time_sec },
            )
        else
            std.fmt.allocPrint(
                allocator,
                "{{\"triangles\":{d},\"passes\":{d},\"points\":{d},\"totalTimeSec\":{d}}}",
                .{ result.triangles, result.passes, result.points, result.total_time_sec },
            );
    }

    fn startOpaque(ctx: *anyopaque) !void {
        const self: *OpenCamLib = @ptrCast(@alignCast(ctx));
        try self.start();
    }

    fn stopOpaque(ctx: *anyopaque) void {
        const self: *OpenCamLib = @ptrCast(@alignCast(ctx));
        self.stop();
    }

    fn executeOpaque(ctx: *anyopaque, allocator: std.mem.Allocator, request_json: []const u8, progress: ?Progress) ![]u8 {
        const self: *OpenCamLib = @ptrCast(@alignCast(ctx));
        return self.execute(allocator, request_json, progress);
    }
};

/// Best-effort progress marker (see the curaengine processor note): the
/// wrapper is one blocking FFI call, so we bracket it with coarse phases until
/// it exposes per-pass progress.
fn emitPhase(progress: ?Progress, phase: []const u8) void {
    const sink = progress orelse return;
    var buffer: [256]u8 = undefined;
    const event = std.fmt.bufPrint(
        &buffer,
        "{{\"phase\":\"{s}\",\"processor\":\"opencamlib\"}}",
        .{phase},
    ) catch return;
    sink.emit(event) catch {};
}
