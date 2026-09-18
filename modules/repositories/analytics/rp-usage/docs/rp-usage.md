# rp-usage

## Purpose

The shared consumption meter: any feature reports "how much was used" here
instead of tracking quotas locally. Aggregated per consumer and period —
the feed billing and limits read from.

## Mental model

Feature records consumption (who, what, how much, period) → usage
aggregates it per account/period. downstream invoicing turns aggregates into money;
limit checks read current totals. Measurement lives here, pricing lives
downstream.

## Ecosystem value

One usage event log:

- Any feature records (function, user, date) rows the same way.
- Solution-function links let any report group calls by solution without per-module quota tables.

## Non-goals

- Not invoicing or payment execution.
- Not authentication or permission checks.
- Not raw counters for dashboards.
## Responsibility boundary

Owns usage measurement and aggregation; does not own invoicing, payment
execution, or pricing policy.

## Direct module dependencies

- None

## Solution membership

- `analitycs`

## Source

`modules/repositories/analytics/rp-usage`
