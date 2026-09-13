# sf-team

## Purpose

The team as one working area: who works here, what each of them may do, and who
has been asked in but has not arrived yet.

## Projections

Four `setOf` views, which the shell turns into the permanent buttons of the tab
— **Team**, **Invitations**, **Schedule**, **Rights** — plus one `objectOf`
view, the person's card, which opens as a subtab *inside* the same area. With
nothing pressed the area shows its own screen (`team.statistic` resolved through
its `setOf` view, the pattern `sf-logs` and `sf-equipment` use).

## What shapes this surface

**The console cannot grant anything.** `rp-access` is `@Access("internal")` and
the runtime refuses a user JWT before any permission is checked
(`messaging-access.ts:176`). So every operation that changes what somebody may
do runs `wf-team-invite` on centimanus, which holds the cluster's service token.
Who may run it is the ordinary grant `wf/workflows/wf-team-invite.js(x)`, which
lives in one preset file — that grant is the whole of "who may add people".

Three invitation methods on `rp-identity` carry a method-level `@Access("user")`
so the delivery column can be read without a workflow per table refresh; they
are gated by `rp/identity/listInvites(r)` in the owner and manager presets.

The **Rights** projection is composed in the browser from the roster and the
invitations, because the service that knows the real answer cannot be asked from
here. It shows the intent of record — the role a person was given and the tags
that came with it — not a reading of their live token.

## Operations

`team.member.import` (the one this contour exists for — a pasted list in,
a filled table of exactly those people out), `team.member.create`,
`team.member.save`, `team.member.setRole`, `team.member.deactivate`,
`team.invite.revoke`, `team.shift.create`.

Three of them are published to the chat catalog in `llm.json`.

## Direct module dependencies

- `front-core`, `g-centimanus`, `g-identity`, `g-staff`

## Solution membership

- `production`

## Source

`modules/surfaces/sequrity/sf-team`
