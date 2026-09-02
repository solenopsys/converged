# Ptah control plane

Ptah turns a Converged platform description into running Kubernetes resources.
It is the system's control plane: it decides what should exist for a platform,
which solutions are active and how tenant workloads and storage are placed.

## Desired platform model

The deployment model has three layers:

| Resource | Meaning |
| --- | --- |
| Platform | Shared runtime, routing, storage profile, applications and module map. |
| Solution | A set of business modules, workflows and processors added to a platform. |
| Tenant | An isolated site with its own scope, routes and, when required, storage shard. |

Ptah observes these resources and produces the complete desired set of
deployments, services, volumes, configuration and routes. Kubernetes then
converges the cluster on that description.

```text
Platform + Solution + Tenant
              |
              v
             Ptah
              |
              v
Kubernetes workloads, storage and routes
```

## Policy and mechanism

Ptah separates cluster mechanics from product policy. The native controller
observes Kubernetes, applies resources, records status and removes obsolete
objects. A pure policy layer converts observed platform data into a desired
result without making network calls or modifying the cluster itself.

The same policy can therefore be evaluated before deployment. This makes
placement and lifecycle decisions inspectable without reproducing them in a
second configuration generator.

## Deployment profiles

Profiles change storage placement without changing application images:

- `mono` runs one storage instance for a compact platform;
- `multi` divides scopes between storage shards;
- `cloud` gives each tenant an isolated storage instance and route boundary.

The volume ownership rule remains the same in every profile: each microservice
has its own storage volume. Ptah decides which Behemoth instance mounts those
volumes and publishes the scope-to-storage mapping used by stateless workloads.

## Modules and rollout

Solutions name modules rather than embedding their bytes. Ptah distributes a
content-addressed module map and serves immutable module content through a
shared cache. Consumers receive the exact digest they should load.

When the selected digest changes, the workload description changes with it and
Kubernetes performs the rollout. A running pod therefore records the precise
module content it started with, and rollback means selecting the previous
digest again.

## Safe reconciliation

Ptah applies a complete desired set and prunes resources that no longer belong
to it. Data-bearing resources are retained unless deletion is explicitly
requested. Incomplete input or a policy failure suppresses pruning, preventing
a temporary dependency problem from being interpreted as a request to remove
the platform.

## Place in the system

Ptah is not a peer on the Fujin message bus and does not process business
traffic. It creates and configures the peers, storage and routes that make up
the runtime. Once they are running, Fujin, Behemoth, Centimanus and Resonus
perform their work independently of the control plane.
