# rp-reviews

## Purpose

The shop's review system, in three tables that answer three different questions.

- `reviews` — what a customer said, what the shop said back, and whether it is
  on the site. Moderation lives here: a review that came from outside is born
  `pending` and is visible only inside the console until somebody publishes it.
- `review_invites` — one personal, single-use link per order, and what became
  of it: sent, opened, answered, expired. This is the funnel the shop reads.
- `review_settings` — one row of JSON: the external platforms, the threshold,
  the mail templates, the delays and the chase allowance.

## Responsibility boundary

Owns reviews, invitations and the funnel settings. Knows nothing about orders:
`Review.orderId` and `ReviewInvite.orderId` are opaque strings, and joining them
to actual orders is the job of `wf-order-review-request` (which asks) and
`sf-reviews` (which shows). Does not own community threads.

## Two doors

Access is by tag, as everywhere: a published review carries `public`, anything
else carries `authenticated` plus `moderator`, which is what lets the shop act
on a review nobody at the shop wrote.

The customer's door is different. `getInviteByToken`, `markInviteOpened` and
`submitByToken` are authorised by the token itself — a capability, not a
session — so the public form works with no login at all. They return a narrowed
view that carries neither the contact nor the invite id, and `submitByToken`
spends the link conditionally, so two submissions from the same mail produce
one review and one refusal rather than two reviews.

## Review gating

`positiveThreshold` moves the *emphasis* of the public form and nothing else:
at or above it the author is offered the external platforms first, below it a
word with the shop first. The platform links stay visible either way, because
showing the path to a public review only to satisfied customers is what Google
and several other platforms forbid. The safe behaviour is the default.

## Direct module dependencies

- None

## Solution membership

- `production`

## Source

`modules/repositories/business/rp-reviews`
