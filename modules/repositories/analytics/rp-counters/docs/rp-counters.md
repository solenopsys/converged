# rp-counters

## Purpose

The shared analytical counter store: any module increments named counters
instead of growing its own stats tables. Pre-aggregated numbers, cheap to
read, ready for dashboards and billing.

## Mental model

Producer increments a counter (name, dimensions, time bucket) → the store
keeps running totals. Consumer reads totals per bucket without scanning raw
events. Raw facts live in `rp-logs`/`rp-events`; here only the sums.

## Ecosystem value

One numbers backend for everyone:

- Product analytics: feature usage, request/order volumes per period.
- `rp-dashboard` renders platform metrics from here instead of querying
  every domain.
- `rp-usage`/`rp-billing`: consumption totals feed quotas and invoicing
  without re-counting raw events.
- Any new module gets dashboards and stats on day one — just emit counters.

## Non-goals

- Not raw event storage — that is `rp-events` / `rp-logs`.
- Not health signals — that is `rp-telemetry`.
- Not per-feature consumption semantics or invoicing — that is `rp-usage` /
  `rp-billing`.

## Responsibility boundary

Owns counter collection, bucketing, and querying; does not own raw event
journaling or billing execution.

## Direct module dependencies

- None

## Solution membership

- `analitycs`

## Source

`modules/repositories/analytics/rp-counters`
