# OpenCAMLib native wrapper

Builds the upstream OpenCAMLib C++ source at `2023.01.11` with `zig c++` and exposes one compact C ABI for the existing STL milling estimate flow. No WASM, Node-API, or Emscripten runtime is linked into the resulting library.

```bash
zig build -Doptimize=ReleaseFast
```

The result is `zig-out/lib/libopencamlib.so`; see `include/opencamlib_wrapper.h` for the ABI. OpenCAMLib is LGPL-2.1-or-later.
