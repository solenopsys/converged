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

- `rp-chats`: a room holds a `threadId` — the conversation moves with the
  room, membership changes never touch messages.
- `rp-community`: a forum topic holds a `threadId` — discussion under the
  topic with no duplicated message tables.
- Calls, requests, orders: comments and correspondence attach via the same
  `threadId` — dialogue belongs to the entity, not vice versa.
- AI: dialogue summaries (`wf-dialogue-summary`) and the assistant read the
  same thread instead of one adapter per chat.

## Non-goals

- No rooms, roles, or forum sections — that is `rp-chats`, `rp-community`.
- No transport: email/SMS/push delivery is `rp-notify` + `lm-*`.
- Calls nobody: thread registration is the calling repository's duty.

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
