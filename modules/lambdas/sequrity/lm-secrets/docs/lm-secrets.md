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

- Provider credentials, integration tokens, OAuth secrets — same get/set/delete shape.
- Any consumer keeps secrets out of code and config; rotation happens in one place.
- New integrations need no new secret plumbing.

## Non-goals

- Not authentication or permission checks.
- Not user identity records.
## Responsibility boundary

Owns storing, retrieving, and deleting named secret values; does not own
identity, permissions, or session logic.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/lambdas/sequrity/lm-secrets`
