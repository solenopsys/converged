# lm-smtp

## Purpose

SMTP leg of the shared notification fan-out: plain provider transport behind the rp-notify contract.

## Ecosystem value

Domain emits a notify intent once via rp-notify → this adapter delivers over SMTP. Swapping or adding email providers never touches domains.

## Non-goals

No channel policy, retries, or templates — that is rp-notify and the calling domain.


## Responsibility boundary

Owns SMTP transport and protocol-level delivery handling; does not own high-level notification orchestration.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/lambdas/providers/lm-smtp`
