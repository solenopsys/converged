/**
 * Warmup Island — background SPA module preloading.
 *
 * Loads during eager phase after SSR page renders.
 * spa-shell mounts eagerly and handles the full layout.
 * This island just warms up the module cache.
 */

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

async function preloadMicrofrontends() {
  const initial = readInitialData();
  const list = Array.isArray(initial.microfrontends) ? initial.microfrontends : [];
  const names = list
    .filter((name): name is string => typeof name === "string" && name.length > 0)
    .map((name) => (name.startsWith("mf-") ? name : `mf-${name}`));

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
