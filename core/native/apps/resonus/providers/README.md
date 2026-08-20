# resonus-providers

Provider descriptors for the resonus gate: the vendor-specific half of talking
to an LLM gateway, authored in TypeScript and built into artifacts the Zig core
loads.

Adding a provider is one file here plus a line of configuration. No Zig changes,
no rebuild of the gate.

## The split

A descriptor has two parts, divided by one question: how often does it run?

| | What | Runs | Where it ends up |
| --- | --- | --- | --- |
| **Decode table** | Which vendor event means what, and which field carries the value | Per event | `dist/<name>.table.json`, executed by Zig |
| **Warm hooks** | Request encoding, terminal-response decoding, session config | Per turn / per socket | `dist/hooks.js`, evaluated in QuickJS |

The table is data, not code. The core parses each vendor event once with its own
JSON reader, looks the event type up in a table built at startup, and copies
fields by path. No JavaScript runs on the event path, so a payload is never
parsed or serialized twice.

The hooks are ordinary functions, because request encoding has real logic in it —
Anthropic's tool results become content blocks, Gemini's assistant turns become
`model` turns — and because at once-per-turn frequency a JS call costs nothing
worth measuring.

Anything the table cannot express is referenced from it by name and implemented
as a hook. `openai-realtime` is the only descriptor that needs this: its
`response.done` requires a filtered walk over an array, which a dotted path
cannot address. It fires once per turn, never per delta.

## Layout

```
src/
  schema.ts                 the contract: types + defineProvider
  core.ts                   logic shared by every provider
  validate.ts               build-time validation, loud and specific
  build.ts                  the builder
  providers/
    <name>.ts               descriptor: transport + decode table (data)
    <name>.hooks.ts         business logic, and nothing else
  qjs.test.ts               runs the built bundle through the real QuickJS .so
```

`core.ts` holds what is genuinely identical across vendors: joining system
messages, building the uniform completion, the empty tool schema, parsing
vendor-sent argument text. Keeping that list short is deliberate — a shared
module in a plugin system attracts anything that looks reusable, and once one
vendor's quirk sits behind a flag in a shared function, the next one gets a
second flag and the descriptors stop being readable on their own.

`encodeTool` and `encodeMessage` stay per-provider for exactly that reason. They
differ in every vendor, and unifying them would mean a shared function switching
on its caller — the same coupling descriptors exist to remove, only harder to
see.

Descriptor and hooks are separate files on purpose. The bundle entry imports
only `<name>.hooks.ts`, so the transport config and decode table physically
cannot end up inside the script the engine loads. That property comes from the
file layout rather than from the bundler's tree-shaking, which is why it is
worth the extra file.

Hook files import types only. Nothing else belongs in them: whatever reaches
QuickJS should be business logic, and anything heavy stays in Zig.

## Build

```bash
bun run build     # -> dist/
bun run check     # validate descriptors, write nothing
bun test          # execute the built bundle in the real QuickJS wrapper
```

`bun test` needs the wrapper built once:

```bash
cd ../../../wrappers/rt/qjs && zig build
```

## Output

```
dist/
  <name>.table.json   transport + decode table, with the hook names it may call
  hooks.js            every provider's hooks, one IIFE, reachable as
                      globalThis["<provider>__<hook>"]
  manifest.json       provider index with sha256 of every artifact
```

Hooks share one ABI: a JSON array of arguments in, a JSON string out. The
builder's wrapper owns that encoding, so a hook stays ordinary TypeScript and
the core never has to know which of them happens to return a string.

## Rules

**Validation is a build step, not a runtime hope.** A descriptor that would not
load fails `bun run build`. The core then re-validates on load and refuses an
`apiVersion` it does not know, rather than skipping rules it cannot execute and
decoding a turn wrong.

**`stateful` is never defaulted.** It says whether the vendor keeps conversation
state on the connection, which decides if the pool may hand a warm connection to
a different session. Guessing it wrong is a cross-session leak, not a slow path.

**Secrets do not enter the sandbox.** A descriptor writes
`"authorization": "Bearer ${secret:openai}"`; the core substitutes the value
before the request goes out. The key never reaches JavaScript.

**Paths are plain.** `a.b.c`, with numeric segments indexing arrays. No filters,
no wildcards, no predicates. A selection that needs one goes in a hook — the
alternative is growing a query language inside JSON, and that road ends at a
worse JavaScript.
