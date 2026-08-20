//! opencamlib — the CAM/milling processor.
//!
//! One Fujin peer, one NRPC method, one native library. Everything else is in
//! the shared `processor` package.
//!
//!   opencamlib [library-path]
//!
//! Settings (each also readable without the `OPENCAMLIB_` prefix, which is how
//! the ptah operator injects the platform-wide ones):
//!   OPENCAMLIB_LIB                 path to libopencamlib.so
//!   OPENCAMLIB_FUJIN_ZMQ_ENDPOINT  Fujin ZMQ endpoint to dial
//!   OPENCAMLIB_FUJIN_TARGET        routing target (default: the service name)
//!   OPENCAMLIB_VALKEY_HOST/_PORT   cache used for input/output blobs
//!   OPENCAMLIB_VALKEY_KEY_PREFIX   cache key namespace (default: cache)
//!   OPENCAMLIB_VALKEY_TTL_SECONDS  produced-blob TTL (default: 1800)

const std = @import("std");
const processor = @import("processor");
const nrpc = @import("generated/opencamlib_nrpc.zig");
const OpenCamLib = @import("milling.zig").OpenCamLib;

const default_library = "/app/lib/libopencamlib.so";

pub fn main(init: std.process.Init) !void {
    const allocator = init.gpa;
    const args = try std.process.Args.toSlice(init.minimal.args, init.arena.allocator());
    const library_path = if (args.len > 1)
        args[1]
    else
        init.environ_map.get("OPENCAMLIB_LIB") orelse default_library;

    var milling = try OpenCamLib.init(allocator, library_path);
    defer milling.deinit();

    try processor.run(init, milling.processor(), .{
        .service = nrpc.service,
        .policy_fn = nrpc.policy,
        .env_prefix = "OPENCAMLIB",
    });
}
