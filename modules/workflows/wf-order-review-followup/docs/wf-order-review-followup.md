# wf-order-review-followup

## Purpose

The single chase. One run takes one review link that was sent, stayed quiet for
the configured number of days and has not been chased its allowance of times,
and asks once more.

## Why this is a workflow

The choosing is not: `reviews.findInvitesToFollowUp` is a question about invites
and belongs to `rp-reviews`. What this flow adds is the order's name for the
mail and the sending — two services in one process, which is the definition of a
workflow here.

## What it deliberately never does

It never chases somebody who opened the form. They read the ask and chose not to
write; asking again is how a review request becomes spam. That condition lives
in the repository query rather than in this flow, so a future caller cannot
forget it.

A refused chase leaves the invite `sent` rather than `failed`: the first mail
did go out, and the customer may still answer it.

## Shape

```
read-settings → find-due (sent, never opened, under the allowance)
              → read-order (for the name only)
              → send-email → count-followup
```

Counting the chase is what makes it *single*: the same query will not return
that link again. `dryRun` renders the mail and counts nothing. `maxFollowups: 0`
switches chasing off entirely, and the flow stops before it asks.

## Parameters

- `from` (required) — sender address.
- `ses` (required) — `SesCredentials`.
- `shopName`, `delayDays`, `maxFollowups`, `dryRun` — overrides; the defaults
  come from `reviews.getSettings()`.

## Direct module dependencies

- `g-orders`
- `g-reviews`
- `g-ses`

## Source

`modules/workflows/wf-order-review-followup`
