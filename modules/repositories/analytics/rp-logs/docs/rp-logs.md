# rp-logs

## Purpose

The single append-only journal of the ecosystem: any service, equipment,
or workflow writes "what happened" here instead of growing its own log
store. Cheap writes, reads by time/source.

## Mental model

Producer sends an event (time, source, level, text/payload) → it lands on
the shared stream. Consumer reads a slice by source or interval. No
aggregation or alerting inside — just recording the fact.

## Ecosystem value

One stream reused by everyone:

- Services: operational logs with no per-`rp-*` storage of their own.
- Equipment: machine/device logs — same API, different source.
- Automation: `rp-dag` writes workflow-run execution trees here; schedule
  history (`rp-sheduller`) and webhook attempts are read from here.
- Audit and incident review (`wf-equipment-incident`): one query shows the
  event chain over time instead of logs scattered across five services.

## Non-goals

- Not counters or aggregates — that is `rp-counters`.
- Not health signals or product metrics — that is `rp-telemetry`,
  `rp-usage`.
- Not distributed-call tracing or alerting.

## Responsibility boundary

Owns log ingestion and retrieval APIs; does not own business metrics,
aggregation, alerting or tracing strategy.

## Direct module dependencies

- None

## Solution membership

- `analitycs`

## Source

`modules/repositories/analytics/rp-logs`
