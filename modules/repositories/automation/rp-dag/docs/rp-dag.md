# rp-dag

## Purpose

Owns the workflow triggers and the execution log. It executes nothing.

## Responsibility boundary

Two things belong here and nothing else:

- **Triggers** — "when this bus topic appears, run that workflow". System
  configuration: tens of rows an operator maintains, held whole in the
  runtime's memory rather than queried.
- **The execution log** — a tree of what a run did. The runtime writes it while
  the script runs: a node is opened before its body executes and closed when it
  finishes, so a run in flight shows the node it is sitting on.

The workflow catalogue is not owned here. Ptah puts the active Solution's
descriptors into this service's environment (`WORKFLOWS`, `WORKFLOW_DIGESTS`,
`MODULE_PROXY`) and `listAvailableWorkflows` republishes them for the runtime
and the UI. Source bytes stay behind Ptah-proxy.

## The log is written by the runtime, not by this service

Nothing here writes a log entry. The runtime formats it, puts it in Valkey under
a key it composes itself, and later hands over the keys — never the entries.
`commitLog` turns each key into a store location and tells storage to pick the
entry up; storage reads the cache directly, so an entry crosses the transport
once, as bytes nobody re-encodes.

```text
workflow thread ─► queue ─► log writer ─► valkey
                                 │
                                 └─ commitLog([keys]) ─► rp-dag ─► storage reads valkey
                                                                        │
                                 ◄──── committed ────────────────────────┘
                                 └─ delete the committed keys
```

That is what keeps logging off the workflow's critical path: a node costs the
runtime a queue append and nothing else. It also means the log is best effort by
construction — an entry may be dropped under backpressure, and a batch may be
committed twice after a crash. Keys are derived from the run and the node's
sequence, so the second commit is a rewrite rather than a duplicate.

Keys come from the runtime for that reason: a number handed out by this service
would cost a round trip per node and would not be reproducible after a restart.

- `dag:log:<executionId>:exec` — the run
- `dag:log:<executionId>:n:<seq>` — one of its nodes, zero-padded to six digits

`commitLog` derives the store location from the key and refuses anything outside
the `dag:log:` prefix, so a key is the whole of the authority the call carries.

## The log is a tree

```text
exec:<id>              the run
node:<id>:<seq>        its nodes, in the order they opened
```

A node that delegated through `rt.sub` carries the child run's id, and the
child is an ordinary run with nodes of its own. `executionTree` walks that link
depth-first and returns the result flat, each row tagged with its `depth` — so
a client renders the tree by indenting and nothing else. No parent index is
needed: the link is the node that made it.

Sequences are zero-padded in the key, because the KV store returns a prefix
range in lexicographic order and that order has to be the order the nodes ran.
The runtime pads to the same width when it composes the cache key; the two
widths are one contract.

Retention is a cap on runs (`5000` by default), enforced every hundredth open.
The log is diagnostics, not an archive.

## Trigger changes reach the runtime over the bus

Creating, changing or deleting a trigger publishes `dag.triggers.changed`. The
runtime subscribes to that topic alongside the triggers' own, so an edit is live
for the next event instead of waiting out a polling interval. Publishing is best
effort — a bus that is down must not fail an operator's edit — and the runtime's
periodic refresh remains the backstop.

## Direct module dependencies

- g-bus — to announce a trigger change

## Solution membership

- Not included in a predefined solution

## Source

`modules/repositories/automation/rp-dag`
