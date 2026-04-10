/**
 * Warmup Island — background SPA module preloading.
 *
 * Loads during eager phase after SSR page renders.
 * spa-shell mounts eagerly and handles the full layout.
 * This island just warms up the module cache.
 */
import { authToken } from "front-core";

const MODULES_LIST_FOR_USER_PATH = "/services/modules/listForUser";
const SSR_ONLY_MICROFRONTENDS = new Set(["mf-landing", "mf-docs"]);
const publicMicrofrontends = [] as string[];
const publicMicrofrontendsSet = new Set(publicMicrofrontends);

type RuntimeInitialData = {
  mfEnv?: Record<string, unknown>;
  microfrontends?: string[];
};

function readInitialData(): RuntimeInitialData {
  const el = document.getElementById("__INITIAL_DATA__");
  if (!el || !el.textContent) return {};
  try {
    return JSON.parse(el.textContent) as RuntimeInitialData;
  } catch {
    return {};
  }
}

async function preloadModules() {
  try {
    await Promise.allSettled([
      import("react"),
      import("react-dom/client"),
      import("react-router-dom"),
      import("front-core"),
    ]);
  } catch {
    // Non-critical
  }
}

function normalizeMfName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("mf-") ? trimmed : `mf-${trimmed}`;
}

function readDiscoveredMicrofrontends(): string[] {
  const initial = readInitialData();
  const list = Array.isArray(initial.microfrontends) ? initial.microfrontends : [];
  const names = list
    .map((name) => normalizeMfName(name))
    .filter((name): name is string => Boolean(name))
    .filter((name) => !SSR_ONLY_MICROFRONTENDS.has(name));
  return [...new Set(names)];
}

async function fetchAllowedMicrofrontends(): Promise<string[] | null> {
  const token = authToken.get();
  const payload = authToken.payload();
  if (!token || !payload?.sub) return null;
  const endpoint = `${window.location.origin}${MODULES_LIST_FOR_USER_PATH}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId: payload.sub }),
    });
    if (!response.ok) return null;
    const body = await response.json();
    const rows = Array.isArray(body)
      ? body
      : Array.isArray((body as any)?.items)
        ? (body as any).items
        : [];
    return [...new Set(
      rows
        .map((entry: any) => normalizeMfName(entry?.name ?? entry?.module ?? entry?.id))
        .filter((name): name is string => Boolean(name)),
    )];
  } catch {
    return null;
  }
}

async function resolveWarmupMicrofrontends(): Promise<string[]> {
  const discovered = readDiscoveredMicrofrontends();
  const system = ["mf-auth", ...publicMicrofrontends].filter(
    (mf) => mf === "mf-auth" || discovered.includes(mf),
  );
  const protectedNames = discovered.filter(
    (mf) => mf !== "mf-auth" && !publicMicrofrontendsSet.has(mf),
  );

  if (!authToken.isAuthenticated()) return [...new Set(system)];

  const allowed = await fetchAllowedMicrofrontends();
  if (!allowed) return [...new Set(system)];

  const allowedSet = new Set(allowed);
  const protectedAllowed = protectedNames.filter((name) => allowedSet.has(name));
  return [...new Set([...system, ...protectedAllowed])];
}

async function preloadMicrofrontends() {
  const names = await resolveWarmupMicrofrontends();
  for (const name of names) {
    try {
      await import(name);
    } catch {
      // Non-critical
    }
  }
}

export function mount(_container: HTMLElement, _props: Record<string, unknown>) {
  // Preload modules in background — non-blocking
  preloadModules().then(() => preloadMicrofrontends());
}
