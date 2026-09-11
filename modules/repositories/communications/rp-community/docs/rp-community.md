# rp-community

## Purpose

Forum structure and ownership: sections, topics, who wrote them and who may see
them. The discussion under a topic is not here — a topic carries a `threadId`
and the messages live in `rp-threads`.

## Responsibility boundary

Owns sections and topics. Does not call `rp-threads` or any other repository:
`createTopic` mints a `threadId` and hands it back, and the caller registers the
thread and writes the opening post itself.

## Identity and authorship

`createdBy` is never accepted from a caller. It is read from the verified token
through `getCurrentWorkspaceContext()`, which `messaging-backend` prefers over
anything the envelope claims. Topic and thread ids are minted here for the same
reason — an id a client can choose is an id it can steal, and the access-tag
table records no object type to catch the collision.

## Visibility

Sections and topics carry a `visibility` column (`public` | `authenticated` |
`private` | `tagged`), and a new topic inherits its section's value unless it
asks for something narrower. The tags behind `tagged` belong in the shared
`access_tags` relation described in `access-control.md`; that half is not
implemented yet, so today `visibility` is recorded but not enforced.

## Locking

`touchTopicActivity` is the only place a lock can be enforced: `rp-threads`
accepts a message without knowing topics exist, so a screen calls this after
posting and treats a refusal as a failed post.

## Direct module dependencies

- `back-core`, `nrpc`, `g-community`

## Solution membership

- `communications`

## Source

`modules/repositories/communications/rp-community`
