# lm-sms

## Purpose

SMS leg of the shared notification fan-out: provider transport behind the rp-notify contract.

## Ecosystem value

Urgent pings (incidents, invite codes, status changes) reach phones while other channels carry the long form. Same intent API as email/push.

## Non-goals

No campaign or segmentation rules — the calling domain decides.


## Responsibility boundary

Owns SMS provider connectivity and payload formatting; does not own campaign/business segmentation rules.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/lambdas/providers/lm-sms`
