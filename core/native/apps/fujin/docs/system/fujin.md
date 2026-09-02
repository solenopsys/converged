# Fujin message bus

Fujin is the communication center of the Converged runtime. It gives browsers,
domain services, storage, workflows, media services and processors one shared
way to exchange messages.

## Why it exists

A modular platform needs components to move independently. Direct HTTP links
would make every service aware of addresses, replicas and deployment topology.
Fujin replaces those links with logical targets: a sender states which runtime
peer should receive a message, and Fujin forwards it to the live connection
that currently owns that target.

```text
sender -> logical target -> Fujin -> live connection -> local service
```

The sender does not know where the receiver runs. A process can restart or move
to another node and reclaim the same target without changing its callers.

## Routing model

Fujin makes one routing decision: it maps a target to a connection. The target
selects a process such as the UI runtime, domain services or Centimanus. The
service name inside the message is interpreted only after the receiving process
gets it.

Keeping those decisions separate is important. Fujin remains a small message
broker rather than becoming a registry of every business service, storage unit
or workflow.

## Browser and cluster traffic

Native peers connect through the cluster transport. Browsers and mobile clients
enter through WebSocket and participate in the same messaging model. This gives
interactive interfaces live events without introducing a second application
routing system.

Large payloads stay outside the browser control channel. Clients receive an
availability event and retrieve the data through the appropriate content path,
which keeps real-time signaling responsive.

## Context and trust

The common message envelope carries correlation data, deadlines, errors and
the trusted tenant scope. Fujin transports that context without deriving it
from a business payload or changing its meaning. Receiving services can apply
authorization and storage rules against the same context established at the
edge.

## Responsibility boundary

Fujin owns connectivity and target routing. It does not execute business logic,
select a handler inside another process, store domain data or decide deployment
placement. Those responsibilities stay with the runtime peer that receives the
message and with Ptah as the control plane.
