const std = @import("std");

const c = @cImport({
    @cInclude("errno.h");
    @cInclude("fcntl.h");
    @cInclude("termios.h");
    @cInclude("unistd.h");
});

const Allocator = std.mem.Allocator;

const temp_poll_interval_ms: i64 = 2_000;
const pos_poll_interval_ms: i64 = 5_000;
const loop_sleep_ns: u64 = 20 * std.time.ns_per_ms;
const max_file_size: usize = 64 * 1024 * 1024;
const max_history_lines: usize = 2_048;
const max_terminal_lines: usize = 256;
const max_tools: usize = 8;
const default_extrude_speed: f64 = 300.0;

const jog_flag_absolute: u32 = 1 << 0;
const axis_x_mask: u32 = 1 << 0;
const axis_y_mask: u32 = 1 << 1;
const axis_z_mask: u32 = 1 << 2;

const HeaterKind = enum(c_int) {
    current_tool = 0,
    tool = 1,
    bed = 2,
    chamber = 3,
};

const InterfaceCommandId = enum(c_int) {
    job_start = 1,
    job_restart = 2,
    job_pause = 3,
    job_resume = 4,
    job_toggle_pause = 5,
    job_cancel = 6,

    printhead_jog = 10,
    printhead_home = 11,
    printhead_feedrate = 12,

    tool_select = 20,
    tool_target = 21,
    tool_offset = 22,
    tool_extrude = 23,
    tool_flowrate = 24,

    bed_target = 30,
    bed_offset = 31,
    chamber_target = 32,
    chamber_offset = 33,

    sd_init = 40,
    sd_refresh = 41,
    sd_release = 42,

    connection_repair = 50,
    emergency_stop = 51,

    command_raw_gcode = 60,
    command_raw_script = 61,
};

pub const MarlinInterfaceCommand = extern struct {
    command_id: c_int,
    flags: u32 = 0,
    axis_mask: u32 = 0,
    tool: i32 = -1,
    heater: i32 = @intFromEnum(HeaterKind.current_tool),
    value_a: f64 = 0.0,
    value_b: f64 = 0.0,
    value_c: f64 = 0.0,
    value_d: f64 = 0.0,
    text: ?[*:0]const u8 = null,
};

const AdapterState = enum(c_int) {
    disconnected = 0,
    connecting = 1,
    operational = 2,
    printing = 3,
    paused = 4,
    failed = 5,
};

const CommandSource = enum {
    manual,
    print,
    temperature_poll,
    position_poll,
    system,
};

const QueueItem = struct {
    text: []u8,
    source: CommandSource,
    needs_ack: bool,
};

const HistoryEntry = struct {
    line_number: u32,
    command: []u8,
};

const Telemetry = struct {
    hotend_actual: ?f64 = null,
    hotend_target: ?f64 = null,
    bed_actual: ?f64 = null,
    bed_target: ?f64 = null,
    chamber_actual: ?f64 = null,
    chamber_target: ?f64 = null,
    pos_x: ?f64 = null,
    pos_y: ?f64 = null,
    pos_z: ?f64 = null,
    pos_e: ?f64 = null,
    sd_current: ?u64 = null,
    sd_total: ?u64 = null,
    progress: f64 = 0.0,
};

const Adapter = struct {
    allocator: Allocator,
    mutex: std.Thread.Mutex = .{},

    running: bool = false,
    io_thread: ?std.Thread = null,

    connected: bool = false,
    fd: c_int = -1,
    port: []u8 = &[_]u8{},
    baudrate: u32 = 0,

    state: AdapterState = .disconnected,
    awaiting_ok: bool = false,
    checksum_enabled: bool = true,
    next_line_number: u32 = 1,
    pending_resend: ?u32 = null,

    command_queue: std.ArrayList(QueueItem),
    print_lines: std.ArrayList([]u8),
    print_index: usize = 0,
    printing: bool = false,
    paused: bool = false,

    history: std.ArrayList(HistoryEntry),
    rx_buffer: std.ArrayList(u8),
    terminal_log: std.ArrayList([]u8),

    telemetry: Telemetry = .{},
    current_tool: u8 = 0,
    tool_offsets: [max_tools]f64 = [_]f64{0} ** max_tools,
    bed_offset: f64 = 0.0,
    chamber_offset: f64 = 0.0,
    last_error: []u8 = &[_]u8{},
    firmware_name: []u8 = &[_]u8{},
    last_line: []u8 = &[_]u8{},

    last_temp_poll_ms: i64 = 0,
    last_pos_poll_ms: i64 = 0,

    fn init(allocator: Allocator) Adapter {
        return .{
            .allocator = allocator,
            .command_queue = .empty,
            .print_lines = .empty,
            .history = .empty,
            .rx_buffer = .empty,
            .terminal_log = .empty,
        };
    }

    fn deinit(self: *Adapter) void {
        self.stopIoThread();
        self.disconnectLocked();

        self.clearCommandQueueLocked();
        self.clearPrintLinesLocked();
        self.clearHistoryLocked();
        self.clearTerminalLogLocked();
        self.rx_buffer.deinit(self.allocator);
        self.command_queue.deinit(self.allocator);
        self.print_lines.deinit(self.allocator);
        self.history.deinit(self.allocator);
        self.terminal_log.deinit(self.allocator);

        self.freeOwnedString(&self.last_error);
        self.freeOwnedString(&self.firmware_name);
        self.freeOwnedString(&self.last_line);
        self.freeOwnedString(&self.port);
    }

    fn startIoThread(self: *Adapter) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        if (self.running) return;
        self.running = true;
        self.io_thread = try std.Thread.spawn(.{}, ioLoop, .{self});
    }

    fn stopIoThread(self: *Adapter) void {
        self.mutex.lock();
        const should_join = self.running;
        self.running = false;
        self.mutex.unlock();

        if (should_join) {
            if (self.io_thread) |thread| {
                thread.join();
                self.io_thread = null;
            }
        }
    }

    fn connect(self: *Adapter, port_z: [:0]const u8, baudrate: u32) !void {
        try self.startIoThread();

        const fd = try openSerial(port_z, baudrate);
        const now_ms = std.time.milliTimestamp();

        self.mutex.lock();
        defer self.mutex.unlock();

        self.disconnectLocked();

        self.fd = fd;
        self.connected = true;
        self.state = .connecting;
        self.awaiting_ok = false;
        self.pending_resend = null;
        self.next_line_number = 1;
        self.last_temp_poll_ms = now_ms;
        self.last_pos_poll_ms = now_ms;
        self.baudrate = baudrate;

        self.freeOwnedString(&self.port);
        self.port = try self.allocator.dupe(u8, port_z);

        self.clearCommandQueueLocked();
        self.clearHistoryLocked();
        self.clearTerminalLogLocked();
        self.rx_buffer.clearRetainingCapacity();
        self.telemetry = .{};
        self.current_tool = 0;
        self.tool_offsets = [_]f64{0} ** max_tools;
        self.bed_offset = 0.0;
        self.chamber_offset = 0.0;
        self.last_error = self.replaceOwnedString(self.last_error, "") catch self.last_error;

        try self.enqueueInternalLocked("M110 N0", .system, true);
        try self.enqueueInternalLocked("M115", .system, true);
        try self.enqueueInternalLocked("M155 S2", .system, true);
        try self.enqueueInternalLocked("M154 S5", .system, true);
    }

    fn disconnect(self: *Adapter) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        self.disconnectLocked();
    }

    fn disconnectLocked(self: *Adapter) void {
        if (self.fd >= 0) {
            _ = c.close(self.fd);
            self.fd = -1;
        }

        self.connected = false;
        self.awaiting_ok = false;
        self.pending_resend = null;
        self.state = .disconnected;
        self.printing = false;
        self.paused = false;
        self.print_index = 0;
    }

    fn queueGcode(self: *Adapter, command: []const u8) !void {
        const normalized = normalizeGcode(self.allocator, command) orelse return;
        errdefer self.allocator.free(normalized);

        self.mutex.lock();
        defer self.mutex.unlock();

        try self.command_queue.append(self.allocator, .{
            .text = normalized,
            .source = .manual,
            .needs_ack = true,
        });
    }

    fn loadPrintFile(self: *Adapter, path: []const u8) !void {
        const file_data = try readFileAlloc(self.allocator, path, max_file_size);
        defer self.allocator.free(file_data);

        var parsed: std.ArrayList([]u8) = .empty;
        errdefer {
            for (parsed.items) |line| self.allocator.free(line);
            parsed.deinit(self.allocator);
        }

        var it = std.mem.splitScalar(u8, file_data, '\n');
        while (it.next()) |line_raw| {
            const normalized = normalizeGcode(self.allocator, line_raw) orelse continue;
            try parsed.append(self.allocator, normalized);
        }

        if (parsed.items.len == 0) return error.EmptyFile;

        self.mutex.lock();
        defer self.mutex.unlock();

        self.clearPrintLinesLocked();
        self.print_lines = parsed;
        self.print_index = 0;
        self.telemetry.progress = 0.0;
    }

    fn startPrint(self: *Adapter) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        if (!self.connected) return error.NotConnected;
        if (self.print_lines.items.len == 0) return error.NoPrintLoaded;

        self.print_index = 0;
        self.printing = true;
        self.paused = false;
        self.state = .printing;
        self.telemetry.progress = 0.0;
    }

    fn pausePrint(self: *Adapter) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        if (!self.printing) return;
        self.paused = true;
        self.state = .paused;
    }

    fn resumePrint(self: *Adapter) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        if (!self.printing) return;
        self.paused = false;
        self.state = .printing;
    }

    fn cancelPrint(self: *Adapter) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        self.printing = false;
        self.paused = false;
        self.print_index = 0;
        self.telemetry.progress = 0.0;
        if (self.connected) self.state = .operational;
    }

    fn repairCommunication(self: *Adapter) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        self.awaiting_ok = false;
        self.pending_resend = null;
        if (self.connected and !self.printing and self.state != .failed) {
            self.state = .operational;
        }
    }

    fn executeInterfaceCommand(self: *Adapter, command: MarlinInterfaceCommand) !void {
        const cmd_id = std.meta.intToEnum(InterfaceCommandId, command.command_id) catch return error.InvalidCommand;
        switch (cmd_id) {
            .job_start, .job_restart => try self.startPrint(),
            .job_pause => try self.pausePrint(),
            .job_resume => try self.resumePrint(),
            .job_toggle_pause => {
                self.mutex.lock();
                const is_paused = self.paused;
                self.mutex.unlock();
                if (is_paused) {
                    try self.resumePrint();
                } else {
                    try self.pausePrint();
                }
            },
            .job_cancel => try self.cancelPrint(),
            .printhead_jog => try self.handleJogCommand(command),
            .printhead_home => try self.handleHomeCommand(command.axis_mask),
            .printhead_feedrate => {
                const factor = try normalizeRateFactor(command.value_a);
                const gcode = try std.fmt.allocPrint(self.allocator, "M220 S{d}", .{factor});
                defer self.allocator.free(gcode);
                try self.queueGcode(gcode);
            },
            .tool_select => try self.handleToolSelect(command.tool),
            .tool_target => try self.handleToolTarget(command),
            .tool_offset => try self.handleToolOffset(command),
            .tool_extrude => try self.handleToolExtrude(command.value_a, command.value_b),
            .tool_flowrate => {
                const factor = try normalizeRateFactor(command.value_a);
                const gcode = try std.fmt.allocPrint(self.allocator, "M221 S{d}", .{factor});
                defer self.allocator.free(gcode);
                try self.queueGcode(gcode);
            },
            .bed_target => try self.handleBedTarget(command.value_a),
            .bed_offset => try self.handleBedOffset(command.value_a),
            .chamber_target => try self.handleChamberTarget(command.value_a),
            .chamber_offset => try self.handleChamberOffset(command.value_a),
            .sd_init => try self.queueGcode("M21"),
            .sd_refresh => try self.queueGcode("M20"),
            .sd_release => try self.queueGcode("M22"),
            .connection_repair => self.repairCommunication(),
            .emergency_stop => try self.queueGcode("M112"),
            .command_raw_gcode, .command_raw_script => {
                const text = cStringToSlice(command.text) orelse return error.MissingText;
                try self.queueGcodeBatch(text);
            },
        }
    }

    fn queueGcodeBatch(self: *Adapter, text: []const u8) !void {
        var it = std.mem.splitScalar(u8, text, '\n');
        var queued_any = false;
        while (it.next()) |line| {
            try self.queueGcode(line);
            queued_any = true;
        }
        if (!queued_any) return error.MissingText;
    }

    fn handleJogCommand(self: *Adapter, command: MarlinInterfaceCommand) !void {
        if ((command.axis_mask & (axis_x_mask | axis_y_mask | axis_z_mask)) == 0) {
            return error.InvalidAxisMask;
        }

        var move = std.ArrayList(u8).empty;
        defer move.deinit(self.allocator);

        try move.appendSlice(self.allocator, "G0");
        if (command.axis_mask & axis_x_mask != 0) {
            try move.writer(self.allocator).print(" X{d}", .{command.value_a});
        }
        if (command.axis_mask & axis_y_mask != 0) {
            try move.writer(self.allocator).print(" Y{d}", .{command.value_b});
        }
        if (command.axis_mask & axis_z_mask != 0) {
            try move.writer(self.allocator).print(" Z{d}", .{command.value_c});
        }
        if (command.value_d > 0.0) {
            try move.writer(self.allocator).print(" F{d}", .{command.value_d});
        }

        if (command.flags & jog_flag_absolute != 0) {
            try self.queueGcode("G90");
            try self.queueGcode(move.items);
            return;
        }

        try self.queueGcode("G91");
        try self.queueGcode(move.items);
        try self.queueGcode("G90");
    }

    fn handleHomeCommand(self: *Adapter, axis_mask: u32) !void {
        if ((axis_mask & (axis_x_mask | axis_y_mask | axis_z_mask)) == 0) {
            return error.InvalidAxisMask;
        }

        var cmd = std.ArrayList(u8).empty;
        defer cmd.deinit(self.allocator);

        try cmd.appendSlice(self.allocator, "G28");
        if (axis_mask & axis_x_mask != 0) try cmd.appendSlice(self.allocator, " X0");
        if (axis_mask & axis_y_mask != 0) try cmd.appendSlice(self.allocator, " Y0");
        if (axis_mask & axis_z_mask != 0) try cmd.appendSlice(self.allocator, " Z0");

        try self.queueGcode("G91");
        try self.queueGcode(cmd.items);
        try self.queueGcode("G90");
    }

    fn handleToolSelect(self: *Adapter, tool_index: i32) !void {
        const normalized = normalizeToolIndex(tool_index) catch return error.InvalidTool;
        self.mutex.lock();
        self.current_tool = normalized;
        self.mutex.unlock();

        const gcode = try std.fmt.allocPrint(self.allocator, "T{d}", .{normalized});
        defer self.allocator.free(gcode);
        try self.queueGcode(gcode);
    }

    fn handleToolTarget(self: *Adapter, command: MarlinInterfaceCommand) !void {
        const heater = std.meta.intToEnum(HeaterKind, command.heater) catch HeaterKind.current_tool;
        if (command.value_a < 0.0) return error.InvalidValue;

        switch (heater) {
            .current_tool => {
                const tool_data = blk: {
                    self.mutex.lock();
                    defer self.mutex.unlock();
                    const current: usize = self.current_tool;
                    break :blk .{ .tool = current, .offset = self.tool_offsets[current] };
                };
                const target = command.value_a + tool_data.offset;
                const gcode = try std.fmt.allocPrint(self.allocator, "M104 S{d}", .{target});
                defer self.allocator.free(gcode);
                try self.queueGcode(gcode);
            },
            .tool => {
                const tool_no = normalizeToolIndex(command.tool) catch return error.InvalidTool;
                const offset = blk: {
                    self.mutex.lock();
                    defer self.mutex.unlock();
                    break :blk self.tool_offsets[tool_no];
                };
                const target = command.value_a + offset;
                const gcode = try std.fmt.allocPrint(self.allocator, "M104 T{d} S{d}", .{ tool_no, target });
                defer self.allocator.free(gcode);
                try self.queueGcode(gcode);
            },
            .bed => try self.handleBedTarget(command.value_a),
            .chamber => try self.handleChamberTarget(command.value_a),
        }
    }

    fn handleToolOffset(self: *Adapter, command: MarlinInterfaceCommand) !void {
        const tool_no = if (command.tool >= 0) normalizeToolIndex(command.tool) catch return error.InvalidTool else blk: {
            self.mutex.lock();
            defer self.mutex.unlock();
            break :blk self.current_tool;
        };

        self.mutex.lock();
        self.tool_offsets[tool_no] = command.value_a;
        self.mutex.unlock();
    }

    fn handleToolExtrude(self: *Adapter, amount: f64, speed: f64) !void {
        if (amount == 0.0) return;
        const normalized_speed: f64 = if (speed > 0.0) speed else default_extrude_speed;

        const move = try std.fmt.allocPrint(self.allocator, "G1 E{d} F{d}", .{ amount, normalized_speed });
        defer self.allocator.free(move);

        try self.queueGcode("G91");
        try self.queueGcode("M83");
        try self.queueGcode(move);
        try self.queueGcode("M82");
        try self.queueGcode("G90");
    }

    fn handleBedTarget(self: *Adapter, value: f64) !void {
        if (value < 0.0) return error.InvalidValue;
        const target = blk: {
            self.mutex.lock();
            defer self.mutex.unlock();
            break :blk value + self.bed_offset;
        };
        const gcode = try std.fmt.allocPrint(self.allocator, "M140 S{d}", .{target});
        defer self.allocator.free(gcode);
        try self.queueGcode(gcode);
    }

    fn handleBedOffset(self: *Adapter, value: f64) !void {
        self.mutex.lock();
        self.bed_offset = value;
        self.mutex.unlock();
    }

    fn handleChamberTarget(self: *Adapter, value: f64) !void {
        if (value < 0.0) return error.InvalidValue;
        const target = blk: {
            self.mutex.lock();
            defer self.mutex.unlock();
            break :blk value + self.chamber_offset;
        };
        const gcode = try std.fmt.allocPrint(self.allocator, "M141 S{d}", .{target});
        defer self.allocator.free(gcode);
        try self.queueGcode(gcode);
    }

    fn handleChamberOffset(self: *Adapter, value: f64) !void {
        self.mutex.lock();
        self.chamber_offset = value;
        self.mutex.unlock();
    }

    fn getStateJson(self: *Adapter) ![]u8 {
        self.mutex.lock();
        defer self.mutex.unlock();

        const Snapshot = struct {
            connected: bool,
            state: []const u8,
            port: []const u8,
            baudrate: u32,
            awaiting_ok: bool,
            checksum_enabled: bool,
            printing: bool,
            paused: bool,
            print_index: usize,
            print_total: usize,
            queue_depth: usize,
            line_number: u32,
            firmware_name: []const u8,
            last_error: []const u8,
            telemetry: Telemetry,
            current_tool: u8,
            tool_offsets: [max_tools]f64,
            bed_offset: f64,
            chamber_offset: f64,
            last_line: []const u8,
        };

        const snapshot = Snapshot{
            .connected = self.connected,
            .state = stateToString(self.state),
            .port = self.port,
            .baudrate = self.baudrate,
            .awaiting_ok = self.awaiting_ok,
            .checksum_enabled = self.checksum_enabled,
            .printing = self.printing,
            .paused = self.paused,
            .print_index = self.print_index,
            .print_total = self.print_lines.items.len,
            .queue_depth = self.command_queue.items.len,
            .line_number = self.next_line_number,
            .firmware_name = self.firmware_name,
            .last_error = self.last_error,
            .telemetry = self.telemetry,
            .current_tool = self.current_tool,
            .tool_offsets = self.tool_offsets,
            .bed_offset = self.bed_offset,
            .chamber_offset = self.chamber_offset,
            .last_line = self.last_line,
        };

        var out: std.io.Writer.Allocating = .init(self.allocator);
        defer out.deinit();

        var stringify: std.json.Stringify = .{
            .writer = &out.writer,
            .options = .{},
        };
        try stringify.write(snapshot);
        return out.toOwnedSlice();
    }

    fn ioLoop(self: *Adapter) void {
        while (true) {
            self.mutex.lock();
            const keep_running = self.running;
            const connected = self.connected;
            const fd = self.fd;
            self.mutex.unlock();

            if (!keep_running) break;

            if (!connected or fd < 0) {
                std.Thread.sleep(loop_sleep_ns);
                continue;
            }

            self.readFromSerial(fd);

            const now_ms = std.time.milliTimestamp();
            var outbound: ?[]u8 = null;
            self.mutex.lock();
            if (self.connected and self.fd == fd) {
                self.schedulePollsLocked(now_ms);
                outbound = self.prepareOutboundLocked();
            }
            self.mutex.unlock();

            if (outbound) |cmd| {
                defer self.allocator.free(cmd);
                if (writeLine(fd, cmd) catch false) {
                    self.mutex.lock();
                    self.appendTerminalLogLocked(">>>", cmd);
                    self.mutex.unlock();
                } else {
                    self.markIoFailure("Write to serial failed");
                }
            }

            std.Thread.sleep(loop_sleep_ns);
        }
    }

    fn readFromSerial(self: *Adapter, fd: c_int) void {
        var buf: [512]u8 = undefined;
        while (true) {
            const rc = c.read(fd, &buf, buf.len);
            if (rc > 0) {
                self.ingestIncoming(buf[0..@intCast(rc)]);
                continue;
            }

            if (rc == 0) break;

            const err_no = std.posix.errno(rc);
            if (err_no == .AGAIN or err_no == .INTR) break;
            self.markIoFailure("Read from serial failed");
            break;
        }
    }

    fn ingestIncoming(self: *Adapter, chunk: []const u8) void {
        self.mutex.lock();
        defer self.mutex.unlock();

        self.rx_buffer.appendSlice(self.allocator, chunk) catch return;

        while (std.mem.indexOfScalar(u8, self.rx_buffer.items, '\n')) |idx| {
            const line_raw = self.rx_buffer.items[0..idx];
            const line = std.mem.trimRight(u8, line_raw, "\r");
            self.processLineLocked(line);

            const consume = idx + 1;
            const remaining = self.rx_buffer.items[consume..];
            std.mem.copyForwards(u8, self.rx_buffer.items[0..remaining.len], remaining);
            self.rx_buffer.items.len = remaining.len;
        }
    }

    fn processLineLocked(self: *Adapter, raw_line: []const u8) void {
        const line = std.mem.trim(u8, raw_line, " \t\r\n\x00");
        if (line.len == 0) return;

        self.appendTerminalLogLocked("<<<", line);
        self.last_line = self.replaceOwnedString(self.last_line, line) catch self.last_line;

        if (startsWithIgnoreCase(line, "echo:busy:") or startsWithIgnoreCase(line, "busy:")) {
            // Keep communication alive and wait for a proper `ok`.
        }

        if (startsWithIgnoreCase(line, "error:") or startsWithIgnoreCase(line, "!!")) {
            self.last_error = self.replaceOwnedString(self.last_error, line) catch self.last_error;
            self.state = .failed;
        }

        if (startsWithIgnoreCase(line, "resend") or startsWithIgnoreCase(line, "rs")) {
            if (parseResendLine(line)) |line_no| {
                self.pending_resend = line_no;
                self.awaiting_ok = true;
            }
        }

        if (startsWithIgnoreCase(line, "ok") or std.ascii.eqlIgnoreCase(line, "wait")) {
            self.awaiting_ok = false;
            if (self.state == .connecting and !self.printing) self.state = .operational;
        }

        self.parseTemperatureLocked(line);
        self.parsePositionLocked(line);
        self.parseSdStatusLocked(line);
        self.parseFirmwareLocked(line);
        self.parseActionLocked(line);

        if (self.printing and self.print_lines.items.len > 0) {
            self.telemetry.progress = @as(f64, @floatFromInt(self.print_index)) /
                @as(f64, @floatFromInt(self.print_lines.items.len));
        }
    }

    fn schedulePollsLocked(self: *Adapter, now_ms: i64) void {
        if (!self.connected) return;

        if (now_ms - self.last_temp_poll_ms >= temp_poll_interval_ms) {
            if (!self.hasQueuedSourceLocked(.temperature_poll)) {
                self.enqueueInternalLocked("M105", .temperature_poll, true) catch {};
            }
            self.last_temp_poll_ms = now_ms;
        }

        if (now_ms - self.last_pos_poll_ms >= pos_poll_interval_ms) {
            if (!self.hasQueuedSourceLocked(.position_poll)) {
                self.enqueueInternalLocked("M114", .position_poll, true) catch {};
            }
            self.last_pos_poll_ms = now_ms;
        }
    }

    fn prepareOutboundLocked(self: *Adapter) ?[]u8 {
        if (!self.connected) return null;

        if (self.pending_resend) |line_no| {
            const cmd = self.buildResendLocked(line_no) catch null;
            self.pending_resend = null;
            return cmd;
        }

        if (self.awaiting_ok) return null;

        if (self.command_queue.items.len > 0) {
            const item = self.command_queue.orderedRemove(0);
            defer self.allocator.free(item.text);
            return self.buildCommandLocked(item.text, item.needs_ack, false, null) catch null;
        }

        if (self.printing and !self.paused) {
            if (self.print_index < self.print_lines.items.len) {
                const line = self.print_lines.items[self.print_index];
                self.print_index += 1;
                self.state = .printing;
                return self.buildCommandLocked(line, true, true, null) catch null;
            }

            self.printing = false;
            self.paused = false;
            self.state = .operational;
            self.telemetry.progress = 1.0;
        }

        return null;
    }

    fn buildResendLocked(self: *Adapter, line_no: u32) ![]u8 {
        const entry = self.findHistoryLocked(line_no) orelse return error.MissingHistoryLine;
        return self.buildCommandLocked(entry.command, true, false, line_no);
    }

    fn buildCommandLocked(
        self: *Adapter,
        raw_command: []const u8,
        needs_ack: bool,
        track_history: bool,
        force_line_no: ?u32,
    ) ![]u8 {
        if (!needs_ack) {
            return self.allocator.dupe(u8, raw_command);
        }

        if (!self.checksum_enabled) {
            self.awaiting_ok = true;
            return self.allocator.dupe(u8, raw_command);
        }

        const line_no: u32 = force_line_no orelse self.next_line_number;
        if (force_line_no == null) {
            self.next_line_number += 1;
        }

        if (track_history and force_line_no == null) {
            try self.pushHistoryLocked(line_no, raw_command);
        }

        const prefixed = try std.fmt.allocPrint(self.allocator, "N{d} {s}", .{ line_no, raw_command });
        defer self.allocator.free(prefixed);

        var checksum: u8 = 0;
        for (prefixed) |ch| checksum ^= ch;

        const encoded = try std.fmt.allocPrint(self.allocator, "{s}*{d}", .{ prefixed, checksum });
        self.awaiting_ok = true;
        return encoded;
    }

    fn pushHistoryLocked(self: *Adapter, line_no: u32, command: []const u8) !void {
        const copy = try self.allocator.dupe(u8, command);
        try self.history.append(self.allocator, .{
            .line_number = line_no,
            .command = copy,
        });

        if (self.history.items.len > max_history_lines) {
            const old = self.history.orderedRemove(0);
            self.allocator.free(old.command);
        }
    }

    fn findHistoryLocked(self: *Adapter, line_no: u32) ?HistoryEntry {
        var i: usize = self.history.items.len;
        while (i > 0) {
            i -= 1;
            const entry = self.history.items[i];
            if (entry.line_number == line_no) return entry;
        }
        return null;
    }

    fn parseTemperatureLocked(self: *Adapter, line: []const u8) void {
        if (parseTempSensor(line, "T0:")) |sensor| {
            self.telemetry.hotend_actual = sensor.actual;
            self.telemetry.hotend_target = sensor.target;
        } else if (parseTempSensor(line, "T:")) |sensor| {
            self.telemetry.hotend_actual = sensor.actual;
            self.telemetry.hotend_target = sensor.target;
        }

        if (parseTempSensor(line, "B:")) |sensor| {
            self.telemetry.bed_actual = sensor.actual;
            self.telemetry.bed_target = sensor.target;
        }

        if (parseTempSensor(line, "C:")) |sensor| {
            self.telemetry.chamber_actual = sensor.actual;
            self.telemetry.chamber_target = sensor.target;
        }
    }

    fn parsePositionLocked(self: *Adapter, line: []const u8) void {
        if (!containsCaseSensitive(line, "X:") or !containsCaseSensitive(line, "Y:") or !containsCaseSensitive(line, "Z:")) {
            return;
        }

        if (parseScalarAfterKey(line, "X:")) |v| self.telemetry.pos_x = v;
        if (parseScalarAfterKey(line, "Y:")) |v| self.telemetry.pos_y = v;
        if (parseScalarAfterKey(line, "Z:")) |v| self.telemetry.pos_z = v;

        if (parseScalarAfterKey(line, "E:")) |v| {
            self.telemetry.pos_e = v;
        } else if (parseScalarAfterKey(line, "E0:")) |v| {
            self.telemetry.pos_e = v;
        }
    }

    fn parseSdStatusLocked(self: *Adapter, line: []const u8) void {
        if (!containsCaseSensitive(line, "SD printing byte")) return;
        if (parseSdPrintingByte(line)) |p| {
            self.telemetry.sd_current = p.current;
            self.telemetry.sd_total = p.total;
        }
    }

    fn parseFirmwareLocked(self: *Adapter, line: []const u8) void {
        if (extractFirmwareName(line)) |name| {
            self.firmware_name = self.replaceOwnedString(self.firmware_name, name) catch self.firmware_name;
        }
    }

    fn parseActionLocked(self: *Adapter, line: []const u8) void {
        if (!startsWithIgnoreCase(line, "//action:")) return;
        const action = std.mem.trim(u8, line["//action:".len..], " \t");

        if (startsWithIgnoreCase(action, "pause") or startsWithIgnoreCase(action, "paused")) {
            if (self.printing) {
                self.paused = true;
                self.state = .paused;
            }
        } else if (startsWithIgnoreCase(action, "resume") or startsWithIgnoreCase(action, "resumed")) {
            if (self.printing) {
                self.paused = false;
                self.state = .printing;
            }
        } else if (startsWithIgnoreCase(action, "cancel")) {
            self.printing = false;
            self.paused = false;
            self.state = .operational;
        } else if (startsWithIgnoreCase(action, "start")) {
            if (self.print_lines.items.len > 0 and !self.printing) {
                self.printing = true;
                self.paused = false;
                self.state = .printing;
            }
        }
    }

    fn hasQueuedSourceLocked(self: *Adapter, source: CommandSource) bool {
        for (self.command_queue.items) |item| {
            if (item.source == source) return true;
        }
        return false;
    }

    fn enqueueInternalLocked(self: *Adapter, text: []const u8, source: CommandSource, needs_ack: bool) !void {
        const copy = try self.allocator.dupe(u8, text);
        errdefer self.allocator.free(copy);
        try self.command_queue.append(self.allocator, .{
            .text = copy,
            .source = source,
            .needs_ack = needs_ack,
        });
    }

    fn appendTerminalLogLocked(self: *Adapter, prefix: []const u8, line: []const u8) void {
        const entry = std.fmt.allocPrint(self.allocator, "{s} {s}", .{ prefix, line }) catch return;
        self.terminal_log.append(self.allocator, entry) catch {
            self.allocator.free(entry);
            return;
        };

        if (self.terminal_log.items.len > max_terminal_lines) {
            const old = self.terminal_log.orderedRemove(0);
            self.allocator.free(old);
        }
    }

    fn clearCommandQueueLocked(self: *Adapter) void {
        for (self.command_queue.items) |item| self.allocator.free(item.text);
        self.command_queue.clearRetainingCapacity();
    }

    fn clearPrintLinesLocked(self: *Adapter) void {
        for (self.print_lines.items) |line| self.allocator.free(line);
        self.print_lines.clearRetainingCapacity();
    }

    fn clearHistoryLocked(self: *Adapter) void {
        for (self.history.items) |entry| self.allocator.free(entry.command);
        self.history.clearRetainingCapacity();
    }

    fn clearTerminalLogLocked(self: *Adapter) void {
        for (self.terminal_log.items) |entry| self.allocator.free(entry);
        self.terminal_log.clearRetainingCapacity();
    }

    fn replaceOwnedString(self: *Adapter, old: []u8, value: []const u8) ![]u8 {
        if (old.len > 0) self.allocator.free(old);
        if (value.len == 0) return &[_]u8{};
        return try self.allocator.dupe(u8, value);
    }

    fn freeOwnedString(self: *Adapter, field: *[]u8) void {
        if (field.*.len > 0) self.allocator.free(field.*);
        field.* = &[_]u8{};
    }

    fn markIoFailure(self: *Adapter, message: []const u8) void {
        self.mutex.lock();
        defer self.mutex.unlock();

        self.last_error = self.replaceOwnedString(self.last_error, message) catch self.last_error;
        self.disconnectLocked();
        self.state = .failed;
    }
};

fn openSerial(port: [:0]const u8, baudrate: u32) !c_int {
    const fd = c.open(port.ptr, c.O_RDWR | c.O_NOCTTY | c.O_NONBLOCK | c.O_CLOEXEC, @as(c_uint, 0));
    if (fd < 0) return error.OpenFailed;
    errdefer _ = c.close(fd);

    var tio: c.struct_termios = undefined;
    if (c.tcgetattr(fd, &tio) != 0) return error.GetAttrFailed;

    c.cfmakeraw(&tio);
    tio.c_cflag |= @as(c.tcflag_t, c.CLOCAL | c.CREAD);
    tio.c_cflag &= ~@as(c.tcflag_t, c.CSTOPB | c.PARENB);
    if (@hasDecl(c, "CRTSCTS")) {
        tio.c_cflag &= ~@as(c.tcflag_t, c.CRTSCTS);
    }

    tio.c_cc[@intCast(c.VMIN)] = 0;
    tio.c_cc[@intCast(c.VTIME)] = 1;

    const speed = baudToTermios(baudrate) orelse return error.UnsupportedBaudrate;
    if (c.cfsetispeed(&tio, speed) != 0) return error.SetSpeedFailed;
    if (c.cfsetospeed(&tio, speed) != 0) return error.SetSpeedFailed;
    if (c.tcsetattr(fd, c.TCSANOW, &tio) != 0) return error.SetAttrFailed;

    return fd;
}

fn writeLine(fd: c_int, line: []const u8) !bool {
    var full: std.ArrayList(u8) = .empty;
    defer full.deinit(std.heap.page_allocator);
    try full.appendSlice(std.heap.page_allocator, line);
    try full.append(std.heap.page_allocator, '\n');

    var written: usize = 0;
    while (written < full.items.len) {
        const rc = c.write(fd, full.items.ptr + written, full.items.len - written);
        if (rc > 0) {
            written += @intCast(rc);
            continue;
        }
        if (rc == 0) return false;

        const err_no = std.posix.errno(rc);
        if (err_no == .INTR) continue;
        if (err_no == .AGAIN) {
            std.Thread.sleep(std.time.ns_per_ms);
            continue;
        }
        return false;
    }

    return true;
}

fn baudToTermios(baudrate: u32) ?c.speed_t {
    return switch (baudrate) {
        9_600 => c.B9600,
        19_200 => c.B19200,
        38_400 => c.B38400,
        57_600 => c.B57600,
        115_200 => c.B115200,
        230_400 => if (@hasDecl(c, "B230400")) c.B230400 else null,
        250_000 => if (@hasDecl(c, "B250000")) c.B250000 else null,
        else => null,
    };
}

fn normalizeGcode(allocator: Allocator, source: []const u8) ?[]u8 {
    const cut = std.mem.indexOfScalar(u8, source, ';') orelse source.len;
    const without_comment = source[0..cut];
    const trimmed = std.mem.trim(u8, without_comment, " \t\r\n");
    if (trimmed.len == 0) return null;
    return allocator.dupe(u8, trimmed) catch null;
}

fn readFileAlloc(allocator: Allocator, path: []const u8, max_len: usize) ![]u8 {
    if (std.fs.path.isAbsolute(path)) {
        const file = try std.fs.openFileAbsolute(path, .{});
        defer file.close();
        return file.readToEndAlloc(allocator, max_len);
    }
    return std.fs.cwd().readFileAlloc(allocator, path, max_len);
}

fn parseResendLine(line: []const u8) ?u32 {
    var i: usize = 0;
    while (i < line.len) : (i += 1) {
        if (std.ascii.isDigit(line[i])) {
            var j = i;
            while (j < line.len and std.ascii.isDigit(line[j])) : (j += 1) {}
            return std.fmt.parseInt(u32, line[i..j], 10) catch null;
        }
    }
    return null;
}

const ParsedTemp = struct {
    actual: ?f64,
    target: ?f64,
};

fn parseTempSensor(line: []const u8, key: []const u8) ?ParsedTemp {
    const idx = std.mem.indexOf(u8, line, key) orelse return null;
    var cursor = idx + key.len;
    const actual = parseFloatAt(line, &cursor) orelse return null;

    while (cursor < line.len and (line[cursor] == ' ' or line[cursor] == '\t')) : (cursor += 1) {}

    var target: ?f64 = null;
    if (cursor < line.len and line[cursor] == '/') {
        cursor += 1;
        target = parseFloatAt(line, &cursor);
    }

    return .{ .actual = actual, .target = target };
}

fn parseScalarAfterKey(line: []const u8, key: []const u8) ?f64 {
    const idx = std.mem.indexOf(u8, line, key) orelse return null;
    var cursor = idx + key.len;
    return parseFloatAt(line, &cursor);
}

fn parseFloatAt(line: []const u8, cursor: *usize) ?f64 {
    while (cursor.* < line.len and (line[cursor.*] == ' ' or line[cursor.*] == '\t')) : (cursor.* += 1) {}

    var i = cursor.*;
    if (i >= line.len) return null;

    if (line[i] == '+' or line[i] == '-') i += 1;
    const start = i;

    var saw_digit = false;
    while (i < line.len and std.ascii.isDigit(line[i])) : (i += 1) {
        saw_digit = true;
    }
    if (i < line.len and line[i] == '.') {
        i += 1;
        while (i < line.len and std.ascii.isDigit(line[i])) : (i += 1) {
            saw_digit = true;
        }
    }

    if (!saw_digit) return null;

    const number_start = if (start > 0 and (line[start - 1] == '+' or line[start - 1] == '-')) start - 1 else start;
    const value = std.fmt.parseFloat(f64, line[number_start..i]) catch return null;
    cursor.* = i;
    return value;
}

const SdProgress = struct {
    current: u64,
    total: u64,
};

fn parseSdPrintingByte(line: []const u8) ?SdProgress {
    const slash = std.mem.indexOfScalar(u8, line, '/') orelse return null;

    var start = slash;
    while (start > 0 and std.ascii.isDigit(line[start - 1])) : (start -= 1) {}
    if (start == slash) return null;

    var end = slash + 1;
    while (end < line.len and std.ascii.isDigit(line[end])) : (end += 1) {}
    if (end == slash + 1) return null;

    const current = std.fmt.parseInt(u64, line[start..slash], 10) catch return null;
    const total = std.fmt.parseInt(u64, line[slash + 1 .. end], 10) catch return null;
    return .{ .current = current, .total = total };
}

fn extractFirmwareName(line: []const u8) ?[]const u8 {
    const tag = "FIRMWARE_NAME:";
    const start_idx = std.mem.indexOf(u8, line, tag) orelse return null;
    const value_start = start_idx + tag.len;
    if (value_start >= line.len) return null;

    const markers = [_][]const u8{
        " SOURCE_CODE_URL:",
        " PROTOCOL_VERSION:",
        " MACHINE_TYPE:",
        " EXTRUDER_COUNT:",
        " UUID:",
    };

    var value_end = line.len;
    for (markers) |marker| {
        if (std.mem.indexOfPos(u8, line, value_start, marker)) |idx| {
            if (idx < value_end) value_end = idx;
        }
    }

    const trimmed = std.mem.trim(u8, line[value_start..value_end], " \t");
    if (trimmed.len == 0) return null;
    return trimmed;
}

fn containsCaseSensitive(haystack: []const u8, needle: []const u8) bool {
    return std.mem.indexOf(u8, haystack, needle) != null;
}

fn startsWithIgnoreCase(haystack: []const u8, prefix: []const u8) bool {
    if (haystack.len < prefix.len) return false;
    var i: usize = 0;
    while (i < prefix.len) : (i += 1) {
        if (std.ascii.toLower(haystack[i]) != std.ascii.toLower(prefix[i])) return false;
    }
    return true;
}

fn stateToString(state: AdapterState) []const u8 {
    return switch (state) {
        .disconnected => "disconnected",
        .connecting => "connecting",
        .operational => "operational",
        .printing => "printing",
        .paused => "paused",
        .failed => "error",
    };
}

fn cStringToSlice(maybe_z: ?[*:0]const u8) ?[]const u8 {
    const z = maybe_z orelse return null;
    return std.mem.sliceTo(z, 0);
}

fn normalizeToolIndex(tool_index: i32) !u8 {
    if (tool_index < 0) return error.InvalidTool;
    const as_u32: u32 = @intCast(tool_index);
    if (as_u32 >= max_tools) return error.InvalidTool;
    return @intCast(as_u32);
}

fn normalizeRateFactor(raw: f64) !u32 {
    if (!std.math.isFinite(raw) or raw <= 0.0) return error.InvalidValue;
    const percent = if (raw <= 10.0) raw * 100.0 else raw;
    if (percent < 1.0) return error.InvalidValue;
    return @intFromFloat(@round(percent));
}

fn asAdapter(ptr: ?*anyopaque) ?*Adapter {
    if (ptr == null) return null;
    return @ptrCast(@alignCast(ptr));
}

export fn marlin_adapter_create() ?*anyopaque {
    const adapter = std.heap.c_allocator.create(Adapter) catch return null;
    adapter.* = Adapter.init(std.heap.c_allocator);
    return adapter;
}

export fn marlin_adapter_destroy(handle: ?*anyopaque) void {
    const adapter = asAdapter(handle) orelse return;
    adapter.deinit();
    std.heap.c_allocator.destroy(adapter);
}

export fn marlin_adapter_connect(handle: ?*anyopaque, port: [*:0]const u8, baudrate: u32) c_int {
    const adapter = asAdapter(handle) orelse return -1;
    adapter.connect(std.mem.sliceTo(port, 0), baudrate) catch return -2;
    return 0;
}

export fn marlin_adapter_disconnect(handle: ?*anyopaque) c_int {
    const adapter = asAdapter(handle) orelse return -1;
    adapter.disconnect();
    return 0;
}

export fn marlin_adapter_queue_gcode(handle: ?*anyopaque, gcode: [*:0]const u8) c_int {
    const adapter = asAdapter(handle) orelse return -1;
    adapter.queueGcode(std.mem.sliceTo(gcode, 0)) catch return -2;
    return 0;
}

export fn marlin_adapter_execute_command(
    handle: ?*anyopaque,
    command: *const MarlinInterfaceCommand,
) c_int {
    const adapter = asAdapter(handle) orelse return -1;
    adapter.executeInterfaceCommand(command.*) catch return -2;
    return 0;
}

export fn marlin_adapter_execute_command_simple(
    handle: ?*anyopaque,
    command_id: c_int,
    flags: u32,
    axis_mask: u32,
    tool: i32,
    heater: i32,
    value_a: f64,
    value_b: f64,
    value_c: f64,
    value_d: f64,
    text: ?[*:0]const u8,
) c_int {
    const adapter = asAdapter(handle) orelse return -1;
    const command = MarlinInterfaceCommand{
        .command_id = command_id,
        .flags = flags,
        .axis_mask = axis_mask,
        .tool = tool,
        .heater = heater,
        .value_a = value_a,
        .value_b = value_b,
        .value_c = value_c,
        .value_d = value_d,
        .text = text,
    };
    adapter.executeInterfaceCommand(command) catch return -2;
    return 0;
}

export fn marlin_adapter_load_print_file(handle: ?*anyopaque, path: [*:0]const u8) c_int {
    const adapter = asAdapter(handle) orelse return -1;
    adapter.loadPrintFile(std.mem.sliceTo(path, 0)) catch return -2;
    return 0;
}

export fn marlin_adapter_start_print(handle: ?*anyopaque) c_int {
    const adapter = asAdapter(handle) orelse return -1;
    adapter.startPrint() catch return -2;
    return 0;
}

export fn marlin_adapter_pause_print(handle: ?*anyopaque) c_int {
    const adapter = asAdapter(handle) orelse return -1;
    adapter.pausePrint() catch return -2;
    return 0;
}

export fn marlin_adapter_resume_print(handle: ?*anyopaque) c_int {
    const adapter = asAdapter(handle) orelse return -1;
    adapter.resumePrint() catch return -2;
    return 0;
}

export fn marlin_adapter_cancel_print(handle: ?*anyopaque) c_int {
    const adapter = asAdapter(handle) orelse return -1;
    adapter.cancelPrint() catch return -2;
    return 0;
}

export fn marlin_adapter_get_state_json(handle: ?*anyopaque, out_ptr: *?[*]u8, out_len: *usize) c_int {
    const adapter = asAdapter(handle) orelse return -1;
    const json = adapter.getStateJson() catch return -2;
    out_ptr.* = json.ptr;
    out_len.* = json.len;
    return 0;
}

export fn marlin_adapter_get_state_code(handle: ?*anyopaque) c_int {
    const adapter = asAdapter(handle) orelse return -1;
    adapter.mutex.lock();
    defer adapter.mutex.unlock();
    return @intFromEnum(adapter.state);
}

export fn marlin_adapter_free_buffer(ptr: ?[*]u8, len: usize) void {
    if (ptr) |p| std.heap.c_allocator.free(p[0..len]);
}

test "parse resend line" {
    try std.testing.expectEqual(@as(?u32, 42), parseResendLine("Resend: 42"));
    try std.testing.expectEqual(@as(?u32, 17), parseResendLine("rs N17"));
}

test "parse temp line" {
    const parsed = parseTempSensor("ok T:201.20 /210.00 B:59.40 /60.00", "T:");
    try std.testing.expect(parsed != null);
    try std.testing.expectApproxEqAbs(@as(f64, 201.2), parsed.?.actual.?, 0.0001);
    try std.testing.expectApproxEqAbs(@as(f64, 210.0), parsed.?.target.?, 0.0001);
}

test "parse position line" {
    try std.testing.expectApproxEqAbs(@as(f64, 10.5), parseScalarAfterKey("X:10.5 Y:20.0 Z:0.3 E:5.0", "X:").?, 0.0001);
    try std.testing.expectApproxEqAbs(@as(f64, 20.0), parseScalarAfterKey("X:10.5 Y:20.0 Z:0.3 E:5.0", "Y:").?, 0.0001);
}

test "normalize rate factor" {
    try std.testing.expectEqual(@as(u32, 100), try normalizeRateFactor(100.0));
    try std.testing.expectEqual(@as(u32, 125), try normalizeRateFactor(1.25));
}
