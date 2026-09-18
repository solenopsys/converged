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

- Markdown files plus JSON conversion behind one API.
- Any producer stores human text the same way instead of its own file handling.

## Non-goals

- Not typed block storage.
- Not HTML rendering.
## Responsibility boundary

Owns markdown conversion/parsing behavior; does not own rich media
transcoding or page composition.

## Direct module dependencies

- None

## Solution membership

- `content`

## Source

`modules/repositories/content/rp-markdown`
