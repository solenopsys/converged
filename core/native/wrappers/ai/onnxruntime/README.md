# ONNX Runtime native wrapper

This wrapper builds the pinned ONNX Runtime `v1.30.0` source tree for the
requested Linux ABI and links it into one `libonnxruntime.so` exporting a small,
stable POSIX C interface. It deliberately exposes generic named tensor I/O;
model tokenization and business logic belong to consuming native applications.

```bash
zig build -Dtarget=x86_64-linux-gnu
# zig-out/x86_64-linux-gnu/lib/libonnxruntime.so

# musl is built natively in Alpine through tools/musl.Containerfile
zig build -Dtarget=x86_64-linux-musl
# zig-out/x86_64-linux-musl/lib/libonnxruntime.so
```

The first build clones the upstream source and its required submodules under
`vendor/onnxruntime`. The build uses Zig as the C/C++ toolchain, so the produced
library matches the selected target instead of inheriting the host Python
wheel's ABI. A musl target is built natively in Alpine by the container helper,
so upstream CMake cannot accidentally mix host glibc headers with the musl ABI.
The helper uses Podman by default; set `CONTAINER_ENGINE=docker` to use Docker.
`x86_64-linux-musl` and `aarch64-linux-musl` select matching Alpine platforms.

`ortw_session_run` only accepts numeric tensors. Every returned `data` and
`shape` allocation belongs to the caller and must be released with
`ortw_tensor_output_free`.
