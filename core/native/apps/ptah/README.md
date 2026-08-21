# Ptah

Ptah is a Kubernetes operator written in Zig. It observes `Platform`,
`Solution`, and `Tenant` resources, evaluates their business rules in
JavaScript, then applies the resulting Kubernetes resources.

Zig owns the controller mechanics. The policy owns the product-specific
decision of what a platform, solution, or tenant should produce.

## Architecture

```text
Kubernetes API
      |
      v
+-----------------------+
| Ptah controller (Zig) |
| - list custom objects |
| - leader election     |
| - apply and prune     |
| - write status        |
+-----------+-----------+
            |
            | ReconcileInput JSON
            v
+-----------------------+
| Policy (JavaScript)   |
| observed -> desired   |
| no I/O, clock, or API |
+-----------+-----------+
            |
            | ReconcileOutput JSON
            v
desired Kubernetes resources
```

The policy runs in a fresh QuickJS evaluation for each reconcile. It cannot
call Kubernetes, access the network, read time, or mutate the cluster. The
same policy can therefore be evaluated offline before deployment.

## Resources

Ptah defines three cluster-scoped custom resources in
[`chart/crds/crds.yaml`](chart/crds/crds.yaml):

| Resource | Role |
|---|---|
| `Platform` | Base shared platform: routing, storage, applications, and module map. |
| `Solution` | Product overlay that contributes modules, workflows, environment, and optional extra resources to a platform. |
| `Tenant` | Cloud-platform site with an isolated storage shard, scope-aware routes, and selected solutions. |

The controller reconciles them in this order: `Platform`, `Solution`, then
`Tenant`. A `Solution` does not own Kubernetes objects directly; the
referenced platform incorporates its enabled configuration.

### Profiles

`spec.profile` decides one thing — how storage is divided. Everything else is
identical across the three, including the images.

| Profile | Storage topology |
|---|---|
| `mono` | One behemoth Deployment for the platform. |
| `multi` | One behemoth per entry in `spec.shards`, each owning a set of scopes. |
| `cloud` | No storage on the platform; the Tenant reconciler owns one behemoth per tenant. |

`mono` and `multi` publish a platform-wide `HTTPRoute`. `cloud` does not: a
catch-all there would shadow the hostnames its tenants own.

A `multi` shard set is validated before anything is emitted from it — a scope
may be claimed by exactly one shard, and exactly one shard must claim `"*"`.
Both are rejections rather than repairs, because either mistake silently sends
a scope to the wrong disk, and a wrong disk looks exactly like an empty one:

```json
"shards": [
  { "name": "alpha", "scopes": ["acme", "globex"], "size": "50Gi" },
  { "name": "rest",  "scopes": ["*"] }
]
```

`multi` and `cloud` publish the same ConfigMap under the same key —
`<platform>-domains` / `STORAGE_TENANT_SERVICES` — so a stateless pod resolves
a scope to a storage host without knowing which profile put it there.

### Processors

`spec.apps` are the always-on peers of the bus: fujin, centimanus, resonus.
`spec.processors` are compute peers — slicers, CAM, converters — that are
declared on the platform but deployed only while a solution lists them in
`spec.processors`. Declaring one therefore costs nothing until it is selected,
and selecting a name the platform never declared is an error rather than a
silent skip: the alternative is a workflow waiting forever for a peer nobody
started.

### Module registry

Solutions name modules; they do not carry them. `spec.registry` says where the
bundles and the base solution configuration are fetched from and where they are
cached:

```json
"registry": {
  "url": "https://s3.eu-central-1.amazonaws.com/converged-modules",
  "solutions": "solutions/converged.json",
  "revision": "2026-08-21",
  "cacheSize": "4Gi"
}
```

Ptah publishes these as `MODULE_REGISTRY`, `MODULE_REGISTRY_SOLUTIONS`,
`MODULE_REGISTRY_REVISION` and `MODULE_CACHE_DIR` — in the module ConfigMap and
in the ui and ms environments — and mounts the cache directory as an
`emptyDir`. The cache is ephemeral on purpose: it is re-fetchable by
definition, and a shared claim would need RWX and turn a disposable directory
into a piece of cluster state.

`revision` participates in the rollout digest. Pointing a platform at new
content changes nothing the running pods can observe unless they restart, so
the stamp has to move with it.

The policy only propagates these values. It has no I/O, so it cannot fetch
anything itself — the fetch belongs to whoever consumes the registry.

## Reconciliation

For each custom resource, Ptah builds a `ReconcileInput` containing the target
object and the related platform, solutions, and tenants. The policy returns:

```ts
{
  resources: KubeObject[];       // complete desired set for this owner
  status: Record<string, unknown>;
  requeueAfter: number;          // optional earlier retry in milliseconds
  prune?: boolean;               // false prevents deletion on incomplete input
}
```

Ptah server-side applies every returned object, then prunes objects it owns
but the desired set no longer contains. All managed objects must carry these
labels:

```text
app.kubernetes.io/managed-by: ptah
ptah.io/owner: <kind>.<name>
```

Pruning is intentionally conservative. Data-bearing resources are retained
unless they explicitly declare `ptah.io/reclaim: delete`. A policy error or an
incomplete dependency must return `prune: false`; this prevents a transient
problem from being interpreted as a request to delete all owned resources.

## Behemoth storage

Behemoth also runs the platform's cache. Valkey is in-process, so ptah deploys
no cache workload of its own — it only publishes the second port on the storage
Service and points `CACHE_URL` at it. Under `cloud` there is no platform-wide
value at all: the shard is per tenant, and the scope index resolves it per
request.

Ptah gives every active microservice one isolated static `PersistentVolume`
and one pre-bound `PersistentVolumeClaim`. All stores owned by that
microservice are directories inside the same volume; stores are not split into
additional disks. A Behemoth pod mounts all of those claims and reads its
microservice-to-root map from `storage.json` in a generated ConfigMap.

This granularity is the same in every profile. What changes is how many
behemoth pods that set of volumes is spread across: one for `mono`, one per
shard for `multi`, one per tenant for `cloud`.

The map is keyed by **store id**, not by module name. A Solution lists
`orders`, but the running service asks its storage for `orders-ms` — that
identifier is compiled into the service, and Behemoth matches it exactly and
refuses any root it was not given. Emitting the bare name would mount every
disk correctly and still fail every store open:

```json
{ "microservices": { "orders-ms": "/app/data/converged-storage-orders" } }
```

The Platform storage spec supplies a Kubernetes PV source template. Ptah
recursively replaces `{{volume}}`, `{{platform}}`, `{{tenant}}`, `{{shard}}`,
and `{{microservice}}` in its string values. The template must resolve to a
unique source for each microservice. A local-cluster MVP can use:

```json
{
  "storageClassName": "local-path",
  "mountBase": "/app/data",
  "volumeSource": {
    "hostPath": {
      "path": "/var/lib/ptah/{{volume}}",
      "type": "DirectoryOrCreate"
    }
  }
}
```

For a multi-node cluster, use a suitable `local`, `nfs`, or `csi` source and
set `storage.nodeAffinity` when the selected volume type requires it.

## Policy

The policy source is in [`policy/src`](policy/src) and is bundled into the
binary during `zig build`. It is TypeScript compiled to a single JavaScript
bundle for QuickJS.

Keep policy code pure:

- Derive desired objects only from `ReconcileInput`.
- Return a complete `resources` list when `prune` is enabled.
- Use `status` for user-visible state and `requeueAfter` for dependency waits.
- Do not put Kubernetes API calls, retries, timers, or other side effects in
  the policy.

## Commands

```bash
# Continuously reconcile the cluster. Uses leader election when enabled.
ptah run

# Reconcile once and exit; --dry-run reports work without changing the cluster.
ptah apply [--dry-run]

# Evaluate the policy locally without Kubernetes.
ptah render examples/platform-cloud.json
ptah render examples/platform-multi.json
```

`render` accepts a serialized `ReconcileInput` and prints the desired resource
array. The files in [`examples`](examples) are ready-to-run inputs.

## Configuration

`PTAH_RESYNC_MS`, `PTAH_LEADER_ELECTION`, and `PTAH_IDENTITY` are required for
controller commands. In a cluster, Ptah uses the mounted service account and
its namespace. Outside a cluster, also set `PTAH_KUBE_SERVER`,
`PTAH_NAMESPACE`, and optionally `PTAH_KUBE_TOKEN`.

## Verification

```bash
zig build test
(cd policy && bun test)
```
