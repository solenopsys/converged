# Converged

![status](https://img.shields.io/badge/status-active%20development-orange) ![build](https://img.shields.io/badge/build-manual%20checks-blue) ![version](https://img.shields.io/badge/version-1.0.0-purple) ![license](https://img.shields.io/badge/license-AGPL--3.0-brightgreen)

A CNC shop or 3D print bureau has two kinds of work: making things, and everything around making things.

The second kind — incoming requests, client messages, order statuses, file handling, queue management, notifications, delivery tracking, payment events, "is it ready yet?" at 11pm — does not require a machinist. It requires a system. That is what Converged is.

Converged is the digital layer of a manufacturing business. Every task that can be handled by software is handled by Converged. The shop focuses on production.

In practice: a client submits a request through the website or the mobile app — it gets logged, routed, and the right person is notified. A new order enters the queue with deadlines tracked automatically. The team checks status, asks questions, or triggers actions through an AI chat built into the same interface. Nobody has to chase anything manually across separate tools.

On the equipment side, Converged reads telemetry from the machines — 3D printers (Bambu Lab, Marlin, Klipper), CNC machines, robotic arms — and uses it to manage work distribution: which job goes to which machine, what's idle, what's overloaded, what's at risk of missing a deadline. The machines themselves are operated by your team as always; Converged handles the scheduling and visibility layer on top. Think of OctoPrint or OctoFarm, but one level up: instead of a window into individual printers, you get a live picture of the whole floor tied into the order and client workflow.

Workflows are built on a DAG runtime — order routing, escalations, queue balancing, multi-step chains — executed by `centimanus` as replayable step-driven graphs, which keeps microservices as pure data stores. AI sits on top as the interaction layer: operators and clients communicate in natural language, the system figures out what to do. Multiple LLM providers run simultaneously (OpenAI, Anthropic, DeepSeek, Mistral, Gemini), each for its own tasks, within a unified permissions and audit model.

The platform is modular and open-source. The same building blocks configure into any profile: 3D printing service bureau, CNC job shop, R&D lab, distributed network of workshops.

Development track: [github.com/solenopsys/converged](https://github.com/solenopsys/converged)

---

## Architecture

### System overview

There is no service mesh and no HTTP call graph between components. Every part
of the platform is a peer on one message bus: each process opens a single
connection to **fujin** and registers exactly one target name. Browsers attach
to the same bus over WebSocket. A peer never learns another peer's address —
it addresses a target, and fujin routes to whichever connection currently owns
that target.

```text
                                 browser / mobile client
                                            │
                                            │ WebSocket
                                            ▼
   ┌────────────┐                 ┌──────────────────────┐                 ┌──────────────┐
   │     ui     │◄───────────────►│                      │◄───────────────►│  centimanus  │
   │  SSR/SPA   │                 │                      │                 │ DAG runtime  │
   │   static   │                 │        fujin         │                 └──────────────┘
   └────────────┘                 │                      │
   ┌────────────┐                 │    message broker    │                 ┌──────────────┐
   │     ms     │◄───────────────►│                      │◄───────────────►│   resonus    │
   │   domain   │                 │  target → connection │                 │  media + AI  │
   │  services  │                 │                      │                 │   gateway    │
   └────────────┘                 │                      │                 └──────────────┘
   ┌────────────┐                 │                      │                 ┌──────────────┐
   │  behemoth  │◄───────────────►│                      │◄───────────────►│  processors  │
   │  storage   │                 │                      │                 │ curaengine,  │
   │   engine   │                 │                      │                 │  opencamlib  │
   └────────────┘                 └──────────────────────┘                 └──────────────┘

   ──────────────────────────────── control plane ────────────────────────────────
   ┌─────────────────────────────────────────────────────────────────────┐
   │  ptah — Kubernetes operator                                         │
   │  Platform / Solution / Tenant  →  Deployments, Services, PV/PVC,    │
   │  ConfigMaps, Gateway, HTTPRoute                                     │
   └─────────────────────────────────────────────────────────────────────┘
```

`ptah` is not on the bus. It is the control plane: it decides which of these
containers exist, how many, and with what volumes — see [Deployment](#deployment).

### Components

| Component | Language | Role |
|---|---|---|
| **fujin** | Zig | Message broker. One `target → connection` map; WebSocket ingress for clients, ZMQ for cluster peers. Nothing else routes. |
| **ui** | TS on Cruller | Everything that renders and serves HTTP: SSR, SPA shell, import map, microfrontend bundles, static assets, landing. |
| **ms** | TS on Cruller | Domain microservices. Thin typed wrappers over their own stores — no cross-service calls, no multi-step logic. |
| **behemoth** | Zig | Multi-model storage engine (SQL, KV, column, vector, graph, files). One isolated root per microservice. |
| **resonus** | Zig | Media and AI gateway in one process: WebRTC/SIP calls, and LLM provider adapters behind one policy. |
| **centimanus** | Zig + QuickJS | DAG runtime. Executes workflows as replayable step graphs, persists node outcomes, resumes from the first unfinished node. |
| **processors** | Zig | Separate compute containers — slicers (`curaengine`), CAM (`opencamlib`), converters. Scaled independently of everything else. |
| **ptah** | Zig + QuickJS | Kubernetes operator. Reconciles `Platform`, `Solution` and `Tenant` into cluster objects. |

### Routing contract

Each connection registers exactly one target, e.g. `ui`, `services`,
`behemoth`, `resonus`, `centimanus`. A message address has two independent
fields:

- `to.target` selects the receiving **connection** — fujin's only decision;
- `to.service` selects a **handler inside** that process — fujin never looks at it.

A target is routable if and only if a live connection owns it. A reconnect
under the same target replaces the old identity atomically, and a dead
identity cannot leave a target behind. Full contract:
[`core/native/apps/fujin/README.md`](core/native/apps/fujin/README.md).

### Monorepo layout

```text
converged/
├── core/
│   ├── backend/              # back-core: server runtime, plugin loading, stores, request scope
│   ├── dag/                  # dag-core + workflow bundler for centimanus
│   ├── frontend/
│   │   ├── front-core/       # shared Preact core: components, state, routing
│   │   ├── spa/              # SPA plugin: import map, /mf/*, /vendor/*
│   │   ├── ssr/              # server-side rendering
│   │   ├── landing/          # landing site
│   │   └── libraries/        # shared UI libs: assistant, effector, files, i18n, md-tools, sequrity
│   ├── native/
│   │   ├── apps/             # fujin, behemoth, centimanus, resonus, ptah
│   │   ├── processors/       # curaengine, opencamlib
│   │   ├── wrappers/         # Zig wrappers: dbs, protocols, adapters, slicers, rt/{cruller,qjs}
│   │   ├── libs/             # cruller-transport, cruller-md4c
│   │   └── types/            # rt-side contracts
│   └── tools/
│       ├── cli/              # operator CLI
│       ├── dev/              # dev runner: resolves the solution, starts native peers
│       └── nrpc/             # contract codegen + messaging runtime
├── modules/
│   ├── types/                # NRPC contracts, grouped by domain
│   ├── generated/            # generated g-<service> packages
│   ├── microservices/        # <domain>/ms-<name>
│   ├── microfrontends/       # <domain>/mf-<name>
│   ├── workflows/            # wf-<name>, compiled for centimanus
│   ├── commands/             # CLI commands
│   └── solutions/            # solution definitions + mapping registry
└── front/landing/            # landing content blocks
```

A downstream product (for example `club`) is a sibling directory with the same
`modules/` shape. It declares `extends` in its solution file and adds its own
microservices, microfrontends and workflows on top of this base.

### NRPC: contract layer

NRPC binds TypeScript contracts to implementations and generates typed clients.

Contracts are interfaces under `modules/types/<domain>/*.ts`. Codegen produces
`g-<service>` packages holding metadata, types, and client factories for three
call sites: browser, another process on the bus, and a workflow inside
centimanus (`g-<service>/rt`).

Transport is the message bus, not HTTP. A service registers with
`createMessagingBackend` from `nrpc/cluster` and receives calls addressed to
its target; payloads are msgpack. Access control travels in the envelope: the
`scope` / `workspace` context is set at the edge and a peer never derives it
from the payload.

```bash
bun run gen   # modules/types → modules/generated, plus rt clients from core/native/types
```

### Data storage: Behemoth

Storage is [**Behemoth**](https://github.com/solenopsys/behemoth) — a native
multi-model engine written in Zig. SQL, key-value, column, vector, graph and
file stores live behind one API.

The isolation unit is the microservice, and it is physical rather than
conventional: **each microservice gets its own volume**. Behemoth refuses to
create a store under a root that is not mounted, so a missing directory is a
mount error and never a silently created shared directory.

The mount table is a JSON file — a ConfigMap in the cluster, written by the dev
runner locally:

```json
{ "microservices": { "orders-ms": "/app/data/converged-storage-orders", "files-ms": "/app/data/converged-storage-files" } }
```

One behemoth process mounts every one of those volumes and serves all of them
over the bus. Splitting storage further is a deployment decision, not a code
change — see the profiles below.

### Frontend: micro-frontends

`front-core` is the shared Preact core: components, Effector state, routing.
Each microfrontend is a separate ESM bundle loaded at runtime through an import
map, so a UI module ships without rebuilding the frontend.

The SPA plugin serves:

- `/vendor/*` — shared dependencies (Preact, Effector, front-core, nrpc)
- `/mf/<name>.js` — one microfrontend bundle
- `/locales/*` — i18n resources

Which microfrontends are mounted comes from the active solution, not from a
build flag.

### Workflow runtime: Centimanus

A workflow is ordinary synchronous JavaScript; its graph is implicit in the
values earlier nodes return. Centimanus executes one node, persists its
outcome, and replays completed nodes on resume — so a restart continues from
the first unfinished step instead of the beginning.

```js
rt.workflow = function (params) {
  var lead = rt.node("find-lead", function () {
    return rt.call("sales", "findLead", { lang: params.lang });
  });
  // branches and loops are plain JS over earlier node results
};
```

Rules that keep replay sound: every side effect lives inside `rt.node` /
`rt.attempt`; node names are unique (in a loop they include the iteration id);
error boundaries are `rt.attempt`, never `try/catch` — a catch around a node
swallows the engine's yield sentinel. Large payloads move by reference through
the cache, not inside messages. Details:
[`core/dag/README.md`](core/dag/README.md).

### Media and AI: Resonus

Resonus is one process covering two jobs that share the same session state:
real-time media (WebRTC, SIP) and LLM access.

Model adapters (OpenAI, Anthropic, DeepSeek, Mistral, Gemini) sit behind a
single policy script, so provider choice is configuration rather than call-site
code. An agent receives context from telemetry and platform data, calls
microservices, and triggers workflows — all under the same ABAC model as a
human user, with the same audit trail.

The trusted context comes from the envelope: resonus refuses a request without
an explicit `scope` and never infers a tenant from the payload.

---

## Deployment

The platform runs on a single-board computer (Orange Pi, 2 GB RAM) and in the
cloud from the same images. The target is Kubernetes; k3s is the reference
distribution for edge.

### One operator, no generated manifests

Deployment is a single Helm chart, and it installs almost nothing: the CRDs,
RBAC, the **ptah** operator, and one `Platform` object built from values.
Everything else — Deployments, Services, PersistentVolumes and Claims,
ConfigMaps, the Gateway and its routes — is created by ptah at runtime.

```text
   helm install
        │
        ▼
   ┌──────────────────────────────────────────┐
   │ CRDs + RBAC + ptah + Platform (values)   │
   └────────────────────┬─────────────────────┘
                        │
                        ▼
   ┌──────────────────────────────────────────┐        ┌───────────────────┐
   │                  ptah                    │ ◄──────┤ solution registry │
   │  Platform → Solution → Tenant            │  fetch │  (remote, cached) │
   │  server-side apply + prune               │        └───────────────────┘
   └────────────────────┬─────────────────────┘
                        │
                        ▼
   Deployments · Services · PV / PVC · ConfigMaps · Gateway · HTTPRoute
```

Three cluster-scoped resources:

| Resource | Role |
|---|---|
| `Platform` | The base: profile, namespace, images, cache, storage template, native apps, gateway and TLS. Boots on its own. |
| `Solution` | An overlay contributing microservices, microfrontends, workflows and env. Owns no cluster objects — the platform folds it in. |
| `Tenant` | One site on a cloud platform: its own storage shard, its own hostnames, its own scope. |

Changing the active solution set is not a redeploy. Ptah publishes the merged
module map as a ConfigMap and stamps its digest onto the pod templates; the
digest change is what rolls the workloads.

Ptah applies server-side and prunes by owner label, so a rename cannot leave
orphans behind. Data-bearing objects are the exception: a PersistentVolume or
Claim that drops out of the desired set is kept unless it explicitly carries
`ptah.io/reclaim: delete`.

Business rules live in a JavaScript policy evaluated in QuickJS, as a pure
`observed → desired` function with no cluster access, so the same rules can be
rendered offline before anything is deployed:

```bash
ptah render examples/platform-cloud.json
```

### Profiles

The profile selects one decision — how storage is divided. Everything else is
identical, including the images.

```text
      mono                        multi                          cloud
      ────                        ─────                          ─────

  ┌───────────┐            ┌───────────┐                  ┌───────────┐
  │ ui · ms   │            │ ui · ms   │                  │ ui · ms   │
  │ fujin     │            │ fujin     │                  │ fujin     │
  │ centimanus│            │ centimanus│                  │ centimanus│
  │ resonus   │            │ resonus   │                  │ resonus   │
  └─────┬─────┘            └─────┬─────┘                  └─────┬─────┘
        │                        │                              │
  ┌─────┴─────┐        ┌─────────┴─────────┐         ┌──────────┴──────────┐
  │ behemoth  │        │behemoth │behemoth │         │behemoth │  behemoth │
  │           │        │ shard A │ shard B │         │ tenant1 │  tenant2  │
  └─────┬─────┘        └────┬────┘────┬────┘         └────┬────┘─────┬─────┘
        │                   │         │                   │          │
   PV per ms           PV per ms  PV per ms          PV per ms   PV per ms
```

| Profile | Storage topology | Use case |
|---|---|---|
| `mono` | One behemoth pod, one PV per microservice. | Edge, development, single shop. |
| `multi` | Behemoth sharded by scope; each shard keeps one PV per microservice. | Larger single-operator production. |
| `cloud` | One behemoth pod per tenant, isolated shard, per-tenant hostnames and scope. | SaaS. |

> `mono` and `cloud` are implemented in the policy today; `multi` is the
> in-progress port of the sharded topology.

In every profile the volume granularity is the same: **one PersistentVolume and
one pre-bound Claim per microservice**. The platform supplies a PV source
template and ptah expands `{{volume}}`, `{{platform}}`, `{{tenant}}` and
`{{microservice}}` into it, refusing any template that resolves two
microservices to the same source.

```json
{
  "storageClassName": "local-path",
  "mountBase": "/app/data",
  "volumeSource": { "hostPath": { "path": "/var/lib/ptah/{{volume}}", "type": "DirectoryOrCreate" } }
}
```

### Routing

Routing is Gateway API. One `Gateway` per platform holds the listeners and the
certificate; each tenant attaches its own `HTTPRoute`, so adding a site never
touches the load balancer. Path precedence is defined by the spec — there are
no hand-tuned priorities.

Scope is a deployment fact, not an application one: the tenant's route sets the
`x-storage-scope` and `workspace` headers with a `set` filter, which overwrites
whatever the client sent. A tenant cannot claim another tenant's scope.

Secrets (API keys, JWT) are not created automatically — integrate a vault,
SealedSecrets, or env injection.

---

## Microservices

48 services, grouped by domain. Each owns its data and exposes a typed API;
none of them call each other.

| Domain | Services |
|---|---|
| **ai** | agent, assistant, contexts, functions |
| **analytics** | counters, dashboard, logs, telemetry, usage |
| **automation** | dag, kubernetes, sheduller, webhooks |
| **business** | billing, equipment, events, finance, orders, requests, reviews, sales, staff |
| **communications** | calls, chats, community, notify, resonus, threads |
| **content** | classifier, galery, markdown, scripts, static, struct |
| **convertors** | modelconvertor |
| **data** | dumps, files, store |
| **providers** | push, ses, sms, smtp |
| **sequrity** | access, auth, environment, identity, oauth, secrets |

28 microfrontends live under `modules/microfrontends/<domain>/mf-<name>` with
the same domain split.

---

## Hardware adapters

Adapters are native Zig shared libraries (`.so` + C header) under
`core/native/wrappers/adapters`, with a unified FFI lifecycle:
`create → connect → commands → get_state_json → disconnect → destroy`. Each one
exposes machine telemetry as JSON and plugs into the microservice layer with no
HTTP in the path.

### Bambu Local

**Equipment:** FDM 3D printers (Bambu Lab X1, P1, A1 series)

Bambu Lab printers run closed firmware with a proprietary MQTT protocol. This
adapter connects directly over the local network (`ssl://<printer-ip>:8883`)
without routing through Bambu Cloud — essential for air-gapped workshops.
Implements the same handshake as the Home Assistant integration.

**Capabilities:** pause / resume / stop print, raw G-code, raw JSON commands,
telemetry and error event subscription, full state snapshot as JSON.

Built with vendored `paho.mqtt.c` and OpenSSL headers — no system `-devel`
packages needed.

### Marlin / OctoPrint

**Equipment:** FDM printers and basic CNC machines running Marlin firmware

Connects over serial (`/dev/ttyUSB*`) and implements the OctoPrint command
interface as a lightweight FFI library — without the HTTP layer, plugin system,
or auth overhead.

**Capabilities:** jog / home / feedrate, extruder and bed temperature targets,
G-code file loading and line-by-line printing, SD card management, emergency
stop, raw G-code queue. Handles the `ok`/`wait`/`Resend` protocol, checksums
and line numbers, and periodic polling (`M105`, `M114`).

### Klipper / Moonraker

**Equipment:** FDM printers and CNC machines running Klipper firmware *(planned)*

Klipper offloads motion planning to a host computer and exposes REST +
WebSocket through Moonraker. The planned adapter will provide the same unified
interface as the others: job control, real-time telemetry, macro execution,
state snapshots.

### UVtools Direct

**Equipment:** resin 3D printers (SLA, MSLA, DLP)

Wraps the UVtools CLI (`UVtoolsCmd`) as a child process behind FFI, so
behaviour stays aligned with upstream rather than reimplementing its internals.

**Capabilities:** convert between resin print formats, extract layers, compare
files, set properties and thumbnails, inspect G-code and machine profiles, run
arbitrary UVtools operations. `argv`-style calls, raw command line, and typed
command structs; stdout/stderr/exit code available through API buffers.

---

## Getting started

```bash
# Requirements: Bun, Zig (for native apps), podman (for container builds)

bun install
bun run dev       # microservices + native peers, no UI
bun run dev:ui    # UI only, against a running dev cluster
bun run dev:all   # everything in one process tree
```

The dev runner reads `../confs/converged-local.env`, resolves the active
solution, creates one data root per microservice under `DATA_DIR`, writes the
behemoth mount table, and starts the native peers listed in
`CONVERGED_DEV_APPS` in dependency order — fujin first, since its peers dial
its socket.

Default ports: microservices `:3001`, UI `:3002`, fujin WebSocket `:8087`,
fujin ZMQ `:5557`.

The topology is identical to production; only the addresses differ. A native
peer must be built before it can be started:

```bash
cd core/native/apps/fujin && zig build
```

**Code quality:**

```bash
bun run format   # Biome formatter
bun run lint     # Biome linter
bun run check    # Biome full check
```

---

## Extending the platform

**Add a microservice:**

1. Define the contract in `modules/types/<domain>/<name>.ts`
2. `bun run gen` → the `g-<name>` package is generated
3. Implement it in `modules/microservices/<domain>/ms-<name>/`
4. Add the name to a solution in `modules/solutions/solutions/`

**Add a microfrontend:**

1. Create `modules/microfrontends/<domain>/mf-<name>/` with `src/index.ts(x)`
2. Add the name to the same solution

**Add a workflow:**

1. Create `modules/workflows/wf-<name>/` as flow-only JS
2. Register it in `modules/solutions/mapping.json`
3. Reference it from a solution's `workflows`

Architecture invariants (violations block PRs): no cross-service imports,
one store boundary per service, no shared state, no direct service-to-service
calls — cross-domain logic belongs in a workflow.

---

## Solutions

A solution is the unit the platform ships in — both technically and
commercially. Technically it is a declarative set of modules:

```json
{
  "microservices": ["files", "store", "requests"],
  "microfrontends": ["requests"],
  "processors": ["curaengine", "opencam"],
  "workflows": ["file-analysis", "file-unpack"],
  "dependencies": ["security"]
}
```

`modules/solutions/<name>.json` selects which solutions are active and which
containers the deployment needs; `modules/solutions/solutions/*.json` defines
each one; `mapping.json` is the registry that resolves a workflow name to its
source. Dependencies are resolved transitively, and a downstream product layers
its own solutions on top through `extends`.

The same definitions drive both ends: the dev runner turns them into a local
process set, and ptah turns them into `Solution` objects that a `Platform`
folds into its module map.

Commercially the platform is sold as ready-made solutions — scenarios built
around specific questions a shop owner needs to answer, each managed through AI
chat instead of a learned interface:

**Orders & clients** — from first contact to repeat sale: service showcase,
unified feed across channels, execution tracking, returning customers.

**Production & inventory** — operational control without a heavy MES: equipment
load and task queues, stock and reserves, quality control, failure log,
shipments.

**Money & profit** — margin by order and client, payment calendar and
receivables, costing and pricing, growth and ROI scenarios.

**Team & accountability** — ownership zones, shift organisation, knowledge base
and standards, onboarding.

Learn more: [4ir.club](https://4ir.club)

---

## License

AGPL-3.0. The platform is fully open for self-hosted deployment. If you modify
the code and provide access to it over a network, you must disclose your
changes.

---

## Stack

| Layer | Technologies |
|---|---|
| Dev runtime | Bun |
| Production runtime | Cruller (Zig fork of Bun 1.3.14, runtime only) |
| Native | Zig, QuickJS |
| Messaging | fujin (ZMQ + WebSocket), msgpack, NRPC |
| Frontend | Preact, Effector, import-map micro-frontends |
| UI | Radix UI, UnoCSS |
| Storage | [Behemoth](https://github.com/solenopsys/behemoth) — SQL, KV, column, vector, graph, files |
| Cache | Valkey |
| Orchestration | Kubernetes, k3s, Helm, ptah operator, Gateway API |
| AI | OpenAI, Anthropic Claude, DeepSeek, Mistral, Gemini |
| Code quality | Biome |
