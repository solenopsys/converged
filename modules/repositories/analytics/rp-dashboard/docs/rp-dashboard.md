# rp-dashboard

## Purpose

Curated analytical views over platform metrics: reads pre-aggregated counters and usage (rp-counters, rp-usage) and serves dashboard-ready shapes to surfaces. No raw-event scanning.

## Responsibility boundary

Owns dashboard composition and view queries; does not own raw event journaling, counter collection, or per-surface rendering.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/repositories/analytics/rp-dashboard`
