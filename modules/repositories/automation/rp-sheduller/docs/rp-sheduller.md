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

One clock for recurring work:

- Cron rows, run history and stats behind one API.
- Any recurring job needs only a cron row — no new timer infrastructure.

## Non-goals

- Not workflow definition or execution.
- Not one-shot triggers — only recurring schedules.
## Responsibility boundary

Owns CRUD/list/stats for cron entries and history records; does not
execute workflows, timers, retries, or background dispatch.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/repositories/automation/rp-sheduller`
