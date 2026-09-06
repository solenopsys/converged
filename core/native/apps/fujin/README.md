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

## Message streams

Fujin carries three unrelated kinds of traffic, and they are worth keeping
apart when reading the source:

1. **Service messaging** — request/response NRPC between peers over ZMQ, plus
   the browsers that enter through WebSocket. This is the routing contract
   above (`registry.zig`, `main.zig`).
2. **Log and telemetry ingest** — Fluent Bit receives the raw streams, hands
   them back over HTTP, and `ingest.zig` groups them into blocks written to
   `rp-logs` / `rp-telemetry` with one `writeBatch` per block.
3. **User notifications** — the `pushrouter` service: business messages
   addressed at a person (`pushrouter.zig`, `notifications.zig`).

## `pushrouter`

`pushrouter` is an NRPC service Fujin hosts on its own target. It is reached
the same way any other service is — `to.target = "fujin"`,
`to.service = "pushrouter"` — from a browser over WebSocket and from a backend
service over ZMQ, using the generated `g-pushrouter` client.

```ts
await createPushRouterServiceClient(config).publish({
  name: "order.created",
  user: "u-42",              // omit to reach every session in the scope
  level: "success",
  titleKey: "notify.order.created.title",
  params: { number: "42" },
});
```

- `publish` accepts a user or a service token (`.any`), and either way the
  `pushrouter/publish(w)` permission has to grant it. A user token can only
  address its own tenant; a service token may name another one.
- Text travels as `titleKey`/`bodyKey` plus `params`. The publisher does not
  know the reader's locale, so a rendered sentence could only ever be one
  language; `title`/`body` remain for data no catalog holds.
- `publish` answers with the number of live sessions reached. Zero means
  nobody was connected, which is the caller's cue to fall back to a durable
  channel such as `rp-notify`.
- `history` replays the calling subject's own messages from an in-memory ring
  (`FUJIN_PUSH_CAPACITY`, default 1024). It takes no recipient parameter and a
  restart drops the window: this covers a reload, not durable history.
- Every notification passes through `onEvent` in `src/event_policy.js` before
  delivery, so a deployment can suppress or reshape one without a rebuild.
  Returning `null` drops it.

## Log ingest

Configuration splits in two. The parameters below are declared in the ptah
`Platform` spec under `spec.logging` (and `spec.pushReplayCapacity`), which is
what emits the `FUJIN_*` env into the Deployment; in dev they are read from
`confs/<env>/<platform>.env` by `core/tools/dev/src/apps.ts`. The two shared
keys are secrets and never appear in a Platform object: they arrive through the
platform Secret in the cluster, and from the same `confs` file in dev.

Set `FUJIN_FLUENTBIT=on` to start the embedded Fluent Bit forward receiver.
Producers authenticate with `FUJIN_FLUENTBIT_SHARED_KEY`; the engine posts the
batches it collects back to this process at `POST /ingest/fluentbit`,
authenticated with `FUJIN_INGEST_KEY` (required whenever Fluent Bit is on —
the route listens on the same address as the browser WebSocket). Records that
name a device, a parameter and a numeric value go to `rp-telemetry`; everything
else becomes an `rp-logs` row, with the Fluent Bit tag as its source. Blocks
of `FUJIN_INGEST_BLOCK_SIZE` (default 100) are written with a single
`writeBatch`; a partial block ships after `FUJIN_INGEST_FLUSH_MS`, and at most
`FUJIN_INGEST_MAX_BLOCKS` wait for `services` before the oldest is dropped.
Fujin's own calls to the repositories carry `SERVICE_TOKEN`.

- `zimq` runs as a `ROUTER` server (`FUJIN_ZMQ_BIND`, default `tcp://0.0.0.0:5557`).
- `GET /ws` exposes a multi-client WebSocket signal fan-out (`FUJIN_WS_HOST` / `FUJIN_WS_PORT`, default `0.0.0.0:8087`).
- JSON `user_event` controls and `pushrouter` notifications go through `src/event_policy.js` in `libqjs.so` before delivery. Set `FUJIN_EVENT_POLICY=/path/policy.js` to load a deployment-specific `onEvent(event)` function; returning `null` drops the message.
- Frames larger than `FUJIN_MAX_CONTROL_BYTES` (default 60 KiB) remain on ZMQ. Browsers receive only `bulk_available` metadata.
- Set `FUJIN_FLUENTBIT=on` to start the native Fluent Bit `forward` receiver (`FUJIN_FLUENTBIT_HOST` / `FUJIN_FLUENTBIT_PORT`), see "Log ingest" above.
- Admin NRPC methods `fujin.messages(limit)` and `fujin.logs(limit)` return the routing journal newest-first. The ring holds `FUJIN_JOURNAL_CAPACITY` entries (default 4096).
- Both of Fujin's own services terminate on the `fujin` target rather than going through the peer registry, so nothing may register `fujin` as a route.

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
