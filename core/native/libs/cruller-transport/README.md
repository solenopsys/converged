# Cruller Transport

Bun/Cruller bindings for the native transport libraries.

- `src/messaging.ts` binds `libmessage.so` and exposes `MessagingConnection`
  for the common cluster envelope and ZeroMQ Peer.
- `src/index.ts` preserves the former Behemoth storage client over
  `libtransport.so` until the storage channel is migrated.

Messaging configuration is explicit: endpoint, envelope and payload limits,
and send/receive timeouts are all required. Use the `bun-transport/messaging`
package export for the cluster API.

```bash
cd ../transport
zig build fixture
zig build -Dall=true -Doptimize=ReleaseFast

cd ../cruller-transport
bun test tests/messaging_smoke.test.ts
```
