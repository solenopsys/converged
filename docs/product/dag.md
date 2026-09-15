## Processes

### Architecture Without a Dependency Network

Converged is an open platform where the community can create, connect, and continuously update thousands of Services, modules, and Workflows. These components evolve independently while still needing to work together precisely.

In traditional service architectures, this creates a serious problem as the system grows: every new component can introduce new connections to existing components. Direct calls, dependency chains, service mesh, routing, and failure handling gradually create a separate layer of increasing complexity. When thousands of components are developed and updated independently, maintaining such a network of connections becomes increasingly difficult.

**Converged solves this problem architecturally: Services know nothing about each other and never call each other directly.** Instead of a network of direct dependencies, the system uses two levels of composition: the UI combines data, while Workflows combine operations into business processes.

### Data and Business Process Composition

At the UI level, data from multiple Services can be requested in parallel and combined within a single user context. Lightweight stateless functions can retrieve data from different sources, transform it, and produce the data required by a Surface or Projection. The Services themselves do not need to know where or alongside which other data their results will be used.

Operations and automated processes are handled through **Workflows**. A Workflow is an individual scenario composed of a sequence of scripts and operations. It defines which actions should be performed, in what order, which steps can run in parallel, where the process must wait for an event, and what happens when an operation fails.

The platform can contain **thousands of independent Workflows**. Each can use existing Services and scripts without creating direct dependencies between the Services themselves.

For example, one Workflow can combine a request, price calculation, approval, queueing, production, quality control, payment, and delivery. Another Workflow can use the same Services for an entirely different process.

### Execution Through Centimanus

**Centimanus** is the DAG engine that executes Workflows. It manages dependencies between steps, parallel execution, event waiting, retries, failure recovery, and the state of long-running processes.

Each Workflow is an independent scenario, while Centimanus provides a unified execution mechanism for all of them. Adding a new process therefore does not require changing existing Services or creating new direct connections between them.

This is particularly important for an open platform. The community can add new Services, scripts, and Workflows without creating a cascade of dependencies throughout the system.

**As a result, the number of components and processes can grow into the thousands without the complexity of their relationships growing proportionally.** Services remain independent, data is composed at the UI level, and operations are combined through individual Workflows.

This gives Converged an architectural advantage in scaling: the system can expand through new components and scenarios without turning their interaction into an ever-growing network of direct dependencies.

### Open Ecosystem

For developers, new capabilities are added through Services, stateless scripts, and Workflows. AI agents can also launch permitted actions within existing scenarios while remaining within defined rules and constraints.

For regular users, this complexity remains hidden. They do not need to manage Services, build graphs, or understand their dependencies. Ready-made Workflows are delivered with solutions, while users can configure them through rules, roles, deadlines, integrations, and notifications.

**The user simply enables the required process and gets a managed result.**
