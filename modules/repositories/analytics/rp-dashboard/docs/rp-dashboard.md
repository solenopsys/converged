# rp-dashboard

## Purpose

Personal dashboard pin storage: remembers which indicator widgets a user
pinned, their order and display metadata. No metrics are computed here,
only the arrangement of the user's own screen.

## Responsibility boundary

Owns pin rows (widget, title, source, position) with per-user visibility;
does not own metrics, counters, or widget rendering.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/repositories/analytics/rp-dashboard`
