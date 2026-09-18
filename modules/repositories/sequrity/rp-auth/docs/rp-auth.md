# rp-auth

## Purpose

The single front door for proving "who you are": sessions, credentials, and
token issuance for the whole ecosystem. No domain runs its own login.

## Mental model

User presents credentials → auth validates and issues a session/token →
every downstream call carries it and `rp-access` decides what it may do.
Login proves identity; permissions are a separate layer.

## Ecosystem value

One login for every surface:

- All `sf-*` frontends and `rp-*` backends trust the same sessions —
  staff, customers, and agents sign in once.
- Team invites (`wf-team-invite`), OAuth handshakes (`rp-oauth`), and
  service accounts all terminate here.
- Rotating or revoking a session instantly cuts access platform-wide.

## Non-goals

- Not fine-grained permissions — that is `rp-access`.
- Not OAuth provider handshakes — that is `rp-oauth`.
- Not identity profiles and attributes — that is `rp-identity`.

## Responsibility boundary

Owns auth flows and token/session issuance logic; does not own third-party
OAuth provider adapters or authorization policy evaluation.

## Direct module dependencies

- None

## Solution membership

- `security`

## Source

`modules/repositories/sequrity/rp-auth`
