# rp-events

## Purpose

The shared business-event bus journal: any domain publishes "what happened"
here without knowing its consumers. Orders, requests, equipment, payments —
all speak one event language.

## Mental model

Producer emits a typed event (kind, entity, time, payload) → it lands on the
shared feed. Consumers (`rp-dag` triggers, `rp-notify`, analytics) subscribe
by kind and react. Publisher never calls the consumer directly.

## Ecosystem value

Decoupling point of the whole platform:

- Domains (orders, requests, equipment, billing) publish state changes once
  instead of calling five consumers.
- `rp-dag` triggers fire workflows off bus topics ("order finished → ask for
  review") with no hard dependency on the publishing domain.
- `rp-notify` fans events out to email/SMS/push; analytics (`rp-counters`,
  `rp-logs`) record them — new consumers plug in without touching producers.

## Non-goals

- Not the raw log tape — that is `rp-logs`.
- Not counters or aggregates — that is `rp-counters`.
- Not workflow execution itself — that is the runtime + `rp-dag`.

## Responsibility boundary

Owns event creation, storage, and retrieval; does not own consumer-side
business processing or workflow execution.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/repositories/business/rp-events`
