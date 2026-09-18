# rp-markdown

## Purpose

The shared markdown pipeline: parsing, transformation, and rendering for
every module that deals with text content. One parser behavior instead of
per-surface flavors.

## Mental model

Markdown source in → parse/transform → rendered output (HTML, blocks).
Content authors write once; docs, chats, landings, and notifications render
the same source consistently.

## Ecosystem value

Single text backbone:

- Docs, community posts, chat messages, review templates — same dialect
  everywhere.
- `rp-struct` blocks render through here on their way to surfaces.
- AI outputs (summaries, assistant replies) reuse the same rendering
  instead of raw-text dumps.

## Non-goals

- Not structure modeling — that is `rp-struct`.
- Not media transcoding or file conversion.
- Not final page composition — that is surfaces.

## Responsibility boundary

Owns markdown conversion/parsing behavior; does not own rich media
transcoding or page composition.

## Direct module dependencies

- None

## Solution membership

- `content`

## Source

`modules/repositories/content/rp-markdown`
