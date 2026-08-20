//! Shared core of every native processor.
//!
//! A processor binary supplies one thing — a `Processor` that turns a task
//! JSON into a result JSON by calling its native library — and this package
//! supplies everything else: the Fujin registration, NRPC authorization, cache
//! staging of heavy blobs, progress streaming and the reply shape. Two
//! processors therefore differ only by their FFI struct and their defaults.

pub const processor = @import("processor.zig");
pub const json = @import("json.zig");
pub const cache = @import("cache.zig");
pub const serve = @import("serve.zig");

pub const Processor = processor.Processor;
pub const Progress = processor.Progress;
pub const Cache = cache.Client;
pub const Options = serve.Options;
pub const run = serve.run;

test {
    _ = processor;
    _ = json;
    _ = cache;
    _ = serve;
}
