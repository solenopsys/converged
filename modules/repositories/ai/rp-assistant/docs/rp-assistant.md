# rp-assistant

## Purpose

Conversational AI front for end users and internal tools: dialogue handling, file-aware request intake, and handoff to analysis workflows. Reads named prompts from rp-contexts and threads from rp-threads.

## Responsibility boundary

Owns assistant dialog behavior and request handling; does not own model provider infrastructure, thread storage, or user identity.

## Direct module dependencies

- None

## Solution membership

- `ai`

## Source

`modules/repositories/ai/rp-assistant`
