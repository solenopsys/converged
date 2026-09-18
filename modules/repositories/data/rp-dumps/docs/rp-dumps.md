# rp-dumps

## Purpose

The shared export dock: any domain snapshots its data here for migration,
backup, or handoff instead of inventing its own dump format. Packaged
snapshots with retrieval metadata.

## Mental model

Domain asks for a dump (scope, time) → dump is generated and packaged →
retrieval metadata points at the artifact in `rp-files`/`rp-store`.
Generation and bookkeeping live here; long-term archiving lives elsewhere.

## Ecosystem value

One export story for the platform:

- Migrations and support handovers read the same snapshot shape.
- Dumps reuse `rp-files`/`rp-store` for bytes — no parallel storage.
- New domains become exportable by registering a dump scope.

## Non-goals

- Not long-term archival or retention policy.
- Not byte storage — that is `rp-files` / `rp-store`.
- Not business semantics of the dumped data.

## Responsibility boundary

Owns dump generation, packaging, and retrieval metadata; does not own
long-term archival platform.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/repositories/data/rp-dumps`
