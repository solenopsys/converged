// Thin Zig entry point for the shared object. The library itself is the
// vendored upstream C (added file by file in build.zig); this module only
// re-exports a minimal decoder surface with default visibility, so the
// .so exposes exactly what our services need and nothing else.
const std = @import("std");

const c = @cImport({
    @cInclude("opus.h");
});

const c_allocator = std.heap.c_allocator;

export fn opus_decoder_create_state(sample_rate: i32, channels: i32) ?*anyopaque {
    var err: c_int = 0;
    const size = c.opus_decoder_get_size(channels);
    if (size <= 0) return null;
    const mem = c_allocator.alignedAlloc(u8, .fromByteUnits(@alignOf(usize)), @intCast(size)) catch return null;
    err = c.opus_decoder_init(@ptrCast(mem.ptr), sample_rate, channels);
    if (err != c.OPUS_OK) {
        c_allocator.free(mem);
        return null;
    }
    return @ptrCast(mem.ptr);
}

export fn opus_decoder_destroy_state(state: ?*anyopaque) void {
    if (state == null) return;
    const size = c.opus_decoder_get_size(1);
    if (size <= 0) return;
    const mem: [*]u8 = @ptrCast(state.?);
    c_allocator.free(mem[0..@intCast(size)]);
}

export fn opus_decode_frame(
    state: ?*anyopaque,
    packet: [*]const u8,
    packet_len: i32,
    pcm_out: [*]i16,
    frame_size: i32,
) c_int {
    if (state == null) return c.OPUS_BAD_ARG;
    return c.opus_decode(@ptrCast(state), packet, packet_len, pcm_out, frame_size, 0);
}

export fn opus_decode_loss(
    state: ?*anyopaque,
    pcm_out: [*]i16,
    frame_size: i32,
) c_int {
    if (state == null) return c.OPUS_BAD_ARG;
    return c.opus_decode(@ptrCast(state), null, 0, pcm_out, frame_size, 0);
}

export fn opus_last_error_message(code: c_int) [*:0]const u8 {
    return c.opus_strerror(code);
}
