# Processors

A processor is one native workload behind one NRPC method. It dlopens a single
wrapper library, answers `analyze`, and does nothing else.

```text
                 workflow / CLI
                       |  NRPC (service = processor name)
                       v
                    Fujin
             +---------+---------+
             |                   |
   curaengine processor    opencamlib processor
   libcuraengine.so        libopencamlib.so
             |                   |
             +---------+---------+
                       |  cache refs
                     Valkey
```

| Package | Role |
|---|---|
| [`interface`](interface) | Shared runtime: Fujin registration, NRPC authorization, cache staging, progress streaming. |
| [`curaengine`](curaengine) | 3D-print slicing. Contract: [`types/curaengine.ts`](../types/curaengine.ts). |
| [`opencamlib`](opencamlib) | CAM/milling estimates. Contract: [`types/opencamlib.ts`](../types/opencamlib.ts). |

## Why processes and not plugins

These two used to be plugins inside one hub process, with an in-memory task
queue, per-plugin worker threads, idle unloading, and a QuickJS policy that
decided `start` / `defer` / `cancel`. Every one of those decisions now has a
better owner: how many instances run and when they restart is the ptah
operator's (Deployment replicas), which instance gets a request is Fujin's, and
a crash in the C++ of one slicer can no longer take the other one down.

What remains per processor is an FFI struct, a task schema, and a `main` that
names its library — roughly 200 lines each. Everything else is `interface`.

## Contract

One method, `analyze`, and the same envelope for both processors:

```json
{
  "task": { "toolDiameter": 6 },
  "inputs": { "stlPath": "cache:files:abc" },
  "outputs": ["gcodePath"],
  "stream": true
}
```

Heavy bytes never ride the wire. `inputs` maps a task field to a Valkey
cacheKey, which the processor GETs into a temp file and binds to that field;
`outputs` lists the task fields the processor writes as files, which are SET
back and returned as cache refs. A task carrying plain local paths (the CLI on
the same host) is used as-is. The reply is always:

```json
{ "result": { }, "outputs": { "gcodePath": { "cacheKey": "…", "sizeBytes": 0 } } }
```

`stream: true` opts into a server-stream: progress events arrive as chunks and
the final chunk (`fin`) carries the payload above. Unary callers — the RT
engine's `rt.call` reads exactly one response — omit it and get the same
payload as a plain response.

## Adding a processor

1. Write `../types/<name>.ts` with a `Runtime<Name>Service` interface.
2. Generate the Zig descriptor:
   ```bash
   cd ../../tools/nrpc
   bun run src/zig-generator.ts ../../native/types/<name>.ts \
     ../../native/processors/<name>/src/generated/<name>_nrpc.zig
   ```
3. Implement a `Processor` (`start` / `stop` / `execute`) over the wrapper.
4. `main` hands it to `processor.run` with the generated `service` and `policy`.
5. Add the image to `Platform.spec.apps` so the operator raises it.
