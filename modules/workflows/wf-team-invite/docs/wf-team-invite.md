# wf-team-invite

## Purpose

Turns a pasted list of people — "name + address", in whatever shape a human
wrote it — into user accounts, roles, staff cards and invitations, and sends
each person the link that signs them in.

It exists because four services have to move together for one row of that list
(`rp-identity`, `rp-access`, `rp-staff`, `rp-auth` plus a mail lambda) and
microservices do not call each other.

## Why it is also the privilege boundary

`rp-access` refuses a user JWT outright (`@Access("internal")`), so no surface
can hand out a role. centimanus runs this script with `SERVICE_TOKEN`, and who
may run it is an ordinary grant — `wf/workflows/wf-team-invite.js(x)` — checked
at the edge (`signal_provider.zig:146`) and written in one preset file. That is
why the product has no "administrator" concept.

The script cannot see who called it, so the escalation guard is a fixed list:
`manager`, `operator`, `viewer`. `owner` and `root` are not grantable here.

## Shape

1. text sources — `files.materialize` + `files.extractText`, plus `rawText`;
2. people — `rt.llm` first, a line-by-line regex as the fallback;
3. one `rt.attempt` per person — user, base preset + role, group tags, card,
   invitation;
4. the letter — its own attempt, so a refused relay is a branch and not a lost
   account;
5. the report, whose `staffIds` the surface turns into an open table of exactly
   these people.

Re-running the same list is harmless: a known address is `updated`, never a
second account.

## Direct module dependencies

- `g-access`, `g-auth`, `g-files`, `g-identity`, `g-notify`, `g-ses`, `g-smtp`,
  `g-staff`

## Solution membership

- `production`

## Source

`modules/workflows/wf-team-invite`
