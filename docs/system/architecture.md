# System architecture

Converged is a modular operating layer for manufacturing businesses. Its user
interfaces, domain services, workflow engine, storage, media gateway and
industrial processors form one system without becoming one application.

The architecture separates three kinds of work:

- domain modules own business data and user-facing capabilities;
- native runtime services move messages, execute workflows, store data and
  handle real-time media;
- the control plane decides which parts run for each platform and tenant.

## One message bus

Runtime components communicate through Fujin. Every process opens one
connection, registers a target and sends messages to logical destinations.
The sender does not need the address or deployment location of the receiver.

```text
browser and mobile clients
          |
          v
          Fujin message bus
       /     |      |      \
      ui     ms  Centimanus Resonus
              \      |      /
               \  Behemoth /
```

This removes the HTTP call graph and service mesh from the application layer.
Routing, request correlation and trusted tenant context travel in the common
message envelope. A receiving process then selects the requested service or
handler inside its own boundary.

## Core runtime

| Component | Responsibility |
| --- | --- |
| Fujin | Connects runtime peers and routes messages to the live owner of a target. |
| Behemoth | Provides isolated SQL, key-value, column, vector, graph and file storage. |
| Centimanus | Executes multi-step business workflows as replayable graphs. |
| Resonus | Handles real-time media, calls, transcription and AI sessions. |
| Ptah | Reconciles the desired platform, solutions and tenants into Kubernetes resources. |

The components are deliberately narrow. Fujin does not understand business
services. Behemoth does not orchestrate business operations. Centimanus does
not own domain data. Resonus does not decide tenant identity. Ptah creates and
configures workloads but does not participate in runtime messaging.

## Modules and solutions

Business capabilities are delivered as microservices, microfrontends and
workflows. A solution is a declarative selection of those modules for a
particular operating scenario, such as order handling, production planning or
equipment monitoring.

Microservices own their data and expose typed contracts. They do not call one
another to coordinate a process. Cross-domain sequences belong to workflows,
which Centimanus executes one durable step at a time. This keeps domain modules
small and allows a solution to combine them without creating hidden coupling.

## Data isolation

Each microservice has its own physical storage root. Behemoth can serve many
roots from one process, but it preserves their ownership boundaries and refuses
to create data outside the configured mounts.

The same model scales across deployment profiles:

- an edge installation can run one Behemoth instance for the platform;
- a larger installation can divide scopes across storage shards;
- a cloud installation can run an isolated storage instance per tenant.

Changing the topology does not change application code because peers continue
to address logical targets and storage boundaries.

## Control plane

Ptah is the control plane and is not connected to Fujin. It observes the
declared Platform, Solution and Tenant resources, calculates the desired
workloads and reconciles them with Kubernetes.

```text
Platform + Solutions + Tenants
              |
              v
             Ptah
              |
              v
Deployments, Services, volumes, configuration and routes
```

This separation lets the runtime stay focused on business traffic while the
deployment model handles placement, storage topology, tenant routes and
lifecycle. The same application images can therefore run on a compact edge
cluster or in a multi-tenant cloud environment.

## Trusted context

Tenant scope is established at the platform edge and carried in the message
envelope. Runtime services consume that trusted context instead of deriving a
tenant from application payloads. Storage placement, service calls and media
sessions all preserve the same scope boundary.

Together, logical messaging, isolated storage, replayable workflows and a
separate control plane allow Converged to remain modular without pushing
distributed-system complexity into every business module.
