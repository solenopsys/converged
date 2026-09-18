# rp-sheduller

## Purpose

The shared time trigger: cron schedules and their execution history for the
whole ecosystem. Any recurring job registers here instead of running its
own timer loop.

## Mental model

Operator defines a cron entry (what workflow, when, with what args) → the
runtime fires on schedule → history records what ran and how it ended.
This module stores and lists entries; it never executes anything itself.

## Ecosystem value

One clock for all recurring work:

- Review chases (`wf-order-review-request` / followup), sales outreach,
  digest summaries — all scheduled the same way.
- History gives a single audit of "what ran last night" across domains.
- New recurring jobs need only a cron row — no new timer infrastructure.

## Non-goals

- No workflow execution, timers, retries, or dispatch — that is the runtime
  + `rp-dag`.
- No business decisions about what should run — the owning domain decides.

## Responsibility boundary

Owns CRUD/list/stats for cron entries and history records; does not
execute workflows, timers, retries, or background dispatch.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/repositories/automation/rp-sheduller`
