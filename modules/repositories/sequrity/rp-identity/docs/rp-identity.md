# rp-identity

## Purpose

The shared profile registry: one identity record per person or service
account, linked from every domain. Orders, chats, staff cards — all point
at the same profile instead of copying names and attributes.

## Mental model

Identity = stable record (id, core attributes, lifecycle state). Domains
store the identity id and read attributes on demand; they never fork the
profile. Auth proves the identity, access checks it, domains reference it.

## Ecosystem value

One "who" for the platform:

- User records, auth-method links and invites in one place.
- Any domain stores an opaque user id and reads attributes on demand instead of forking profiles.

## Non-goals

- Not login or sessions.
- Not permissions.
- Not org structure or staffing semantics.
## Responsibility boundary

Owns identity records and identity lifecycle state; does not own
fine-grained permission policies or authentication flows.

## Direct module dependencies

- None

## Solution membership

- `security`

## Source

`modules/repositories/sequrity/rp-identity`
