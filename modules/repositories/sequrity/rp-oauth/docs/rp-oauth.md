# rp-oauth

## Purpose

OAuth grant flows and token exchange with third-party providers. Terminates in rp-auth sessions; permissions stay in rp-access.

## Responsibility boundary

Owns OAuth grant handling and token exchange; does not own non-OAuth login, sessions, or authorization policy.

## Direct module dependencies

- None

## Solution membership

- `security`

## Source

`modules/repositories/sequrity/rp-oauth`
