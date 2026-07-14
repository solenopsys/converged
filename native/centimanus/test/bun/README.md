# RT VM bun test harness

Run **compiled workflows on the real step-driven DAG engine**, answering their
microservice calls with plain TS handlers — no sockets, no microservices, no
container. The engine is loaded as a C library (`librt-mock.so`) via `bun:ffi`,
same pattern as `native/behemoth/bun-transport`.

## How it works

`librt-mock.so` is the real `vm.zig` core wired to a mock transport
(`src/testlib.zig`): `rt.call` is forwarded to a JS callback you register, and
`rt.get/set` are routed to a **TS `Map` — the Valkey stand-in shared by the
engine and your mocked microservices**. So a workflow executes exactly as in
production — one node per step, same memoisation and branching — and the mocked
services exchange heavy data by reference (CacheRef) through that same cache.

The handler signature is `(service, method, params, cache)`; the run result
includes the final `cache` so you can assert on what the services exchanged
(see the "passes heavy data by reference" test).

## Build & run

```bash
# build the library for your local (glibc) bun
zig build mock -Dtarget=x86_64-linux-gnu

# run the tests
bun test test/bun/example.test.ts
```

`centimanus-mock.ts` exposes:

```ts
runWorkflow(source, params, handler) // -> { ok: true, result } | { ok: false, error }
runOk(source, params, handler)       // asserts ok, returns result
```

`source` is the compiled workflow JS (what `bun build` emits from a TS workflow).
`handler(service, method, params)` returns the mock result for each `rt.call`;
throw to simulate a microservice failure.

See `example.test.ts` for a full flow, a branch, and a failure case.
