# rp-calls

## Purpose

Call sessions and metadata: setup, participants, and linkage to recordings (block streams in rp-store) and transcripts/threads (rp-threads). Summaries via wf-dialogue-summary.

## Responsibility boundary

Owns call-session domain logic and call metadata; does not own telecom provider infrastructure, audio bytes, or message threads.

## Direct module dependencies

- None

## Solution membership

- `ai`

## Source

`modules/repositories/communications/rp-calls`
