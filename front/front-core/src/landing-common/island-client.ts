import { GROUPS } from './groups';
import { $allMenuItems, addMenuRequested, bus, runActionEvent } from '../controllers';
import { rightRailActionSelected } from '../components/right-rail/uri-sync';
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
let menuBootstrapPromise: Promise<void> | null = null;
const bridge = createBridgeController({
  onMenuAction: (actionId) => {
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
.ssr-panel-link:hover {
  background: rgba(148, 163, 184, 0.15);
}
.ssr-menu-action {
  width: 100%;
  text-align: left;
  background: transparent;
  cursor: pointer;
}
.ssr-menu-action[data-depth="1"] { padding-left: 18px; }
.ssr-menu-action[data-depth="2"] { padding-left: 28px; }
.ssr-menu-action[data-depth="3"] { padding-left: 38px; }
.ssr-menu-tree details {
  margin: 4px 0;
}
.ssr-menu-tree summary {
  list-style: none;
  cursor: default;
}
.ssr-menu-tree summary::-webkit-details-marker {
  display: none;
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
  return item.title || item.key || `Item ${index + 1}`;
}

function renderFallbackGroups(host: HTMLElement): void {
  host.innerHTML = GROUPS
    .map(
      (group) => `
        <button
          type="button"
          class="ssr-panel-link ssr-menu-action"
          data-depth="0"
          data-group-id="${group.id}"
        >${group.title}</button>
      `,
    )
    .join('');
}

function findFirstActionId(items: RuntimeMenuItem[]): string | null {
  for (const item of items) {
    const actionId = resolveActionId(item.action);
    if (actionId) return actionId;
    if (Array.isArray(item.items) && item.items.length > 0) {
      const nested = findFirstActionId(item.items);
      if (nested) return nested;
    }
  }
  return null;
}

function findFirstActionIdForGroup(items: RuntimeMenuItem[], groupId: string): string | null {
  const groupNode = items.find((item) => item.key === groupId);
  if (!groupNode) return null;
  const groupItems = Array.isArray(groupNode.items) ? groupNode.items : [];
  return findFirstActionId(groupItems);
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

async function bootstrapMenuRuntimeIfNeeded(): Promise<void> {
  if (menuBootstrapPromise) return menuBootstrapPromise;

  menuBootstrapPromise = (async () => {
    const current = (($allMenuItems.getState?.() as RuntimeMenuItem[]) || []);
    if (current.length > 0) return;

    const names = discoverMicrofrontends();
    if (names.length === 0) return;
    initMicrofrontendEnv();

    const grouped: Record<string, { title: string; iconName: string; items: any[] }> = {};
    const order: string[] = [];

    for (const name of names) {
      try {
        const runtime = await import(name);

        if (runtime?.default?.plug) {
          runtime.default.plug(bus);
        }

        const group = normalizeGroup(runtime?.GROUP as RuntimeGroup);
        if (!grouped[group.id]) {
          grouped[group.id] = { title: group.title, iconName: group.iconName, items: [] };
          order.push(group.id);
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
          grouped[group.id].items.push(menu);
        }
      } catch (error) {
        console.error(`[ssr-menu] failed to load ${name}`, error);
      }
    }

    const groupedMenu = order
      .map((id) => grouped[id])
      .filter(Boolean)
      .filter((group) => group.items.length > 0)
      .map((group) => ({
        key: order.find((id) => grouped[id] === group),
        title: group.title,
        iconName: group.iconName,
        items: group.items,
      }));

    if (groupedMenu.length > 0) {
      addMenuRequested({ microfrontendId: 'grouped', menu: groupedMenu });
    }
  })();

  return menuBootstrapPromise;
}

function buildTreeNode(item: RuntimeMenuItem, depth: number, index: number): HTMLElement {
  const label = resolveLabel(item, index);
  const children = Array.isArray(item.items) ? item.items : [];
  const actionId = resolveActionId(item.action);

  if (children.length > 0) {
    const details = document.createElement('details');
    details.className = 'ssr-menu-tree';
    details.open = depth < 1;

    const summary = document.createElement('summary');
    summary.className = 'ssr-panel-link ssr-menu-action';
    summary.setAttribute('data-depth', String(depth));
    summary.textContent = label;
    if (actionId) {
      summary.dataset.actionId = actionId;
    }
    details.appendChild(summary);

    const nested = document.createElement('div');
    children.forEach((child, childIndex) => {
      nested.appendChild(buildTreeNode(child, depth + 1, childIndex));
    });
    details.appendChild(nested);
    return details;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ssr-panel-link ssr-menu-action';
  button.setAttribute('data-depth', String(depth));
  button.textContent = label;
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
    if (!Array.isArray(items) || items.length === 0) {
      bridge.setMenu([]);
      renderFallbackGroups(groupsHost);
      return;
    }
    bridge.setMenu(items as unknown[]);
    groupsHost.innerHTML = '';
    items.forEach((item, index) => {
      groupsHost.appendChild(buildTreeNode(item, 0, index));
    });
  };

  if (groupsHost.dataset.menuActionsBound !== '1') {
    groupsHost.dataset.menuActionsBound = '1';
    groupsHost.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const actionButton = event.target.closest('[data-action-id]') as HTMLElement | null;
      if (actionButton) {
        const actionId = actionButton.dataset.actionId;
        if (!actionId) return;
        event.preventDefault();
        void bridge.selectMenuAction(actionId);
        return;
      }

      const groupButton = event.target.closest('[data-group-id]') as HTMLElement | null;
      if (!groupButton) return;
      const groupId = groupButton.dataset.groupId;
      if (!groupId) return;
      event.preventDefault();

      void bootstrapMenuRuntimeIfNeeded().then(() => {
        const items = (($allMenuItems.getState?.() as RuntimeMenuItem[]) || []);
        const actionId = findFirstActionIdForGroup(items, groupId);
        if (!actionId) return;
        void bridge.selectMenuAction(actionId);
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

  const stateItems = (($allMenuItems.getState?.() as RuntimeMenuItem[]) || []);
  if (stateItems.length === 0) {
    void bootstrapMenuRuntimeIfNeeded();
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
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest('a[href]') as HTMLAnchorElement | null;
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
