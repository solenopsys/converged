# rp-counters

## Purpose

Per-tenant configuration of external analytics counters: stores tracking
ids (GA4, GTM, Yandex Metrika, Meta Pixel) or a custom head snippet, so SSR
can inject the right scripts per tenant.

## Mental model

Operator saves a counter (type, tracking id or snippet, enabled flag) → the
store keeps the config. SSR reads enabled counters for the current tenant
and renders the matching tags. No numbers are collected here, only the
counter settings.

## Ecosystem value

One place for analytics wiring:

- External counters (GA4, GTM, Metrika, Pixel) and custom snippets are
  configured per tenant instead of being hardcoded per landing.

## Non-goals

- Not raw event storage.
- Not numeric sample journals.
- Not usage records or invoicing.
## Responsibility boundary

Owns counter configs (type, tracking id or snippet, enabled flag); does not
collect metrics, aggregate usage, or do billing.

## Direct module dependencies

- None

## Solution membership

- `analitycs`

## Source

`modules/repositories/analytics/rp-counters`
