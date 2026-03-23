import { GROUPS } from './groups';
import { $allMenuItems, addMenuRequested, bus, runActionEvent } from '../controllers';
import { rightRailActionSelected } from '../components/right-rail/uri-sync';
import { $centerView } from '../slots/present';
import { createBridgeController } from '../bridge';

const SSR_MENU_STYLE_ID = 'ssr-menu-shell-style';
const SSR_COUNTER_ID = 'ssr-seconds-counter';
const SSR_RIGHT_RAIL_ID = 'ssr-right-rail';
const SSR_SLOT_PROVIDER_ROOT_ID = 'ssr-slot-provider-root';
const RIGHT_RAIL_QUERY_KEYS = ['sidebarTab', 'sidebarPanel', 'sidebarAction'] as const;
let startedAtMs = 0;
let counterTimer: ReturnType<typeof setInterval> | null = null;
let pendingNavigation: AbortController | null = null;
let stopMenuWatch: (() => void) | null = null;
const groupLoadPromises = new Map<string, Promise<void>>();
const loadedModules = new Set<string>();
const knownModuleGroup: Record<string, string> = {};
const loadedGroupMenus: Record<string, any[]> = {};
let preferredOpenGroupId: string | null = null;
let centerRendererInitPromise: Promise<void> | null = null;
let centerRenderWatchStop: (() => void) | null = null;
let centerRenderHost: HTMLElement | null = null;
let centerRenderRoot: { render: (node: any) => void; unmount: () => void } | null = null;
let rightRailInitPromise: Promise<void> | null = null;
let rightRailWatchStop: (() => void) | null = null;
let rightRailHost: HTMLElement | null = null;
let rightRailPortalRoot: { render: (node: any) => void; unmount: () => void } | null = null;
let rightRailChatBootstrapped = false;
type CenterViewState = ReturnType<typeof $centerView.getState>;

async function ensureCenterRenderer(): Promise<void> {
  const host = document.getElementById('root');
  if (!host) return;
  const main = host.closest('#ssr-main') as HTMLElement | null;
  if (main) {
    main.setAttribute('data-center-runtime', '1');
  }
  host.setAttribute('data-center-runtime', '1');

  if (
    centerRendererInitPromise &&
    centerRenderHost === host &&
    centerRenderHost.isConnected &&
    centerRenderRoot
  ) {
    return centerRendererInitPromise;
  }

  centerRendererInitPromise = (async () => {
    if (centerRenderRoot && centerRenderHost !== host) {
      try {
        centerRenderRoot.unmount();
      } catch {
        // ignore unmount errors
      }
      centerRenderRoot = null;
    }

    const [{ createElement }, reactDom] = await Promise.all([
      import('react'),
      import('react-dom/client'),
    ]);
    const nextRoot = reactDom.createRoot(host);
    centerRenderHost = host;
    centerRenderRoot = nextRoot;

    const renderCenter = (centerView: CenterViewState) => {
      if (!centerView || !centerRenderRoot) return;
      const View = centerView.view as any;
      centerRenderRoot.render(
        createElement(
          'div',
          { className: 'ssr-center-runtime' },
          createElement(View, centerView.config ?? {}),
        ),
      );
    };

    renderCenter(($centerView.getState?.() as CenterViewState) ?? null);

    if (!centerRenderWatchStop) {
      const watchResult = $centerView.watch((next) => {
        renderCenter((next as CenterViewState) ?? null);
      });
      centerRenderWatchStop =
        typeof watchResult === 'function'
          ? watchResult
          : () => (watchResult as { unsubscribe?: () => void }).unsubscribe?.();
    }
  })();

  return centerRendererInitPromise;
}

function setRightRailMode(mode: 'chat' | 'tab'): void {
  const rail = document.getElementById(SSR_RIGHT_RAIL_ID);
  if (!rail) return;
  rail.dataset.mode = mode;
}

function setRightRailOpen(open: boolean): void {
  const rail = document.getElementById(SSR_RIGHT_RAIL_ID);
  const appShell = document.getElementById('app-shell');
  const shell = document.getElementById('ssr-shell');
  const next = open ? '1' : '0';
  if (rail) {
    rail.dataset.open = next;
  }
  if (shell) {
    shell.dataset.railOpen = next;
  }
  if (appShell) {
    appShell.dataset.railOpen = next;
  }
}

function syncRightRailMode(tabId: string | null | undefined): void {
  if (tabId && tabId !== 'menu') {
    setRightRailOpen(true);
    setRightRailMode('tab');
    return;
  }
  setRightRailMode('chat');
}

async function ensureAssistantsLoaded(): Promise<void> {
  const moduleName = 'mf-assistants';
  if (loadedModules.has(moduleName)) return;

  initMicrofrontendEnv();

  try {
    const runtime = await import(moduleName);
    const group = normalizeGroup(runtime?.GROUP as RuntimeGroup);
    knownModuleGroup[moduleName] = group.id;

    if (!loadedModules.has(moduleName) && runtime?.default?.plug) {
      runtime.default.plug(bus);
      loadedModules.add(moduleName);
    }

    if (runtime?.MENU) {
      if (!loadedGroupMenus[group.id]) loadedGroupMenus[group.id] = [];
      const alreadyAdded = loadedGroupMenus[group.id].some(
        (item) => item && item.key === runtime.MENU.key,
      );
      if (!alreadyAdded) {
        loadedGroupMenus[group.id].push(runtime.MENU);
        publishLoadedGroupsMenu();
      }
    }
  } catch (error) {
    console.error('[ssr-menu] failed to preload mf-assistants', error);
  }
}

async function ensureRightRailRuntime(): Promise<void> {
  const rail = document.getElementById(SSR_RIGHT_RAIL_ID);
  if (!rail) return;

  const host = document.getElementById(SSR_SLOT_PROVIDER_ROOT_ID);
  if (!host) return;

  if (rightRailInitPromise && rightRailHost === host && rightRailPortalRoot) {
    return rightRailInitPromise;
  }

  rightRailInitPromise = (async () => {
    if (rightRailPortalRoot && rightRailHost !== host) {
      try {
        rightRailPortalRoot.unmount();
      } catch {
        // ignore unmount errors
      }
      rightRailPortalRoot = null;
    }

    const [{ createElement }, reactDom, { SlotProvider }, sidebarStore] = await Promise.all([
      import('react'),
      import('react-dom/client'),
      import('../slots/SlotProvider'),
      import('sidebar-controller'),
    ]);

    const nextRoot = reactDom.createRoot(host);
    rightRailHost = host;
    rightRailPortalRoot = nextRoot;
    rightRailPortalRoot.render(createElement(SlotProvider));

    syncRightRailMode((sidebarStore.$activeTab.getState?.() as string) ?? 'menu');
    if (!rightRailWatchStop) {
      const watchResult = sidebarStore.$activeTab.watch((tabId: string) => {
        syncRightRailMode(tabId);
      });
      rightRailWatchStop =
        typeof watchResult === 'function'
          ? watchResult
          : () => (watchResult as { unsubscribe?: () => void }).unsubscribe?.();
    }

    await ensureAssistantsLoaded();

    if (!rightRailChatBootstrapped) {
      rightRailChatBootstrapped = true;
      const chatSlot = document.getElementById('slot-panel-chat');
      if (chatSlot) {
        chatSlot.innerHTML = '';
      }
      runActionEvent({ actionId: 'chats.show', params: {} });
    }
  })();

  return rightRailInitPromise;
}

const bridge = createBridgeController({
  onMenuAction: async (actionId) => {
    await Promise.all([ensureCenterRenderer(), ensureRightRailRuntime()]);
    rightRailActionSelected(actionId);
    runActionEvent({ actionId, params: {} });
  },
});

function ensureStyles(): void {
  if (document.getElementById(SSR_MENU_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SSR_MENU_STYLE_ID;
  style.textContent = `
.ssr-panel-link {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  width: 100%;
  border: none;
  border-radius: 6px;
  text-decoration: none;
  color: inherit;
  background: transparent;
  padding: 0 12px;
  box-sizing: border-box;
  font-size: 15px;
  font-weight: 500;
}
.ssr-panel-link:hover {
  background: rgba(148, 163, 184, 0.14);
}
.ssr-menu-action {
  text-align: left;
  cursor: pointer;
}
.ssr-menu-tree {
  margin: 0;
}
.ssr-menu-tree > summary {
  list-style: none;
  cursor: pointer;
}
.ssr-menu-tree > summary::-webkit-details-marker {
  display: none;
}
.ssr-menu-chevron {
  width: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 14px;
  color: rgba(226, 232, 240, 0.85);
}
.ssr-menu-chevron svg {
  width: 11px;
  height: 11px;
  display: block;
  transform-origin: 50% 50%;
  transition: transform 120ms ease;
}
.ssr-menu-tree[open] > summary .ssr-menu-chevron svg {
  transform: rotate(90deg);
}
.ssr-menu-chevron-empty svg {
  display: none;
}
.ssr-menu-icon {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  color: rgba(226, 232, 240, 0.92);
}
.ssr-menu-icon svg {
  width: 16px;
  height: 16px;
  display: block;
}
.ssr-menu-icon-empty {
  color: transparent;
}
.ssr-menu-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ssr-menu-nested {
  margin: 0 0 0 4px;
  padding: 0;
}
#ssr-main[data-center-runtime="1"] {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 28px);
  height: calc(100vh - 28px);
  max-height: calc(100vh - 28px);
  min-width: 0;
  width: 100%;
  overflow: hidden;
}
#root[data-center-runtime="1"] {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  height: 100%;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}
.ssr-center-runtime {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  height: 100%;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}
.ssr-center-runtime > * {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}
#root[data-center-runtime="1"] .header-panel-logo {
  display: none !important;
}
#ssr-left-panel {
  display: flex;
  flex-direction: column;
}
#ssr-right-rail {
  display: flex;
  flex-direction: column;
}
#ssr-right-rail[data-mode="chat"] #ssr-right-rail-tab {
  display: none;
}
#ssr-right-rail[data-mode="tab"] #ssr-right-rail-chat {
  display: none;
}
#ssr-slot-provider-root {
  display: none;
}
#slot-panel-chat,
#slot-panel-tab {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  min-width: 0;
}
#slot-panel-chat > *,
#slot-panel-tab > * {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
}
#${SSR_COUNTER_ID} {
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid rgba(148, 163, 184, 0.25);
  font-size: 12px;
  opacity: 0.85;
}
`;
  document.head.appendChild(style);
}

function isInterceptableLink(link: HTMLAnchorElement, event: MouseEvent): boolean {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (link.target && link.target !== '_self') return false;
  if (link.hasAttribute('download')) return false;

  const href = link.getAttribute('href');
  if (!href) return false;
  if (href.startsWith('#')) return false;
  if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
    return false;
  }

  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  return true;
}

function resolveEventElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
}

function extractRootFromHtml(html: string): HTMLElement | null {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const nextRoot = parsed.getElementById('root');
  if (!nextRoot) return null;
  document.title = parsed.title || document.title;
  return nextRoot;
}

type RuntimeMenuItem = {
  key?: string;
  title?: string;
  iconName?: string;
  icon?: unknown;
  action?: unknown;
  items?: RuntimeMenuItem[];
};

type InitialDataShape = {
  microfrontends?: string[];
  mfEnv?: Record<string, unknown>;
};

type RuntimeGroup = { id?: string; title?: string; iconName?: string } | null | undefined;

const MENU_ICON_SVG: Record<string, string> = {
  IconBrain:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 4a3 3 0 0 0-3 3v1.2a2.8 2.8 0 0 0 0 5.6V15a3 3 0 0 0 3 3"/><path d="M14.5 4a3 3 0 0 1 3 3v1.2a2.8 2.8 0 0 1 0 5.6V15a3 3 0 0 1-3 3"/><path d="M9.5 10.5h5"/><path d="M9.5 15.5h5"/><path d="M12 4v14"/></svg>',
  IconBriefcase:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/></svg>',
  IconGlobe:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a13 13 0 0 1 0 18"/><path d="M12 3a13 13 0 0 0 0 18"/></svg>',
  IconTarget:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></svg>',
  IconGitBranch:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><circle cx="6" cy="19" r="2"/><path d="M6 7v8a4 4 0 0 0 4 4h6"/><path d="M18 17v-2a4 4 0 0 0-4-4H6"/></svg>',
  IconChartBar:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V9"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></svg>',
  IconDatabase:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/></svg>',
  IconFileText:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/></svg>',
  IconMessages:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"/><path d="M8 20l4-4h8a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2z"/></svg>',
};
const MENU_CHEVRON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';

function resolveActionId(action: unknown): string | null {
  if (typeof action === 'string' && action.length > 0) return action;
  if (action && typeof action === 'object' && 'id' in action) {
    const id = (action as { id?: unknown }).id;
    if (typeof id === 'string' && id.length > 0) return id;
  }
  return null;
}

function resolveLabel(item: RuntimeMenuItem, index: number): string {
  const raw = item.title || item.key || `Item ${index + 1}`;
  if (raw.startsWith('menu.')) {
    const short = raw.slice(5).split('.').pop() || raw.slice(5);
    const normalized = short.replace(/[_-]+/g, ' ').trim();
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
  return raw;
}

function resolveIconName(item: RuntimeMenuItem, depth: number): string | null {
  if (typeof item.iconName === 'string' && item.iconName.length > 0) {
    return item.iconName;
  }
  if (typeof item.icon === 'string' && item.icon.length > 0) {
    return item.icon;
  }
  if (depth === 0 && item.key) {
    const group = GROUPS.find((g) => g.id === item.key);
    if (group?.iconName) return group.iconName;
  }
  return null;
}

function setMenuIcon(target: HTMLElement, iconName: string | null): void {
  target.className = 'ssr-menu-icon';
  if (!iconName) {
    target.classList.add('ssr-menu-icon-empty');
    target.innerHTML = '';
    return;
  }
  const svg = MENU_ICON_SVG[iconName];
  if (!svg) {
    target.classList.add('ssr-menu-icon-empty');
    target.innerHTML = '';
    return;
  }
  target.innerHTML = svg;
}

function setMenuChevron(target: HTMLElement, withArrow: boolean): void {
  target.className = withArrow ? 'ssr-menu-chevron' : 'ssr-menu-chevron ssr-menu-chevron-empty';
  target.innerHTML = MENU_CHEVRON_SVG;
}

function createGroupButton(groupId: string, title: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ssr-panel-link ssr-menu-action';
  button.dataset.groupId = groupId;

  const chevron = document.createElement('span');
  setMenuChevron(chevron, true);
  const icon = document.createElement('span');
  const groupIconName = GROUPS.find((g) => g.id === groupId)?.iconName ?? null;
  setMenuIcon(icon, groupIconName);
  const text = document.createElement('span');
  text.className = 'ssr-menu-label';
  text.textContent = title;
  button.append(chevron, icon, text);
  return button;
}

function renderFallbackGroups(host: HTMLElement): void {
  host.innerHTML = '';
  for (const group of GROUPS) {
    host.appendChild(createGroupButton(group.id, group.title));
  }
}

function readInitialData(): InitialDataShape {
  const el = document.getElementById('__INITIAL_DATA__');
  if (!el?.textContent) return {};
  try {
    return JSON.parse(el.textContent) as InitialDataShape;
  } catch {
    return {};
  }
}

function initMicrofrontendEnv(): void {
  const initial = readInitialData();
  const current = ((globalThis as any).__MF_ENV__ ?? {}) as Record<string, unknown>;
  const next = initial.mfEnv && typeof initial.mfEnv === 'object' ? initial.mfEnv : {};
  (globalThis as any).__MF_ENV__ = { ...current, ...next };
}

function discoverMicrofrontends(): string[] {
  const initial = readInitialData();
  const list = Array.isArray(initial.microfrontends) ? initial.microfrontends : [];
  const fromInitial = list
    .filter((name): name is string => typeof name === 'string' && name.length > 0)
    .map((name) => (name.startsWith('mf-') ? name : `mf-${name}`));

  const script = document.querySelector('script[type="importmap"]');
  let fromImportMap: string[] = [];
  if (script?.textContent) {
    try {
      const parsed = JSON.parse(script.textContent) as { imports?: Record<string, string> };
      fromImportMap = Object.keys(parsed.imports ?? {}).filter((key) => key.startsWith('mf-'));
    } catch {
      fromImportMap = [];
    }
  }

  return [...new Set([...fromInitial, ...fromImportMap])];
}

function normalizeGroup(raw: RuntimeGroup) {
  if (raw?.id && raw?.title && raw?.iconName) {
    return { id: raw.id, title: raw.title, iconName: raw.iconName };
  }
  return GROUPS.find((g) => g.id === 'content') ?? GROUPS[0];
}

function likelyMatchesGroup(name: string, groupId: string): boolean {
  const n = name.toLowerCase();
  const explicit: Record<string, string[]> = {
    ai: ['mf-assistants', 'mf-agents'],
    analytics: ['mf-logs', 'mf-telemetry', 'mf-usage', 'mf-dasboards'],
    workflows: ['mf-dag', 'mf-requests', 'mf-sheduller', 'mf-webhooks'],
    content: ['mf-docs', 'mf-landing', 'mf-markdown', 'mf-struct', 'mf-galery'],
    data: ['mf-dumps'],
    social: ['mf-calls', 'mf-community', 'mf-threads', 'mf-charts'],
    marketing: ['mf-marker'],
    sales: ['mf-mailing', 'mf-sales', 'mf-companies'],
    geo: ['mf-geo', 'mf-places'],
  };
  const explicitList = explicit[groupId];
  if (explicitList && explicitList.includes(name)) return true;

  switch (groupId) {
    case 'ai':
      return /(assist|agent|ai)/.test(n);
    case 'analytics':
      return /(analytic|logs|telemetry|usage|dash|chart)/.test(n);
    case 'workflows':
      return /(workflow|dag|request|sched|webhook|cron|process)/.test(n);
    case 'content':
      return /(doc|land|markdown|struct|galery|gallery|content)/.test(n);
    case 'data':
      return /(data|dump|db|storage)/.test(n);
    case 'social':
      return /(social|community|thread|call|chart)/.test(n);
    case 'marketing':
      return /(marketing|marker|mailing|campaign)/.test(n);
    case 'geo':
      return /(geo|place|catalog)/.test(n);
    case 'sales':
      return /(sales|company|mailing)/.test(n);
    default:
      return false;
  }
}

function publishLoadedGroupsMenu(): void {
  const order = [
    ...GROUPS.map((g) => g.id),
    ...Object.keys(loadedGroupMenus).filter((id) => !GROUPS.some((g) => g.id === id)),
  ];
  const groupedMenu = order
    .filter((id) => (loadedGroupMenus[id]?.length ?? 0) > 0)
    .map((id) => {
      const groupDef = GROUPS.find((g) => g.id === id);
      return {
        key: id,
        title: groupDef?.title ?? id,
        iconName: groupDef?.iconName,
        items: loadedGroupMenus[id],
      };
    });

  if (groupedMenu.length > 0) {
    addMenuRequested({ microfrontendId: 'grouped', menu: groupedMenu });
  }
}

async function ensureGroupLoaded(groupId: string): Promise<void> {
  const existing = groupLoadPromises.get(groupId);
  if (existing) return existing;

  const promise = (async () => {
    const names = discoverMicrofrontends();
    if (names.length === 0) return;
    initMicrofrontendEnv();

    const prioritized = names.filter((name) => {
      const known = knownModuleGroup[name];
      if (known) return known === groupId;
      return likelyMatchesGroup(name, groupId);
    });

    const toTry = prioritized;

    if (!loadedGroupMenus[groupId]) loadedGroupMenus[groupId] = [];

    for (const name of toTry) {
      try {
        const runtime = await import(name);
        const group = normalizeGroup(runtime?.GROUP as RuntimeGroup);
        knownModuleGroup[name] = group.id;
        if (group.id !== groupId) continue;

        if (!loadedModules.has(name) && runtime?.default?.plug) {
          runtime.default.plug(bus);
          loadedModules.add(name);
        }

        let menu = runtime?.MENU;
        if (!menu && typeof runtime?.getMenu === 'function') {
          try {
            menu = await runtime.getMenu();
          } catch {
            // ignore getMenu errors per module
          }
        }
        if (menu) {
          loadedGroupMenus[groupId].push(menu);
        }
      } catch (error) {
        console.error(`[ssr-menu] failed to load ${name}`, error);
      }
    }

    publishLoadedGroupsMenu();
  })();

  groupLoadPromises.set(groupId, promise);
  return promise;
}

function buildTreeNode(item: RuntimeMenuItem, depth: number, index: number): HTMLElement {
  const label = resolveLabel(item, index);
  const children = Array.isArray(item.items) ? item.items : [];
  const actionId = resolveActionId(item.action);
  const iconName = resolveIconName(item, depth);

  if (children.length > 0) {
    const details = document.createElement('details');
    details.className = 'ssr-menu-tree';
    details.open = depth === 0 ? item.key === preferredOpenGroupId : false;
    if (actionId) {
      details.dataset.nodeActionId = actionId;
    }

    const summary = document.createElement('summary');
    summary.className = 'ssr-panel-link ssr-menu-action';
    summary.style.paddingLeft = `${8 + depth * 16}px`;
    const chevron = document.createElement('span');
    setMenuChevron(chevron, true);
    const icon = document.createElement('span');
    setMenuIcon(icon, iconName);
    const text = document.createElement('span');
    text.className = 'ssr-menu-label';
    text.textContent = label;
    summary.append(chevron, icon, text);
    // Parent nodes should expand/collapse on click.
    // Keep action binding only on leaf nodes so nested commands stay reachable.
    details.appendChild(summary);

    const nested = document.createElement('div');
    nested.className = 'ssr-menu-nested';
    children.forEach((child, childIndex) => {
      nested.appendChild(buildTreeNode(child, depth + 1, childIndex));
    });
    details.appendChild(nested);
    return details;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ssr-panel-link ssr-menu-action';
  button.style.paddingLeft = `${8 + depth * 16}px`;
  const chevron = document.createElement('span');
  setMenuChevron(chevron, false);
  const icon = document.createElement('span');
  setMenuIcon(icon, iconName);
  const text = document.createElement('span');
  text.className = 'ssr-menu-label';
  text.textContent = label;
  button.append(chevron, icon, text);
  if (actionId) {
    button.dataset.actionId = actionId;
  } else {
    button.disabled = true;
    button.style.opacity = '0.7';
  }
  return button;
}

function installDynamicMenu(menuPanel: HTMLElement): void {
  const groupsHost = menuPanel.querySelector<HTMLElement>('[data-ssr-menu-groups]');
  if (!groupsHost) return;

  const render = (items: RuntimeMenuItem[]) => {
    groupsHost.innerHTML = '';
    const normalized = Array.isArray(items) ? items : [];
    bridge.setMenu(normalized as unknown[]);

    const groupedById = new Map<string, RuntimeMenuItem>();
    for (const item of normalized) {
      if (item.key) groupedById.set(item.key, item);
    }

    for (const group of GROUPS) {
      const node = groupedById.get(group.id);
      if (node) {
        groupsHost.appendChild(buildTreeNode(node, 0, 0));
      } else {
        groupsHost.appendChild(createGroupButton(group.id, group.title));
      }
    }

    for (const item of normalized) {
      if (!item.key || GROUPS.some((g) => g.id === item.key)) continue;
      groupsHost.appendChild(buildTreeNode(item, 0, 0));
    }
  };

  if (groupsHost.dataset.menuActionsBound !== '1') {
    groupsHost.dataset.menuActionsBound = '1';
    groupsHost.addEventListener('click', (event) => {
      const eventEl = resolveEventElement(event.target);
      if (!eventEl) return;
      const summaryEl = eventEl.closest('summary');
      if (summaryEl) {
        const parentDetails = summaryEl.parentElement as HTMLElement | null;
        const actionId = parentDetails?.dataset.nodeActionId;
        if (actionId) {
          void bridge.selectMenuAction(actionId);
          return;
        }
      }
      const actionButton = eventEl.closest('[data-action-id]') as HTMLElement | null;
      if (actionButton) {
        const actionId = actionButton.dataset.actionId;
        if (!actionId) return;
        event.preventDefault();
        void bridge.selectMenuAction(actionId);
        return;
      }

      const groupButton = eventEl.closest('[data-group-id]') as HTMLElement | null;
      if (!groupButton) return;
      const groupId = groupButton.dataset.groupId;
      if (!groupId) return;
      event.preventDefault();
      preferredOpenGroupId = groupId;
      render((($allMenuItems.getState?.() as RuntimeMenuItem[]) || []));
      void ensureGroupLoaded(groupId).then(() => {
        render((($allMenuItems.getState?.() as RuntimeMenuItem[]) || []));
      });
    });
  }

  try {
    render(($allMenuItems.getState?.() as RuntimeMenuItem[]) || []);
  } catch {
    renderFallbackGroups(groupsHost);
  }

  if (!stopMenuWatch) {
    const watchResult = $allMenuItems.watch((items) => {
      render((items as RuntimeMenuItem[]) || []);
    });
    stopMenuWatch =
      typeof watchResult === 'function'
        ? watchResult
        : () => (watchResult as { unsubscribe?: () => void }).unsubscribe?.();
  }

}

async function navigateByFragment(url: URL, mode: 'push' | 'replace' | 'none' = 'push'): Promise<void> {
  const currentRoot = document.getElementById('root');
  if (!currentRoot) return;

  if (pendingNavigation) pendingNavigation.abort();
  const controller = new AbortController();
  pendingNavigation = controller;

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'text/html',
        'X-Fragment-Request': 'root',
      },
      signal: controller.signal,
      credentials: 'same-origin',
    });

    if (!response.ok) {
      window.location.assign(url.toString());
      return;
    }

    const html = await response.text();
    const nextRoot = extractRootFromHtml(html);
    if (!nextRoot) {
      window.location.assign(url.toString());
      return;
    }

    currentRoot.replaceWith(nextRoot);

    if (mode === 'push') {
      history.pushState({ by: 'fragment-nav' }, '', url.toString());
    } else if (mode === 'replace') {
      history.replaceState({ by: 'fragment-nav' }, '', url.toString());
    }
  } catch {
    if (!controller.signal.aborted) {
      window.location.assign(url.toString());
    }
  } finally {
    if (pendingNavigation === controller) {
      pendingNavigation = null;
    }
  }
}

function installLinkInterceptor(): void {
  if (document.documentElement.dataset.ssrNavBridge === '1') return;
  document.documentElement.dataset.ssrNavBridge = '1';

  document.addEventListener('click', (event) => {
    const eventEl = resolveEventElement(event.target);
    if (!eventEl) return;
    const link = eventEl.closest('a[href]') as HTMLAnchorElement | null;
    if (!link) return;
    if (!isInterceptableLink(link, event)) return;

    const url = new URL(link.href, window.location.href);
    if (url.pathname === window.location.pathname && url.search === window.location.search) {
      if (url.hash) {
        window.location.hash = url.hash;
      }
      return;
    }

    event.preventDefault();
    void navigateByFragment(url, 'push');
  });

  window.addEventListener('popstate', () => {
    const url = new URL(window.location.href);
    void navigateByFragment(url, 'none');
  });
}

function startSecondsCounter(menuPanel: HTMLElement): void {
  let counter = menuPanel.querySelector<HTMLElement>(`#${SSR_COUNTER_ID}`);
  if (!counter) {
    counter = document.createElement('div');
    counter.id = SSR_COUNTER_ID;
    menuPanel.appendChild(counter);
  }

  if (!startedAtMs) {
    startedAtMs = Date.now();
  }

  const render = () => {
    const elapsedSec = Math.floor((Date.now() - startedAtMs) / 1000);
    counter!.textContent = `uptime ${elapsedSec}s`;
  };
  render();

  if (counterTimer) return;
  counterTimer = setInterval(render, 1000);
}

function hasRightRailDeepLink(): boolean {
  const search = new URLSearchParams(window.location.search);
  return RIGHT_RAIL_QUERY_KEYS.some((key) => search.has(key));
}

export function mountSsrMenuShell(): void {
  if (typeof document === 'undefined') return;

  const menuPanel = document.getElementById('ssr-left-panel');
  if (!menuPanel) return;
  menuPanel.dataset.ssrMenuShell = '1';

  ensureStyles();

  installDynamicMenu(menuPanel);
  startSecondsCounter(menuPanel);
  installLinkInterceptor();
  // Keep first paint stable: bootstrap right rail runtime lazily.
  // Only eager-init when URL explicitly deep-links into right rail state.
  if (hasRightRailDeepLink()) {
    void ensureRightRailRuntime();
  }
}
