## Performance

Converged is designed for production sites that do not always have a large server fleet. The system therefore avoids unnecessary weight: Bun reduces backend process overhead, Runtime stays stateless, and microservices can be grouped by load type instead of running hundreds of separate containers.

Performance comes from architecture, not from one trick. Data does not pass through unnecessary layers, services own their stores, Runtime parallelizes workflows and cron jobs, and native adapters are used where HTTP or a regular JS layer would add too much overhead.

A compact installation can run on a small server or single-board computer if the workload matches the scale of the workshop. As the company grows, Runtime, microservices, and storage groups can be separated to use more CPU cores, isolate heavy tasks, and prevent one bottleneck from stopping the whole system.

The platform does not promise infinite performance “out of the box”. Bottlenecks depend on equipment, file volume, order count, AI providers, and integrations. Converged’s architecture allows a company to start compactly and scale only the parts that actually become hot.
