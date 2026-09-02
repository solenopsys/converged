# Centimanus workflow runtime

Centimanus executes the multi-step processes that connect otherwise independent
Converged modules. Order routing, notifications, approvals, AI-assisted work
and production sequences can evolve as workflows without moving orchestration
into domain services.

## Replayable execution

A workflow is a program whose meaningful operations are divided into named
nodes. Centimanus executes one unfinished node, records its outcome and then
evaluates the workflow again. Completed nodes return their stored results
instead of repeating their side effects.

```text
first pass:   find order -> store result
second pass:  replay order -> reserve machine -> store result
third pass:   replay both -> notify operator -> complete
```

Branches and loops can depend on earlier results, so the graph emerges from the
process itself rather than from a separate static diagram. The recorded node
outcomes make progress explicit and allow execution to continue from the first
unfinished step.

## Why workflows are separate

Domain microservices in Converged own data and small business capabilities.
They do not call one another to implement an end-to-end process. This avoids
hidden chains in which a change or failure in one service unexpectedly affects
many others.

Centimanus is the place where cross-domain coordination is visible. A workflow
can call services, request AI work and choose the next step while each service
remains focused on its own boundary.

## Workflow delivery

Solutions determine which workflows are active. Ptah publishes that selection,
the DAG service exposes the selected descriptors, and Centimanus loads the
corresponding content through Ptah's content-addressed proxy. A workflow that
is not part of the active solution is not available for execution.

This separates four concerns: product selection, content delivery, execution
and observability. Each can change without turning the workflow runtime into a
module registry or deployment controller.

## Reliability boundary

Centimanus records completed node outcomes, but external operations must still
respect their own idempotency rules. Workflow telemetry is used for visibility;
it does not decide execution state. Business data remains in the services that
own it rather than becoming workflow-engine state.

## Place in the system

Centimanus receives work and calls services through Fujin. It uses platform
storage for workflow progress and reports lifecycle events for monitoring. It
does not own domain records, select active solutions or route messages between
other peers.
