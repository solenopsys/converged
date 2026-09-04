# rp-files

## Purpose

Provides file metadata APIs and file-management workflows.

## Responsibility boundary

Owns file records and file-level operations; does not own object storage implementation details.

## Direct module dependencies

- `rp-store` — the content-addressed block store every file's bytes live in.
  rp-files keeps names, collections and the chunk list; it stores no data.

## Solution membership

- `requests`

## Source

`modules/repositories/data/rp-files`
