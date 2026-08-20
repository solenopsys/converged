# Centimanus DAG Runtime

Centimanus executes JavaScript workflows as a replayable, step-driven DAG.
Workflow code defines the control flow; Centimanus persists completed node
outcomes and resumes the workflow from the next unfinished node. Business logic
and side effects belong to the services called by the workflow.

## Overview

```text
workflow source
      |
      v
+------------------------+
| Centimanus             |
| - evaluates workflow   |
| - executes one node    |
| - replays prior nodes  |
+-----------+------------+
            |
            +------------------+-------------------+
            |                  |                   |
            v                  v                   v
       State store       External services      LLM provider
       node outcomes     rt.call(...)           rt.llm(...)
            |
            v
       DAG telemetry (best effort)
```

## Execution model

A workflow is ordinary synchronous JavaScript. Its graph is implicit: branches
and loops are evaluated from the values returned by earlier nodes. There is no
separate graph definition or static topological sort.

```js
rt.workflow = function (params) {
  var lead = rt.node("find-lead", function () {
    return rt.call("sales", "findLead", { lang: params.lang });
  });

  if (!lead) return { skipped: true };

  var sent = rt.node("send-email", function () {
    return rt.call("smtp", "send", { to: lead.email });
  });

  return { id: sent.id };
};
```

Centimanus evaluates the workflow until it reaches one unfinished node. It runs
that node, stores its outcome, then re-evaluates the workflow from the start.
Previously completed nodes return their stored values. Evaluation continues
until the workflow returns a final value or fails.

```text
evaluation 1: find-lead EXECUTE -> persist
evaluation 2: find-lead REPLAY  -> send-email EXECUTE -> persist
evaluation 3: find-lead REPLAY  -> send-email REPLAY  -> done
```

This makes each node the durable unit of work for a single execution.

## Writing workflows

### Use a node for every side effect

Wrap every external call, state mutation, LLM request, or other side effect in
`rt.node` or `rt.attempt`. Code outside a node runs again on every evaluation.

```js
var charge = rt.node("charge-order", function () {
  return rt.call("billing", "charge", params);
});
```

Pure, deterministic calculations may remain outside a node when they depend
only on workflow parameters and replayed node values.

### Choose stable, unique node names

The node name is its identity within an execution. Reusing a name returns the
first stored outcome instead of running the callback again. Names in loops must
include the iteration, round, or tool-call identifier.

```js
for (var i = 0; i < items.length; i += 1) {
  rt.node("send-" + i, function () {
    return rt.call("mailer", "send", items[i]);
  });
}
```

### Handle expected failures with `rt.attempt`

`rt.node(name, fn)` returns a successful value or fails the workflow. Use
`rt.attempt(name, fn)` when the workflow must decide how to handle an expected
failure:

```js
var delivery = rt.attempt("deliver-" + order.id, function () {
  return rt.call("shipping", "createLabel", order);
});

if (!delivery.ok) return { status: "manual-review", error: delivery.error };
return { status: "ready", label: delivery.value };
```

Both successful outcomes and errors are memoized. A retry of the same node
name does not issue the external call again.

## Runtime API

| API | Purpose |
|---|---|
| `rt.node(name, fn)` | Run and memoize a required DAG node. |
| `rt.attempt(name, fn)` | Run and memoize a node whose error is returned to the workflow. |
| `rt.call(service, method, params)` | Call an external service synchronously. |
| `rt.get(key)` / `rt.set(key, value)` | Read or write workflow state. |
| `rt.llm(params)` | Make a synchronous LLM completion request. |
| `rt.log(message)` | Write a workflow log message. |

The workflow entry point is `rt.workflow`, or a global `workflow` function.
The runtime is synchronous; Promises and async orchestration are not part of
the workflow contract.

## State and replay

Centimanus stores each node outcome under an execution-specific key. This
prevents a completed node from being repeated while the current workflow is
replayed. Workflow data written with `rt.set` is also available to later
evaluations of that execution.

An execution is not currently resumable after the process stops: a new run has
a new execution ID and therefore a new node cache. Design external operations
to be idempotent as an additional safeguard.

## Observability

The runtime reports execution and task lifecycle events to the DAG service on a
best-effort basis. These events support visibility into a run; they do not
control execution and are not the source of node state.

## Design constraints

- Workflows execute one node at a time.
- A node callback may run only once per execution, but code outside nodes is
  replayed on every step.
- Node outcomes are retained by the configured state backend; cleanup and TTL
  are not currently managed by Centimanus.
- Workflows should keep node callbacks small, deterministic where possible,
  and safe to retry at the service boundary.

See `examples/workflows/` for complete workflow examples.
