import { hydrateRoot } from "react-dom/client";
import { App } from "./app/App";
import { addMenuRequested, bus } from "front-core";

type RuntimeInitialData = {
  mfEnv?: Record<string, unknown>;
  landing?: Record<string, unknown>;
};

const DEFAULT_MF_ENV: Record<string, unknown> = {
  "mf-docs": {
    docs: [{ name: "club", id: "ru/club/index.json" }],
  },
  "mf-landing": {
    landingConfId: "ru/product/landing/4ir-laiding.json",
    title: "4ir",
  },
  "mf-charts": {
    userId: "guest",
    title: "Chats",
  },
  "mf-community": {
    userId: "guest",
    title: "Community",
  },
  "mf-threads": {
    threadId: "public-chat",
    title: "Threads",
  },
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

function initMicrofrontendEnv() {
  const initial = readInitialData();
  const mfEnv =
    initial.mfEnv && typeof initial.mfEnv === "object"
      ? initial.mfEnv
      : {};

  const current = (((globalThis as any).__MF_ENV__ ?? {}) as Record<string, unknown>);
  (globalThis as any).__MF_ENV__ = {
    ...DEFAULT_MF_ENV,
    ...current,
    ...mfEnv,
  };

  if (initial.landing && typeof initial.landing === "object") {
    (globalThis as any).__LANDING_SSR_DATA__ = initial.landing;
  }
}

initMicrofrontendEnv();

hydrateRoot(
  document.getElementById("root")!,
  <App />
);

// Группы микрофронтендов (соответствуют директориям back/microservices)
const menuGroups: Record<string, { title: string; iconName: string; microfrontends: string[] }> = {
  ai: {
    title: "AI",
    iconName: "IconBrain",
    microfrontends: ["mf-assistants"],
  },
  analytics: {
    title: "Analytics",
    iconName: "IconChartBar",
    microfrontends: ["mf-telemetry", "mf-logs", "mf-usage", "mf-dasboards"],
  },
  business: {
    title: "Business",
    iconName: "IconBriefcase",
    microfrontends: ["mf-requests", "mf-sheduller"],
  },
  content: {
    title: "Content",
    iconName: "IconFileText",
    microfrontends: ["mf-landing", "mf-docs", "mf-markdown"],
  },
  data: {
    title: "Data",
    iconName: "IconDatabase",
    microfrontends: ["mf-dumps", "mf-threads"],
  },
  social: {
    title: "Social",
    iconName: "IconUsers",
    microfrontends: ["mf-community", "mf-charts", "mf-webhooks"],
  },
  workflows: {
    title: "Workflows",
    iconName: "IconGitBranch",
    microfrontends: ["mf-dag"],
  },
};

// Загружаем auth отдельно, остальные MF только для авторизованного пользователя.
const AUTH_TOKEN_KEY = "authToken";
const publicMicrofrontends = ["mf-landing", "mf-docs"];
const systemMicrofrontends = ["mf-auth", ...publicMicrofrontends];
const protectedMicrofrontends = Object.values(menuGroups).flatMap(
  (g) => g.microfrontends,
).filter((mf) => !publicMicrofrontends.includes(mf));
const loadedMicrofrontends = new Set<string>();
const mfMenus: Record<string, any> = {};

// Обратный маппинг: mf-name -> group
const mfToGroup: Record<string, string> = {};
for (const [groupId, group] of Object.entries(menuGroups)) {
  for (const mf of group.microfrontends) {
    mfToGroup[mf] = groupId;
  }
}

// Хранилище загруженных меню по группам
const groupMenus: Record<string, any[]> = {};

function buildGroupedMenu() {
  const result: any[] = [];

  for (const [groupId, group] of Object.entries(menuGroups)) {
    const services = groupMenus[groupId] || [];
    if (services.length === 0) continue;

    // Группа → Сервисы → Команды (3 уровня)
    result.push({
      title: group.title,
      iconName: group.iconName,
      items: services, // каждый service = { title, iconName, items: [команды] }
    });
  }

  return result;
}

function publishGroupedMenu() {
  const grouped = buildGroupedMenu();
  addMenuRequested({ microfrontendId: "grouped", menu: grouped });
}

function hasAuthToken() {
  if (typeof window === "undefined") return false;
  return Boolean(window.localStorage.getItem(AUTH_TOKEN_KEY));
}

function rebuildMenus(authenticated: boolean) {
  for (const groupId of Object.keys(groupMenus)) {
    delete groupMenus[groupId];
  }

  for (const [mfName, menu] of Object.entries(mfMenus)) {
    if (!authenticated && !publicMicrofrontends.includes(mfName)) {
      continue;
    }
    const groupId = mfToGroup[mfName];
    if (!groupId) continue;
    if (!groupMenus[groupId]) groupMenus[groupId] = [];
    groupMenus[groupId].push(menu);
  }
}

function presentGuestLanding() {
  if (hasAuthToken()) return;
  const maxAttempts = 50;
  let attempt = 0;

  const run = () => {
    attempt += 1;
    if (hasAuthToken()) return;

    const centerSlot = document.getElementById("slot-center");
    if (!centerSlot) {
      if (attempt < maxAttempts) {
        setTimeout(run, 80);
      }
      return;
    }

    try {
      bus.run("landing.show.default", {});
    } catch (error) {
      console.error("[landing] Failed to present guest landing", error);
      if (attempt < maxAttempts) {
        setTimeout(run, 120);
      }
      return;
    }

    // If center still contains the fallback text, try once more.
    if (
      centerSlot.textContent?.includes("Loading landing") &&
      attempt < maxAttempts
    ) {
      setTimeout(run, 120);
    }
  };

  run();
}

async function loadMicrofrontends(names: string[]) {
  for (const name of names) {
    if (loadedMicrofrontends.has(name)) continue;
    try {
      const runtime = await import(name);
      loadedMicrofrontends.add(name);
      // Регистрируем actions через plugin
      if (runtime.default?.plug) {
        runtime.default.plug(bus);
      }
      let menu = runtime.MENU;
      if (typeof runtime.getMenu === "function") {
        try {
          const dynamicMenu = await runtime.getMenu();
          if (dynamicMenu) {
            menu = dynamicMenu;
          }
        } catch (e) {
          console.error(`[mf] Failed to build menu for ${name}:`, e);
        }
      }
      if (menu) {
        mfMenus[name] = menu;
        const groupId = mfToGroup[name];
        if (groupId) {
          if (!groupMenus[groupId]) groupMenus[groupId] = [];
          groupMenus[groupId].push(menu);
        }
      }
      console.log(`[mf] Loaded ${name}`);
    } catch (e) {
      console.error(`[mf] Failed to load ${name}:`, e);
    }
  }
}

async function loadInitialMicrofrontends() {
  await loadMicrofrontends(systemMicrofrontends);
  if (hasAuthToken()) {
    await loadMicrofrontends(protectedMicrofrontends);
  }
  rebuildMenus(hasAuthToken());
  publishGroupedMenu();
  presentGuestLanding();
}

window.addEventListener("auth-token-changed", async () => {
  if (hasAuthToken()) {
    await loadMicrofrontends(protectedMicrofrontends);
  }
  rebuildMenus(hasAuthToken());
  publishGroupedMenu();
  presentGuestLanding();
});

loadInitialMicrofrontends();
