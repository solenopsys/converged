# lm-compressors

## Purpose

The shared byte-workhorse of the file pipeline: assembly, decompression,
ZIP parsing, output chunking, and staging. Stateless — no `files` or
`store` clients inside; it returns bytes and cache references, persistence
is the workflow's job.

## Mental model

Workflow hands chunk refs + operation (unpack, assemble, chunk) → lambda
does pure byte work → hands staged bytes/cache refs back. It never decides
what a file means and never stores anything.

## Ecosystem value

One place where archive bytes are touched:

- Compressed chunks in, staged entries out — one unpack shape for any caller.
- Any future archive or compression format lands here once and upgrades every intake at once.

## Non-goals

- Not file storage or classification.
- Not model conversion or preview rendering.
## Responsibility boundary

Owns byte assembly, decompression, archive parsing, output chunking, and
staging; does not own file records or persistence.

## Direct module dependencies

- None

## Solution membership

- `requests`

## Source

`modules/lambdas/data/lm-compressors`
