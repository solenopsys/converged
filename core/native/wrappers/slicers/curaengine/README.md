# Native CuraEngine wrapper

`zig build -Doptimize=ReleaseFast` builds the upstream CuraEngine 5.1.0 C++ slicer
as a native executable and a small POSIX C ABI wrapper at `zig-out/lib/libcuraengine.so`.

The wrapper has no WASM or Node dependency. It launches `CuraEngine slice` in a
temporary directory and returns the produced G-code through malloc-owned memory.
This process boundary is required because upstream CuraEngine uses global singleton
state and terminates the process on several error paths.

Set `input.engine_path` to the bundled `zig-out/bin/CuraEngine` (or set
`CURAENGINE_BINARY`) when the executable is not on `PATH`.

Upstream CuraEngine and this distribution are AGPL-3.0-or-later. Bundled build
dependencies are Clipper 6.4.2, RapidJSON 1.1.0, and stb.
