# rp-events

## Purpose

The shared business-event bus journal: any domain publishes "what happened"
here without knowing its consumers. Orders, requests, equipment, payments —
all speak one event language.

## Mental model

Producer emits a typed event (kind, entity, time, payload) → it lands on the
shared feed. Consumers (workflow triggers, notifiers, analytics) subscribe
by kind and react. Publisher never calls the consumer directly.

## Ecosystem value

Decoupling point for state changes:

- Typed business events published once and listed back behind one API.
- Any domain records "what happened" without knowing its readers.

## Non-goals

- Not the raw log tape.
- Not counters or aggregates.
- Not workflow execution itself.
## Responsibility boundary

Owns event creation, storage, and retrieval; does not own consumer-side
business processing or workflow execution.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/repositories/business/rp-events`
