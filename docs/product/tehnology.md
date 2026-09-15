## Technologies

Converged is built on a compact systems foundation designed for high performance and efficient resource usage across Kubernetes environments of any scale — from a single microcomputer to a distributed cluster.

At the core of the infrastructure is **Zig** — a modern, extremely fast, and simple systems programming language. Zig is used for infrastructure elements where performance, resource efficiency, hardware access, and low-level control matter.

**Cruller** provides the execution environment for TypeScript and JavaScript. It is a specialized runtime derived from Bun and adapted to the architecture and requirements of Converged.

**Behemoth** provides a unified data layer supporting different storage models, including SQL, key-value data, files, vectors, and other specialized data structures. Storage can be distributed and scaled according to the requirements of each deployment.

**Fujin** provides the communication layer, connecting Services, interfaces, events, and equipment through a unified real-time communication fabric. **Centimanus** executes Workflows and manages their dependencies, parallel execution, events, retries, and long-running operations.

Converged always runs in **Kubernetes**. The base environment is **k3s**, a lightweight Kubernetes distribution that makes the same deployment model practical even on small edge devices such as Raspberry Pi. On a single machine, Converged runs as a compact single-node cluster; when required, the same cluster can be distributed across multiple machines.

This provides one consistent technology foundation across the entire infrastructure — from a small edge device to a distributed cloud cluster.
