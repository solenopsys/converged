# rp-struct

## Purpose

The shared structure builder: turns loose content into typed, schema-shaped
representations every consumer can rely on. One modeling point between raw
content and channel rendering.

## Mental model

Raw content in → structure modeling applies schemas and shapes → typed
blocks out. Channels (`sf-*`, markdown, notify templates) render blocks
without re-parsing the source.

## Ecosystem value

One typeless JSON shelf:

- JSON documents behind one file API.
- Any producer stores structured blobs without its own file handling.

## Non-goals

- Not taxonomy or labeling.
- Not markdown rendering.
## Responsibility boundary

Owns structure modeling and schema-level shaping; does not own final
channel-specific rendering.

## Direct module dependencies

- None

## Solution membership

- `content`

## Source

`modules/repositories/content/rp-struct`
