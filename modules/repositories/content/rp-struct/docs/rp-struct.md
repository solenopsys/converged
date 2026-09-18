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

One shape language for content:

- Docs, landings, product cards: authored once, rendered everywhere.
- AI pipelines: contexts and summaries consume structured blocks instead of
  raw strings.
- New surfaces plug in by rendering existing blocks — no per-channel
  re-modeling.

## Non-goals

- Not final rendering — that is surfaces / `rp-markdown`.
- Not classification — that is `rp-classifier`.
- Not binary transcoding.

## Responsibility boundary

Owns structure modeling and schema-level shaping; does not own final
channel-specific rendering.

## Direct module dependencies

- None

## Solution membership

- `content`

## Source

`modules/repositories/content/rp-struct`
