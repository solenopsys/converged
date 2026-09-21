# opus Zig wrapper

Self-contained `libopus.so` for the converged native stack, built from the
vendored upstream source (`vendor/opus-vendor`, `xiph/opus`tag `v1.5.2`,
BSD-licensed). Same layout as the `md4c` wrapper next to it: C sources go
straight into the Zig build, one `libopus-<arch>-<libc>.so` per target, hashes
in `current.json`, content-addressed copies in `../../artifacts/libs`.

Why a wrapper instead of the system package: the runtime targets include
`x86_64/aarch64 × gnu/musl`, and the container images ship no dev packages.
Zig compiles the vendored C for the requested target, so the library always
matches the service ABI — same reason the ONNX Runtime wrapper exists.

Build for the current target:

```bash
zig build -Doptimize=ReleaseFast
# zig-out/lib/libopus.so + include/opus/opus.h
```

Build for all supported targets:

```bash
zig build -Dall=true -Doptimize=ReleaseFast
# ../../artifacts/libs/<sha256>.so + current.json
```

Consumers: `speach` (Opus → PCM 48 kHz for the ASR frontend) links
`opus:decoder_*` from `src/main.zig` through this library's headers.
Only the decoder API is exported (`opus_decoder_*`, `opus_strerror` is
re-exported as-is); the encoder is compiled in but not wrapped.

## Notes

- Upstream needs no `config.h`: `celt/arch.h` falls back to a generic
  configuration when none is generated. `OPUS_BUILD` is defined so internal
  symbols export correctly into the shared object.
- x86 SSE/AVX intrinsics stay on for `x86_64` (upstream compiles them
  unconditionally on that arch); ARM NEON objects are added for `aarch64`.
- Symbol visibility is `hidden` except the wrapped decoder API, surfaced
  with explicit `__attribute__((visibility("default")))` in `src/main.zig`.
