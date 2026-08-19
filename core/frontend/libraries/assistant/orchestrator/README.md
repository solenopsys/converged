# orchestrator

A tiny, stateless step machine that turns one user utterance into an
`OrchestratorPlan` — either a plain answer, a function call with its result
("fact"), or "no function matched". It is the kernel that runs inside chat
hosts (browser tab, embed widget, CLI); it carries no history and no domain
knowledge, so the same code runs anywhere.

## Design invariants

- **No state.** The `Context` lives for exactly one `run()` and dies with it.
  Conversation history belongs to the gateway (keyed by session id); durable
  state belongs to centimanus. The orchestrator never accumulates anything
  across turns.
- **No domain knowledge.** Steps only ever talk to four ports (see below):
  `ask` (one LLM call), `prompt` (per-step system text), and the host's
  `OrchestratorCatalog` (function search/meta/invoke). The kernel never sees a
  UI component, a widget, or a payload — only ids, briefs, and facts.
- **No buffering, by reference not by value.** A step patches the context; it
  never grows an accumulator. A function result ("fact") is capped at
  `factLimitBytes` (default 8 KiB) — oversized results are rejected with an
  instruction to return a reference (id / cacheKey) instead of a payload.
- **Finite by construction.** `createMachine` walks the step table forward
  once. There is no scheduler, no graph, no retry loop, and no "go back" — a
  run costs at most `N` vendor round-trips, where `N` is the number of
  non-local steps. Anything needing branching/looping belongs in centimanus,
  not here.

## Ports (`types.ts`)

The machine is generic over `Context` and only depends on these shapes:

| Port | Shape | Purpose |
|---|---|---|
| `OneShotAsk` | `(step, system, user, tier, tools) => Promise<StepAnswer>` | One instruction, one utterance, no history. Talks to the gateway. |
| `StepPrompt` | `(step: string) => Promise<string \| undefined>` | Fetches a step's system prompt from ms-contexts, one section per step. |
| `OrchestratorCatalog` | `search / listCategories / meta / invoke / load?` | The host's function registry. Kernel sees ids, briefs, and facts — never views or components. |
| `Tier` | `"fast" \| "heavy" \| string` | Names a model *entity*, not a vendor model; the gateway resolves it to a pool, so one turn can mix models. |

A `Step<Context>` is a module with:

- `when?(context)` — skip the step entirely (no round-trip, no trace).
- `ask?(context)` — the user-turn text to send; returning `undefined` means
  the step is **local** (no vendor call, e.g. `search`/`invoke`).
- `tools?(context)` — the `ToolSpec[]` the model should answer with, so the
  answer arrives structured instead of as prose to parse.
- `apply(context, answer)` — returns `{ patch }` to continue, or
  `{ done: OrchestratorPlan }` to terminate the run. There is no "go back".

## The kernel (`machine.ts`)

`createMachine({ steps, ask, prompt, onStep, tier })` returns a `Machine` with
one method, `run(initial): Promise<OrchestratorPlan>`. It walks `steps` in
order:

1. Skip if `step.when` says so.
2. If `step.ask` returns text, call `askStep` — fetches the prompt, resolves
   the tier (`tier?.(name) ?? step.tier ?? "fast"`), calls `ask(...)`, and
   emits `onStep` traces (start/finish/error) for observability.
3. Always call `step.apply(context, answer)`.
4. `result.done` → return immediately. `result.patch` → merge into context
   (`{ ...context, ...patch }`) and continue.
5. Falling off the end of the table without a `done` is a wiring bug and
   throws — the kernel refuses to guess an outcome.

An empty model answer (no tool calls, no text) is also treated as a hard
error rather than silently downgraded to "no function needed", since that
would look like a real decision.

## The built-in flow (`steps.ts`)

`createFunctionSteps({ catalog, candidateLimit = 12, factLimitBytes = 8192 })`
builds the default five-step table used by `createOrchestrator`:

```
route → search → select → args → invoke
```

- **route** (LLM, tool call `route`) — classifies the utterance as
  `"function"` or `"answer"`, plus a free-text `area` used as a search query.
  `"answer"` ends the run immediately (`{ kind: "answer" }`) — one round-trip
  total for a plain question.
- **search** (local) — queries `catalog.search(area ?? userText, limit)`.
  Zero hits ends the run as `{ kind: "function-missed" }`. Exactly one
  candidate skips straight to `args` (no `select` round-trip). The top
  candidate is spec-loaded (`catalog.load`) while the model still builds
  arguments.
- **select** (LLM, tool call `select`, skipped `when id` is already known) —
  picks one id from the candidate list via an `enum` tool schema. An id the
  model invents (not in the candidate list) is treated as a miss, not a call
  — better to under-call than to call the wrong function.
- **args** (LLM, tool call `call`, skipped when the function needs no
  arguments) — if the host published a JSON-Schema for the function
  (`meta.parameters`), the tool *is* the function itself, so the model fills
  real parameters directly instead of describing them in prose.
- **invoke** (local, terminal) — calls `catalog.invoke(id, args)`. Both
  success and failure become `{ kind: "function", id, args, fact }` — a
  failed call is a fact for the answer step to explain, not a thrown error
  out of the run. The fact is size-capped (`cap()`); an oversized result is
  replaced with an error fact instructing the host to return a reference
  instead.

Answer parsing goes through `structured()`: prefer the model's own tool call
by name, and fall back to parsing its prose as JSON (`json.ts`) — light
models sometimes wrap JSON in code fences or ignore the tool schema.

## Composition (`index.ts`)

`createOrchestrator({ ask, prompt, catalog, onStep, tier, steps? })` wires a
`createMachine` over `createFunctionSteps({ catalog })` by default, and
exposes a single `plan(userText): Promise<OrchestratorPlan>`. Passing a
custom `steps` table replaces the built-in flow entirely — this is the
extension point; a host with a different scenario composes its own table
instead of patching the kernel.

`emptyCatalog` is exported for hosts with nothing to call (e.g. a
third-party embed widget): `search`/`listCategories` return empty and the run
ends at `search`, costing exactly one vendor round-trip (`route`) for any
input.

## Transport binding (`resonus-session.ts`)

`createResonusSession({ transport, sessionId?, endpoint?, endpointForTier?,
maxTokens? })` implements `OneShotAsk` on top of a Resonus
`ResonusCommandTransport` (`command` + `stream`). It is the one piece that
knows about a real LLM gateway:

- Lazily opens a session (`session.open`) and binds tier→endpoint pairs
  (`session.bind`), reusing bindings by session id across steps that select
  different tiers in the same turn.
- Per call: writes `system`/`user` as messages (`message.put`), creates a
  short-lived `context.create` with just those two message ids, streams
  `llm.generate`, and always tears the context down (`context.delete`) in a
  `finally` — no context outlives one step.
- Folds the event stream into a `StepAnswer`: `text.delta` appends prose,
  `tool_call.ready` appends a `StepToolCall`, `response.error` throws.

This module is the only place `Tier` becomes a concrete endpoint string,
and the only place the machine's abstract `ask` port touches a wire protocol.

## Block diagram

```
                         ┌────────────────────────────────────────┐
                         │              Host application            │
                         │  (browser tab / embed widget / CLI)       │
                         └───────────────┬────────────────────────┘
                                          │ userText
                                          ▼
┌──────────────────────────── createOrchestrator ─────────────────────────────┐
│                                                                              │
│   ┌──────────────┐        run({ userText, candidates: [] })                 │
│   │  Machine      │◄─────────────────────────────────────────┐             │
│   │ (machine.ts)  │                                           │             │
│   └──────┬───────┘                                            │             │
│          │ walk step table forward, once                      │             │
│          ▼                                                     │             │
│   ┌─────────────────────────────────────────────────────────┐ │             │
│   │        Step table  (steps.ts, or a custom table)         │ │             │
│   │                                                            │ │             │
│   │   ┌───────┐    ┌────────┐    ┌────────┐    ┌──────┐    ┌────────┐      │ │
│   │   │ route │───►│ search │───►│ select │───►│ args │───►│ invoke │      │ │
│   │   │ (LLM) │    │(local) │    │ (LLM)  │    │(LLM) │    │(local) │      │ │
│   │   └───┬───┘    └───┬────┘    └───┬────┘    └──┬───┘    └───┬────┘      │ │
│   │       │ "answer"   │ 0 hits      │ bad id      │            │            │ │
│   │       ▼            ▼             ▼             │            ▼            │ │
│   │   {kind:answer}  {kind:function-missed}     (skip if id known/no args)  │ │
│   │                                                              │            │ │
│   │                                                    {kind:function, fact} │ │
│   └─────────────────────────────────────────────────────────┬──┘             │
│                                                               │ OrchestratorPlan
│          ┌────────────────────────┬────────────────────────┐│                │
│          ▼                        ▼                        ▼│                │
│   ┌─────────────┐          ┌─────────────┐          ┌──────────────┐        │
│   │  ask port    │          │ prompt port │          │ catalog port  │        │
│   │ (OneShotAsk) │          │(StepPrompt) │          │(Orchestrator- │        │
│   │              │          │             │          │   Catalog)    │        │
│   └──────┬───────┘          └──────┬──────┘          └──────┬───────┘        │
└──────────┼──────────────────────────┼───────────────────────┼────────────────┘
           │                          │                        │
           ▼                          ▼                        ▼
  ┌──────────────────┐      ┌──────────────────┐     ┌──────────────────────┐
  │ resonus-session.ts │      │   ms-contexts     │     │  host function        │
  │ session.open/bind  │      │ (per-step system  │     │  registry (search /   │
  │ message.put        │      │  prompt sections) │     │  meta / invoke /      │
  │ context.create      │      └──────────────────┘     │  load)                │
  │ stream llm.generate │                                └──────────────────────┘
  │ context.delete       │
  └──────────┬───────────┘
             │
             ▼
     ┌───────────────┐
     │  Resonus       │
     │  gateway → LLM │
     │  vendor pool    │
     └───────────────┘
```

## Files

| File | Role |
|---|---|
| `types.ts` | Ports and shared shapes: `Tier`, `Step`, `StepAnswer`, `OrchestratorCatalog`, `OrchestratorPlan`, `PlanContext`. |
| `machine.ts` | The kernel: `createMachine` walks a step table once, no state, no domain knowledge. |
| `steps.ts` | Built-in `route → search → select → args → invoke` flow (`createFunctionSteps`). |
| `index.ts` | Composition root: `createOrchestrator`, `emptyCatalog`, re-exports. |
| `resonus-session.ts` | `OneShotAsk` implementation over a Resonus command/stream transport. |
| `json.ts` | Best-effort JSON-object extraction from model prose (fence, raw, first-`{`-to-matching-`}`). |
| `machine.test.ts`, `resonus-session.test.ts` | Unit tests for the kernel and the transport binding. |
