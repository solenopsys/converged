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

Single routing brain for intakes:

- File intake (`wf-files-process`): which uploads are production models.
- Requests (`wf-request-analyze`): what the request is about before staging.
- Dialogues (`wf-dialogue-summary`): noise classification for chat/call
  transcripts.
- Any new intake reuses the same labels instead of training its own.

## Non-goals

- Not ingestion or file storage — that is `rp-files` / `rp-store`.
- Not structured shaping — that is `rp-struct`.
- Not model conversion or analysis — that is `lm-modelconvertor` / `wf-*`.

## Responsibility boundary

Owns classification logic and label assignment; does not own source
content ingestion pipelines or downstream business routing.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/repositories/content/rp-classifier`
