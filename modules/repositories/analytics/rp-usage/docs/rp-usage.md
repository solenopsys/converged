# rp-usage

## Purpose

The shared consumption meter: any feature reports "how much was used" here
instead of tracking quotas locally. Aggregated per consumer and period —
the feed billing and limits read from.

## Mental model

Feature records consumption (who, what, how much, period) → usage
aggregates it per account/period. `rp-billing` turns aggregates into money;
limit checks read current totals. Measurement lives here, pricing lives
downstream.

## Ecosystem value

One metering point for monetization and limits:

- AI calls, file processing, model conversions, notifications — all metered
  the same way, no per-module quota tables.
- `rp-billing` invoices from these aggregates without knowing each
  feature's internals.
- New paid features become billable by emitting usage — no billing changes.

## Non-goals

- Not raw counters for dashboards — that is `rp-counters`.
- Not invoicing or payment execution — that is `rp-billing` / `rp-finance`.
- Not authentication or permission checks — that is `rp-auth` / `rp-access`.

## Responsibility boundary

Owns usage measurement and aggregation; does not own invoicing, payment
execution, or pricing policy.

## Direct module dependencies

- None

## Solution membership

- `analitycs`

## Source

`modules/repositories/analytics/rp-usage`
