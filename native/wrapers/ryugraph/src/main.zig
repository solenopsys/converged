// The shared object is built by CMake from vendor/ryugraph.
// This module exists so the wrapper has a standard Zig entry point.
comptime {
    _ = @import("std");
}
