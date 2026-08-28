## Architecture

Converged is designed as a modular platform, but not as a chaotic collection of microservices. The separation is simple: the interface shows data and launches actions, Runtime executes processes, microservices own data, and adapters connect equipment and external systems.

```text
User / client
        ↓
UI and micro-frontends
        ↓
Runtime: workflows, cron, integrations, AI actions
        ↓
Microservices: typed APIs and owned data
        ↓
Storage / Behemoth / files / SQL / KV / metrics
        ↓
Equipment, messengers, payment and external services
```

Microservices intentionally stay thin. Each service is responsible for its data area, validation, and typed API. It should not know the internal logic of neighboring services and should not become a hidden center of business processes. This lowers coupling and makes the system easier to maintain.

All cross-domain logic is moved into Runtime. If the system needs to accept an order, query several services, create a task, send a notification, wait for an event, and update status, that is executed in a workflow. Runtime does not store persistent state itself: it writes history, variables, and results through the services that own their storage.

Storage is built around isolation. Instead of one shared database, each domain gets its own data boundaries: SQL, key-value, file storage, column data, vector indexes, or graph relations where needed. This approach helps move workspaces, limit access, and avoid a common database where different clients’ data is mixed.

The frontend is modular as well. The shared shell loads independent micro-frontends through an import map, so individual interface areas can evolve without rebuilding the entire product. For the user it remains one system, while development keeps clear areas of responsibility.
