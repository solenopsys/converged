# rp-dumps

## Purpose

The shared export dock: any domain snapshots its data here for migration,
backup, or handoff instead of inventing its own dump format. Packaged
snapshots with retrieval metadata.

## Mental model

Domain asks for a dump (scope, time) → dump is generated and packaged →
retrieval metadata points at the stored artifact.
Generation and bookkeeping live here; long-term archiving lives elsewhere.

## Ecosystem value

One export story for the platform:

- Storage listing, stats, compaction and dump segments behind one API.
- Any domain becomes exportable without its own snapshot machinery.

## Non-goals

- Not live file serving.
- Not a parallel byte storage.
## Responsibility boundary

Owns dump generation, packaging, and retrieval metadata; does not own
long-term archival platform.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/repositories/data/rp-dumps`
