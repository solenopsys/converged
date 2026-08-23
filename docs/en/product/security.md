## Security

Converged starts from the assumption that production data should not be thrown into one shared pile. Orders, client files, technological parameters, payments, messages, and equipment telemetry must be separated by workspaces and responsibility zones.

Architecturally, this is supported by data isolation. Microservices own their stores, and workspaces can have separate directories, keys, files, and access boundaries. This simplifies export, self-hosted migration, backups, and audit.

Access rights apply not only to people, but also to AI agents. If a model launches an action, reads data, or calls a workflow, it must happen within its permission profile. Actions are logged, so it is possible to reconstruct who or which agent initiated a step, what data was affected, and how the scenario ended.

Self-hosted and private deployments give the client full control over infrastructure: network, secrets, API keys, backups, and physical data location. Cloud mode is operationally easier, but should not become vendor lock-in: data must remain portable, and scenarios must remain reproducible in another installation.
