# rp-contexts

## Purpose

The shared named-context store for AI: prompts, language variants, and
domain knowledge live here instead of being hardcoded in every workflow.
Versioned by name, resolved by language.

## Mental model

Workflow or assistant asks for a context by name (+ language) → gets the
current text. Editors update contexts without redeploying consumers.
Storage and retrieval live here; prompt engineering lives with the editors.

## Ecosystem value

One knowledge shelf for all AI paths:

- Assistant (`rp-assistant`), request analysis, dialogue summaries — all
  resolve the same named contexts.
- Multilingual surfaces get language variants from one place.
- Updating a prompt upgrades every consumer at once — no per-workflow
  string edits.

## Non-goals

- Not dialogue state or chat behavior — that is `rp-assistant` /
  `rp-threads`.
- Not model provider infrastructure.

## Responsibility boundary

Owns storage and retrieval of named AI contexts and language variants;
does not own model provider infrastructure or dialogue behavior.

## Direct module dependencies

- None

## Solution membership

- `ai`

## Source

`modules/repositories/ai/rp-contexts`
