# rp-requests

## Purpose

Service-request intake and lifecycle: submission, status transitions, file attachments (by fileId), and promotion to orders via wf-request-to-order. Analysis runs through wf-request-analyze.

## Responsibility boundary

Owns request lifecycle and status transitions; does not own messaging transport, file bytes, or analysis execution.

## Direct module dependencies

- None

## Solution membership

- `requests`

## Source

`modules/repositories/business/rp-requests`
