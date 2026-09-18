# rp-classifier

## Purpose

The shared labeling service: any intake points raw content here and gets
back categories, labels, or intents. One classification logic instead of
per-domain if-chains.

## Mental model

Producer sends raw items (files, texts, requests) → classifier assigns
labels → the caller routes by label (production model vs drawing, urgent
vs noise). Labels are advice; the business decision stays with the caller.

## Ecosystem value

Single taxonomy shelf:

- Tree nodes and key mappings behind one API.
- Any intake resolves labels from the same tree instead of its own dictionaries.

## Non-goals

- Not file bytes or conversion.
- Not JSON document storage.
## Responsibility boundary

Owns classification logic and label assignment; does not own source
content ingestion pipelines or downstream business routing.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/repositories/content/rp-classifier`
