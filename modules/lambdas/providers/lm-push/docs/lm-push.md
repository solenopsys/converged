# lm-push

## Purpose

Push leg of the shared notification fan-out: web/mobile push transport behind the rp-notify contract.

## Ecosystem value

Real-time nudges for chats, orders, requests — delivered alongside email/SMS from a single notify intent.

## Non-goals

No targeting or business logic — that is rp-notify and the calling domain.


## Responsibility boundary

Owns push provider integration details; does not own notification business targeting logic.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/lambdas/providers/lm-push`
