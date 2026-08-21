# Ptah

Ptah is a Kubernetes operator written in Zig. It observes `Platform`,
`Solution`, and `Tenant` resources, evaluates their business rules in
JavaScript, then applies the resulting Kubernetes resources.

Zig owns the controller mechanics. The policy owns the product-specific
decision of what a platform, solution, or tenant should produce.

## Architecture

```text
Kubernetes API
      ^
      | HTTPS via mbedTLS (src/tls.zig)
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

### Why the apiserver connection is not `std.http`

Zig's TLS client has no branch for the TLS 1.3 CertificateRequest message:
`certificate_request` exists as an enum value in `std.crypto.tls` and is never
handled in the client's handshake state machine. A Kubernetes apiserver sends
one whenever client-certificate authentication is configured, which is the
default, so every handshake ends in `error.TlsUnexpectedMessage` — before any
certificate is examined, and regardless of how the CA or the hostname are
configured.

[`src/tls.zig`](src/tls.zig) therefore implements the transport over mbedTLS,
built from the wrapper in `core/native/wrappers/protocols/mbedtls`. It is only
what an apiserver conversation needs: one request per connection, an explicit
CA bundle, `Content-Length` and chunked bodies. Two details of that build are
worth knowing, because neither matches what its README says:

- it is mbedTLS **4.x**, where randomness comes from PSA — there is no
  `mbedtls_ssl_conf_rng`, and `psa_crypto_init()` must be called first;
- a TLS 1.3 server sends session tickets after the handshake, and mbedTLS
  reports each one from `mbedtls_ssl_read` as a non-fatal
  `MBEDTLS_ERR_SSL_RECEIVED_NEW_SESSION_TICKET`. Reading again is the only
  correct response.

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

### What the stateless pods are told

A `Platform` is the only place these values exist, so the policy sets them
explicitly rather than leaving them to an image or a Secret. Container `env`
also wins over `envFrom`, which matters: the platform Secret is a dump of a
`.env` file and carries values from whoever generated it.

| Variable | Value |
|---|---|
| `FUJIN_ZMQ_ENDPOINT` | The bus. Every peer dials it; fujin itself binds it. |
| `FUJIN_WS_URL` | `/ws` — relative, because under `cloud` the hostname belongs to the tenant. |
| `FUJIN_TARGET` | `ui` or `services`: the name that connection registers under. |
| `FUJIN_BROWSER_SCOPE` | Handed to the browser by SSR; the same scope fujin registers. |
| `CACHE_URL` | Behemoth's in-process valkey. Absent under `cloud` — the shard is per tenant. |
| `STORAGE_SCOPE` | Pinned for ui in every profile as a startup fallback, and for ms only under `mono`. Pinning ms elsewhere would answer for the wrong tenant whenever a header went missing. |
| `DATA_DIR` | `/app/data`, stated to keep the Secret's value out. |
| `MICROSERVICES` / `FRONTEND_MODULES` | Which modules boot, from the merged solutions. |

The scope index arrives separately, as `envFrom` on the `<platform>-domains`
ConfigMap: it changes as tenants come and go, and a pod should pick that up on
a restart rather than on a policy edit. Every profile publishes it, `mono`
included, so the ConfigMap a pod reads from always exists.

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

Behemoth is started with an explicit `command`: its image names the binary in
`CMD` and declares no `ENTRYPOINT`, so passing `args` alone would replace the
whole command and leave the runtime trying to exec `start`.

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

## Deployment

One Helm chart, in [`chart`](chart). It installs the CRDs, RBAC, the operator,
and a single `Platform` built from values — nothing else. Every workload comes
from ptah at runtime.

```bash
helm install converged chart -n converged --create-namespace \
  --set platform.spec.profile=cloud
```

`Platform`, `Solution` and `Tenant` are cluster-scoped, so **one operator
already sees every platform in the cluster**. A second install does not divide
the work — both would reconcile everything, twice. Releases after the first set
`operator.create=false` and contribute only their `Platform`.

The chart refuses to render rather than install something that will misbehave
quietly: an unknown profile, `multi` without shards or without exactly one
catch-all, storage with no class or no volume source, a registry URL with no
solution key, fujin missing either port.

## Configuration

`PTAH_RESYNC_MS`, `PTAH_LEADER_ELECTION`, and `PTAH_IDENTITY` are required for
controller commands; none of them are defaulted, because an operator that
guesses its identity or its resync period reconciles the wrong cluster on the
wrong schedule.

In a cluster ptah uses the mounted service account, and addresses the apiserver
as `kubernetes.default.svc` rather than through `KUBERNETES_SERVICE_HOST`: the
cluster IP appears on the serving certificate only as an IP SAN, and the TLS
client matches the host string against DNS SANs.

| Variable | Purpose |
|---|---|
| `PTAH_KUBE_SERVER` | Explicit apiserver URL. Wins over in-cluster detection, which is what makes a local run against a real cluster possible from inside a pod. |
| `PTAH_KUBE_CA` | CA bundle for that URL. Without it the connection is unverified, which is right only for a plain-HTTP proxy. |
| `PTAH_KUBE_TOKEN` | Bearer token when not using the mounted service account. |
| `PTAH_NAMESPACE` | Namespace for the Lease; defaults to the service account's. |

A full pass can be run against a live cluster from a workstation, which is the
fastest way to iterate on the policy:

```bash
kubectl get secret -o jsonpath='{...}' ... > /tmp/ca.crt   # or copy from a pod
PTAH_RESYNC_MS=30000 PTAH_LEADER_ELECTION=off PTAH_IDENTITY=dev \
PTAH_NAMESPACE=converged PTAH_KUBE_SERVER=https://localhost:6443 \
PTAH_KUBE_CA=/tmp/ca.crt PTAH_KUBE_TOKEN="$(kubectl create token converged-ptah -n converged)" \
  ./zig-out/bin/ptah apply --dry-run
```

## Building

`zig build` drives two wrapper builds before its own: QuickJS, which evaluates
the policy, and mbedTLS, which talks to the apiserver. Both are installed
beside the binary and found through its `$ORIGIN/lib` rpath.

```bash
zig build                                  # host
TARGET=x86_64-linux-musl ./build.sh        # the target the image uses
./build-container.sh                       # the above, then podman build
```

## Verification

```bash
zig build test          # controller, transport, and the QuickJS boundary
(cd policy && bun test) # the rules themselves
helm lint chart
ptah render examples/platform-multi.json
```

## Known gaps

- `run` does not exit promptly on `SIGTERM`: it sleeps a whole resync period
  before rechecking, so a rollout stalls until the grace period runs out.
- In `run`, a failure to reach the apiserver is swallowed by
  `lease.acquire(...) catch false` and becomes a silent "not the leader" loop.
  That is why a controller that could not connect at all looked like a healthy
  pod for months.
- `multi` is implemented in the policy but has not been exercised against a
  live cluster.
