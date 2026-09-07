# Automation

## Purpose

Owns the automation workspace: workflows and their runs, the bus triggers that
start them, recurring schedules, and inbound webhook endpoints.

## Responsibility boundary

Controls the workspace experience. It does not execute workflows, keep
schedules, or deliver webhooks — it starts a run through the runtime and reads
the log back from rp-dag.

## The DAG section

- **Workflows** — the catalogue the active Solution publishes, read-only.
  Opening one is asking to run it: parameters are typed as JSON and handed to
  `centimanus.runWorkflow`.
- **Runs** — every execution, with its status.
- **Run detail** — the tree of what the run did. One line per node: how deep it
  sits, whether it finished, how long it took. Unfolding a node shows the
  service calls it made and what came back. A node that delegated through
  `rt.sub` is followed by the nodes of the run it delegated to, one level in.
  A run that is still going refreshes itself.
- **Triggers** — "when this bus topic appears, run that workflow". Topic,
  workflow, JSON parameters, on/off.
- **Variables** — workflow state written by `rt.set`.

Parameters are typed as JSON everywhere rather than generated into a form: a
workflow's parameters are its own and change with it, so a text field stays
correct when they do and what is typed is what the workflow receives.

## Direct module dependencies

- None

## Solution membership

- Not included in a predefined solution

## Source

`modules/surfaces/automation/sf-automation`
