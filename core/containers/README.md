# Containers

The two images that are not native applications: `ui` and `ms`.

Every other container in the platform is a Zig binary and keeps its
Containerfile next to its source, under
[`core/native/apps`](../native/apps) — `fujin`, `behemoth`, `centimanus`,
`resonus`, `ptah`. These two are TypeScript, so they live here instead.

## Why these are static, and empty

They used to be generated. The generator existed for one reason: it baked an
exact module list into the image at build time — `runtime-map.toml` naming
every service chunk for `ms`, a fixed `SURFACES` delivery for `ui`. A new
solution therefore meant a new image, and a project that extended converged
meant a second pair of images with a different list inside.

That went in two steps. First the *selection* moved to runtime: ptah merges the
active solutions and the container reads the result from its environment, so
there was nothing left for a generator to decide. The images then carried the
superset — every module in the tree — which served any solution but still tied
a module's lifecycle to the image's: editing one microservice rebuilt and
redeployed all of them.

Now the modules are gone too. Each is built once by
[`core/tools/registry`](../tools/registry), published under the sha256 of its
own bytes, and fetched from ptah at boot. What is in the image is the server,
and the server does not change when a module does.

Two things follow that are worth stating, because both were previously false:
a module rolls forward by editing a digest in the mapping, and these two images
are genuinely the same for every solution and every product.

## Build

The build context is the repository root, the directory holding `converged/`
and any product extending it:

```bash
cd /path/to/business

podman build -f converged/core/containers/ms.Containerfile \
  --ignorefile converged/core/containers/containerignore \
  -t localhost/rp-converged:latest .

podman build -f converged/core/containers/ui.Containerfile \
  --ignorefile converged/core/containers/containerignore \
  -t localhost/converged-ui:latest .
```

`--build-arg PROJECT=club` builds the same file for a product layered on top:
its `modules/` are searched first and converged answers for everything the
product does not override.

## Runtime contract

`entrypoint.sh` translates ptah's module environment into the Solution
document the runtime reads. `REPOSITORIES`, `LAMBDAS` and `FRONTEND_MODULES` come from
the platform's module ConfigMap; setting `SOLUTION_PATH` directly bypasses the
translation and is what a local run does.

A container started with neither refuses to boot. That is deliberate: booting
zero modules produces a process that passes every health check and serves
nothing, which is worse than a crash loop naming the missing variable.

| Variable | Source | Notes |
|---|---|---|
| `REPOSITORIES` / `LAMBDAS` / `FRONTEND_MODULES` | ptah module ConfigMap | Which modules boot |
| `MODULE_PROXY` | ptah module ConfigMap | The content-addressed proxy modules are fetched from |
| `MODULE_DIGESTS` | ptah module ConfigMap | `{"rp-orders.js": "<sha256>"}` — the only place a name is resolved |
| `FUJIN_ZMQ_ENDPOINT` | ptah | The bus; nothing works without it |
| `VALKEY_URL` | ptah (`CACHE_URL`) | Shared cache |
| `STORAGE_TENANT_SERVICES` / `STORAGE_SCOPE` | ptah domain ConfigMap / edge headers | Which storage answers |
| `SERVICE_TOKEN` | platform Secret | `ms` only; an Ed25519 service JWT |

`PORT`, `DATA_DIR`, `MODULE_CACHE_DIR`, `LIBC_VARIANT` and the cache defaults
are set in the image: they are properties of how it was built, not of where it
runs.

A container with no `MODULE_PROXY` resolves modules from source instead. That
is the dev path, and in a built image there are no sources to find — so an
`ms` pod started without it registers nothing, which is the shape of the
misconfiguration to look for.

## Modules

Built and published separately, from the repository root:

```bash
cd converged
bun run build:modules        # → dist/registry/{objects,modules.json}
bun run build:modules -p     # …and upload to the registry bucket
```

`modules.json` is the mapping. Its `modules` object is what
`spec.registry.modules` on the Platform takes, and its `revision` is what makes
pointing a platform at new content a rollout rather than a silent swap.

## Base image

Both stages run on Bun. The production runtime is meant to be
[Cruller](../native/wrappers/rt/cruller) — a Bun fork cut down to an
execute-only runtime — which needs a pre-bundled server entrypoint rather than
a source tree. That entrypoint does not exist in this tree yet, so these images
run the same TypeScript entry the dev runner does. Moving to Cruller is an
image change and touches nothing above it.
