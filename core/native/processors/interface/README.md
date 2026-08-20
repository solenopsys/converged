# processor

The shared half of every native processor. A processor binary supplies a
`Processor` — task JSON in, result JSON out — and this package supplies the
rest of the process.

## What it owns

- **Registration.** Dials Fujin as a peer under the NRPC service name.
- **Authorization.** Looks the inbound method up in the generated NRPC policy
  and runs the envelope's token through `transport.auth.receiver`.
- **Cache staging.** Pulls `inputs` cache refs into temp files, binds the
  `outputs` fields to temp files, and pushes what the processor wrote back into
  Valkey as new refs. Temp files are removed when the request ends.
- **Progress.** Forwards `Progress.emit` calls as server-stream chunks when the
  caller asked for a stream, and terminates the stream with the result.

## What it does not own

No task queue, no scheduling policy, no idle unloading, no second thread pool.
One request runs one native call. `Runtime` is configured with a single handler
thread, which keeps the reactor free to answer heartbeats during a long slice
while still serializing calls into a native library that is not reentrant.

## Modules

| File | Contents |
|---|---|
| `src/processor.zig` | The `Processor` and `Progress` contracts. |
| `src/serve.zig` | `Options` and `run` — the whole request path. |
| `src/cache.zig` | Valkey RESP client (`GET` to file, `SET` + `EXPIRE`) and the prefixed-env reader. |
| `src/json.zig` | Task-field readers with processor-owned defaults, file helpers. |

## Settings

Every setting is read as `<PREFIX>_<NAME>` first and as `<NAME>` second, so a
platform-wide value injected by the ptah operator works without per-processor
configuration while a single processor can still be pointed elsewhere.

| Name | Default |
|---|---|
| `FUJIN_ZMQ_ENDPOINT` | `tcp://127.0.0.1:5557` |
| `FUJIN_TARGET` | the NRPC service name |
| `VALKEY_HOST` / `VALKEY_PORT` | `127.0.0.1` / `6379` |
| `VALKEY_KEY_PREFIX` | `cache` |
| `VALKEY_TTL_SECONDS` | `1800` |

## Usage

```zig
try processor.run(init, engine.processor(), .{
    .service = nrpc.service,
    .policy_fn = nrpc.policy,
    .env_prefix = "CURAENGINE",
});
```

## Verification

```bash
zig build test
```
