# runtime — the RT virtual machine

A thin, fast, reliable Zig VM that **only runs flow**. It replaces the TS DAG/cron
engine (`back/runtime/engines`) with a sharper split of responsibilities:

| concern | old (TS in RT) | new |
|---|---|---|
| node business logic | node classes inside RT | **microservices** (see `MAPPING.md`) |
| branching / DAG flow | `Workflow` subclasses | **flow-only JS** run in QuickJS |
| durable state (vars, task memoisation, status) | ms-dag | **Valkey** (storage-integrated) |
| cron-expression parsing / scheduling | croner in RT | **scheduler microservice**; RT only runs the timer |
| workflow source | bundled TS | fetched from the **scripts microservice** |

The Zig side is deliberately dumb: it embeds QuickJS, runs a script, and gives that
script exactly four host primitives. Everything heavy (LLM calls, DB, cron math,
config) is on the other side of a network boundary. Zig never parses config and
never holds business logic — it executes.

## Model

```
            POST /run {script, params}            ┌─────────────────┐
 caller ───────────────────────────────────────► │   RT VM (Zig)   │
            (or the scheduler MS, on a period)    │  embeds QuickJS │
                                                  └───────┬─────────┘
   workflow JS (flow only) runs in QuickJS  ◄─────────────┘
        │  rt.call(service, method, params)  ──►  microservice (nrpc HTTP)
        │  rt.get(key) / rt.set(key, value)  ──►  Valkey
        │  rt.log(msg)
        └─ rt.node(name, fn): memoised DAG step (cached in Valkey, resume-safe)
```

The whole branching/DAG/finite-state-machine layer is the JS the workflow author
(or the nrpc-driven translator) writes. The prelude that defines `rt` lives in
`src/prelude.js`; the VM evaluates `prelude + <workflow source> + JSON.stringify(__run())`.

## Host primitives (the entire `rt` surface)

- `rt.call(service, method, params)` → nrpc POST `SERVICES_BASE/<service>/<method>`
- `rt.get(key)` / `rt.set(key, value)` → Valkey (values are opaque to Zig)
- `rt.log(message)`
- `rt.node(name, fn)` → a named, memoised step (skipped on resume if already done)
- `rt.llm({...})` → one chat completion via the Zig provider hub (see below)

## LLM provider hub (`rt.llm`)

`src/llm/` holds the provider layer: a uniform chat-completion contract
(`provider.zig`), three wire implementations — `openai.zig` (chat/completions),
`claude.zig` (messages), `gemini.zig` (generateContent) — and `hub.zig`, which
owns one long-lived HTTP client so TLS/keep-alive connections to the vendors
stay warm across calls. The uniform shapes mirror the TS ChatLLMProvider layer
(`rt-assistant/impls/providers/base.ts`), so workflows, tests and the old TS
runtimes all speak one dialect.

Everything is explicit — the VM never invents a provider, model or token
budget; the flow script decides, Zig transports:

```js
var res = rt.node("llm-round-0", function () {
  return rt.llm({
    provider: "openai" | "claude" | "gemini",   // required
    model: "gpt-5-mini",                        // required
    maxTokens: 2048,                            // required
    messages: [                                  // required
      { role: "system", content: "..." },
      { role: "user", content: "..." },
      // { role: "assistant", content, toolCalls: [{id,name,args}] }
      // { role: "tool", toolCallId, name, content }
    ],
    tools: [{ name, description, parameters }],  // optional
    temperature: 0.7,                            // optional
  });
});
// -> { provider, model, text, toolCalls: [{id,name,args}], finishReason,
//      usage: {input, output} }
```

Wrap every call in `rt.node(...)` — a completed LLM round is memoised in
Valkey and never re-paid on resume. `examples/workflows/wf-chat-turn.js` is
the reference agent loop (LLM → tools via `rt.call` → LLM), and
`test/bun/llm.test.ts` drives it against a mocked hub.

Providers register only when their key is present; calling an unregistered one
fails loudly with the env var to set:

| var | meaning |
|---|---|
| `OPENAI_API_KEY` | enables provider `openai` |
| `ANTHROPIC_API_KEY` (or `CLAUDE_API_KEY`) | enables provider `claude` |
| `GEMINI_API_KEY` | enables provider `gemini` |
| `RT_OPENAI_BASE_URL` / `RT_ANTHROPIC_BASE_URL` / `RT_GEMINI_BASE_URL` | optional endpoint overrides (proxies) |

## Configuration (env only — missing required values fail loudly, no defaults)

| var | meaning |
|---|---|
| `RT_BIND` | `host:port` to listen on (or pass as `argv[1]`) |
| `SERVICES_BASE` | microservice gateway base URL |
| `RT_STATE_BACKEND` | `memory` (local/test) or `valkey` |
| `VALKEY_HOST` / `VALKEY_PORT` | required when backend = `valkey` |
| `RT_SCHEDULER` | `on` to run the periodic launcher loop |
| `RT_SERVICE_TOKEN` / `RT_SCOPE` | optional nrpc auth / tenant headers |
| `*_API_KEY` | LLM providers (see the hub section above) |

## HTTP surface

```
GET  /healthz                 -> "ok"
POST /run   {"script","params"}  -> {"executionId","ok","result"|"error"}
```

## Cron

There is **no cron logic in Zig**. The scheduler microservice formalizes every
cron expression into a period and returns `sheduller.schedule()` →
`{ items: [ { script, params, periodMs } ] }` (see `examples/schedule.json`). With
`RT_SCHEDULER=on` the RT polls that list and launches each script when its period
elapses — a dumb timer, nothing more.

## Build & run

```bash
zig build                                   # native musl -> zig-out/{bin,lib}
# local glibc host:
RT_STATE_BACKEND=memory SERVICES_BASE=http://127.0.0.1:9888 \
  zig build -Dtarget=x86_64-linux-gnu run -- 127.0.0.1:9777
```

End-to-end smoke test (mock gateway + `examples/workflows/wf-demo.js`):

```bash
curl -s -X POST http://127.0.0.1:9777/run \
  -d '{"script":"workflows/wf-demo.js","params":{"name":"world","n":21}}'
# {"executionId":"exec-...","ok":true,"result":{"doubled":42,"memoised_equal":true,
#  "got":{"saved":true},"ping":{"echoedPath":"/demo/ping","echoedBody":{"x":21}}}}
```

## Translating workflows

`examples/workflows/wf-markering.js` shows the pattern: the old node classes
collapse into single `rt.call(...)` steps (node logic having moved into the owning
microservice per `MAPPING.md`), and only the flow — sequence, branches, error
handling — remains. These files belong to the scripts microservice; nrpc codegen
can emit them as a thin projection of the generated `g-*` metadata.

## Container

```bash
zig build -Dall -Doptimize=ReleaseSafe
podman build -f Containerfile -t runtime .
```
