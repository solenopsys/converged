const std = @import("std");

const Allocator = std.mem.Allocator;

const default_timeout_ms: u32 = 300_000;
const default_max_output_bytes: usize = 16 * 1024 * 1024;

const AdapterState = enum(c_int) {
    idle = 0,
    running = 1,
    failed = 2,
};

const AdapterResultCode = enum(c_int) {
    ok = 0,
    invalid = -1,
    exec_error = -2,
    command_failed = -3,
    timed_out = -4,
};

const UvtoolsCommandId = enum(c_int) {
    set_properties = 1,
    run = 2,
    convert = 3,
    extract = 4,
    copy_parameters = 5,
    set_thumbnail = 6,
    compare = 7,
    print_issues = 8,
    print_properties = 9,
    print_gcode = 10,
    print_machines = 11,
    print_formats = 12,
    benchmark_layer_codecs = 13,
    raw = 100,
};

pub const UvtoolsInterfaceCommand = extern struct {
    command_id: c_int,
    input_path: ?[*:0]const u8 = null,
    secondary_path: ?[*:0]const u8 = null,
    output_path: ?[*:0]const u8 = null,
    extra_args: ?[*:0]const u8 = null,
};

const Adapter = struct {
    allocator: Allocator,
    mutex: std.Thread.Mutex = .{},

    state: AdapterState = .idle,
    executable: []u8 = &[_]u8{},
    workdir: []u8 = &[_]u8{},
    timeout_ms: u32 = default_timeout_ms,
    max_output_bytes: usize = default_max_output_bytes,

    last_exit_code: c_int = 0,
    last_success: bool = true,
    last_timed_out: bool = false,
    last_stdout: []u8 = &[_]u8{},
    last_stderr: []u8 = &[_]u8{},
    last_error: []u8 = &[_]u8{},
    last_args: []u8 = &[_]u8{},

    fn init(allocator: Allocator) !Adapter {
        return .{
            .allocator = allocator,
            .executable = try allocator.dupe(u8, "UVtoolsCmd"),
        };
    }

    fn deinit(self: *Adapter) void {
        self.mutex.lock();
        defer self.mutex.unlock();

        self.freeOwnedString(&self.executable);
        self.freeOwnedString(&self.workdir);
        self.freeOwnedString(&self.last_stdout);
        self.freeOwnedString(&self.last_stderr);
        self.freeOwnedString(&self.last_error);
        self.freeOwnedString(&self.last_args);
    }

    fn setExecutable(self: *Adapter, executable_path: []const u8) !void {
        if (executable_path.len == 0) return error.InvalidArgument;

        self.mutex.lock();
        defer self.mutex.unlock();

        try self.replaceOwnedStringLocked(&self.executable, executable_path);
    }

    fn setWorkdir(self: *Adapter, workdir_path: []const u8) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        if (workdir_path.len == 0) {
            self.freeOwnedString(&self.workdir);
            self.workdir = &[_]u8{};
            return;
        }

        try self.replaceOwnedStringLocked(&self.workdir, workdir_path);
    }

    fn setTimeoutMs(self: *Adapter, timeout_ms: u32) void {
        self.mutex.lock();
        defer self.mutex.unlock();

        self.timeout_ms = timeout_ms;
    }

    fn setMaxOutputBytes(self: *Adapter, max_output_bytes: usize) !void {
        if (max_output_bytes == 0) return error.InvalidArgument;

        self.mutex.lock();
        defer self.mutex.unlock();

        self.max_output_bytes = max_output_bytes;
    }

    fn executeRaw(self: *Adapter, raw_args_line: []const u8) !void {
        if (raw_args_line.len == 0) return error.InvalidArgument;

        var parsed = try parseArgsLine(self.allocator, raw_args_line);
        defer freeOwnedTokens(self.allocator, &parsed);

        if (parsed.items.len == 0) return error.InvalidArgument;

        try self.executeArgs(parsed.items);
    }

    fn executeArgv(self: *Adapter, args: []const []const u8) !void {
        if (args.len == 0) return error.InvalidArgument;
        try self.executeArgs(args);
    }

    fn executeCommand(self: *Adapter, command: UvtoolsInterfaceCommand) !void {
        const command_id = std.meta.intToEnum(UvtoolsCommandId, command.command_id) catch return error.InvalidArgument;
        if (command_id == .raw) {
            const raw = cStringToSlice(command.extra_args) orelse return error.InvalidArgument;
            try self.executeRaw(raw);
            return;
        }

        var args: std.ArrayList([]const u8) = .empty;
        defer args.deinit(self.allocator);

        try args.append(self.allocator, commandIdToSubcommand(command_id));
        try appendOptionalCStringArg(self.allocator, &args, command.input_path);
        try appendOptionalCStringArg(self.allocator, &args, command.secondary_path);
        try appendOptionalCStringArg(self.allocator, &args, command.output_path);

        if (cStringToSlice(command.extra_args)) |extra| {
            var parsed = try parseArgsLine(self.allocator, extra);
            defer freeOwnedTokens(self.allocator, &parsed);
            for (parsed.items) |token| {
                try args.append(self.allocator, token);
            }
        }

        try self.executeArgs(args.items);
    }

    fn executeConvert(
        self: *Adapter,
        input_path: []const u8,
        target_type_or_ext: []const u8,
        output_path: []const u8,
        extra_args: ?[]const u8,
    ) !void {
        if (input_path.len == 0 or target_type_or_ext.len == 0) return error.InvalidArgument;

        var args: std.ArrayList([]const u8) = .empty;
        defer args.deinit(self.allocator);

        try args.appendSlice(self.allocator, &.{ "convert", input_path, target_type_or_ext });
        if (output_path.len > 0) {
            try args.append(self.allocator, output_path);
        }

        try appendExtraArgLine(self.allocator, &args, extra_args);
        try self.executeArgs(args.items);
    }

    fn executeExtract(
        self: *Adapter,
        input_path: []const u8,
        output_dir: []const u8,
        extra_args: ?[]const u8,
    ) !void {
        if (input_path.len == 0) return error.InvalidArgument;

        var args: std.ArrayList([]const u8) = .empty;
        defer args.deinit(self.allocator);

        try args.appendSlice(self.allocator, &.{ "extract", input_path });
        if (output_dir.len > 0) {
            try args.append(self.allocator, output_dir);
        }

        try appendExtraArgLine(self.allocator, &args, extra_args);
        try self.executeArgs(args.items);
    }

    fn executeRun(
        self: *Adapter,
        input_path: []const u8,
        classes_or_files: []const u8,
        extra_args: ?[]const u8,
    ) !void {
        if (input_path.len == 0 or classes_or_files.len == 0) return error.InvalidArgument;

        var args: std.ArrayList([]const u8) = .empty;
        defer args.deinit(self.allocator);

        try args.appendSlice(self.allocator, &.{ "run", input_path });

        var parsed_classes = try parseArgsLine(self.allocator, classes_or_files);
        defer freeOwnedTokens(self.allocator, &parsed_classes);
        if (parsed_classes.items.len == 0) return error.InvalidArgument;

        for (parsed_classes.items) |token| {
            try args.append(self.allocator, token);
        }

        try appendExtraArgLine(self.allocator, &args, extra_args);
        try self.executeArgs(args.items);
    }

    fn executeCompare(
        self: *Adapter,
        input_path_a: []const u8,
        input_path_b: []const u8,
        extra_args: ?[]const u8,
    ) !void {
        if (input_path_a.len == 0 or input_path_b.len == 0) return error.InvalidArgument;

        var args: std.ArrayList([]const u8) = .empty;
        defer args.deinit(self.allocator);

        try args.appendSlice(self.allocator, &.{ "compare", input_path_a, input_path_b });
        try appendExtraArgLine(self.allocator, &args, extra_args);
        try self.executeArgs(args.items);
    }

    fn executePrintLike(
        self: *Adapter,
        subcommand: []const u8,
        input_path: []const u8,
        extra_args: ?[]const u8,
    ) !void {
        if (input_path.len == 0) return error.InvalidArgument;

        var args: std.ArrayList([]const u8) = .empty;
        defer args.deinit(self.allocator);

        try args.appendSlice(self.allocator, &.{ subcommand, input_path });
        try appendExtraArgLine(self.allocator, &args, extra_args);
        try self.executeArgs(args.items);
    }

    fn executeArgs(self: *Adapter, args: []const []const u8) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        if (self.state == .running) return error.Busy;

        self.state = .running;
        self.last_success = false;
        self.last_timed_out = false;
        self.last_exit_code = -1;
        try self.replaceOwnedStringLocked(&self.last_error, "");

        var command_argv: std.ArrayList([]const u8) = .empty;
        defer command_argv.deinit(self.allocator);

        var timeout_token: ?[]u8 = null;
        defer if (timeout_token) |tok| self.allocator.free(tok);

        if (self.timeout_ms > 0) {
            try command_argv.appendSlice(self.allocator, &.{ "timeout", "--signal=TERM", "--kill-after=5s" });
            const secs = @as(f64, @floatFromInt(self.timeout_ms)) / 1000.0;
            timeout_token = try std.fmt.allocPrint(self.allocator, "{d:.3}s", .{secs});
            try command_argv.append(self.allocator, timeout_token.?);
        }

        if (std.mem.endsWith(u8, self.executable, ".dll")) {
            try command_argv.appendSlice(self.allocator, &.{ "dotnet", self.executable });
        } else {
            try command_argv.append(self.allocator, self.executable);
        }

        try command_argv.appendSlice(self.allocator, args);

        const args_preview = try joinArgsForLog(self.allocator, command_argv.items);
        defer self.allocator.free(args_preview);
        try self.replaceOwnedStringLocked(&self.last_args, args_preview);

        const cwd_opt: ?[]const u8 = if (self.workdir.len == 0) null else self.workdir;

        const run_result = std.process.Child.run(.{
            .allocator = self.allocator,
            .argv = command_argv.items,
            .cwd = cwd_opt,
            .max_output_bytes = self.max_output_bytes,
        }) catch |err| {
            self.state = .failed;
            try self.replaceOwnedStringLockedFmt(&self.last_error, "spawn failed: {s}", .{@errorName(err)});
            return error.ExecutionFailed;
        };

        self.replaceOwnedBufferLocked(&self.last_stdout, run_result.stdout);
        self.replaceOwnedBufferLocked(&self.last_stderr, run_result.stderr);

        var exit_code: c_int = -1;
        switch (run_result.term) {
            .Exited => |code| {
                exit_code = @intCast(code);
            },
            .Signal => |sig| {
                exit_code = 128 + @as(c_int, @intCast(sig));
            },
            .Stopped => |sig| {
                exit_code = 128 + @as(c_int, @intCast(sig));
            },
            .Unknown => {
                exit_code = -1;
            },
        }

        self.last_exit_code = exit_code;
        self.last_timed_out = exit_code == 124;
        self.last_success = exit_code == 0;

        if (self.last_timed_out) {
            self.state = .failed;
            try self.replaceOwnedStringLockedFmt(&self.last_error, "command timed out ({d} ms)", .{self.timeout_ms});
            return error.CommandTimedOut;
        }

        if (!self.last_success) {
            self.state = .failed;
            if (self.last_stderr.len > 0) {
                try self.replaceOwnedStringLocked(&self.last_error, self.last_stderr);
            } else {
                try self.replaceOwnedStringLockedFmt(&self.last_error, "command exited with code {d}", .{exit_code});
            }
            return error.CommandFailed;
        }

        self.state = .idle;
    }

    fn getStateJson(self: *Adapter) ![]u8 {
        self.mutex.lock();
        defer self.mutex.unlock();

        const state_payload = .{
            .state_code = @intFromEnum(self.state),
            .executable = self.executable,
            .workdir = if (self.workdir.len == 0) null else self.workdir,
            .timeout_ms = self.timeout_ms,
            .max_output_bytes = self.max_output_bytes,
            .last_exit_code = self.last_exit_code,
            .last_success = self.last_success,
            .last_timed_out = self.last_timed_out,
            .last_error = self.last_error,
            .last_args = self.last_args,
            .last_stdout = self.last_stdout,
            .last_stderr = self.last_stderr,
        };

        return std.json.Stringify.valueAlloc(self.allocator, state_payload, .{});
    }

    fn getStateCode(self: *Adapter) c_int {
        self.mutex.lock();
        defer self.mutex.unlock();

        return @intFromEnum(self.state);
    }

    fn getLastExitCode(self: *Adapter) c_int {
        self.mutex.lock();
        defer self.mutex.unlock();

        return self.last_exit_code;
    }

    fn getLastSuccess(self: *Adapter) c_int {
        self.mutex.lock();
        defer self.mutex.unlock();

        return if (self.last_success) 1 else 0;
    }

    fn getLastTimedOut(self: *Adapter) c_int {
        self.mutex.lock();
        defer self.mutex.unlock();

        return if (self.last_timed_out) 1 else 0;
    }

    fn copyLastStdout(self: *Adapter, out_ptr: *?[*]u8, out_len: *usize) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        try copyBufferForFfi(self.allocator, self.last_stdout, out_ptr, out_len);
    }

    fn copyLastStderr(self: *Adapter, out_ptr: *?[*]u8, out_len: *usize) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        try copyBufferForFfi(self.allocator, self.last_stderr, out_ptr, out_len);
    }

    fn copyLastError(self: *Adapter, out_ptr: *?[*]u8, out_len: *usize) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        try copyBufferForFfi(self.allocator, self.last_error, out_ptr, out_len);
    }

    fn copyLastArgs(self: *Adapter, out_ptr: *?[*]u8, out_len: *usize) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        try copyBufferForFfi(self.allocator, self.last_args, out_ptr, out_len);
    }

    fn freeOwnedString(self: *Adapter, owned: *[]u8) void {
        if (owned.len > 0) {
            self.allocator.free(owned.*);
        }
        owned.* = &[_]u8{};
    }

    fn replaceOwnedStringLocked(self: *Adapter, owned: *[]u8, value: []const u8) !void {
        const duped = try self.allocator.dupe(u8, value);
        self.freeOwnedString(owned);
        owned.* = duped;
    }

    fn replaceOwnedStringLockedFmt(self: *Adapter, owned: *[]u8, comptime fmt: []const u8, args: anytype) !void {
        const duped = try std.fmt.allocPrint(self.allocator, fmt, args);
        self.freeOwnedString(owned);
        owned.* = duped;
    }

    fn replaceOwnedBufferLocked(self: *Adapter, owned: *[]u8, value: []u8) void {
        self.freeOwnedString(owned);
        owned.* = value;
    }
};

fn appendOptionalCStringArg(
    allocator: Allocator,
    args: *std.ArrayList([]const u8),
    c_value: ?[*:0]const u8,
) !void {
    if (cStringToSlice(c_value)) |value| {
        if (value.len > 0) {
            try args.append(allocator, value);
        }
    }
}

fn appendExtraArgLine(
    allocator: Allocator,
    args: *std.ArrayList([]const u8),
    extra_args: ?[]const u8,
) !void {
    const extra = extra_args orelse return;
    if (extra.len == 0) return;

    var parsed = try parseArgsLine(allocator, extra);
    defer freeOwnedTokens(allocator, &parsed);

    for (parsed.items) |token| {
        try args.append(allocator, token);
    }
}

fn commandIdToSubcommand(command_id: UvtoolsCommandId) []const u8 {
    return switch (command_id) {
        .set_properties => "set-properties",
        .run => "run",
        .convert => "convert",
        .extract => "extract",
        .copy_parameters => "copy-parameters",
        .set_thumbnail => "set-thumbnail",
        .compare => "compare",
        .print_issues => "print-issues",
        .print_properties => "print-properties",
        .print_gcode => "print-gcode",
        .print_machines => "print-machines",
        .print_formats => "print-formats",
        .benchmark_layer_codecs => "benchmark-layer-codecs",
        .raw => "",
    };
}

fn cStringToSlice(value: ?[*:0]const u8) ?[]const u8 {
    const ptr = value orelse return null;
    return std.mem.span(ptr);
}

fn parseArgsLine(allocator: Allocator, line: []const u8) !std.ArrayList([]u8) {
    var tokens: std.ArrayList([]u8) = .empty;
    errdefer freeOwnedTokens(allocator, &tokens);

    var current: std.ArrayList(u8) = .empty;
    defer current.deinit(allocator);

    var in_single = false;
    var in_double = false;
    var escaped = false;

    for (line) |ch| {
        if (escaped) {
            try current.append(allocator, ch);
            escaped = false;
            continue;
        }

        if (ch == '\\' and !in_single) {
            escaped = true;
            continue;
        }

        if (ch == '\'' and !in_double) {
            in_single = !in_single;
            continue;
        }

        if (ch == '"' and !in_single) {
            in_double = !in_double;
            continue;
        }

        if (std.ascii.isWhitespace(ch) and !in_single and !in_double) {
            if (current.items.len > 0) {
                const token = try allocator.dupe(u8, current.items);
                try tokens.append(allocator, token);
                current.clearRetainingCapacity();
            }
            continue;
        }

        try current.append(allocator, ch);
    }

    if (escaped or in_single or in_double) {
        return error.InvalidArgument;
    }

    if (current.items.len > 0) {
        const token = try allocator.dupe(u8, current.items);
        try tokens.append(allocator, token);
    }

    return tokens;
}

fn freeOwnedTokens(allocator: Allocator, tokens: *std.ArrayList([]u8)) void {
    for (tokens.items) |token| {
        allocator.free(token);
    }
    tokens.deinit(allocator);
}

fn joinArgsForLog(allocator: Allocator, argv: []const []const u8) ![]u8 {
    var out: std.ArrayList(u8) = .empty;
    defer out.deinit(allocator);

    for (argv, 0..) |arg, idx| {
        if (idx > 0) try out.append(allocator, ' ');
        if (std.mem.indexOfScalar(u8, arg, ' ') != null) {
            try out.append(allocator, '"');
            for (arg) |ch| {
                if (ch == '"') {
                    try out.appendSlice(allocator, "\\\"");
                } else {
                    try out.append(allocator, ch);
                }
            }
            try out.append(allocator, '"');
        } else {
            try out.appendSlice(allocator, arg);
        }
    }

    return out.toOwnedSlice(allocator);
}

fn copyBufferForFfi(
    allocator: Allocator,
    source: []const u8,
    out_ptr: *?[*]u8,
    out_len: *usize,
) !void {
    out_len.* = source.len;
    if (source.len == 0) {
        out_ptr.* = null;
        return;
    }

    const duped = try allocator.dupe(u8, source);
    out_ptr.* = duped.ptr;
}

fn castAdapter(handle: ?*anyopaque) ?*Adapter {
    return @ptrCast(@alignCast(handle orelse return null));
}

fn mapExecError(err: anyerror) c_int {
    return switch (err) {
        error.InvalidArgument, error.Busy => @intFromEnum(AdapterResultCode.invalid),
        error.CommandFailed => @intFromEnum(AdapterResultCode.command_failed),
        error.CommandTimedOut => @intFromEnum(AdapterResultCode.timed_out),
        else => @intFromEnum(AdapterResultCode.exec_error),
    };
}

pub export fn uvtools_adapter_create() ?*anyopaque {
    const allocator = std.heap.c_allocator;
    const adapter = allocator.create(Adapter) catch return null;
    adapter.* = Adapter.init(allocator) catch {
        allocator.destroy(adapter);
        return null;
    };
    return adapter;
}

pub export fn uvtools_adapter_destroy(handle: ?*anyopaque) void {
    const adapter = castAdapter(handle) orelse return;
    const allocator = adapter.allocator;
    adapter.deinit();
    allocator.destroy(adapter);
}

pub export fn uvtools_adapter_set_executable(handle: ?*anyopaque, executable_path: ?[*:0]const u8) c_int {
    const adapter = castAdapter(handle) orelse return @intFromEnum(AdapterResultCode.invalid);
    const path = cStringToSlice(executable_path) orelse return @intFromEnum(AdapterResultCode.invalid);
    adapter.setExecutable(path) catch |err| return mapExecError(err);
    return @intFromEnum(AdapterResultCode.ok);
}

pub export fn uvtools_adapter_set_workdir(handle: ?*anyopaque, workdir_path: ?[*:0]const u8) c_int {
    const adapter = castAdapter(handle) orelse return @intFromEnum(AdapterResultCode.invalid);
    const path = cStringToSlice(workdir_path) orelse return @intFromEnum(AdapterResultCode.invalid);
    adapter.setWorkdir(path) catch |err| return mapExecError(err);
    return @intFromEnum(AdapterResultCode.ok);
}

pub export fn uvtools_adapter_set_timeout_ms(handle: ?*anyopaque, timeout_ms: u32) c_int {
    const adapter = castAdapter(handle) orelse return @intFromEnum(AdapterResultCode.invalid);
    adapter.setTimeoutMs(timeout_ms);
    return @intFromEnum(AdapterResultCode.ok);
}

pub export fn uvtools_adapter_set_max_output_bytes(handle: ?*anyopaque, max_output_bytes: u64) c_int {
    const adapter = castAdapter(handle) orelse return @intFromEnum(AdapterResultCode.invalid);
    const casted: usize = @intCast(max_output_bytes);
    adapter.setMaxOutputBytes(casted) catch |err| return mapExecError(err);
    return @intFromEnum(AdapterResultCode.ok);
}

pub export fn uvtools_adapter_execute_argv(
    handle: ?*anyopaque,
    argv: ?[*]const ?[*:0]const u8,
    argc: usize,
) c_int {
    const adapter = castAdapter(handle) orelse return @intFromEnum(AdapterResultCode.invalid);
    const raw_argv = argv orelse return @intFromEnum(AdapterResultCode.invalid);
    if (argc == 0) return @intFromEnum(AdapterResultCode.invalid);

    var args: std.ArrayList([]const u8) = .empty;
    defer args.deinit(std.heap.c_allocator);

    var index: usize = 0;
    while (index < argc) : (index += 1) {
        const item = raw_argv[index] orelse return @intFromEnum(AdapterResultCode.invalid);
        args.append(std.heap.c_allocator, std.mem.span(item)) catch return @intFromEnum(AdapterResultCode.exec_error);
    }

    adapter.executeArgv(args.items) catch |err| return mapExecError(err);
    return @intFromEnum(AdapterResultCode.ok);
}

pub export fn uvtools_adapter_execute_raw(handle: ?*anyopaque, raw_args_line: ?[*:0]const u8) c_int {
    const adapter = castAdapter(handle) orelse return @intFromEnum(AdapterResultCode.invalid);
    const line = cStringToSlice(raw_args_line) orelse return @intFromEnum(AdapterResultCode.invalid);
    adapter.executeRaw(line) catch |err| return mapExecError(err);
    return @intFromEnum(AdapterResultCode.ok);
}

pub export fn uvtools_adapter_execute_command(handle: ?*anyopaque, command: ?*const UvtoolsInterfaceCommand) c_int {
    const adapter = castAdapter(handle) orelse return @intFromEnum(AdapterResultCode.invalid);
    const cmd = command orelse return @intFromEnum(AdapterResultCode.invalid);
    adapter.executeCommand(cmd.*) catch |err| return mapExecError(err);
    return @intFromEnum(AdapterResultCode.ok);
}

pub export fn uvtools_adapter_execute_command_simple(
    handle: ?*anyopaque,
    command_id: c_int,
    input_path: ?[*:0]const u8,
    secondary_path: ?[*:0]const u8,
    output_path: ?[*:0]const u8,
    extra_args: ?[*:0]const u8,
) c_int {
    const command = UvtoolsInterfaceCommand{
        .command_id = command_id,
        .input_path = input_path,
        .secondary_path = secondary_path,
        .output_path = output_path,
        .extra_args = extra_args,
    };
    return uvtools_adapter_execute_command(handle, &command);
}

pub export fn uvtools_adapter_convert(
    handle: ?*anyopaque,
    input_path: ?[*:0]const u8,
    target_type_or_ext: ?[*:0]const u8,
    output_path: ?[*:0]const u8,
    extra_args: ?[*:0]const u8,
) c_int {
    const adapter = castAdapter(handle) orelse return @intFromEnum(AdapterResultCode.invalid);
    const input = cStringToSlice(input_path) orelse return @intFromEnum(AdapterResultCode.invalid);
    const target = cStringToSlice(target_type_or_ext) orelse return @intFromEnum(AdapterResultCode.invalid);
    const output = cStringToSlice(output_path) orelse "";
    const extra = cStringToSlice(extra_args);

    adapter.executeConvert(input, target, output, extra) catch |err| return mapExecError(err);
    return @intFromEnum(AdapterResultCode.ok);
}

pub export fn uvtools_adapter_extract(
    handle: ?*anyopaque,
    input_path: ?[*:0]const u8,
    output_dir: ?[*:0]const u8,
    extra_args: ?[*:0]const u8,
) c_int {
    const adapter = castAdapter(handle) orelse return @intFromEnum(AdapterResultCode.invalid);
    const input = cStringToSlice(input_path) orelse return @intFromEnum(AdapterResultCode.invalid);
    const output = cStringToSlice(output_dir) orelse "";
    const extra = cStringToSlice(extra_args);

    adapter.executeExtract(input, output, extra) catch |err| return mapExecError(err);
    return @intFromEnum(AdapterResultCode.ok);
}

pub export fn uvtools_adapter_run(
    handle: ?*anyopaque,
    input_path: ?[*:0]const u8,
    classes_or_files: ?[*:0]const u8,
    extra_args: ?[*:0]const u8,
) c_int {
    const adapter = castAdapter(handle) orelse return @intFromEnum(AdapterResultCode.invalid);
    const input = cStringToSlice(input_path) orelse return @intFromEnum(AdapterResultCode.invalid);
    const classes = cStringToSlice(classes_or_files) orelse return @intFromEnum(AdapterResultCode.invalid);
    const extra = cStringToSlice(extra_args);

    adapter.executeRun(input, classes, extra) catch |err| return mapExecError(err);
    return @intFromEnum(AdapterResultCode.ok);
}

pub export fn uvtools_adapter_compare(
    handle: ?*anyopaque,
    input_path_a: ?[*:0]const u8,
    input_path_b: ?[*:0]const u8,
    extra_args: ?[*:0]const u8,
) c_int {
    const adapter = castAdapter(handle) orelse return @intFromEnum(AdapterResultCode.invalid);
    const input_a = cStringToSlice(input_path_a) orelse return @intFromEnum(AdapterResultCode.invalid);
    const input_b = cStringToSlice(input_path_b) orelse return @intFromEnum(AdapterResultCode.invalid);
    const extra = cStringToSlice(extra_args);

    adapter.executeCompare(input_a, input_b, extra) catch |err| return mapExecError(err);
    return @intFromEnum(AdapterResultCode.ok);
}

pub export fn uvtools_adapter_print_issues(
    handle: ?*anyopaque,
    input_path: ?[*:0]const u8,
    extra_args: ?[*:0]const u8,
) c_int {
    const adapter = castAdapter(handle) orelse return @intFromEnum(AdapterResultCode.invalid);
    const input = cStringToSlice(input_path) orelse return @intFromEnum(AdapterResultCode.invalid);
    const extra = cStringToSlice(extra_args);

    adapter.executePrintLike("print-issues", input, extra) catch |err| return mapExecError(err);
    return @intFromEnum(AdapterResultCode.ok);
}

pub export fn uvtools_adapter_print_properties(
    handle: ?*anyopaque,
    input_path: ?[*:0]const u8,
    extra_args: ?[*:0]const u8,
) c_int {
    const adapter = castAdapter(handle) orelse return @intFromEnum(AdapterResultCode.invalid);
    const input = cStringToSlice(input_path) orelse return @intFromEnum(AdapterResultCode.invalid);
    const extra = cStringToSlice(extra_args);

    adapter.executePrintLike("print-properties", input, extra) catch |err| return mapExecError(err);
    return @intFromEnum(AdapterResultCode.ok);
}

pub export fn uvtools_adapter_print_gcode(
    handle: ?*anyopaque,
    input_path: ?[*:0]const u8,
    extra_args: ?[*:0]const u8,
) c_int {
    const adapter = castAdapter(handle) orelse return @intFromEnum(AdapterResultCode.invalid);
    const input = cStringToSlice(input_path) orelse return @intFromEnum(AdapterResultCode.invalid);
    const extra = cStringToSlice(extra_args);

    adapter.executePrintLike("print-gcode", input, extra) catch |err| return mapExecError(err);
    return @intFromEnum(AdapterResultCode.ok);
}

pub export fn uvtools_adapter_get_state_code(handle: ?*anyopaque) c_int {
    const adapter = castAdapter(handle) orelse return @intFromEnum(AdapterState.failed);
    return adapter.getStateCode();
}

pub export fn uvtools_adapter_get_last_exit_code(handle: ?*anyopaque) c_int {
    const adapter = castAdapter(handle) orelse return -1;
    return adapter.getLastExitCode();
}

pub export fn uvtools_adapter_get_last_success(handle: ?*anyopaque) c_int {
    const adapter = castAdapter(handle) orelse return 0;
    return adapter.getLastSuccess();
}

pub export fn uvtools_adapter_get_last_timed_out(handle: ?*anyopaque) c_int {
    const adapter = castAdapter(handle) orelse return 0;
    return adapter.getLastTimedOut();
}

pub export fn uvtools_adapter_get_last_stdout(
    handle: ?*anyopaque,
    out_ptr: ?*?[*]u8,
    out_len: ?*usize,
) c_int {
    const adapter = castAdapter(handle) orelse return @intFromEnum(AdapterResultCode.invalid);
    const ptr = out_ptr orelse return @intFromEnum(AdapterResultCode.invalid);
    const len = out_len orelse return @intFromEnum(AdapterResultCode.invalid);

    adapter.copyLastStdout(ptr, len) catch |err| return mapExecError(err);
    return @intFromEnum(AdapterResultCode.ok);
}

pub export fn uvtools_adapter_get_last_stderr(
    handle: ?*anyopaque,
    out_ptr: ?*?[*]u8,
    out_len: ?*usize,
) c_int {
    const adapter = castAdapter(handle) orelse return @intFromEnum(AdapterResultCode.invalid);
    const ptr = out_ptr orelse return @intFromEnum(AdapterResultCode.invalid);
    const len = out_len orelse return @intFromEnum(AdapterResultCode.invalid);

    adapter.copyLastStderr(ptr, len) catch |err| return mapExecError(err);
    return @intFromEnum(AdapterResultCode.ok);
}

pub export fn uvtools_adapter_get_last_error(
    handle: ?*anyopaque,
    out_ptr: ?*?[*]u8,
    out_len: ?*usize,
) c_int {
    const adapter = castAdapter(handle) orelse return @intFromEnum(AdapterResultCode.invalid);
    const ptr = out_ptr orelse return @intFromEnum(AdapterResultCode.invalid);
    const len = out_len orelse return @intFromEnum(AdapterResultCode.invalid);

    adapter.copyLastError(ptr, len) catch |err| return mapExecError(err);
    return @intFromEnum(AdapterResultCode.ok);
}

pub export fn uvtools_adapter_get_last_args(
    handle: ?*anyopaque,
    out_ptr: ?*?[*]u8,
    out_len: ?*usize,
) c_int {
    const adapter = castAdapter(handle) orelse return @intFromEnum(AdapterResultCode.invalid);
    const ptr = out_ptr orelse return @intFromEnum(AdapterResultCode.invalid);
    const len = out_len orelse return @intFromEnum(AdapterResultCode.invalid);

    adapter.copyLastArgs(ptr, len) catch |err| return mapExecError(err);
    return @intFromEnum(AdapterResultCode.ok);
}

pub export fn uvtools_adapter_get_state_json(
    handle: ?*anyopaque,
    out_ptr: ?*?[*]u8,
    out_len: ?*usize,
) c_int {
    const adapter = castAdapter(handle) orelse return @intFromEnum(AdapterResultCode.invalid);
    const ptr = out_ptr orelse return @intFromEnum(AdapterResultCode.invalid);
    const len = out_len orelse return @intFromEnum(AdapterResultCode.invalid);

    const json = adapter.getStateJson() catch |err| return mapExecError(err);
    ptr.* = json.ptr;
    len.* = json.len;
    return @intFromEnum(AdapterResultCode.ok);
}

pub export fn uvtools_adapter_free_buffer(ptr: ?[*]u8, len: usize) void {
    const p = ptr orelse return;
    if (len == 0) return;
    const slice = p[0..len];
    std.heap.c_allocator.free(slice);
}

test "parseArgsLine handles quotes" {
    const allocator = std.testing.allocator;
    const input = "convert \"in file.ctb\" ctb out.ctb --version 4";
    var args = try parseArgsLine(allocator, input);
    defer freeOwnedTokens(allocator, &args);

    try std.testing.expectEqual(@as(usize, 6), args.items.len);
    try std.testing.expectEqualStrings("convert", args.items[0]);
    try std.testing.expectEqualStrings("in file.ctb", args.items[1]);
    try std.testing.expectEqualStrings("ctb", args.items[2]);
    try std.testing.expectEqualStrings("out.ctb", args.items[3]);
    try std.testing.expectEqualStrings("--version", args.items[4]);
    try std.testing.expectEqualStrings("4", args.items[5]);
}

test "joinArgsForLog adds quotes for spaces" {
    const allocator = std.testing.allocator;
    const argv: []const []const u8 = &.{ "UVtoolsCmd", "convert", "in file.ctb", "ctb" };
    const joined = try joinArgsForLog(allocator, argv);
    defer allocator.free(joined);

    try std.testing.expect(std.mem.indexOf(u8, joined, "\"in file.ctb\"") != null);
}
