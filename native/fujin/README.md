# Fujin

`fujin` is an application-level message hub for the converged native stack.

- `zimq` runs as a `ROUTER` server (`FUJIN_ZMQ_BIND`, default `tcp://0.0.0.0:5557`).
- `GET /ws` exposes a multi-client WebSocket signal fan-out (`FUJIN_WS_HOST` / `FUJIN_WS_PORT`, default `0.0.0.0:8087`).
- JSON `user_event` controls go through `src/event_policy.js` in `libqjs.so` before broadcast. Set `FUJIN_EVENT_POLICY=/path/policy.js` to load a deployment-specific `onEvent(event)` function.
- Frames larger than `FUJIN_MAX_CONTROL_BYTES` (default 60 KiB) remain on ZMQ. Browsers receive only `bulk_available` metadata.
- Set `FUJIN_FLUENTBIT=on` to start the native Fluent Bit `forward` receiver (`FUJIN_FLUENTBIT_HOST` / `FUJIN_FLUENTBIT_PORT`).

The three wrapper paths are configurable with `FUJIN_ZIMQ_LIB`, `FUJIN_QJS_LIB`, and `FUJIN_FLUENTBIT_LIB`; defaults point to the sibling wrapper build outputs. Build the wrappers first using their own existing build instructions, then build Fujin:

```sh
cd native/fujin
zig build
FUJIN_FLUENTBIT=on zig build run
```

Control producers should use a ZMQ `DEALER` socket and send one JSON frame, for example:

```json
{"type":"user_event","name":"job.updated","payload":{"id":"42"}}
```

`resonus`, `centimanus`, and `ptah` use the shared `native/fujin_client.zig`
client. They connect to `FUJIN_ZMQ_ENDPOINT` (default `tcp://127.0.0.1:5557`)
and load `libzimq` from the service-specific `*_FUJIN_ZIMQ_LIB` variable, or
from `FUJIN_ZIMQ_LIB`. The library path is runtime configuration, so each OS and
architecture can use its own wrapper artifact.
