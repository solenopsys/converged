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

- `rp-staff`, `rp-chats`, `rp-orders`, `rp-requests` — all link the same
  profile, so renaming or deactivating hits everywhere at once.
- Team invites and onboarding (`wf-team-invite`) create the identity once;
  roles and permissions attach later via `rp-access`.
- AI contexts and threads resolve authors against one registry instead of
  per-module user tables.

## Non-goals

- Not login or sessions — that is `rp-auth`.
- Not permissions — that is `rp-access`.
- Not org structure or staffing semantics — that is `rp-staff`.

## Responsibility boundary

Owns identity records and identity lifecycle state; does not own
fine-grained permission policies or authentication flows.

## Direct module dependencies

- None

## Solution membership

- `security`

## Source

`modules/repositories/sequrity/rp-identity`
