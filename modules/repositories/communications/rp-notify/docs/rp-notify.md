# rp-notify

## Purpose

The single notification fan-out of the ecosystem: any domain says "tell the
user" once, and this module picks channels, policy, and retries. Domains
never touch SMTP/SMS/push APIs directly.

## Mental model

Domain emits a notification intent (who, what, template, urgency) → notify
resolves channels and delivery policy → external provider adapters do the actual sending. Retries and channel
fallback live here, message meaning lives in the domain.

## Ecosystem value

One "tell the user" store:

- Templates, channels, profile and send records behind one API.
- Any domain keeps its notification texts and delivery records in one place.

## Non-goals

- Not message delivery itself — only templates, channels and send records.
- Not dialogue threads.
## Responsibility boundary

Owns notification orchestration and delivery policy; does not own
low-level provider-specific sending adapters or domain trigger logic.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/repositories/communications/rp-notify`
