const std = @import("std");

extern "c" fn usleep(usec: c_uint) c_int;

const Handle = opaque {};

const FnWrapperCreate = *const fn (*?*Handle, [*:0]const u8) callconv(.c) i32;
const FnWrapperDestroy = *const fn (*Handle) callconv(.c) void;
const FnCreatePeerConnection = *const fn (*Handle, ?[*:0]const u8, u16, u16, *i32) callconv(.c) i32;
const FnClosePeerConnection = *const fn (*Handle, i32) callconv(.c) i32;
const FnDeletePeerConnection = *const fn (*Handle, i32) callconv(.c) i32;
const FnSetLocalDescription = *const fn (*Handle, i32, ?[*:0]const u8) callconv(.c) i32;
const FnGetString = *const fn (*Handle, i32, *?[*]u8, *usize) callconv(.c) i32;
const FnAddOpusTrack = *const fn (
    *Handle,
    i32,
    i32,
    u32,
    i32,
    ?[*:0]const u8,
    ?[*:0]const u8,
    ?[*:0]const u8,
    ?[*:0]const u8,
    *i32,
) callconv(.c) i32;
const FnCreateDataChannel = *const fn (*Handle, i32, [*:0]const u8, *i32) callconv(.c) i32;
const FnCloseId = *const fn (*Handle, i32) callconv(.c) i32;
const FnDeleteId = *const fn (*Handle, i32) callconv(.c) i32;
const FnSendMessage = *const fn (*Handle, i32, [*]const u8, usize) callconv(.c) i32;
const FnSendBinary = *const fn (*Handle, i32, [*]const u8, usize) callconv(.c) i32;
const FnFreeBuffer = *const fn ([*]u8, usize) callconv(.c) i32;
const FnLastError = *const fn (*Handle) callconv(.c) [*:0]const u8;
const FnSetRemoteDescription = *const fn (*Handle, i32, [*:0]const u8, [*:0]const u8) callconv(.c) i32;
const FnSetMessageCallback = *const fn (*Handle, i32, FnMessageCb, ?*anyopaque) callconv(.c) i32;
const FnSetTrackCallback = *const fn (*Handle, i32, FnTrackCb, ?*anyopaque) callconv(.c) i32;
const FnSetOpenCallback = *const fn (*Handle, i32, FnOpenCb, ?*anyopaque) callconv(.c) i32;
const FnSetClosedCallback = *const fn (*Handle, i32, FnClosedCb, ?*anyopaque) callconv(.c) i32;
const FnSetStateCallback = *const fn (*Handle, i32, FnStateCb, ?*anyopaque) callconv(.c) i32;
const FnSetIceStateCallback = *const fn (*Handle, i32, FnIceStateCb, ?*anyopaque) callconv(.c) i32;
const FnSetGatheringStateCallback = *const fn (*Handle, i32, FnGatheringStateCb, ?*anyopaque) callconv(.c) i32;
const FnIsOpen = *const fn (*Handle, i32) callconv(.c) bool;
const FnSetOpusPacketizer = *const fn (*Handle, i32, u8, u32) callconv(.c) i32;

// Public callback types for use by callers registering C-compatible callbacks
pub const FnMessageCb = *const fn (i32, [*]const u8, usize, ?*anyopaque) callconv(.c) void;
pub const FnOpenCb = *const fn (i32, ?*anyopaque) callconv(.c) void;
pub const FnClosedCb = *const fn (i32, ?*anyopaque) callconv(.c) void;
pub const FnStateCb = *const fn (i32, i32, ?*anyopaque) callconv(.c) void;
pub const FnIceStateCb = *const fn (i32, i32, ?*anyopaque) callconv(.c) void;
pub const FnGatheringStateCb = *const fn (i32, i32, ?*anyopaque) callconv(.c) void;
pub const FnTrackCb = *const fn (i32, i32, ?*anyopaque) callconv(.c) void;

pub const Direction = enum(i32) {
    unknown = 0,
    sendonly = 1,
    recvonly = 2,
    sendrecv = 3,
    inactive = 4,
};

pub const LocalOffer = struct {
    peer_connection_id: i32,
    data_channel_id: i32,
    track_id: i32,
    offer_type: []u8,
    offer_sdp: []u8,

    pub fn deinit(self: *LocalOffer, allocator: std.mem.Allocator) void {
        allocator.free(self.offer_type);
        allocator.free(self.offer_sdp);
        self.* = undefined;
    }
};

pub const Client = struct {
    allocator: std.mem.Allocator,
    lib: std.DynLib,
    handle: *Handle,

    fn_destroy: FnWrapperDestroy,
    fn_create_peer_connection: FnCreatePeerConnection,
    fn_close_peer_connection: FnClosePeerConnection,
    fn_delete_peer_connection: FnDeletePeerConnection,
    fn_set_local_description: FnSetLocalDescription,
    fn_get_local_description: FnGetString,
    fn_get_local_description_type: FnGetString,
    fn_add_opus_track: FnAddOpusTrack,
    fn_create_data_channel: FnCreateDataChannel,
    fn_close_id: FnCloseId,
    fn_delete_id: FnDeleteId,
    fn_send_message: FnSendMessage,
    fn_send_binary: FnSendBinary,
    fn_free_buffer: FnFreeBuffer,
    fn_last_error: FnLastError,
    fn_set_remote_description: FnSetRemoteDescription,
    fn_set_message_callback: FnSetMessageCallback,
    fn_set_track_callback: FnSetTrackCallback,
    fn_set_open_callback: FnSetOpenCallback,
    fn_set_closed_callback: FnSetClosedCallback,
    fn_set_state_callback: FnSetStateCallback,
    fn_set_ice_state_callback: FnSetIceStateCallback,
    fn_set_gathering_state_callback: FnSetGatheringStateCallback,
    fn_is_open: FnIsOpen,
    fn_set_opus_packetizer: ?FnSetOpusPacketizer,

    pub fn init(allocator: std.mem.Allocator, wrapper_path: []const u8, core_path: []const u8) !Client {
        var lib = try std.DynLib.open(wrapper_path);
        errdefer lib.close();

        const fn_create = try lookupRequired(FnWrapperCreate, &lib, "ldc_wrapper_create");
        const fn_destroy = try lookupRequired(FnWrapperDestroy, &lib, "ldc_wrapper_destroy");

        const core_z = try toOwnedZ(allocator, core_path);
        defer allocator.free(core_z);

        var handle: ?*Handle = null;
        const rc = fn_create(&handle, core_z.ptr);
        if (rc != 0 or handle == null) return error.DataChannelWrapperCreateFailed;
        errdefer fn_destroy(handle.?);

        return .{
            .allocator = allocator,
            .lib = lib,
            .handle = handle.?,
            .fn_destroy = fn_destroy,
            .fn_create_peer_connection = try lookupRequired(FnCreatePeerConnection, &lib, "ldc_create_peer_connection"),
            .fn_close_peer_connection = try lookupRequired(FnClosePeerConnection, &lib, "ldc_close_peer_connection"),
            .fn_delete_peer_connection = try lookupRequired(FnDeletePeerConnection, &lib, "ldc_delete_peer_connection"),
            .fn_set_local_description = try lookupRequired(FnSetLocalDescription, &lib, "ldc_set_local_description"),
            .fn_get_local_description = try lookupRequired(FnGetString, &lib, "ldc_get_local_description"),
            .fn_get_local_description_type = try lookupRequired(FnGetString, &lib, "ldc_get_local_description_type"),
            .fn_add_opus_track = try lookupRequired(FnAddOpusTrack, &lib, "ldc_add_opus_track"),
            .fn_create_data_channel = try lookupRequired(FnCreateDataChannel, &lib, "ldc_create_data_channel"),
            .fn_close_id = try lookupRequired(FnCloseId, &lib, "ldc_close_id"),
            .fn_delete_id = try lookupRequired(FnDeleteId, &lib, "ldc_delete_id"),
            .fn_send_message = try lookupRequired(FnSendMessage, &lib, "ldc_send_message"),
            .fn_send_binary = try lookupRequired(FnSendBinary, &lib, "ldc_send_binary"),
            .fn_free_buffer = try lookupRequired(FnFreeBuffer, &lib, "ldc_free_buffer"),
            .fn_last_error = try lookupRequired(FnLastError, &lib, "ldc_last_error"),
            .fn_set_remote_description = try lookupRequired(FnSetRemoteDescription, &lib, "ldc_set_remote_description"),
            .fn_set_message_callback = try lookupRequired(FnSetMessageCallback, &lib, "ldc_set_message_callback"),
            .fn_set_track_callback = try lookupRequired(FnSetTrackCallback, &lib, "ldc_set_track_callback"),
            .fn_set_open_callback = try lookupRequired(FnSetOpenCallback, &lib, "ldc_set_open_callback"),
            .fn_set_closed_callback = try lookupRequired(FnSetClosedCallback, &lib, "ldc_set_closed_callback"),
            .fn_set_state_callback = try lookupRequired(FnSetStateCallback, &lib, "ldc_set_state_callback"),
            .fn_set_ice_state_callback = try lookupRequired(FnSetIceStateCallback, &lib, "ldc_set_ice_state_callback"),
            .fn_set_gathering_state_callback = try lookupRequired(FnSetGatheringStateCallback, &lib, "ldc_set_gathering_state_callback"),
            .fn_is_open = try lookupRequired(FnIsOpen, &lib, "ldc_is_open"),
            .fn_set_opus_packetizer = lookupOptional(FnSetOpusPacketizer, &lib, "ldc_set_opus_packetizer"),
        };
    }

    pub fn deinit(self: *Client) void {
        // libdatachannel is a C++ library with process-global state. Unloading it
        // after dlopen can run destructors after Zig/glibc teardown has started.
        // PeerConnection/DataChannel instances are closed explicitly; keep the
        // native libraries resident for the lifetime of the process.
        self.* = undefined;
    }

    pub fn createPeerConnection(
        self: *const Client,
        stun_url: ?[]const u8,
        port_range_begin: u16,
        port_range_end: u16,
    ) !i32 {
        var stun_z: ?[:0]u8 = null;
        defer if (stun_z) |value| self.allocator.free(value);
        if (stun_url) |value| {
            stun_z = try toOwnedZ(self.allocator, value);
        }

        var pc: i32 = 0;
        try self.check(self.fn_create_peer_connection(
            self.handle,
            if (stun_z) |value| value.ptr else null,
            port_range_begin,
            port_range_end,
            &pc,
        ));
        return pc;
    }

    pub fn closePeerConnection(self: *const Client, pc: i32) void {
        _ = self.fn_close_peer_connection(self.handle, pc);
    }

    pub fn deletePeerConnection(self: *const Client, pc: i32) void {
        _ = self.fn_delete_peer_connection(self.handle, pc);
    }

    pub fn createDataChannel(self: *const Client, pc: i32, label: []const u8) !i32 {
        const label_z = try toOwnedZ(self.allocator, label);
        defer self.allocator.free(label_z);

        var dc: i32 = 0;
        try self.check(self.fn_create_data_channel(self.handle, pc, label_z.ptr, &dc));
        return dc;
    }

    pub fn addOpusTrack(
        self: *const Client,
        pc: i32,
        direction: Direction,
        ssrc: u32,
        payload_type: i32,
        mid: []const u8,
        name: []const u8,
        msid: []const u8,
        track_id: []const u8,
    ) !i32 {
        const mid_z = try toOwnedZ(self.allocator, mid);
        defer self.allocator.free(mid_z);
        const name_z = try toOwnedZ(self.allocator, name);
        defer self.allocator.free(name_z);
        const msid_z = try toOwnedZ(self.allocator, msid);
        defer self.allocator.free(msid_z);
        const track_z = try toOwnedZ(self.allocator, track_id);
        defer self.allocator.free(track_z);

        var tr: i32 = 0;
        try self.check(self.fn_add_opus_track(
            self.handle,
            pc,
            @intFromEnum(direction),
            ssrc,
            payload_type,
            mid_z.ptr,
            name_z.ptr,
            msid_z.ptr,
            track_z.ptr,
            &tr,
        ));
        return tr;
    }

    pub fn setLocalDescription(self: *const Client, pc: i32, sdp_type: ?[]const u8) !void {
        var type_z: ?[:0]u8 = null;
        defer if (type_z) |value| self.allocator.free(value);
        if (sdp_type) |value| {
            type_z = try toOwnedZ(self.allocator, value);
        }

        try self.check(self.fn_set_local_description(
            self.handle,
            pc,
            if (type_z) |value| value.ptr else null,
        ));
    }

    pub fn sendMessage(self: *const Client, id: i32, payload: []const u8) !void {
        try self.check(self.fn_send_message(self.handle, id, payload.ptr, payload.len));
    }

    // Send binary data on a track (audio Opus frames). Uses negative size per libdatachannel API.
    pub fn sendBinaryMessage(self: *const Client, id: i32, payload: []const u8) !void {
        try self.check(self.fn_send_binary(self.handle, id, payload.ptr, payload.len));
    }

    pub fn setOpusPacketizer(self: *const Client, track: i32, payload_type: u8, clock_rate: u32) void {
        if (self.fn_set_opus_packetizer) |f| {
            _ = f(self.handle, track, payload_type, clock_rate);
        }
    }

    pub fn deleteId(self: *const Client, id: i32) void {
        _ = self.fn_close_id(self.handle, id);
        _ = self.fn_delete_id(self.handle, id);
    }

    pub fn setRemoteDescription(self: *const Client, pc: i32, sdp: []const u8, sdp_type: []const u8) !void {
        const sdp_z = try toOwnedZ(self.allocator, sdp);
        defer self.allocator.free(sdp_z);
        const type_z = try toOwnedZ(self.allocator, sdp_type);
        defer self.allocator.free(type_z);
        try self.check(self.fn_set_remote_description(self.handle, pc, sdp_z.ptr, type_z.ptr));
    }

    pub fn setMessageCallback(self: *const Client, id: i32, cb: FnMessageCb, user: ?*anyopaque) !void {
        try self.check(self.fn_set_message_callback(self.handle, id, cb, user));
    }

    /// Register a callback fired when the remote peer's track is created from
    /// its offer (answerer flow). The callback receives (pc, track_id, user).
    pub fn setTrackCallback(self: *const Client, pc: i32, cb: FnTrackCb, user: ?*anyopaque) !void {
        try self.check(self.fn_set_track_callback(self.handle, pc, cb, user));
    }

    pub fn setOpenCallback(self: *const Client, id: i32, cb: FnOpenCb, user: ?*anyopaque) !void {
        try self.check(self.fn_set_open_callback(self.handle, id, cb, user));
    }

    pub fn setClosedCallback(self: *const Client, id: i32, cb: FnClosedCb, user: ?*anyopaque) !void {
        try self.check(self.fn_set_closed_callback(self.handle, id, cb, user));
    }

    pub fn setStateCallback(self: *const Client, pc: i32, cb: FnStateCb, user: ?*anyopaque) !void {
        try self.check(self.fn_set_state_callback(self.handle, pc, cb, user));
    }

    pub fn setIceStateCallback(self: *const Client, pc: i32, cb: FnIceStateCb, user: ?*anyopaque) !void {
        try self.check(self.fn_set_ice_state_callback(self.handle, pc, cb, user));
    }

    pub fn setGatheringStateCallback(self: *const Client, pc: i32, cb: FnGatheringStateCb, user: ?*anyopaque) !void {
        try self.check(self.fn_set_gathering_state_callback(self.handle, pc, cb, user));
    }

    pub fn isOpen(self: *const Client, id: i32) bool {
        return self.fn_is_open(self.handle, id);
    }

    pub fn getLocalDescription(self: *const Client, allocator: std.mem.Allocator, pc: i32, timeout_ms: u64) ![]u8 {
        return self.waitForString(allocator, self.fn_get_local_description, pc, timeout_ms);
    }

    pub fn createLocalOfferSmoke(self: *const Client, allocator: std.mem.Allocator) !LocalOffer {
        const pc = try self.createPeerConnection(
            "stun:stun.l.google.com:19302",
            0,
            0,
        );
        defer {
            self.closePeerConnection(pc);
            self.deletePeerConnection(pc);
        }

        const dc = try self.createDataChannel(pc, "oai-events");
        defer self.deleteId(dc);

        const tr = try self.addOpusTrack(pc, .sendrecv, 12345, 111, "0", "audio", "openai-audio", "audio-track");
        defer self.deleteId(tr);

        try self.setLocalDescription(pc, "offer");

        const offer_sdp = try self.waitForString(allocator, self.fn_get_local_description, pc, 2500);
        errdefer allocator.free(offer_sdp);
        const offer_type = try self.waitForString(allocator, self.fn_get_local_description_type, pc, 2500);
        errdefer allocator.free(offer_type);

        return .{
            .peer_connection_id = pc,
            .data_channel_id = dc,
            .track_id = tr,
            .offer_type = offer_type,
            .offer_sdp = offer_sdp,
        };
    }

    fn waitForString(
        self: *const Client,
        allocator: std.mem.Allocator,
        getter: FnGetString,
        id: i32,
        timeout_ms: u64,
    ) ![]u8 {
        const interval_ms: u64 = 20;
        const attempts = @max(@divFloor(timeout_ms, interval_ms), 1);
        var attempt: u64 = 0;
        while (attempt < attempts) : (attempt += 1) {
            if (self.readString(allocator, getter, id)) |value| {
                if (value.len > 0) return value;
                allocator.free(value);
            } else |_| {}

            _ = usleep(@intCast(interval_ms * std.time.us_per_ms));
        }
        return error.DataChannelTimedOut;
    }

    fn readString(self: *const Client, allocator: std.mem.Allocator, getter: FnGetString, id: i32) ![]u8 {
        var ptr: ?[*]u8 = null;
        var len: usize = 0;
        try self.check(getter(self.handle, id, &ptr, &len));
        defer if (ptr) |value| {
            _ = self.fn_free_buffer(value, len);
        };

        const actual_len = if (len > 0 and ptr.?[len - 1] == 0) len - 1 else len;
        const out = try allocator.alloc(u8, actual_len);
        if (actual_len > 0) {
            @memcpy(out, ptr.?[0..actual_len]);
        }
        return out;
    }

    fn check(self: *const Client, rc: i32) !void {
        if (rc == 0) return;
        const msg = std.mem.span(self.fn_last_error(self.handle));
        if (msg.len > 0) {
            std.log.err("libdatachannel wrapper error (rc={d}): {s}", .{ rc, msg });
        } else {
            std.log.err("libdatachannel wrapper error (rc={d}, no message)", .{rc});
        }
        return error.DataChannelCallFailed;
    }
};

fn lookupRequired(comptime T: type, lib: *std.DynLib, symbol: [:0]const u8) !T {
    return lib.lookup(T, symbol) orelse error.DataChannelSymbolMissing;
}

fn lookupOptional(comptime T: type, lib: *std.DynLib, symbol: [:0]const u8) ?T {
    return lib.lookup(T, symbol);
}

fn toOwnedZ(allocator: std.mem.Allocator, value: []const u8) ![:0]u8 {
    const out = try allocator.alloc(u8, value.len + 1);
    @memcpy(out[0..value.len], value);
    out[value.len] = 0;
    return out[0..value.len :0];
}
