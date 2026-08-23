## Technologies

The server side of Converged is built on **Bun** and **Elysia**. Bun starts JavaScript and TypeScript quickly, uses memory efficiently, and fits compact edge deployments. Elysia is used as the HTTP layer for backend plugins and microservices.

Service contracts are described with types. NRPC binds TypeScript interfaces to implementations and generates client packages, so the frontend, Runtime, and backend work with the same contracts instead of disconnected string-based APIs.

Data storage uses a set of lightweight stores for different tasks: SQL, key-value, files, column data, vector indexes, and graph relations. The native Behemoth layer and Zig adapters cover tasks where low overhead, equipment access, Unix sockets, or FFI matter.

The frontend is a React platform with micro-frontends. The shared shell loads separate UI modules, and product scenarios can evolve independently. This matters for a platform with many solutions: the interface should not become one heavy monolith.

Orchestration and delivery are built around k3s, Helm, and configuration profiles. The same component set can be assembled into a compact mono profile or split into groups for production.
