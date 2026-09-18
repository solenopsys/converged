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

One knowledge shelf for AI paths:

- Named contexts with language variants behind one API.
- Any AI path resolves the same named context instead of its own prompt copies.

## Non-goals

- Not chat history or dialogue threads.
- Not prompt execution — only stored context texts.
## Responsibility boundary

Owns storage and retrieval of named AI contexts and language variants;
does not own model provider infrastructure or dialogue behavior.

## Direct module dependencies

- None

## Solution membership

- `ai`

## Source

`modules/repositories/ai/rp-contexts`
