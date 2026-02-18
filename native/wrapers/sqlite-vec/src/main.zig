// sqlite-vec Zig wrapper
// The C source (sqlite-vec.c) directly provides sqlite3_vec_init entry point.
// This root module exists to satisfy the Zig build system.

comptime {
    // Force the C source to be linked
    _ = @import("std");
}
