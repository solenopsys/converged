# rp-telemetry

## Purpose

The shared technical health feed: services report "how I feel" (latency,
errors, resource signals) here instead of each ops tool scraping them
individually. Normalized intake, one query surface for health.

## Mental model

Service pushes health events (source, signal, time, payload) → telemetry
normalizes them into a uniform shape. Ops consumers (dashboards, incident
workflows) read health per service over time. Business meaning is attached
by the reader, not the store.

## Ecosystem value

Single health picture across the platform:

- Every `rp-*`/`lm-*` reports the same way — new services are observable
  without new pipelines.
- `wf-equipment-incident` and ops dashboards correlate service health with
  equipment logs (`rp-logs`) on one timeline.
- Separates "is the system healthy" (here) from "what happened" (`rp-logs`)
  and "how much was used" (`rp-usage`).

## Non-goals

- Not product analytics or business counters — that is `rp-counters` /
  `rp-usage`.
- Not the operational log tape — that is `rp-logs`.
- Not alerting policy or incident resolution.

## Responsibility boundary

Owns telemetry event intake and normalization; does not own product
analytics definitions, alerting, or remediation.

## Direct module dependencies

- None

## Solution membership

- `analitycs`

## Source

`modules/repositories/analytics/rp-telemetry`
