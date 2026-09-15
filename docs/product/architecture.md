## Architecture

Converged is built as a modular execution environment in which the interface, business logic, and infrastructure are separated while operating as a single system.

At the user level, the system consists of **Surfaces**, which organize the working context, and **Projections** — individual screens designed to solve specific user tasks.

Business logic is implemented in **TypeScript** through several types of **Services**: Repositories, Lambdas, and Runtimes. More complex processes are assembled into **Workflows**, which are executed through the DAG processing engine Centimanus.

At the foundation of the system are **Apps**. They are infrastructure execution environments with a compact Zig core in which TypeScript scripts run. Apps provide the fundamental capabilities on which Services, Workflows, and the UI operate.

```text
User
  ↓
Surfaces
  └── Projections
        ↓
Services — TypeScript
  ├── Repositories
  ├── Lambdas
  └── Runtimes
        ↓
Workflows
        ↓
Apps — Zig + TypeScript
  ├── Fujin
  ├── Centimanus
  ├── Resonus
  ├── Behemoth
  ├── Ptah
  └── Cruller
        ↓
Kubernetes
  ↓
Edge / Server / Cluster
```

### Surfaces and Projections

A **Surface** is a user workspace organized around a specific working context. It brings together the data, actions, and views required to work within a particular area.

A Surface does not have to correspond to a single Service. It can combine data and actions from multiple Repositories, Lambdas, Runtimes, and Workflows.

A **Projection** is an individual screen within a Surface, designed to perform a specific function. It presents data in a form convenient for the user and provides the required actions.

The interface is therefore organized around **what the user is working with**, rather than around the internal structure of Services.

### Services

Converged business logic is written in TypeScript and divided into several types of Services.

**Repositories** encapsulate data access. They provide an interface for reading, modifying, and querying data while hiding the underlying storage mechanism.

**Lambdas** are stateless functions designed for individual operations such as data processing and transformation, computation, validation, or acting as gateways to external APIs.

**Runtimes** provide specialized execution environments for logic that requires its own execution context.

Services are the building blocks of the system. They do not need to know about the business processes in which they will be used and can be reused by different Surfaces and Workflows.

### Workflows

A **Workflow** combines Services into a complete business process.

Instead of connecting Services through direct calls, a Workflow defines which operations must be performed, in what order, which steps can run in parallel, where the system must wait for an event, and what should happen when an operation fails.

For example:

```text
Order
  ↓
Payment
  ↓
Slicing
  ↓
Production
  ↓
Delivery
```

A Workflow can use Repositories for data operations, Lambdas for individual operations, and Runtimes or Apps for specialized tasks.

### Centimanus

**Centimanus is the DAG engine that executes Workflows.**

A Workflow is represented as a graph of operations, while Centimanus manages its execution: dependencies between steps, retries, event waiting, parallel operations, and compensation on failure.

Every execution produces an audit trail showing what was started, what completed, which operations were retried, and why a failure occurred.

This makes it possible to build long-running, resilient processes that preserve execution state and can continue after a restart.

Services remain independent because they do not need to be connected through direct call chains to implement a particular business process.

### Apps

**Apps are the infrastructure foundation of Converged.**

An App is a lightweight virtual execution environment. Its system core is written in **Zig**, while mutable logic runs as **TypeScript scripts**.

This separation keeps critical infrastructure in a compact, high-performance core while retaining the flexibility of TypeScript for application logic and configuration.

Apps provide the infrastructure capabilities used by the rest of the system:

* **Fujin** — communication fabric for commands, events, WebSockets, and machine telemetry.
* **Centimanus** — DAG processing and Workflow execution.
* **Resonus** — realtime gateway for voice, media, transcription, and AI providers.
* **Behemoth** — isolated multi-storage for different types of data.
* **Ptah** — deployment and Kubernetes topology management.
* **Cruller** — runtime in which UI and TypeScript modules execute.

Apps are not another layer of business logic. They provide the **infrastructure and execution environments** in which the TypeScript layer operates.

### Fujin

**Fujin is the unified fabric for commands, events, and telemetry.**

All system components communicate through Fujin instead of making direct calls to one another. A command from the UI, a Workflow event, a machine sensor reading, or a production progress update all pass through the same communication layer.

WebSockets deliver changes to the interface in real time without polling.

Because communication passes through a single layer, it can be centrally traced, replayed, and rate-limited.

**Result:** Services remain independent, realtime becomes part of the common infrastructure, and system events become observable.

### Resonus

**Resonus is a unified realtime interface for voice, media, and AI.**

It combines phone calls, audio streams, transcription, and AI provider adapters within a single layer.

A conversation can move from a phone call to transcription and then to AI analysis without passing between separate systems. Media can be directly associated with orders, equipment, and events.

Provider adapters isolate the system from individual voice and AI vendors.

**Result:** voice, media, and AI become part of the common Workflow environment, while providers can be replaced without restructuring application logic.

### Behemoth

**Behemoth is the unified multi-storage system for Converged data.**

Different types of data are provided with appropriate storage: SQL for orders and customers, files for models and documents, vectors for AI search, cache for hot state, and other specialized storage types where required.

Isolation is structural: data from different workspaces is not mixed and can be scaled, backed up, and moved independently.

The same model works across Edge, Server, and Cluster deployments. On a small Edge device, all storage domains can reside on a single node; in a Cluster, they can be distributed across specialized storage hardware.

**Result:** data is isolated by construction, while storage infrastructure can grow with the installation without changing the application layer.

### Ptah

**Ptah is the Converged deployment orchestrator on top of Kubernetes.**

It manages the placement of Apps, containers, and data according to the deployment topology: Edge, Server, or Cluster.

The Ptah core is written in Zig, while management rules are implemented as TypeScript scripts. This allows placement, rollout order, failover, and data distribution logic to change without rebuilding the core.

The same mechanism is used for different installation types — from a single Edge node to a distributed cluster.

**Result:** the entire system is managed through a unified deployment layer, while deployment logic remains dynamic and changeable.

### Cruller

**Cruller is the runtime for UI and TypeScript modules.**

It provides the environment in which Converged TypeScript logic executes, including the UI and application modules.

Cruller connects the dynamic TypeScript layer with the infrastructure capabilities provided by Apps, allowing the application layer to evolve without modifying the low-level core.

### Kubernetes and Topology

All Apps and related components are deployed through **Kubernetes**.

Converged uses the same architectural model regardless of installation scale:

```text
Edge
  → single node

Server
  → single server with greater resources

Cluster
  → multiple nodes and distributed storage
```

The physical topology changes, but the application model does not. Services, Workflows, Surfaces, and Projections operate in the same way whether the system is running on an Edge device or across a full cluster.

### Unified Model

The different parts of Converged are organized around different responsibilities:

**Surface** — user working context.
**Projection** — a specific function and its visual representation.
**Repository** — data access.
**Lambda** — an individual stateless operation.
**Runtime** — a specialized execution environment.
**Workflow** — a business process that combines Services.
**Apps** — infrastructure execution environments with a Zig core and TypeScript inside.
**Fujin** — communication and events.
**Centimanus** — Workflow execution.
**Resonus** — realtime voice, media, and AI.
**Behemoth** — storage.
**Ptah** — deployment and Kubernetes management.
**Cruller** — execution environment for UI and TypeScript.

The central principle of Converged is to **separate user context, application logic, and infrastructure without forcing them into the same structure**.

A Surface can combine multiple Services. A Workflow can combine multiple operations. And multiple Workflows and Services can use the same underlying Apps.

The result is a system that remains modular at the business-logic level, compact at the infrastructure level, and unified from the user's perspective.
