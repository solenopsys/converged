# lm-ses

## Purpose

SES leg of the shared notification fan-out: AWS email transport behind the rp-notify contract.

## Ecosystem value

Bulk and transactional mail (review invites, order updates, team invites) flow through one SES integration. Credentials resolve via lm-secrets.

## Non-goals

No channel policy or templates — that is rp-notify and the calling domain.


## Responsibility boundary

Owns SES-specific sending integration and mapping; does not own email template authoring domain.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/lambdas/providers/lm-ses`
