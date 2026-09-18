# rp-access

## Purpose

The shared authorization layer: every `rp-*` asks here "may this actor do
this" instead of inventing its own permission checks. One permission tree,
one evaluation rule, enforced before any handler runs.

## Mental model

Two questions, two layers: method access ("may call X at all") is held in
the permission tree and enforced by the guard; object access ("which rows
does the call return") is evaluated per entity. Without the first, anyone
could call `deleteTopic`.

## Ecosystem value

Single trust root for the platform:

- All repositories delegate auth decisions here — adding a role or scope
  upgrades every module at once.
- `rp-auth` proves who you are, `rp-identity` says what you are, this module
  decides what you may do — clean split, no overlaps.
- Moderation, multi-tenancy, per-object visibility (e.g. published vs draft
  reviews) all read from the same tree.

## Non-goals

- Not identity proofing or login — that is `rp-auth` / `rp-oauth`.
- Not identity profiles — that is `rp-identity`.
- Not secret storage — that is `lm-secrets`.

## Responsibility boundary

Owns authorization policy evaluation and access scopes; does not own
identity proofing/authentication login.

## Direct module dependencies

- None

## Solution membership

- `security`

## Source

`modules/repositories/sequrity/rp-access`
