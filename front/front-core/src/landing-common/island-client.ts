import { GROUPS } from './groups';
import { $allMenuItems, addMenuRequested, bus, runActionEvent } from '../controllers';
import { rightRailActionSelected } from '../components/right-rail/uri-sync';
import { $centerView, type CenterViewState } from '../slots/present';
import { createBridgeController } from '../bridge';
import {
  DEFAULT_LOCALE,
  buildLocalePath,
  isSupportedLocale,
  type SupportedLocale,
} from './i18n';

const SSR_MENU_STYLE_ID = 'ssr-menu-shell-style';
const SSR_COUNTER_ID = 'ssr-seconds-counter';
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

const bridge = createBridgeController({
  onMenuAction: async (actionId) => {
    await ensureCenterRenderer();
    rightRailActionSelected(actionId);
    runActionEvent({ actionId, params: {} });
  },
});

function resolveLocale(): SupportedLocale {
  const lang = document.documentElement.lang.trim().slice(0, 2).toLowerCase();
  return isSupportedLocale(lang) ? lang : DEFAULT_LOCALE;
}

function ensureStyles(): void {
  if (document.getElementById(SSR_MENU_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SSR_MENU_STYLE_ID;
  style.textContent = `
.ssr-panel-link {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  width: 100%;
  border: none;
  border-radius: 6px;
  text-decoration: none;
  color: inherit;
  background: transparent;
  padding: 0 8px;
  box-sizing: border-box;
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
.ssr-menu-chevron::before {
  content: "▸";
  font-size: 10px;
  line-height: 1;
  transition: transform 120ms ease;
}
.ssr-menu-tree[open] > summary .ssr-menu-chevron::before {
  transform: rotate(90deg);
}
.ssr-menu-chevron-empty::before {
  content: "";
}
.ssr-menu-icon {
  width: 14px;
  flex: 0 0 14px;
}
.ssr-menu-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ssr-menu-nested {
  margin: 0;
  padding: 0;
}
#ssr-main[data-center-runtime="1"] {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 28px);
}
#root[data-center-runtime="1"] {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}
.ssr-center-runtime {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}
.ssr-center-runtime > * {
  min-height: 0;
}
#ssr-left-panel {
  display: flex;
  flex-direction: column;
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
  action?: unknown;
  items?: RuntimeMenuItem[];
};

type InitialDataShape = {
  microfrontends?: string[];
  mfEnv?: Record<string, unknown>;
};

type RuntimeGroup = { id?: string; title?: string; iconName?: string } | null | undefined;

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

function createGroupButton(groupId: string, title: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ssr-panel-link ssr-menu-action';
  button.dataset.groupId = groupId;

  const chevron = document.createElement('span');
  chevron.className = 'ssr-menu-chevron ssr-menu-chevron-empty';
  const icon = document.createElement('span');
  icon.className = 'ssr-menu-icon';
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
    chevron.className = 'ssr-menu-chevron';
    const icon = document.createElement('span');
    icon.className = 'ssr-menu-icon';
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
  chevron.className = 'ssr-menu-chevron';
  const icon = document.createElement('span');
  icon.className = 'ssr-menu-icon';
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

export function mountSsrMenuShell(): void {
  if (typeof document === 'undefined') return;

  const menuPanel = document.getElementById('ssr-left-panel');
  if (!menuPanel) return;
  menuPanel.dataset.ssrMenuShell = '1';

  ensureStyles();

  const locale = resolveLocale();
  const linksHost = menuPanel.querySelector<HTMLElement>('[data-ssr-menu-links]');
  if (linksHost) {
    const links = [
      { label: 'Home', href: buildLocalePath(locale, '/') },
      { label: 'About', href: buildLocalePath(locale, '/about') },
      { label: 'Docs', href: buildLocalePath(locale, '/docs/page1') },
    ];
    linksHost.innerHTML = links
      .map((item) => `<a class="ssr-panel-link" href="${item.href}">${item.label}</a>`)
      .join('');
  }

  installDynamicMenu(menuPanel);
  startSecondsCounter(menuPanel);
  installLinkInterceptor();
}
