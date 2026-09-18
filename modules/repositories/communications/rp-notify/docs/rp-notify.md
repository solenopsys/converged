# rp-notify

## Purpose

The single notification fan-out of the ecosystem: any domain says "tell the
user" once, and this module picks channels, policy, and retries. Domains
never touch SMTP/SMS/push APIs directly.

## Mental model

Domain emits a notification intent (who, what, template, urgency) → notify
resolves channels and delivery policy → provider adapters (`lm-smtp`,
`lm-ses`, `lm-sms`, `lm-push`) do the actual sending. Retries and channel
fallback live here, message meaning lives in the domain.

## Ecosystem value

One "tell the user" path for all:

- Requests, orders, reviews (`wf-order-review-request`, chase follow-ups),
  team invites (`wf-team-invite`) — same intent API, different templates.
- `rp-events` subscribers trigger notifications without knowing channel
  details; adding a channel (e.g. push) upgrades every domain at once.
- Delivery policy (which channel first, when to retry, when to stop) is
  centralized instead of copy-pasted per domain.

## Non-goals

- No provider protocols — that is `lm-smtp` / `lm-ses` / `lm-sms` /
  `lm-push`.
- No business decisions about when to notify — the calling domain decides.
- No message threads — that is `rp-threads`.

## Responsibility boundary

Owns notification orchestration and delivery policy; does not own
low-level provider-specific sending adapters or domain trigger logic.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/repositories/communications/rp-notify`
