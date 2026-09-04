# Centimanus DAG Runtime

Centimanus executes JavaScript workflows as a resumable DAG. Workflow code
defines the control flow; Centimanus persists completed node outcomes so a
re-run of the same execution skips what already succeeded. Business logic and
side effects belong to the services called by the workflow.

## Overview

```text
workflow source
      |
      v
+------------------------+
| Centimanus             |
| - loads the program    |
| - calls the workflow   |
| - keeps node outcomes  |
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
The program is compiled once per execution and the workflow is then called
like any other function. It runs top to bottom: a node executes its body,
persists the outcome and returns the value, and the next line follows.

```text
run: find-lead EXECUTE -> persist -> send-email EXECUTE -> persist -> done
```

Node outcomes are what makes an execution resumable: re-running the same
execution id returns the stored value instead of calling the service again, so
a run interrupted halfway continues from where it stopped rather than paying
for the calls it already made. That makes each node the durable unit of work.

### Node state is scratch, not storage

Node outcomes live in the state store only so a resumed execution does not
re-issue the microservice calls the run already paid for. The durable record is
rp-dag, which receives every node as it completes. When a run ends — finished,
failed, or out of budget — the engine deletes the `rt:task:<execId>:*` keys it wrote, so
completed work leaves nothing behind. Keys a workflow sets itself through
`rt.set` are its own and are never touched.

## Writing workflows

### Use a node for every side effect

Wrap every external call, state mutation, LLM request, or other side effect in
`rt.node` or `rt.attempt`. Only a node's outcome is kept, so only a node is
skipped when an execution is resumed.

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

### Delegate a step to another workflow with `rt.sub`

A workflow that composes work (a "smart" one) hands each unit to the workflow
that owns that single operation (a "dumb" one), instead of reimplementing it:

```js
var unpacked = rt.subAttempt("unpack:" + id, "workflows/wf-file-unpack.js", {
  fileId: id,
});
if (unpacked.ok) use(unpacked.value.entries);
```

Delegation is an ordinary call. The parent blocks inside its host call while
the engine runs the child on its own QuickJS runtime, then stores the child's
outcome under the parent's node key and returns it. A delegation therefore
caches and resumes exactly like a node, and the child gets its own execution id
and its own node history.

The child runs inline on the same thread. It is deliberately not an NRPC hop
back into `centimanus`: the transport has a single handler thread, so a self
call would park that worker on its own reply and deadlock, and `run_mutex` is
already held by the run in flight. Nesting is capped (`max_sub_depth`).

`rt.sub` throws when the child fails; `rt.subAttempt` returns
`{ ok, value } | { ok, error }` so one bad item cannot lose the batch.

A delegation is a node in every respect: same outcome shape, same key, same
per-node log to rp-dag, and the same end-of-run cleanup. Nesting is capped at
`vm.max_sub_depth` — the cap lives in the VM, not in a transport, so a
self-delegating workflow always terminates whichever transport it runs on.

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

## Workflow delivery

Centimanus does not own a workflow catalogue and never addresses the object
registry. Ptah selects workflow descriptors from the active Solutions and puts
that selection into the DAG service's `WORKFLOWS` environment.

Before execution, Centimanus obtains the selected descriptor from the DAG
service. The descriptor identifies the script and its Ptah-proxy location.
Centimanus reads the raw JavaScript directly from that proxy, then evaluates
it. Ptah-proxy is the only component that fetches registry objects and caches
their bytes; the DAG service only publishes descriptors and execution state.

```text
Solution -> Ptah -> DAG service (active descriptors)
                       |                 ^
                       v                 |
                  Centimanus -> Ptah-proxy
```

This keeps solution selection, registry delivery, execution and observability
separate. A script outside the descriptor set is not executable.

## Design constraints

- A node callback runs at most once per execution id; a resumed execution
  reads the stored outcome instead.
- Time a node spends waiting on a service is not charged to the workflow's
  execution budget, which bounds the flow code's own compute.
- Node outcomes are retained by the configured state backend; cleanup and TTL
  are not currently managed by Centimanus.
- Workflows should keep node callbacks small, deterministic where possible,
  and safe to retry at the service boundary.

See `examples/workflows/` for complete workflow examples.
