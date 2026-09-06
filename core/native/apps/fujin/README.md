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

Fujin carries four unrelated kinds of traffic, and they are worth keeping
apart when reading the source:

1. **Service messaging** — request/response NRPC between peers over ZMQ, plus
   the browsers that enter through WebSocket. This is the routing contract
   above (`registry.zig`, `main.zig`).
2. **Log and telemetry ingest** — Fluent Bit receives the raw streams, hands
   them back over HTTP, and `ingest.zig` groups them into blocks written to
   `rp-logs` / `rp-telemetry` with one `writeBatch` per block.
3. **User notifications** — the `pushrouter` service: business messages
   addressed at a person (`pushrouter.zig`, `notifications.zig`).
4. **Business events** — the `bus` service: facts addressed at nobody, handed
   to whoever subscribed to the topic (`bus.zig`, `topics.zig`).

## `bus`

A business event is a fact — an order was paid, a webhook arrived, a schedule
elapsed. Unlike a notification it names no recipient: subscribers state which
topics they care about and Fujin hands each event to whoever currently matches.

Topics are dot-separated and carry the entity: `order.updated.42`. A pattern
matches segment by segment, `*` standing for one segment and `>` for the
remaining tail — the NATS convention, so `order.*.42` follows one order and
`order.>` follows all of them.

```ts
await createBusServiceClient(config).publish({
  name: "order.paid.42",
  payload: { total: 1990 },
});
await createBusServiceClient(config).subscribe(["order.>"]);
```

- A subscription belongs to the connection that made it and disappears with it.
  There is no lease and no expiry: Fujin already learns about a dead peer from
  ROUTER_NOTIFY and about a closed socket from the read loop. A client
  re-subscribes after reconnecting, which is also what repairs the table after
  Fujin itself restarts.
- What the table must never become is a registry of durable business
  subscribers. "Which of a million users watches order 42" is application data
  with an index behind it, answered by whichever service owns it — a peer of
  the bus like any other.
- A runtime peer receives an event as an ordinary `bus.onEvent` request signed
  with Fujin's `SERVICE_TOKEN`. Delivery is at-most-once and fire-and-forget:
  the bus is not a queue.
- A browser session receives `{id, name, at, scope}` and nothing else. The data
  is refetched through the service that owns it, which is also the service that
  knows whether that session may see it — so no payload can leak through a
  subscription, whatever pattern it names.
- `FUJIN_SUBSCRIPTIONS_MAX` (default 4096) bounds the table across every
  connection.

## Schedule ticker

`FUJIN_SCHEDULER=on` starts the schedule ticker in this process, for one reason
only: a schedule needs a single clock, and Fujin is the component there is
exactly one of. Everything else about it is an ordinary participant — it opens
its own DEALER connection to this same Fujin, registers `FUJIN_SCHEDULER_TARGET`
(default `scheduler`) and speaks plain NRPC: `sheduller.schedule()` for when
things are due, `bus.publish()` for the event once one is. The router gained no
request/response machinery to support it.

Cron expressions never reach Zig. `rp-sheduller` interprets them with a real
cron library and answers with absolute instants; the ticker compares numbers,
fires `cron.<name>`, and records the run through `sheduller.recordHistory`.
Every fired event carries `dedupKey = <cronId>:<instant>`, so a consumer can
drop a repeat on its own — the property that keeps a future clustered Fujin,
with a Raft-elected leader, from turning one schedule into two invoices. Which
process owns the schedule is decided in one function, `isScheduleLeader`.

`FUJIN_SCHEDULE_REFRESH_MS` (default 30000) is how often the plan is re-read;
the horizon requested is twice that, so a failed poll still leaves the next one
time to catch the same occurrence. `FUJIN_SCHEDULER_ENDPOINT` overrides the
loopback address derived from `FUJIN_ZMQ_BIND`.

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
