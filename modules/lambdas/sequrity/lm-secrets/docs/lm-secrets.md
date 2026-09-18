# lm-secrets

## Purpose

The shared secret vault adapter: named secret values for the whole
platform behind one contract. Services read config secrets here instead of
env-sprawl or per-module vault clients.

## Mental model

Service asks by secret name → gets the value. Rotation happens in one
place and propagates to every consumer. Storage backend details stay behind
the contract.

## Ecosystem value

One vault door for all:

- Provider credentials (SMTP, SMS, SES, push), OAuth client secrets,
  integration tokens — same get/set/delete shape.
- `rp-notify` and all `lm-*` provider adapters resolve credentials here
  instead of hardcoding them.
- Rotation and revocation are platform-wide, not per-service hunts.

## Non-goals

- Not identity or permissions — that is `rp-identity` / `rp-access`.
- Not session issuance — that is `rp-auth`.

## Responsibility boundary

Owns storing, retrieving, and deleting named secret values; does not own
identity, permissions, or session logic.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/lambdas/sequrity/lm-secrets`
