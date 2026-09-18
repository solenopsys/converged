# rp-store

## Purpose

Content-addressed block store — the bottom binary storage layer of the
whole ecosystem. Stores chunks by content hash; knows nothing about files,
orders, users, or business entities.

## Mental model

Producer splits bytes into chunks → puts them in the store → gets
references back. Consumer reassembles bytes from references. The store
itself is a dumb key(blob_hash) → bytes map with deduplication: an
identical chunk uploaded twice is stored once.

## Ecosystem value

Content-addressed byte foundation:

- Opaque byte blobs keyed by hash, stored once, referenced anywhere.
- Any producer persists bytes without its own binary storage.

## Non-goals

- Not file metadata or collections.
- Not staged cache entries.
## Responsibility boundary

Owns block put/get by content reference and chunk lifecycle; does not own
file-level naming/collections or business semantics of calling services.

## Direct module dependencies

- None

## Solution membership

- `requests`

## Source

`modules/repositories/data/rp-store`
