# opencamlib

The CAM/milling processor: one Fujin peer, one NRPC method, one native library.
Everything that is not milling lives in [`../interface`](../interface).

- Contract: [`../../types/opencamlib.ts`](../../types/opencamlib.ts)
- Generated descriptor: `src/generated/opencamlib_nrpc.zig`
- Wrapper it loads: [`../../wrappers/slicers/opencamlib`](../../wrappers/slicers/opencamlib) → `libopencamlib.so`

## Task

```json
{
  "task": {
    "stlPath": "/tmp/part.stl",
    "toolDiameter": 6,
    "stepover": 0.4,
    "feed": 300,
    "safeZ": 5
  },
  "inputs": { "stlPath": "cache:files:abc" },
  "outputs": ["gcodePath"]
}
```

Only the model is required; every tool parameter falls back to the processor's
default (`toolDiameter` 3.175, `toolLength` 20, `stepover` 1, `sampling` 0.5,
`minSampling` 0.1, `feed` 300, `rapid` 1000, `safeZ` 5). Omitting `gcodePath`
(and `outputs`) makes the run an estimate only — the wrapper then skips g-code
generation entirely rather than producing bytes nobody asked for.

The result is `{triangles, passes, points, totalTimeSec}`, plus
`{gcodePath, gcodeBytes}` when g-code was requested; the g-code itself comes
back as a cache ref in `outputs`.

Progress is coarse — `reading` then `toolpath` — because the wrapper is a
single blocking FFI call with no per-pass callback yet.

## Build

```bash
zig build                # the processor for musl, plus libzimq.so
zig build test
zig build wrapper        # libopencamlib.so via CMake (slow)
./build.sh               # both, laid out as the container expects
./build-container.sh     # and the image
```

## Run

```bash
OPENCAMLIB_LIB=../../wrappers/slicers/opencamlib/zig-out/lib/libopencamlib.so \
OPENCAMLIB_FUJIN_ZMQ_ENDPOINT=tcp://127.0.0.1:5557 \
  ./zig-out/bin/opencamlib
```

The library path may also be given as the first positional argument. All other
settings are the shared ones documented in the interface README, read as
`OPENCAMLIB_*` first and platform-wide second.

## Deployment

The ptah operator raises it from `Platform.spec.apps`:

```json
"opencamlib": {
  "image": "public.ecr.aws/i5x9u8b2/opencamlib:latest",
  "fujinTarget": "opencamlib",
  "fujinEndpointEnv": "OPENCAMLIB_FUJIN_ZMQ_ENDPOINT"
}
```

Toolpath extraction is CPU-bound and single-request, so scale it with
`replicas` rather than by making the process concurrent.
