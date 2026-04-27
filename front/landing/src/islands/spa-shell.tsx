/**
 * SPA Shell Island — mounts App (BrowserRouter → RootLayout → BaseLayout) via createRoot.
 *
 * This is NOT hydration — fresh mount (createRoot), SSR HTML is replaced.
 * Before this island mounts, the user sees SSR content in #root.
 * After mount: full BaseLayout from front-core with chat + menu panel.
 */
import { createRoot } from "react-dom/client";
import { addMenuRequested, bus, authToken } from "front-core";
import { App } from "../app/App";
import { GROUPS, type GroupDef } from "../groups";
import { DEFAULT_LOCALE, extractLocaleFromPath } from "../app/i18n";

// ---- MF env ----

function resolveRuntimeLocale(): string {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  return extractLocaleFromPath(window.location.pathname) ?? DEFAULT_LOCALE;
}

function buildDefaultMfEnv(locale: string): Record<string, unknown> {
  return {
    "mf-docs": { docs: [{ name: "club", id: `${locale}/club/index.json` }] },
    "mf-landing": { landingConfId: `${locale}/product/landing/4ir-laiding.json`, title: "4ir" },
    "mf-charts": { userId: "guest", title: "Chats" },
    "mf-community": { userId: "guest", title: "Community" },
    "mf-threads": { threadId: "public-chat", threadIds: ["public-chat"], title: "Threads" },
  };
}

type RuntimeInitialData = {
  mfEnv?: Record<string, unknown>;
  landing?: Record<string, unknown>;
  microfrontends?: string[];
};

function readInitialData(): RuntimeInitialData {
  const el = document.getElementById("__INITIAL_DATA__");
  if (!el || !el.textContent) return {};
  try { return JSON.parse(el.textContent) as RuntimeInitialData; } catch { return {}; }
}

function initMicrofrontendEnv() {
  const initial = readInitialData();
  const mfEnv = initial.mfEnv && typeof initial.mfEnv === "object" ? initial.mfEnv : {};
  const current = ((globalThis as any).__MF_ENV__ ?? {}) as Record<string, unknown>;
  const locale = resolveRuntimeLocale();
  (globalThis as any).__MF_ENV__ = { ...buildDefaultMfEnv(locale), ...current, ...mfEnv };
  if (initial.landing && typeof initial.landing === "object") {
    (globalThis as any).__LANDING_SSR_DATA__ = initial.landing;
  }
}

function uniq(items: string[]): string[] { return [...new Set(items)]; }

function readInitialMicrofrontends(): string[] {
  const initial = readInitialData();
  const list = Array.isArray(initial.microfrontends) ? initial.microfrontends : [];
  return list
    .filter((n): n is string => typeof n === "string" && n.length > 0)
    .map((n) => (n.startsWith("mf-") ? n : `mf-${n}`));
}

function readImportMapMicrofrontends(): string[] {
  const script = document.querySelector('script[type="importmap"]');
  if (!script?.textContent) return [];
  try {
    const parsed = JSON.parse(script.textContent) as { imports?: Record<string, string> };
    return Object.keys(parsed?.imports ?? {}).filter((k) => k.startsWith("mf-"));
  } catch { return []; }
}

// ---- MF loading ----

const MODULES_LIST_FOR_USER_PATH = "/services/modules/listForUser";
const SSR_ONLY_MICROFRONTENDS = new Set(["mf-landing", "mf-docs"]);
const publicMicrofrontends = [] as string[];
const publicMicrofrontendsSet = new Set(publicMicrofrontends);

const discoveredMicrofrontends = uniq([
  ...readInitialMicrofrontends(),
  ...readImportMapMicrofrontends(),
]).filter((name) => !SSR_ONLY_MICROFRONTENDS.has(name));
const systemMicrofrontends = uniq(
  ["mf-auth", ...publicMicrofrontends].filter(
    (mf) => mf === "mf-auth" || discoveredMicrofrontends.includes(mf),
  ),
);
const protectedMicrofrontends = discoveredMicrofrontends.filter(
  (mf) => mf !== "mf-auth" && !publicMicrofrontendsSet.has(mf),
);

const loadedMicrofrontends = new Set<string>();
let allowedProtectedMicrofrontends: Set<string> | null = null;
let allowedMicrofrontendsCacheKey: string | null = null;
let allowedMicrofrontendsCache: string[] | null = null;
let allowedMicrofrontendsPromise: Promise<string[] | null> | null = null;
const mfMenus: Record<string, any> = {};
const DEFAULT_GROUP: GroupDef =
  GROUPS.find((g) => g.id === "content") ?? { id: "other", title: "Other", iconName: "IconGridDots" };
const knownGroups: Record<string, GroupDef> = {};
const groupOrder: string[] = [];
const mfToGroup: Record<string, string> = {};
const groupMenus: Record<string, any[]> = {};

function bindMenuToMicrofrontend(item: any, microfrontendId: string): any {
  if (!item || typeof item !== "object") return item;
  return {
    ...item,
    __microfrontendId: microfrontendId,
    items: Array.isArray(item.items)
      ? item.items.map((child) => bindMenuToMicrofrontend(child, microfrontendId))
      : item.items,
  };
}

function resolveMicrofrontendNamespace(moduleName: string, runtime: any): string {
  const id = runtime?.ID ?? runtime?.default?.name;
  if (typeof id === "string" && id.length > 0) {
    if (id.startsWith("mf-")) return id;
    if (id.endsWith("-mf")) return `mf-${id.slice(0, -3)}`;
    return id;
  }
  return moduleName;
}

function hasAuthToken(): boolean {
  return authToken.isAuthenticated();
}

function normalizeMfName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("mf-") ? trimmed : `mf-${trimmed}`;
}

async function fetchAllowedMicrofrontends(): Promise<string[] | null> {
  const token = authToken.get();
  const payload = authToken.payload();
  if (!token || !payload?.sub) return null;

  const cacheKey = `${payload.sub}:${token}`;
  if (allowedMicrofrontendsCacheKey === cacheKey && allowedMicrofrontendsCache) {
    return allowedMicrofrontendsCache;
  }
  if (allowedMicrofrontendsCacheKey === cacheKey && allowedMicrofrontendsPromise) {
    return allowedMicrofrontendsPromise;
  }

  const endpoint = typeof window !== "undefined"
    ? `${window.location.origin}${MODULES_LIST_FOR_USER_PATH}`
    : MODULES_LIST_FOR_USER_PATH;

  const pending = (async () => {
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

      const names = rows
        .map((entry: any) => normalizeMfName(entry?.name ?? entry?.module ?? entry?.id))
        .filter((name): name is string => Boolean(name));
      const unique = [...new Set(names)];
      allowedMicrofrontendsCacheKey = cacheKey;
      allowedMicrofrontendsCache = unique;
      return unique;
    } catch (e) {
      console.error("[mf] Failed to fetch allowed modules", e);
      return null;
    } finally {
      allowedMicrofrontendsPromise = null;
    }
  })();

  allowedMicrofrontendsCacheKey = cacheKey;
  allowedMicrofrontendsPromise = pending;
  return pending;
}

async function resolveAllowedProtectedMicrofrontends(): Promise<string[]> {
  if (!hasAuthToken()) {
    allowedProtectedMicrofrontends = null;
    return [];
  }

  const allowed = await fetchAllowedMicrofrontends();
  if (!allowed) {
    allowedProtectedMicrofrontends = new Set();
    return [];
  }

  const allowedSet = new Set(allowed);
  allowedProtectedMicrofrontends = new Set(
    protectedMicrofrontends.filter((mf) => allowedSet.has(mf)),
  );
  return [...allowedProtectedMicrofrontends];
}

function isConsoleRoute() {
  const pathname = window.location.pathname;
  const locale = extractLocaleFromPath(pathname);
  const path = locale ? (pathname.slice(locale.length + 1) || "/") : pathname;
  return path === "/console" || path.startsWith("/console/");
}

function isServerRenderedPublicRoute() {
  const pathname = window.location.pathname;
  const locale = extractLocaleFromPath(pathname);
  if (!locale) return false;

  const path = pathname.slice(locale.length + 1) || "/";
  return path === "/" || path.startsWith("/docs/");
}

function resolveGroupDef(raw: any): GroupDef {
  if (raw?.id && raw?.title && raw?.iconName &&
    typeof raw.id === "string" && typeof raw.title === "string" && typeof raw.iconName === "string") {
    return { id: raw.id, title: raw.title, iconName: raw.iconName };
  }
  return DEFAULT_GROUP;
}

function registerMfGroup(mfName: string, rawGroup: any) {
  const group = resolveGroupDef(rawGroup);
  if (!knownGroups[group.id]) { knownGroups[group.id] = group; groupOrder.push(group.id); }
  mfToGroup[mfName] = group.id;
}

function buildGroupedMenu() {
  const result: any[] = [];
  for (const groupId of groupOrder) {
    const group = knownGroups[groupId];
    const services = groupMenus[groupId] || [];
    if (services.length === 0) continue;
    result.push({ title: group.title, iconName: group.iconName, items: services });
  }
  return result;
}

function publishGroupedMenu() {
  addMenuRequested({ microfrontendId: "grouped", menu: buildGroupedMenu() });
}

function rebuildMenus(authenticated: boolean) {
  for (const groupId of Object.keys(groupMenus)) delete groupMenus[groupId];
  for (const [mfName, menu] of Object.entries(mfMenus)) {
    if (!authenticated && !publicMicrofrontendsSet.has(mfName)) continue;
    if (authenticated && !publicMicrofrontendsSet.has(mfName)) {
      if (!allowedProtectedMicrofrontends?.has(mfName)) continue;
    }
    const groupId = mfToGroup[mfName];
    if (!groupId) continue;
    if (!groupMenus[groupId]) groupMenus[groupId] = [];
    groupMenus[groupId].push(menu);
  }
}

async function loadMicrofrontends(names: string[]) {
  for (const name of names) {
    if (SSR_ONLY_MICROFRONTENDS.has(name)) continue;
    if (loadedMicrofrontends.has(name)) continue;
    try {
      const runtime = await import(name);
      loadedMicrofrontends.add(name);
      if (runtime.default?.plug) runtime.default.plug(bus);
      registerMfGroup(name, runtime.GROUP);
      let menu = runtime.MENU;
      if (typeof runtime.getMenu === "function") {
        try { const dm = await runtime.getMenu(); if (dm) menu = dm; } catch (e) { console.error(`[mf] getMenu ${name}`, e); }
      }
      if (menu) {
        const boundMenu = bindMenuToMicrofrontend(
          menu,
          resolveMicrofrontendNamespace(name, runtime),
        );
        mfMenus[name] = boundMenu;
        const groupId = mfToGroup[name];
        if (groupId) {
          if (!groupMenus[groupId]) groupMenus[groupId] = [];
          groupMenus[groupId].push(boundMenu);
        }
      }
      console.log(`[mf] Loaded ${name}`);
    } catch (e) { console.error(`[mf] Failed ${name}`, e); }
  }
}

function presentGuestLanding() {
  if (hasAuthToken() || isConsoleRoute()) return;
  const maxAttempts = 50;
  let attempt = 0;
  const run = () => {
    attempt += 1;
    if (hasAuthToken()) return;
    const centerSlot = document.getElementById("slot-center");
    if (!centerSlot) { if (attempt < maxAttempts) setTimeout(run, 80); return; }
    try { bus.run("landing.show.default", {}); } catch (e) {
      console.error("[landing] Failed to present guest landing", e);
      if (attempt < maxAttempts) setTimeout(run, 120);
      return;
    }
    if (centerSlot.textContent?.includes("Loading landing") && attempt < maxAttempts) setTimeout(run, 120);
  };
  run();
}

async function loadInitialMicrofrontends() {
  await loadMicrofrontends(systemMicrofrontends);
  if (hasAuthToken()) {
    const allowed = await resolveAllowedProtectedMicrofrontends();
    await loadMicrofrontends(allowed);
  } else {
    allowedProtectedMicrofrontends = null;
  }
  rebuildMenus(hasAuthToken());
  publishGroupedMenu();
  presentGuestLanding();
}

// ---- Island mount ----

export function mount(container: HTMLElement, _props: Record<string, unknown>) {
  if (isServerRenderedPublicRoute()) {
    return;
  }

  initMicrofrontendEnv();

  // Clear SSR placeholder, mount full App (BrowserRouter → RootLayout → BaseLayout)
  container.innerHTML = "";
  const root = createRoot(container);
  root.render(<App />);

  // Load microfrontends into menu
  loadInitialMicrofrontends();

  window.addEventListener("auth-token-changed", async () => {
    if (hasAuthToken()) {
      const allowed = await resolveAllowedProtectedMicrofrontends();
      await loadMicrofrontends(allowed);
    } else {
      allowedProtectedMicrofrontends = null;
    }
    rebuildMenus(hasAuthToken());
    publishGroupedMenu();
    presentGuestLanding();
  });
}
