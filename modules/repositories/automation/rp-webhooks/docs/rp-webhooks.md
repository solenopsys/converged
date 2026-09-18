# rp-webhooks

## Purpose

The single inbound door for the outside world: external systems hit one
webhook endpoint, and this module validates, normalizes, and fans events
inward. No domain exposes its own callback URL scheme.

## Mental model

External system POSTs → webhook validates signature and shape → normalized
event lands on the bus (`rp-events`) or fires a `rp-dag` trigger.
Delivery attempts and validation live here; business reaction lives
downstream.

## Ecosystem value

One integration point for outsiders:

- Payment callbacks, carrier tracking, telephony hooks — same validation
  and retry story.
- New integrations add a webhook route, not a new server.
- Domains stay decoupled: they subscribe to normalized events instead of
  parsing provider payloads.

## Non-goals

- No business processing of the target system — the owning domain decides.
- No outbound delivery policy — that is `rp-notify`.
- No workflow execution — that is the runtime + `rp-dag`.

## Responsibility boundary

Owns webhook transport, validation, and delivery attempts; does not own
target-system business processing.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/repositories/automation/rp-webhooks`
