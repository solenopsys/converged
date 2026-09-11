# sf-chats

## Purpose

Chat rooms, as three separate tabs: the room list, one room's conversation, and
one room's membership. Managing who is in a room and reading what they said are
two jobs and therefore two tabs.

## Responsibility boundary

Owns room navigation, the conversation screen and membership editing. Messages
belong to `rp-threads`, read directly from the browser; files belong to
`rp-files` through a `link` message.

## How a room is created

`createRoom` on `rp-chats` mints the room id and the thread id and records the
creator from the token as `owner`; this surface then registers the thread with
`rp-threads`. `rp-chats` never calls another repository.

## Live updates

A new message is published to each member by name over Fujin's `pushrouter`,
never to the whole tenant: a private room's existence is not public even when
its contents stay behind the read predicate. The push carries identifiers only.

## Direct module dependencies

- `effector`, `front-core`, `g-chats`, `g-threads`, `signal-channel`, `threads-state`

## Solution membership

- `communications`

## Source

`modules/surfaces/communications/sf-chats`
