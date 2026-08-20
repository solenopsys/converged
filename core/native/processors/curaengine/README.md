# curaengine

The 3D-print slicing processor: one Fujin peer, one NRPC method, one native
library. Everything that is not slicing lives in [`../interface`](../interface).

- Contract: [`../../types/curaengine.ts`](../../types/curaengine.ts)
- Generated descriptor: `src/generated/curaengine_nrpc.zig`
- Wrapper it loads: [`../../wrappers/slicers/curaengine`](../../wrappers/slicers/curaengine) → `libcuraengine.so`

## Task

```json
{
  "task": {
    "stlPath": "/tmp/part.stl",
    "definitionPath": "/tmp/printer.def.json",
    "gcodePath": "/tmp/part.gcode",
    "modelName": "part.stl",
    "definitionName": "printer.def.json",
    "settings": ["layer_height=0.2"],
    "threads": 4
  },
  "outputs": ["gcodePath"]
}
```

`stlPath`, `definitionPath` and `gcodePath` are required by the time the
wrapper is called, but a caller normally supplies the first two through
`inputs` (cache refs) and the third through `outputs`, so the processor binds
them to temp files itself. `settings` are raw `key=value` overrides passed
through to CuraEngine; `searchFiles` supplies extra definition files by name.

The result is `{gcodePath, gcodeBytes, exitCode}`, and the g-code comes back as
a cache ref in `outputs`.

Progress is coarse — `reading` then `slicing` — because the wrapper is a single
blocking FFI call with no layer callback yet.

## Build

```bash
zig build                # the processor for musl, plus libzimq.so
zig build test
zig build wrapper        # libcuraengine.so via CMake (slow)
./build.sh               # both, laid out as the container expects
./build-container.sh     # and the image
```

## Run

```bash
CURAENGINE_LIB=../../wrappers/slicers/curaengine/zig-out/lib/libcuraengine.so \
CURAENGINE_FUJIN_ZMQ_ENDPOINT=tcp://127.0.0.1:5557 \
  ./zig-out/bin/curaengine
```

The library path may also be given as the first positional argument. All other
settings are the shared ones documented in the interface README, read as
`CURAENGINE_*` first and platform-wide second.

## Deployment

The ptah operator raises it from `Platform.spec.apps`:

```json
"curaengine": {
  "image": "public.ecr.aws/i5x9u8b2/curaengine:latest",
  "fujinTarget": "curaengine",
  "fujinEndpointEnv": "CURAENGINE_FUJIN_ZMQ_ENDPOINT"
}
```

Slicing is CPU-bound and single-request, so scale it with `replicas` rather
than by making the process concurrent.
