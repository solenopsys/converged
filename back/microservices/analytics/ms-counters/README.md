# ms-counters

Per-tenant configuration for **analytics counters / tracking pixels** (Google
Analytics, Google Tag Manager, Yandex.Metrika, Meta Pixel, or arbitrary custom
snippets).

Counter codes are stored as a small JSON document in a `FileStore`. That store
is **partitioned per tenant (scope)**, so every workspace gets its own set of
counters automatically — no per-tenant env vars and no operator wiring. The
scope is resolved the same way as the rest of the platform (Host → scope
middleware / `STORAGE_SCOPE` pin), and propagated to this service over nrpc.

## Current scope

Store and serve the tracking ids that SSR landings inject into `<head>`:

- `listCounters()` — all counters for the current scope. *(public)*
- `listEnabled()` — only enabled counters; this is what SSR reads. *(public)*
- `getCounter(id)` — a single counter by id. *(public)*
- `upsertCounter(input)` — create/update a counter code. *(authenticated)*
- `deleteCounter(id)` — remove a counter. *(authenticated)*

Read methods are `@Access("public")` because the unauthenticated landing SSR
needs them at render time. Writes require authentication (admin / configurator).

### Data model

```ts
type CounterType =
  | "google-analytics"    // GA4, gtag.js   — trackingId "G-XXXXXXXX"
  | "google-tag-manager"  // GTM            — trackingId "GTM-XXXXXXX"
  | "yandex-metrika"      // Yandex.Metrika — trackingId numeric
  | "facebook-pixel"      // Meta Pixel     — trackingId numeric
  | "custom";             // raw headSnippet injected verbatim

type Counter = {
  id: string;             // stable key, e.g. "google-analytics"
  type: CounterType;
  trackingId?: string;
  enabled: boolean;
  headSnippet?: string;   // required when type === "custom"
  createdAt?: string;
  updatedAt?: string;
};
```

### Example

```ts
import { createCountersServiceClient } from "g-counters";

const counters = createCountersServiceClient({ baseUrl, workspace });

// Set the Google Analytics counter id for this tenant.
await counters.upsertCounter({
  id: "google-analytics",
  type: "google-analytics",
  trackingId: "G-BMS82GCVBM",
});

// SSR landing reads what to render into <head>.
const enabled = await counters.listEnabled();
```

## Roadmap — beyond storing codes

This service is intended to grow into the platform's **analytics integration
hub**, not just a code registry. Planned/possible extensions:

- **Provider API proxy.** Act as an authenticated proxy in front of provider
  APIs (e.g. the Google Analytics Data API / GA4 Measurement Protocol, Yandex
  Metrika API), so the rest of the platform never handles provider credentials
  directly.
- **Metrics ingestion & persistence.** Periodically pull reports (sessions,
  conversions, events) through those APIs and persist them per tenant, so
  dashboards can query historical analytics without hitting third-party APIs on
  every request.
- **Server-side events.** Forward first-party events (leads, calls, orders)
  to providers server-side (Measurement Protocol / Conversions API) instead of
  relying only on client-side tags.
- **Credentials.** Provider secrets should be resolved via `ms-secrets`, kept
  out of this service's config document.
