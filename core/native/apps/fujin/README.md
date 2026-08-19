# Fujin

`fujin` is an application-level message hub for the converged native stack.

## Routing Contract

This contract is the source of truth for Fujin routing. Fujin routes to a
connection; the receiving process routes to a service.

### Ownership

Each `DEALER` connection registers exactly one target, such as `services`,
`behemoth`, or `ui`. The message address has two independent fields:

- `to.target` selects the receiving connection in Fujin.
- `to.service` selects a handler inside the receiving process.

Fujin owns one map:

```text
target -> ZMQ connection identity
```

### Lifecycle

1. The transport sends `register` with its target after connecting.
2. Fujin atomically binds that target to the connection identity.
3. A reconnect under the same target replaces the old identity immediately.
4. A disconnect removes the mapping only when that identity still owns it.
5. After a Fujin restart, the first `register`, ping, or application packet
   restores its source target before that packet is handled.
6. Fujin forwards ordinary messages using only `to.target`; the receiver
   dispatches using only `to.service`.

### Required Properties

- A target is routable if and only if a live identity currently owns it.
- A dead identity cannot leave a target behind.
- A late disconnect from an old identity cannot remove its replacement.
- Restarting Fujin clears all mappings; the next packet from each transport
  restores its one source target without waiting for an application timer.
- `service_unavailable` means no currently connected identity owns the target.
- An unknown `to.service` is reported by the receiving process, not Fujin.

### Prohibited Designs

- Registering `ms:<service>` or store names as Fujin routes.
- Sending service metadata or route snapshots in `register`.
- Maintaining target liveness with application request traffic or a lease
  timer independent of ZMQ connection state.
- Binding more than one target to one physical connection.

### Tests

The routing tests must cover these cases:

1. Registration makes exactly one target routable.
2. Disconnect removes that target.
3. Reconnect moves ownership to the new identity.
4. A late disconnect from the old identity is harmless.
5. Fujin restart causes target re-registration without application help.
6. Two services behind one target are dispatched locally by `to.service`.

- `zimq` runs as a `ROUTER` server (`FUJIN_ZMQ_BIND`, default `tcp://0.0.0.0:5557`).
- `GET /ws` exposes a multi-client WebSocket signal fan-out (`FUJIN_WS_HOST` / `FUJIN_WS_PORT`, default `0.0.0.0:8087`).
- JSON `user_event` controls go through `src/event_policy.js` in `libqjs.so` before broadcast. Set `FUJIN_EVENT_POLICY=/path/policy.js` to load a deployment-specific `onEvent(event)` function.
- Frames larger than `FUJIN_MAX_CONTROL_BYTES` (default 60 KiB) remain on ZMQ. Browsers receive only `bulk_available` metadata.
- Set `FUJIN_FLUENTBIT=on` to start the native Fluent Bit `forward` receiver (`FUJIN_FLUENTBIT_HOST` / `FUJIN_FLUENTBIT_PORT`).
- Admin NRPC methods `fujin.messages(limit)` and `fujin.logs(limit)` return the routing journal newest-first. The ring holds `FUJIN_JOURNAL_CAPACITY` entries (default 4096).

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
