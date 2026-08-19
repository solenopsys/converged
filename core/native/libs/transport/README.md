# Cluster Transport

Shared ZeroMQ messaging for native Navite applications.

## Message Core

The Zig module exported as `transport` has two endpoint roles:

- `transport.Router`: binds a ZeroMQ `ROUTER` endpoint for Fujin.
- `transport.Peer`: connects a ZeroMQ `DEALER` endpoint for services.

Both roles use the same strict multipart packet:

```text
Peer -> Router: [envelope][payload]
Router -> Peer: [identity][envelope][payload]
```

`envelope` is the Cap'n Proto-compatible cluster header implemented by the
pure-Zig codec in `src/envelope.zig`. `payload` is opaque JSON, Cap'n Proto, or
raw data. Socket limits and timeouts are explicit application settings.

The module also provides control packet builders for register, ping, pong,
cancel, and unregister. Routing registries, pending requests, heartbeat loops,
and application dispatch remain outside this low-level module.

## Bun ABI

`src/abi.zig` builds `libmessage.so`. It exposes `msg_*` functions used by
`cruller-transport/messaging`: connect a Peer, send envelope fields plus a
payload, and receive an owned native message. Payload transfer into Bun uses a
single `toArrayBuffer` copy before `msg_in_free`.

## Storage Compatibility

`src/storage` and `schema/storage` preserve the former Behemoth-only transport
and its `libtransport.so` C ABI during migration. Its `wire.capnp` message is a
Behemoth payload protocol, not the cluster envelope. The separate storage
socket is removed only when Behemoth moves to the common Peer.

## Build And Test

```bash
zig build
zig build test
zig build fixture
zig build -Dall=true -Doptimize=ReleaseFast
```

The all-target build emits glibc and musl libraries for x86_64 and aarch64 and
syncs them into `../cruller-transport/bin-libs`.

`zig build mock` still builds the in-memory storage compatibility ABI as
`libtransport-mock.so`.
