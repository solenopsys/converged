# sf-reviews

## Purpose

The review system as one working area: what customers said about the work,
which of it is on the site, what the shop said back, and how far the asking is
getting — how many links went out, how many were opened, how many came back.

## Shape

The surface declares two `setOf` views — reviews and the invitations that asked
for them — which the workspace turns into the permanent buttons of this tab, and
one `objectOf` view for a review. Moderation queue, published wall and rejected
pile are presets on the reviews table rather than three types: they are one list
read three ways. Opening a review therefore opens a subtab *inside* reviews
rather than navigating away from it. With nothing pressed the surface shows its
own screen, `ReviewsDashboardView`.

## Responsibility boundary

Reads and writes `rp-reviews`. Reads `rp-orders` for the work a review is about —
directly from the browser, which is where a two-call composition belongs; neither
repository knows about the other.

Sending is not done from here. `wf-order-review-request` mints and sends the
personal link and `wf-order-review-followup` chases it, because reaching an order
and a review in one process is exactly what a workflow is for. "Ask for a review"
on this surface mints the link and leaves the sending to that flow, so there
stays one sender and one trail.

## Review gating

The public form shows the external platforms to everybody. The shop's threshold
moves the *emphasis* — a happy customer is offered the platforms first, an
unhappy one a word with the shop first — and never the availability of the links,
because showing the path to a public review only to satisfied customers is what
Google and several other platforms forbid. The card says which way the form
leaned for a given review; it does not gate anything.

## Direct module dependencies

- `g-reviews`
- `g-orders`

## Solution membership

- `production`

## Source

`modules/surfaces/business/sf-reviews`
