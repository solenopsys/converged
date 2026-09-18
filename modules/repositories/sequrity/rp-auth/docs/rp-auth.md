# rp-auth

## Purpose

The single front door for proving "who you are": sessions, credentials, and
token issuance for the whole ecosystem. No domain runs its own login.

## Mental model

User presents credentials → auth validates and issues a session/token →
every downstream call carries it and the access layer decides what it may do.
Login proves identity; permissions are a separate layer.

## Ecosystem value

One login backend for every surface:

- Magic links, refresh sessions and OAuth client records in one place.
- Any frontend signs users in the same way instead of its own session tables.

## Non-goals

- Not permission policies.
- Not user profile records.
## Responsibility boundary

Owns auth flows and token/session issuance logic; does not own third-party
OAuth provider adapters or authorization policy evaluation.

## Direct module dependencies

- None

## Solution membership

- `security`

## Source

`modules/repositories/sequrity/rp-auth`
