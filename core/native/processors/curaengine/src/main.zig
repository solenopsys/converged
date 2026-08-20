//! curaengine — the 3D-print slicing processor.
//!
//! One Fujin peer, one NRPC method, one native library. Everything else is in
//! the shared `processor` package.
//!
//!   curaengine [library-path]
//!
//! Settings (each also readable without the `CURAENGINE_` prefix, which is how
//! the ptah operator injects the platform-wide ones):
//!   CURAENGINE_LIB                 path to libcuraengine.so
//!   CURAENGINE_FUJIN_ZMQ_ENDPOINT  Fujin ZMQ endpoint to dial
//!   CURAENGINE_FUJIN_TARGET        routing target (default: the service name)
//!   CURAENGINE_VALKEY_HOST/_PORT   cache used for input/output blobs
//!   CURAENGINE_VALKEY_KEY_PREFIX   cache key namespace (default: cache)
//!   CURAENGINE_VALKEY_TTL_SECONDS  produced-blob TTL (default: 1800)

const std = @import("std");
const processor = @import("processor");
const nrpc = @import("generated/curaengine_nrpc.zig");
const CuraEngine = @import("engine.zig").CuraEngine;

const default_library = "/app/lib/libcuraengine.so";

pub fn main(init: std.process.Init) !void {
    const allocator = init.gpa;
    const args = try std.process.Args.toSlice(init.minimal.args, init.arena.allocator());
    const library_path = if (args.len > 1)
        args[1]
    else
        init.environ_map.get("CURAENGINE_LIB") orelse default_library;

    var engine = try CuraEngine.init(allocator, library_path);
    defer engine.deinit();

    try processor.run(init, engine.processor(), .{
        .service = nrpc.service,
        .policy_fn = nrpc.policy,
        .env_prefix = "CURAENGINE",
    });
}
