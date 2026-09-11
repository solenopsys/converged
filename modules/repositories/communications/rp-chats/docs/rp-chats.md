# rp-chats

## Purpose

Chat rooms, their membership and their per-room contexts. The conversation
itself is not here: a room carries a `threadId` and the messages live in
`rp-threads`.

## Responsibility boundary

Owns rooms, roles and contexts. Calls no other repository — `createRoom` mints
the `threadId` and returns it, and the caller registers the thread.

## Identity and access

The caller comes from the verified token, never from a parameter. Two
consequences worth naming:

- `listRooms` is scoped to the caller inside the query, so substituting another
  user's id no longer reads their rooms, and `totalCount` cannot leak the number
  of rooms it hid;
- anything addressing one room by id checks membership first.

`chart_room_users` stays even after `access_tags` arrives: a tag expresses
membership but not `owner` versus `admin` versus `member`.

## Note on table names

The tables are spelled `chart_rooms` / `chart_room_users`. The typo is
consistent across migrations, entities and queries, so the code works; renaming
is a migration, not an edit.

## Direct module dependencies

- `back-core`, `nrpc`, `g-chats`

## Solution membership

- `communications`

## Source

`modules/repositories/communications/rp-chats`
