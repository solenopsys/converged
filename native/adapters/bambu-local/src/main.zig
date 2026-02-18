const std = @import("std");

const c = @cImport({
    @cInclude("MQTTClient.h");
});

const Allocator = std.mem.Allocator;

fn allocPrintZ(allocator: Allocator, comptime fmt: []const u8, args: anytype) ![:0]u8 {
    const tmp = try std.fmt.allocPrint(allocator, fmt, args);
    defer allocator.free(tmp);
    return try allocator.dupeZ(u8, tmp);
}

fn defaultConnectOptions() c.MQTTClient_connectOptions {
    var opts: c.MQTTClient_connectOptions = std.mem.zeroes(c.MQTTClient_connectOptions);
    opts.struct_id = .{ 'M', 'Q', 'T', 'C' };
    opts.struct_version = 8;
    opts.keepAliveInterval = 20;
    opts.cleansession = 1;
    opts.reliable = 1;
    opts.connectTimeout = 30;
    opts.retryInterval = 0;
    opts.MQTTVersion = c.MQTTVERSION_DEFAULT;
    opts.maxInflightMessages = -1;
    opts.cleanstart = 0;
    return opts;
}

const AdapterState = enum(c_int) {
    disconnected = 0,
    connecting = 1,
    connected = 2,
    failed = 3,
};

const BambuCommandId = enum(c_int) {
    get_version = 1,
    push_all = 2,
    start_push = 3,

    pause = 10,
    @"resume" = 11,
    stop = 12,

    gcode_line = 20,
    raw_json = 21,
};

pub const BambuInterfaceCommand = extern struct {
    command_id: c_int,
    text: ?[*:0]const u8 = null,
};

pub const AdapterEventCallback = *const fn (
    user_data: ?*anyopaque,
    event_type: c_int,
    payload: [*]const u8,
    payload_len: usize,
) callconv(.c) void;

const Telemetry = struct {
    gcode_state: []u8 = &[_]u8{},
    progress_percent: f64 = 0,

    nozzle_temp: ?f64 = null,
    nozzle_target_temp: ?f64 = null,
    bed_temp: ?f64 = null,
    bed_target_temp: ?f64 = null,
    chamber_temp: ?f64 = null,

    layer_num: ?i64 = null,
    total_layer_num: ?i64 = null,
    remaining_minutes: ?i64 = null,

    print_error_code: i64 = 0,
    mc_print_error_code: []u8 = &[_]u8{},
};

const Adapter = struct {
    allocator: Allocator,
    mutex: std.Thread.Mutex = .{},

    state: AdapterState = .disconnected,
    client: c.MQTTClient = null,

    host: []u8 = &[_]u8{},
    serial: []u8 = &[_]u8{},
    request_topic: ?[:0]u8 = null,
    report_topic: ?[:0]u8 = null,

    event_cb: ?AdapterEventCallback = null,
    event_cb_user_data: ?*anyopaque = null,

    last_error: []u8 = &[_]u8{},
    last_report: []u8 = &[_]u8{},
    last_info: []u8 = &[_]u8{},
    last_print: []u8 = &[_]u8{},
    last_system: []u8 = &[_]u8{},

    telemetry: Telemetry = .{},

    fn init(allocator: Allocator) Adapter {
        return .{
            .allocator = allocator,
        };
    }

    fn deinit(self: *Adapter) void {
        self.disconnect();

        self.freeOwnedString(&self.host);
        self.freeOwnedString(&self.serial);
        self.freeOwnedString(&self.last_error);
        self.freeOwnedString(&self.last_report);
        self.freeOwnedString(&self.last_info);
        self.freeOwnedString(&self.last_print);
        self.freeOwnedString(&self.last_system);
        self.freeOwnedString(&self.telemetry.gcode_state);
        self.freeOwnedString(&self.telemetry.mc_print_error_code);

        if (self.request_topic) |topic| self.allocator.free(topic);
        if (self.report_topic) |topic| self.allocator.free(topic);
    }

    fn setEventCallback(self: *Adapter, cb: ?AdapterEventCallback, user_data: ?*anyopaque) void {
        self.mutex.lock();
        defer self.mutex.unlock();

        self.event_cb = cb;
        self.event_cb_user_data = user_data;
    }

    fn connect(
        self: *Adapter,
        host: []const u8,
        port: u16,
        serial: []const u8,
        access_code: []const u8,
        insecure_tls: bool,
        ca_cert_path: ?[]const u8,
    ) !void {
        if (host.len == 0 or serial.len == 0 or access_code.len == 0) return error.InvalidArgument;

        self.disconnect();

        self.mutex.lock();
        self.state = .connecting;
        self.mutex.unlock();

        const server_uri = try allocPrintZ(self.allocator, "ssl://{s}:{d}", .{ host, port });
        defer self.allocator.free(server_uri);

        const client_id = try allocPrintZ(self.allocator, "zig-bambu-{d}", .{std.time.milliTimestamp()});
        defer self.allocator.free(client_id);

        var mqtt_client: c.MQTTClient = undefined;

        var rc = c.MQTTClient_create(
            &mqtt_client,
            server_uri.ptr,
            client_id.ptr,
            c.MQTTCLIENT_PERSISTENCE_NONE,
            null,
        );
        if (rc != c.MQTTCLIENT_SUCCESS) {
            try self.failWithErrorFmt("MQTTClient_create rc={d}", .{rc});
            return error.CreateFailed;
        }

        rc = c.MQTTClient_setCallbacks(
            mqtt_client,
            @ptrCast(self),
            onConnectionLost,
            onMessageArrived,
            null,
        );
        if (rc != c.MQTTCLIENT_SUCCESS) {
            _ = c.MQTTClient_destroy(&mqtt_client);
            try self.failWithErrorFmt("MQTTClient_setCallbacks rc={d}", .{rc});
            return error.CallbackSetupFailed;
        }

        var ssl_options: c.MQTTClient_SSLOptions = std.mem.zeroes(c.MQTTClient_SSLOptions);
        ssl_options.struct_id = .{ 'M', 'Q', 'T', 'S' };
        ssl_options.struct_version = 5;
        ssl_options.sslVersion = c.MQTT_SSL_VERSION_DEFAULT;
        ssl_options.enableServerCertAuth = if (insecure_tls) 0 else 1;
        ssl_options.verify = if (insecure_tls) 0 else 1;
        if (!insecure_tls) {
            if (ca_cert_path) |path| {
                const ca_path_z = try allocPrintZ(self.allocator, "{s}", .{path});
                defer self.allocator.free(ca_path_z);
                ssl_options.trustStore = ca_path_z.ptr;

                var conn_options = defaultConnectOptions();
                conn_options.username = "bblp";
                conn_options.password = @ptrCast(access_code.ptr);
                conn_options.ssl = &ssl_options;

                rc = c.MQTTClient_connect(mqtt_client, &conn_options);
            } else {
                var conn_options = defaultConnectOptions();
                conn_options.username = "bblp";
                conn_options.password = @ptrCast(access_code.ptr);
                conn_options.ssl = &ssl_options;

                rc = c.MQTTClient_connect(mqtt_client, &conn_options);
            }
        } else {
            var conn_options = defaultConnectOptions();
            conn_options.username = "bblp";
            conn_options.password = @ptrCast(access_code.ptr);
            conn_options.ssl = &ssl_options;

            rc = c.MQTTClient_connect(mqtt_client, &conn_options);
        }

        if (rc != c.MQTTCLIENT_SUCCESS) {
            _ = c.MQTTClient_destroy(&mqtt_client);
            try self.failWithErrorFmt("MQTTClient_connect rc={d}", .{rc});
            return error.ConnectFailed;
        }

        const request_topic = try allocPrintZ(self.allocator, "device/{s}/request", .{serial});
        errdefer self.allocator.free(request_topic);

        const report_topic = try allocPrintZ(self.allocator, "device/{s}/report", .{serial});
        errdefer self.allocator.free(report_topic);

        rc = c.MQTTClient_subscribe(mqtt_client, report_topic.ptr, 0);
        if (rc != c.MQTTCLIENT_SUCCESS) {
            _ = c.MQTTClient_disconnect(mqtt_client, 1500);
            _ = c.MQTTClient_destroy(&mqtt_client);
            try self.failWithErrorFmt("MQTTClient_subscribe rc={d}", .{rc});
            return error.SubscribeFailed;
        }

        self.mutex.lock();

        self.client = mqtt_client;
        self.state = .connected;

        self.freeOwnedString(&self.host);
        self.freeOwnedString(&self.serial);
        self.host = try self.allocator.dupe(u8, host);
        self.serial = try self.allocator.dupe(u8, serial);

        if (self.request_topic) |topic| self.allocator.free(topic);
        if (self.report_topic) |topic| self.allocator.free(topic);
        self.request_topic = request_topic;
        self.report_topic = report_topic;

        try self.replaceOwnedStringLocked(&self.last_error, "");
        self.mutex.unlock();

        self.emitEvent(.connected, "{\"event\":\"connected\"}");

        // Initial sync, same as HA integration.
        _ = self.sendRawJson("{\"info\":{\"sequence_id\":\"0\",\"command\":\"get_version\"}}") catch {};
        _ = self.sendRawJson("{\"pushing\":{\"sequence_id\":\"0\",\"command\":\"pushall\"}}") catch {};
    }

    fn disconnect(self: *Adapter) void {
        self.mutex.lock();
        defer self.mutex.unlock();

        if (self.client) |client| {
            _ = c.MQTTClient_disconnect(client, 1500);
            var to_destroy: c.MQTTClient = self.client;
            c.MQTTClient_destroy(&to_destroy);
            self.client = null;
        }

        self.state = .disconnected;
        self.emitEvent(.disconnected, "{\"event\":\"disconnected\"}");
    }

    fn sendRawJson(self: *Adapter, payload: []const u8) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        const client = self.client orelse return error.NotConnected;
        const topic = self.request_topic orelse return error.NotConnected;

        var msg: c.MQTTClient_message = std.mem.zeroes(c.MQTTClient_message);
        msg.struct_id = .{ 'M', 'Q', 'T', 'M' };
        msg.struct_version = 1;
        msg.payload = @constCast(@ptrCast(payload.ptr));
        msg.payloadlen = @intCast(payload.len);
        msg.qos = 0;
        msg.retained = 0;

        var token: c.MQTTClient_deliveryToken = 0;
        const rc = c.MQTTClient_publishMessage(client, topic.ptr, &msg, &token);
        if (rc != c.MQTTCLIENT_SUCCESS) {
            try self.replaceOwnedStringLockedFmt(&self.last_error, "MQTT publish failed rc={d}", .{rc});
            self.state = .failed;
            return error.PublishFailed;
        }

        _ = c.MQTTClient_waitForCompletion(client, token, 5000);
    }

    fn sendGcodeLine(self: *Adapter, gcode: []const u8) !void {
        const payload = try buildCommandPayload(
            self.allocator,
            "print",
            "gcode_line",
            "param",
            gcode,
        );
        defer self.allocator.free(payload);

        try self.sendRawJson(payload);
    }

    fn executeCommand(self: *Adapter, command: BambuInterfaceCommand) !void {
        const cmd: BambuCommandId = @enumFromInt(command.command_id);
        switch (cmd) {
            .get_version => try self.sendRawJson("{\"info\":{\"sequence_id\":\"0\",\"command\":\"get_version\"}}"),
            .push_all => try self.sendRawJson("{\"pushing\":{\"sequence_id\":\"0\",\"command\":\"pushall\"}}"),
            .start_push => try self.sendRawJson("{\"pushing\":{\"sequence_id\":\"0\",\"command\":\"start\"}}"),
            .pause => try self.sendRawJson("{\"print\":{\"sequence_id\":\"0\",\"command\":\"pause\"}}"),
            .@"resume" => try self.sendRawJson("{\"print\":{\"sequence_id\":\"0\",\"command\":\"resume\"}}"),
            .stop => try self.sendRawJson("{\"print\":{\"sequence_id\":\"0\",\"command\":\"stop\"}}"),
            .gcode_line => {
                const txt = cStringToSlice(command.text) orelse return error.InvalidArgument;
                try self.sendGcodeLine(txt);
            },
            .raw_json => {
                const txt = cStringToSlice(command.text) orelse return error.InvalidArgument;
                try self.sendRawJson(txt);
            },
        }
    }

    fn getStateJson(self: *Adapter) ![]u8 {
        var connected = false;
        var state: AdapterState = .disconnected;
        var gcode_state: []u8 = &[_]u8{};
        var mc_print_error_code: []u8 = &[_]u8{};

        var progress: f64 = 0;
        var nozzle: ?f64 = null;
        var nozzle_target: ?f64 = null;
        var bed: ?f64 = null;
        var bed_target: ?f64 = null;
        var chamber: ?f64 = null;

        var layer_num: ?i64 = null;
        var total_layer_num: ?i64 = null;
        var remaining_minutes: ?i64 = null;
        var print_error_code: i64 = 0;

        var last_error: []u8 = &[_]u8{};

        self.mutex.lock();

        connected = self.client != null and self.state == .connected;
        state = self.state;

        gcode_state = try self.allocator.dupe(u8, self.telemetry.gcode_state);
        errdefer self.allocator.free(gcode_state);

        mc_print_error_code = try self.allocator.dupe(u8, self.telemetry.mc_print_error_code);
        errdefer self.allocator.free(mc_print_error_code);

        progress = self.telemetry.progress_percent;
        nozzle = self.telemetry.nozzle_temp;
        nozzle_target = self.telemetry.nozzle_target_temp;
        bed = self.telemetry.bed_temp;
        bed_target = self.telemetry.bed_target_temp;
        chamber = self.telemetry.chamber_temp;
        layer_num = self.telemetry.layer_num;
        total_layer_num = self.telemetry.total_layer_num;
        remaining_minutes = self.telemetry.remaining_minutes;
        print_error_code = self.telemetry.print_error_code;

        last_error = try self.allocator.dupe(u8, self.last_error);
        errdefer self.allocator.free(last_error);

        self.mutex.unlock();
        defer self.allocator.free(gcode_state);
        defer self.allocator.free(mc_print_error_code);
        defer self.allocator.free(last_error);

        var out: std.ArrayListUnmanaged(u8) = .{};
        errdefer out.deinit(self.allocator);
        const w = out.writer(self.allocator);

        try w.writeByte('{');
        try writeJsonBoolField(w, "connected", connected);
        try w.writeByte(',');
        try writeJsonIntField(w, "state_code", @intFromEnum(state));
        try w.writeByte(',');
        try writeJsonStringField(w, self.allocator, "gcode_state", gcode_state);
        try w.writeByte(',');
        try writeJsonFloatField(w, "progress_percent", progress);
        try w.writeByte(',');
        try writeJsonOptionalFloatField(w, "nozzle_temp", nozzle);
        try w.writeByte(',');
        try writeJsonOptionalFloatField(w, "nozzle_target_temp", nozzle_target);
        try w.writeByte(',');
        try writeJsonOptionalFloatField(w, "bed_temp", bed);
        try w.writeByte(',');
        try writeJsonOptionalFloatField(w, "bed_target_temp", bed_target);
        try w.writeByte(',');
        try writeJsonOptionalFloatField(w, "chamber_temp", chamber);
        try w.writeByte(',');
        try writeJsonOptionalIntField(w, "layer_num", layer_num);
        try w.writeByte(',');
        try writeJsonOptionalIntField(w, "total_layer_num", total_layer_num);
        try w.writeByte(',');
        try writeJsonOptionalIntField(w, "remaining_minutes", remaining_minutes);
        try w.writeByte(',');
        try writeJsonIntField(w, "print_error_code", print_error_code);
        try w.writeByte(',');
        try writeJsonStringField(w, self.allocator, "mc_print_error_code", mc_print_error_code);
        try w.writeByte(',');
        try writeJsonStringField(w, self.allocator, "last_error", last_error);
        try w.writeByte('}');

        return out.toOwnedSlice(self.allocator);
    }

    fn onMessage(self: *Adapter, payload: []const u8) void {
        const report_json = self.allocator.dupe(u8, payload) catch return;
        defer self.allocator.free(report_json);

        var print_json: ?[]u8 = null;
        defer if (print_json) |p| self.allocator.free(p);

        var info_json: ?[]u8 = null;
        defer if (info_json) |p| self.allocator.free(p);

        var system_json: ?[]u8 = null;
        defer if (system_json) |p| self.allocator.free(p);

        var parsed = std.json.parseFromSlice(std.json.Value, self.allocator, payload, .{}) catch {
            self.emitEvent(.report_raw, report_json);
            return;
        };
        defer parsed.deinit();

        var has_error_event = false;

        if (valueGet(parsed.value, "print")) |print_value| {
            print_json = valueToJsonOwned(self.allocator, print_value) catch null;
            self.mutex.lock();
            defer self.mutex.unlock();
            if (print_json) |p| {
                self.replaceOwnedStringLocked(&self.last_print, p) catch {};
            }
            self.applyTelemetryFromPrintLocked(print_value, &has_error_event);
        }

        if (valueGet(parsed.value, "info")) |info_value| {
            info_json = valueToJsonOwned(self.allocator, info_value) catch null;
            self.mutex.lock();
            defer self.mutex.unlock();
            if (info_json) |p| {
                self.replaceOwnedStringLocked(&self.last_info, p) catch {};
            }
        }

        if (valueGet(parsed.value, "system")) |system_value| {
            system_json = valueToJsonOwned(self.allocator, system_value) catch null;
            self.mutex.lock();
            defer self.mutex.unlock();
            if (system_json) |p| {
                self.replaceOwnedStringLocked(&self.last_system, p) catch {};
            }
        }

        self.mutex.lock();
        self.replaceOwnedStringLocked(&self.last_report, report_json) catch {};
        self.mutex.unlock();

        self.emitEvent(.report_raw, report_json);
        if (print_json) |p| {
            self.emitEvent(.telemetry, p);
            if (has_error_event) self.emitEvent(.@"error", p);
        }
        if (info_json) |p| self.emitEvent(.info, p);
        if (system_json) |p| self.emitEvent(.system, p);
    }

    fn applyTelemetryFromPrintLocked(self: *Adapter, print_value: std.json.Value, has_error_event: *bool) void {
        if (valueGet(print_value, "gcode_state")) |v| {
            if (valueToString(v)) |text| {
                self.replaceOwnedStringLocked(&self.telemetry.gcode_state, text) catch {};
            }
        }

        if (valueGet(print_value, "mc_percent")) |v| {
            if (valueToFloat(v)) |n| self.telemetry.progress_percent = n;
        } else if (valueGet(print_value, "percent")) |v2| {
            if (valueToFloat(v2)) |n2| self.telemetry.progress_percent = n2;
        }

        self.telemetry.nozzle_temp = if (valueGet(print_value, "nozzle_temper")) |t| valueToFloat(t) else if (valueGet(print_value, "nozzle_temp")) |t2| valueToFloat(t2) else null;
        self.telemetry.nozzle_target_temp = if (valueGet(print_value, "nozzle_target_temper")) |t| valueToFloat(t) else if (valueGet(print_value, "nozzle_target_temp")) |t2| valueToFloat(t2) else null;
        self.telemetry.bed_temp = if (valueGet(print_value, "bed_temper")) |t| valueToFloat(t) else if (valueGet(print_value, "bed_temp")) |t2| valueToFloat(t2) else null;
        self.telemetry.bed_target_temp = if (valueGet(print_value, "bed_target_temper")) |t| valueToFloat(t) else if (valueGet(print_value, "bed_target_temp")) |t2| valueToFloat(t2) else null;
        self.telemetry.chamber_temp = if (valueGet(print_value, "chamber_temper")) |t| valueToFloat(t) else if (valueGet(print_value, "chamber_temp")) |t2| valueToFloat(t2) else null;

        if (valueGet(print_value, "layer_num")) |v3| {
            self.telemetry.layer_num = valueToInt(v3);
        }
        if (valueGet(print_value, "total_layer_num")) |v4| {
            self.telemetry.total_layer_num = valueToInt(v4);
        }
        if (valueGet(print_value, "mc_remaining_time")) |v5| {
            self.telemetry.remaining_minutes = valueToInt(v5);
        }

        if (valueGet(print_value, "print_error")) |v6| {
            if (valueToInt(v6)) |code| {
                self.telemetry.print_error_code = code;
                if (code != 0) has_error_event.* = true;
            }
        }

        if (valueGet(print_value, "mc_print_error_code")) |v7| {
            switch (v7) {
                .string => |code_text| {
                    self.replaceOwnedStringLocked(&self.telemetry.mc_print_error_code, code_text) catch {};
                    if (!std.mem.eql(u8, code_text, "0")) has_error_event.* = true;
                },
                .integer => |code_num| {
                    var buf: [32]u8 = undefined;
                    const code_text = std.fmt.bufPrint(&buf, "{d}", .{code_num}) catch "";
                    self.replaceOwnedStringLocked(&self.telemetry.mc_print_error_code, code_text) catch {};
                    if (code_num != 0) has_error_event.* = true;
                },
                else => {},
            }
        }
    }

    fn failWithErrorFmt(self: *Adapter, comptime fmt: []const u8, args: anytype) !void {
        self.mutex.lock();
        defer self.mutex.unlock();

        self.state = .failed;
        try self.replaceOwnedStringLockedFmt(&self.last_error, fmt, args);
    }

    fn replaceOwnedStringLocked(self: *Adapter, target: *[]u8, value: []const u8) !void {
        if (target.*.len > 0) self.allocator.free(target.*);
        target.* = if (value.len == 0) &[_]u8{} else try self.allocator.dupe(u8, value);
    }

    fn replaceOwnedStringLockedFmt(self: *Adapter, target: *[]u8, comptime fmt: []const u8, args: anytype) !void {
        const text = try std.fmt.allocPrint(self.allocator, fmt, args);
        defer self.allocator.free(text);
        try self.replaceOwnedStringLocked(target, text);
    }

    fn freeOwnedString(self: *Adapter, target: *[]u8) void {
        if (target.*.len > 0) self.allocator.free(target.*);
        target.* = &[_]u8{};
    }

    fn emitEvent(self: *Adapter, event_type: EventType, payload: []const u8) void {
        const cb = self.event_cb orelse return;
        cb(self.event_cb_user_data, @intFromEnum(event_type), payload.ptr, payload.len);
    }
};

const EventType = enum(c_int) {
    connected = 1,
    disconnected = 2,
    report_raw = 10,
    telemetry = 11,
    info = 12,
    system = 13,
    @"error" = 14,
};

fn buildCommandPayload(
    allocator: Allocator,
    section: []const u8,
    command: []const u8,
    text_field: []const u8,
    text: []const u8,
) ![]u8 {
    const encoded_text = try std.json.Stringify.valueAlloc(allocator, text, .{});
    defer allocator.free(encoded_text);
    return try std.fmt.allocPrint(
        allocator,
        "{{\"{s}\":{{\"sequence_id\":\"0\",\"command\":\"{s}\",\"{s}\":{s}}}}}",
        .{ section, command, text_field, encoded_text },
    );
}

fn valueToJsonOwned(allocator: Allocator, value: std.json.Value) ![]u8 {
    return std.json.Stringify.valueAlloc(allocator, value, .{});
}

fn writeJsonBoolField(writer: anytype, key: []const u8, value: bool) !void {
    try writer.print("\"{s}\":{s}", .{ key, if (value) "true" else "false" });
}

fn writeJsonIntField(writer: anytype, key: []const u8, value: i64) !void {
    try writer.print("\"{s}\":{d}", .{ key, value });
}

fn writeJsonFloatField(writer: anytype, key: []const u8, value: f64) !void {
    try writer.print("\"{s}\":{d}", .{ key, value });
}

fn writeJsonOptionalIntField(writer: anytype, key: []const u8, value: ?i64) !void {
    try writer.print("\"{s}\":", .{key});
    if (value) |v| {
        try writer.print("{d}", .{v});
    } else {
        try writer.writeAll("null");
    }
}

fn writeJsonOptionalFloatField(writer: anytype, key: []const u8, value: ?f64) !void {
    try writer.print("\"{s}\":", .{key});
    if (value) |v| {
        try writer.print("{d}", .{v});
    } else {
        try writer.writeAll("null");
    }
}

fn writeJsonStringField(writer: anytype, allocator: Allocator, key: []const u8, value: []const u8) !void {
    try writer.print("\"{s}\":", .{key});
    const encoded = try std.json.Stringify.valueAlloc(allocator, value, .{});
    defer allocator.free(encoded);
    try writer.writeAll(encoded);
}

fn cStringToSlice(ptr_z: ?[*:0]const u8) ?[]const u8 {
    const z = ptr_z orelse return null;
    return std.mem.sliceTo(z, 0);
}

fn valueGet(v: std.json.Value, key: []const u8) ?std.json.Value {
    return switch (v) {
        .object => |obj| obj.get(key),
        else => null,
    };
}

fn valueToString(v: std.json.Value) ?[]const u8 {
    return switch (v) {
        .string => |s| s,
        else => null,
    };
}

fn valueToInt(v: std.json.Value) ?i64 {
    return switch (v) {
        .integer => |n| @as(i64, n),
        .float => |n| @intFromFloat(n),
        .string => |s| std.fmt.parseInt(i64, s, 10) catch null,
        else => null,
    };
}

fn valueToFloat(v: std.json.Value) ?f64 {
    return switch (v) {
        .integer => |n| @floatFromInt(n),
        .float => |n| n,
        .string => |s| std.fmt.parseFloat(f64, s) catch null,
        else => null,
    };
}

fn onConnectionLost(context: ?*anyopaque, cause: [*c]u8) callconv(.c) void {
    _ = cause;
    const adapter = asAdapter(context) orelse return;

    adapter.mutex.lock();
    defer adapter.mutex.unlock();

    adapter.state = .failed;
    adapter.replaceOwnedStringLocked(&adapter.last_error, "mqtt connection lost") catch {};
    adapter.emitEvent(.disconnected, "{\"event\":\"connection_lost\"}");
}

fn onMessageArrived(
    context: ?*anyopaque,
    topic_name: [*c]u8,
    topic_len: c_int,
    message: ?*c.MQTTClient_message,
) callconv(.c) c_int {
    _ = topic_len;

    const adapter = asAdapter(context) orelse return 1;
    const msg = message orelse return 1;

    const payload_ptr: [*]const u8 = @ptrCast(@alignCast(msg.payload));
    const payload = payload_ptr[0..@intCast(msg.payloadlen)];

    adapter.onMessage(payload);

    var message_ptr = message;
    c.MQTTClient_freeMessage(&message_ptr);
    c.MQTTClient_free(topic_name);
    return 1;
}

fn asAdapter(ptr: ?*anyopaque) ?*Adapter {
    if (ptr == null) return null;
    return @ptrCast(@alignCast(ptr));
}

export fn bambu_adapter_create() ?*anyopaque {
    const adapter = std.heap.c_allocator.create(Adapter) catch return null;
    adapter.* = Adapter.init(std.heap.c_allocator);
    return adapter;
}

export fn bambu_adapter_destroy(handle: ?*anyopaque) void {
    const adapter = asAdapter(handle) orelse return;
    adapter.deinit();
    std.heap.c_allocator.destroy(adapter);
}

export fn bambu_adapter_set_event_callback(
    handle: ?*anyopaque,
    cb: ?AdapterEventCallback,
    user_data: ?*anyopaque,
) void {
    const adapter = asAdapter(handle) orelse return;
    adapter.setEventCallback(cb, user_data);
}

export fn bambu_adapter_connect(
    handle: ?*anyopaque,
    host: [*:0]const u8,
    serial: [*:0]const u8,
    access_code: [*:0]const u8,
) c_int {
    const adapter = asAdapter(handle) orelse return -1;
    adapter.connect(
        std.mem.sliceTo(host, 0),
        8883,
        std.mem.sliceTo(serial, 0),
        std.mem.sliceTo(access_code, 0),
        true,
        null,
    ) catch return -2;
    return 0;
}

export fn bambu_adapter_connect_ex(
    handle: ?*anyopaque,
    host: [*:0]const u8,
    port: u16,
    serial: [*:0]const u8,
    access_code: [*:0]const u8,
    insecure_tls: c_int,
    ca_cert_path: ?[*:0]const u8,
) c_int {
    const adapter = asAdapter(handle) orelse return -1;
    adapter.connect(
        std.mem.sliceTo(host, 0),
        port,
        std.mem.sliceTo(serial, 0),
        std.mem.sliceTo(access_code, 0),
        insecure_tls != 0,
        cStringToSlice(ca_cert_path),
    ) catch return -2;
    return 0;
}

export fn bambu_adapter_disconnect(handle: ?*anyopaque) c_int {
    const adapter = asAdapter(handle) orelse return -1;
    adapter.disconnect();
    return 0;
}

export fn bambu_adapter_execute_command(handle: ?*anyopaque, command: *const BambuInterfaceCommand) c_int {
    const adapter = asAdapter(handle) orelse return -1;
    adapter.executeCommand(command.*) catch return -2;
    return 0;
}

export fn bambu_adapter_execute_command_simple(
    handle: ?*anyopaque,
    command_id: c_int,
    text: ?[*:0]const u8,
) c_int {
    const adapter = asAdapter(handle) orelse return -1;
    const command = BambuInterfaceCommand{
        .command_id = command_id,
        .text = text,
    };
    adapter.executeCommand(command) catch return -2;
    return 0;
}

export fn bambu_adapter_send_raw_json(handle: ?*anyopaque, json_payload: [*:0]const u8) c_int {
    const adapter = asAdapter(handle) orelse return -1;
    adapter.sendRawJson(std.mem.sliceTo(json_payload, 0)) catch return -2;
    return 0;
}

export fn bambu_adapter_send_gcode_line(handle: ?*anyopaque, gcode_line: [*:0]const u8) c_int {
    const adapter = asAdapter(handle) orelse return -1;
    adapter.sendGcodeLine(std.mem.sliceTo(gcode_line, 0)) catch return -2;
    return 0;
}

export fn bambu_adapter_pause_print(handle: ?*anyopaque) c_int {
    const adapter = asAdapter(handle) orelse return -1;
    const command = BambuInterfaceCommand{ .command_id = @intFromEnum(BambuCommandId.pause), .text = null };
    adapter.executeCommand(command) catch return -2;
    return 0;
}

export fn bambu_adapter_resume_print(handle: ?*anyopaque) c_int {
    const adapter = asAdapter(handle) orelse return -1;
    const command = BambuInterfaceCommand{ .command_id = @intFromEnum(BambuCommandId.@"resume"), .text = null };
    adapter.executeCommand(command) catch return -2;
    return 0;
}

export fn bambu_adapter_stop_print(handle: ?*anyopaque) c_int {
    const adapter = asAdapter(handle) orelse return -1;
    const command = BambuInterfaceCommand{ .command_id = @intFromEnum(BambuCommandId.stop), .text = null };
    adapter.executeCommand(command) catch return -2;
    return 0;
}

export fn bambu_adapter_request_push_all(handle: ?*anyopaque) c_int {
    const adapter = asAdapter(handle) orelse return -1;
    const command = BambuInterfaceCommand{ .command_id = @intFromEnum(BambuCommandId.push_all), .text = null };
    adapter.executeCommand(command) catch return -2;
    return 0;
}

export fn bambu_adapter_request_version(handle: ?*anyopaque) c_int {
    const adapter = asAdapter(handle) orelse return -1;
    const command = BambuInterfaceCommand{ .command_id = @intFromEnum(BambuCommandId.get_version), .text = null };
    adapter.executeCommand(command) catch return -2;
    return 0;
}

export fn bambu_adapter_get_state_code(handle: ?*anyopaque) c_int {
    const adapter = asAdapter(handle) orelse return -1;
    adapter.mutex.lock();
    defer adapter.mutex.unlock();
    return @intFromEnum(adapter.state);
}

export fn bambu_adapter_get_state_json(handle: ?*anyopaque, out_ptr: *?[*]u8, out_len: *usize) c_int {
    const adapter = asAdapter(handle) orelse return -1;
    const json = adapter.getStateJson() catch return -2;
    out_ptr.* = json.ptr;
    out_len.* = json.len;
    return 0;
}

export fn bambu_adapter_free_buffer(ptr: ?[*]u8, len: usize) void {
    if (ptr) |p| std.heap.c_allocator.free(p[0..len]);
}
