# rp-threads

## Purpose

The single conversational layer of the ecosystem: any module where people
or agents exchange messages keeps no messages of its own — it holds a
`threadId`, and the dialogue itself lives here.

## Mental model

Entity (chat room, forum topic, call, request) stores only a `threadId`.
All messages, ordering, and context live in the thread. Creating an entity
= minting a `threadId` and handing it to the caller, which registers it.

## Ecosystem value

One dialogue format everywhere:

- Threads and ordered messages behind one API, keyed by opaque thread id.
- Any entity attaches a discussion without its own message tables.

## Non-goals

- Not chat rooms or forum topics — only the message threads behind them.
- Not notification delivery or dialogue summaries.
## Responsibility boundary

Owns thread lifecycle, message ordering and thread-level metadata; does
not own rooms/topics, membership, or transport gateways for
email/SMS/push.

## Direct module dependencies

- None

## Solution membership

- `ai`

## Source

`modules/repositories/communications/rp-threads`
