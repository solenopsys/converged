# wf-order-review-request

## Purpose

Contour 2 of the review system: ask the customer, once, after the work is done.

One run finds one order that finished long enough ago, has a customer to write
to and has never been asked; mints its personal single-use review link in
`rp-reviews`; and sends the ask through `lm-ses`.

## Why this is a workflow

The question "which finished orders have not been asked yet" spans two services
that are forbidden to know about each other: `rp-orders` does not know what a
review is, and `rp-reviews` holds `orderId` as an opaque string. Putting the two
lists side by side is exactly what a flow is for — and `rt.node` is what makes
the link minting survive a restart without minting a second one.

## Shape

```
read-settings → list-finished (completed, updatedAt ≤ now − delay)
              → list-invites (which of those were already asked)
              → create-invite → send-email → mark-sent | mark-failed
```

One mail per run, so a stuck address never blocks the queue behind it and the
schedule decides the rate. `dryRun` renders the mail and mints nothing: a
rehearsal that left a live link behind would have the next real run skip that
order as already asked.

A refused mail comes back from `lm-ses` as `{ success: false }`, not as a throw,
so it is an ordinary branch that marks the invite `failed` — not an error
boundary.

## Parameters

- `from` (required) — sender address.
- `ses` (required) — `SesCredentials`.
- `shopName` — filled into `{{shopName}}` in the templates.
- `delayHours` — overrides `ReviewSettings.requestDelayHours` for a catch-up.
- `dryRun` — render and stop.

Subject, body, link base and the delay come from `reviews.getSettings()`, so the
shop changes its own wording without touching this flow.

## Direct module dependencies

- `g-orders`
- `g-reviews`
- `g-ses`

## Source

`modules/workflows/wf-order-review-request`
