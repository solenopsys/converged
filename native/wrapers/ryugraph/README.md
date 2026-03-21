# RyuGraph Zig Wrapper

This wrapper builds `predictable-labs/ryugraph` as a shared library through `zig build`.

## What Is Disabled In Build

The wrapper explicitly turns off non-essential targets:

- `BUILD_PYTHON=OFF`
- `BUILD_JAVA=OFF`
- `BUILD_NODEJS=OFF`
- `BUILD_BENCHMARK=OFF`
- `BUILD_EXAMPLES=OFF`
- `BUILD_TESTS=OFF`
- `BUILD_EXTENSION_TESTS=OFF`
- `BUILD_SHELL=OFF`
- `BUILD_SINGLE_FILE_HEADER=OFF`
- `BUILD_EXTENSIONS=""`

Additionally:

- `AUTO_UPDATE_GRAMMAR=OFF` to avoid grammar regeneration tooling.

## Build

Prerequisites:

- Zig `0.15.2+`
- `cmake` and a Make backend (`make`)

Build for current target:

```bash
zig build -Doptimize=ReleaseFast
```

Build for all supported targets:

```bash
zig build -Dall=true -Doptimize=ReleaseFast
```

Single-target output:

- `zig-out/lib/libryugraph.so`
- `zig-out/include/ryugraph/ryu.h`

`-Dall=true` output:

- target-specific `.so` files are hashed and copied to `../../artifacts/libs`
- `current.json` contains target -> hash mapping
