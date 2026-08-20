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
[`manifests/crds.yaml`](manifests/crds.yaml):

| Resource | Role |
|---|---|
| `Platform` | Base shared platform: routing, storage, cache, applications, and module map. |
| `Solution` | Product overlay that contributes modules, workflows, environment, and optional extra resources to a platform. |
| `Tenant` | Cloud-platform site with an isolated storage shard, scope-aware routes, and selected solutions. |

The controller reconciles them in this order: `Platform`, `Solution`, then
`Tenant`. A `Solution` does not own Kubernetes objects directly; the
referenced platform incorporates its enabled configuration.

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
