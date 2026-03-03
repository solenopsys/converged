const std    = @import("std");
const socket = @import("socket.zig");
const codec  = @import("codec.zig");

// Import the C header — gives us all transport_req_* / transport_resp_* symbols
// that are implemented in capnp_wrap.cpp.
const c = @cImport(@cInclude("transport.h"));

// Re-export the full C API so the dynamic library surface is visible.
// Zig re-exports each symbol from the linked C++ object.

pub const transport_req_ping            = c.transport_req_ping;
pub const transport_req_shutdown        = c.transport_req_shutdown;
pub const transport_req_open            = c.transport_req_open;
pub const transport_req_close           = c.transport_req_close;
pub const transport_req_exec_sql        = c.transport_req_exec_sql;
pub const transport_req_query_sql       = c.transport_req_query_sql;
pub const transport_req_size            = c.transport_req_size;
pub const transport_req_manifest        = c.transport_req_manifest;
pub const transport_req_migrate         = c.transport_req_migrate;
pub const transport_req_archive         = c.transport_req_archive;
pub const transport_req_kv_put          = c.transport_req_kv_put;
pub const transport_req_kv_get          = c.transport_req_kv_get;
pub const transport_req_kv_delete       = c.transport_req_kv_delete;
pub const transport_req_kv_list         = c.transport_req_kv_list;
pub const transport_req_file_put        = c.transport_req_file_put;
pub const transport_req_file_get        = c.transport_req_file_get;
pub const transport_req_file_delete     = c.transport_req_file_delete;
pub const transport_req_file_list       = c.transport_req_file_list;
pub const transport_req_encode          = c.transport_req_encode;
pub const transport_req_free            = c.transport_req_free;
pub const transport_resp_decode         = c.transport_resp_decode;
pub const transport_resp_free           = c.transport_resp_free;
pub const transport_resp_ok             = c.transport_resp_ok;
pub const transport_resp_error          = c.transport_resp_error;
pub const transport_resp_duration_us    = c.transport_resp_duration_us;
pub const transport_resp_op_count       = c.transport_resp_op_count;
pub const transport_resp_affected       = c.transport_resp_affected;
pub const transport_resp_size           = c.transport_resp_size;
pub const transport_resp_row_count      = c.transport_resp_row_count;
pub const transport_resp_col_count      = c.transport_resp_col_count;
pub const transport_resp_col_name       = c.transport_resp_col_name;
pub const transport_resp_value_type     = c.transport_resp_value_type;
pub const transport_resp_value_int      = c.transport_resp_value_int;
pub const transport_resp_value_real     = c.transport_resp_value_real;
pub const transport_resp_value_text     = c.transport_resp_value_text;
pub const transport_resp_key_count      = c.transport_resp_key_count;
pub const transport_resp_key_at         = c.transport_resp_key_at;
pub const transport_resp_found          = c.transport_resp_found;
pub const transport_resp_data_ptr       = c.transport_resp_data_ptr;
pub const transport_resp_data_len       = c.transport_resp_data_len;
pub const transport_resp_manifest_name  = c.transport_resp_manifest_name;
pub const transport_resp_manifest_type  = c.transport_resp_manifest_type;
pub const transport_resp_manifest_version         = c.transport_resp_manifest_version;
pub const transport_resp_manifest_migration_count = c.transport_resp_manifest_migration_count;
pub const transport_resp_manifest_migration_at    = c.transport_resp_manifest_migration_at;
pub const transport_free_buf            = c.transport_free_buf;

// ── Unix socket transport (added on top of capnp encode/decode) ───────────────

/// Connect to a storage Unix socket.  Returns fd or -1 on error.
pub export fn transport_connect(path: [*:0]const u8) i32 {
    const fd = socket.connect(path) catch return -1;
    return @intCast(fd);
}

/// Set per-socket send/receive timeout in milliseconds.
/// Returns 0 on success, -1 on error.
pub export fn transport_set_timeout_ms(fd: i32, timeout_ms: u32) i32 {
    socket.setOperationTimeout(@intCast(fd), timeout_ms) catch return -1;
    return 0;
}

/// Create and listen on a Unix socket.  Returns server fd or -1 on error.
pub export fn transport_listen(path: [*:0]const u8) i32 {
    const fd = socket.listen(path) catch return -1;
    return @intCast(fd);
}

/// Accept next client (blocking).  Returns client fd, -1 on would-block, -2 on error.
pub export fn transport_accept(server_fd: i32) i32 {
    const client_fd = std.posix.accept(@intCast(server_fd), null, null, 0) catch |err| switch (err) {
        error.WouldBlock => return -1,
        else             => return -2,
    };
    return @intCast(client_fd);
}

/// Close a file descriptor.
pub export fn transport_close(fd: i32) void {
    std.posix.close(@intCast(fd));
}

/// Encode a request with capnp and send it over fd (4-byte LE length prefix + body).
/// Returns 0 on success, -1 on encode error, -2 on send error.
pub export fn transport_send_req(fd: i32, req: ?*anyopaque) i32 {
    var out_buf: ?[*]u8 = null;
    var out_len: usize  = 0;
    const rc = c.transport_req_encode(
        @ptrCast(req),
        @ptrCast(&out_buf),
        &out_len,
    );
    if (rc != 0) return -1;
    defer c.transport_free_buf(out_buf, out_len);

    codec.sendMessage(@intCast(fd), out_buf.?[0..out_len]) catch return -2;
    return 0;
}

/// Receive a capnp response from fd.
/// Returns a TransportResponse* (opaque) or null on error.
/// Caller must free with transport_resp_free().
pub export fn transport_recv_resp(fd: i32) ?*anyopaque {
    const allocator = std.heap.c_allocator;
    const msg = codec.recvMessage(@intCast(fd), allocator) catch return null;
    defer allocator.free(msg);
    return @ptrCast(c.transport_resp_decode(msg.ptr, msg.len));
}
