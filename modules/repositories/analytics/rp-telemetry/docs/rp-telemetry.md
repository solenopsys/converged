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

One numeric sample journal:

- Any producer writes (device, parameter, value, unit, time) rows into hot/cold stores.
- One timeline for numbers of any origin — equipment sensors or anything else.

## Non-goals

- Not text log storage.
- Not usage records.
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
