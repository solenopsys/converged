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

The foundation every other storage builds on:

- `rp-files` keeps names, collections, and chunk lists — the bytes live here.
- Call audio records (`rp-calls`): a conversation is easier to keep as a
  block stream than as a file — slicing, streaming, cutting the middle
  without rewriting a file.
- Production artifacts: staged model bytes, GLB previews, slicing/CAM
  results, `lm-compressors` cache while unpacking ZIPs.
- Any future module that needs "bytes without file semantics" comes here
  instead of inventing its own storage.

Key pipeline invariant: workflows (`wf-file-unpack`, `wf-file-analyze`,
`wf-request-analyze`) never hold bytes in memory — they carry only metadata
and `CacheRef` references between `rp-files`, `rp-store`, and
`lm-compressors`. Bytes flow store ↔ lambda directly.

## Non-goals

- No file names, extensions, or collections — that is `rp-files`.
- No business semantics: whose order, request, or call it is.
- No transcoding, unpacking, or conversion — that is `lm-*`.

## Responsibility boundary

Owns block put/get by content reference and chunk lifecycle; does not own
file-level naming/collections or business semantics of calling services.

## Direct module dependencies

- None

## Solution membership

- `requests`

## Source

`modules/repositories/data/rp-store`
