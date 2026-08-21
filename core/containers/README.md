# Containers

The two images that are not native applications: `ui` and `ms`.

Every other container in the platform is a Zig binary and keeps its
Containerfile next to its source, under
[`core/native/apps`](../native/apps) — `fujin`, `behemoth`, `centimanus`,
`resonus`, `ptah`. These two are TypeScript, so they live here instead.

## Why these are static now

They used to be generated. The generator existed for one reason: it baked an
exact module list into the image at build time — `runtime-map.toml` naming
every service chunk for `ms`, a fixed `MICROFRONTENDS` delivery for `ui`. A new
solution therefore meant a new image, and a project that extended converged
meant a second pair of images with a different list inside.

Modules are selected at runtime now. Ptah merges the active solutions, and the
container reads the result from its environment. There is nothing left for a
generator to decide, so the Containerfile is a file in the repository like any
other.

The images carry the **superset**: every module in the tree. Nothing is gained
by trimming one — an unlisted module is simply never imported — and carrying
all of them is what lets one image serve any solution.

## Build

The build context is the repository root, the directory holding `converged/`
and any product extending it:

```bash
cd /path/to/business

podman build -f converged/core/containers/ms.Containerfile \
  --ignorefile converged/core/containers/containerignore \
  -t localhost/converged-ms:latest .

podman build -f converged/core/containers/ui.Containerfile \
  --ignorefile converged/core/containers/containerignore \
  -t localhost/converged-ui:latest .
```

`--build-arg PROJECT=club` builds the same file for a product layered on top:
its `modules/` are searched first and converged answers for everything the
product does not override.

## Runtime contract

`entrypoint.sh` translates ptah's module environment into the Solution
document the runtime reads. `MICROSERVICES` and `FRONTEND_MODULES` come from
the platform's module ConfigMap; setting `SOLUTION_PATH` directly bypasses the
translation and is what a local run does.

A container started with neither refuses to boot. That is deliberate: booting
zero modules produces a process that passes every health check and serves
nothing, which is worse than a crash loop naming the missing variable.

| Variable | Source | Notes |
|---|---|---|
| `MICROSERVICES` / `FRONTEND_MODULES` | ptah module ConfigMap | Which modules boot |
| `FUJIN_ZMQ_ENDPOINT` | ptah | The bus; nothing works without it |
| `VALKEY_URL` | ptah (`CACHE_URL`) | Shared cache |
| `STORAGE_TENANT_SERVICES` / `STORAGE_SCOPE` | ptah domain ConfigMap / edge headers | Which storage answers |
| `SERVICE_TOKEN` | platform Secret | `ms` only; an Ed25519 service JWT |
| `MODULE_REGISTRY*`, `MODULE_CACHE_DIR` | ptah, when a registry is configured | Where modules are fetched and cached |

`PORT`, `DATA_DIR`, `LIBC_VARIANT` and the cache defaults are set in the image:
they are properties of how it was built, not of where it runs.

## Base image

Both stages run on Bun. The production runtime is meant to be
[Cruller](../native/wrappers/rt/cruller) — a Bun fork cut down to an
execute-only runtime — which needs a pre-bundled server entrypoint rather than
a source tree. That entrypoint does not exist in this tree yet, so these images
run the same TypeScript entry the dev runner does. Moving to Cruller is an
image change and touches nothing above it.
