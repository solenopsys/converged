# assistant-state

The stateful half of the chat assistant. Where `orchestrator` is a pure,
one-shot "given this message, what's the plan?" calculator, this library owns
everything that actually persists across a conversation: message history,
streaming state, active tool calls, session identity, and the loop guards
that keep an agentic turn from running forever.

It is built as an Effector store plus a handful of framework-agnostic
adapters, so the same store logic drives a browser tab, an embedded widget,
or a CLI — only the adapters (transport, threads persistence, file uploads)
differ per host.

## Two loops in one turn

A user message triggers two independent things, run side by side:

1. **Persist + plan.** The message is saved to the threads service, and (if a
   planner is wired in) handed to the orchestrator for a quick "is this a
   function call?" pass. If it resolves to a function, its result becomes a
   *fact* string threaded into the model's next message, plus a small "step
   card" shown inline in the chat.
2. **Assistant turn.** The message (with the fact appended, if any) is sent
   to the model as a streaming conversation. The model can talk, or call
   tools; every tool call that comes back through the stream is executed
   locally and its result is sent back to the model as a new message — the
   model may then call again. That is the actual agentic loop.

The planner and the agentic loop use two different mechanisms for the same
underlying idea ("let the model do something, not just talk"): the planner
is one bounded pre-pass through `orchestrator`, while the live loop is
open-ended tool calling during the streamed response.

## Why the loop needs guards

An agentic tool-calling loop only stops when the model decides to answer
instead of calling again. Nothing guarantees it will — a tool call whose
result the model can't act on (e.g. it always needs data it isn't allowed to
see) makes the model call again, forever. Two ceilings close that off:

- **A budget over the whole turn** — after N tool calls without a final
  answer, the turn is stopped outright.
- **A repeat count** — the same tool called with the same arguments more than
  a couple of times ends the turn instead of feeding the model another
  identical result.

When either fires, the turn ends *without* sending the model a tool result —
that's what breaks the loop, since answering is what would start the next
round.

## State shape

The chat store holds one flat state object per thread: identity (thread,
session, service/model/context/language), the message list, the in-flight
streaming buffer, and the set of pending tool calls plus the loop guard
counters. Messages carry enough shape to render as chat bubbles, running
tool-call cards, or file-upload cards — the UI layer just reads state, all
the transitions happen through events.

Two side stores exist beside the chat state itself:

- a **function registry**, mapping tool name → executable handler, so tools
  can be registered dynamically per host instead of being hardcoded;
- a **turn guard**, reset on every new user message, tracking round count and
  call signatures for the loop-breaking logic above.

## Tool surfaces

On top of the raw "register a function, it becomes a model tool" primitive,
this library ships a few pre-built tool sets a host can drop in:

- a **function-catalog** tool set (`listFunctions` / `describeFunction` /
  `invokeFunction`) that lets the model search a large function catalog
  on demand instead of needing every function description in context up
  front — useful when the catalog is too big to inline;
- a thin **UI-action** wrapper around the same catalog shape, for hosts whose
  "functions" are actually UI actions (with legacy tool names for
  backward compatibility);
- a **file-analysis** tool that kicks off a CNC/3D-print analysis workflow
  for uploaded files and returns its result;
- a small **uploaded-files** tool so the model can list what's already in the
  chat.

## Transport

The store talks to the model through a `RuntimeAssistantService` interface
(create a session, stream a conversation) — an adapter implements this over
whatever wire protocol the host actually has (e.g. an NRPC signal channel).
A second, separate adapter implements orchestrator's own transport port
(command/stream) over the same kind of channel, since the orchestrator's
one-shot planning calls and the chat's long-lived streaming session are two
different protocols riding the same connection.

## What lives where

- The step-machine logic itself (route/search/select/args/invoke) is *not*
  in this library — it lives in `orchestrator`, kept free of Effector and
  transport code so it runs identically in every host.
- This library owns the two host-side adapters orchestrator needs (a
  transport-backed `ask`, and a mapping from its plan into a turn's fact +
  card), plus everything about being a *stateful, running chat*: history,
  streaming, tool execution, and the loop guards.
