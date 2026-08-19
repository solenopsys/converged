# Native Fluent Bit wrapper

Run zig build -Doptimize=ReleaseFast to build Fluent Bit 1.4.6 as a native,
stripped zig-out/lib/libfluentbit.so. There is no Go proxy, WASM, or Node
runtime.

The C ABI starts and stops the engine through Fluent Bit's supported library
API. It accepts the main configuration and its @INCLUDE files as bytes, keeps
them in a private temporary directory while the engine runs, and removes them
on destroy.

The build profile covers the archived logging deployment: tail input with
parser/SQLite state, Kubernetes filter with TLS, and Elasticsearch output.
Other upstream plugins are deliberately disabled to keep the artifact small.

Fluent Bit is Apache-2.0 licensed.
