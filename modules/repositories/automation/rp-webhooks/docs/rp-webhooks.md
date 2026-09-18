# rp-webhooks

## Purpose

The single inbound door for the outside world: external systems hit one
webhook endpoint, and this module validates, normalizes, and fans events
inward. No domain exposes its own callback URL scheme.

## Mental model

External system POSTs → webhook validates signature and shape → normalized
event is recorded as a delivery and routed to the configured topic.
Delivery attempts and validation live here; business reaction lives
downstream.

## Ecosystem value

One ingress for external callbacks:

- Endpoint configs and delivery records behind one API.
- Any external system gets the same endpoint shape instead of per-integration plumbing.

## Non-goals

- Not workflow execution.
- Not event publishing or notification sending.
## Responsibility boundary

Owns webhook transport, validation, and delivery attempts; does not own
target-system business processing.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/repositories/automation/rp-webhooks`
