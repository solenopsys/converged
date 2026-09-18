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

Single trust root for decisions:

- Permission tree, presets, tags and issued tokens live in one place.
- Any service checks the same tree instead of growing its own policy tables.

## Non-goals

- Not login or session issuance.
- Not secret storage.
## Responsibility boundary

Owns authorization policy evaluation and access scopes; does not own
identity proofing/authentication login.

## Direct module dependencies

- None

## Solution membership

- `security`

## Source

`modules/repositories/sequrity/rp-access`
