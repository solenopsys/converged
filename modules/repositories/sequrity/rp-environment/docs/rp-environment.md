# rp-environment

## Purpose

Per-user environment configuration: settings and workspace state scoped to identity. Consumed by surfaces to personalize without forking identity records.

## Responsibility boundary

Owns environment config CRUD scoped to users; does not own identity lifecycle, auth, or permissions.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/repositories/sequrity/rp-environment`
