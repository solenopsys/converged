## Processes

The main problem of a growing workshop is rarely the lack of one more button. More often, processes live in people’s heads: who must answer the client, when to calculate the price, who checks the file, when production starts, whom to notify about a delay, and what happens after shipment.

In Converged, these chains are described as workflows. A typical process can go from request to estimation, approval, queueing, production, quality control, payment, delivery, and notifications. The user usually does not build a graph from scratch: ready-made scenarios ship with the solutions, and configuration comes down to rules, roles, deadlines, integrations, and notifications.

Technically, execution is moved into the Runtime layer. It runs workflows, cron jobs, integration steps, and business logic while remaining stateless: persistent data stays in microservices, and Runtime is responsible for executing chains. This keeps business logic from being scattered across dozens of services and leaves one clear place where process rules live.

For complex deployments, workflows can be extended. A developer describes scenarios as typed TypeScript classes, and AI agents can launch permitted actions inside those scenarios. But for a regular user, the goal is different: not to build a constructor, but to enable a ready process and get a managed result.
