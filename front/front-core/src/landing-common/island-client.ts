import { structClient } from "g-struct";
import { GROUPS } from './groups';
import { $allMenuItems, addMenuRequested, bus, runActionEvent } from '../controllers';
import { LocaleController } from '../controllers/locale-controller';
import { rightRailActionSelected } from '../components/right-rail/uri-sync';
import { $centerView } from '../slots/present';
import { createBridgeController } from '../bridge';
import { chatSendRequested } from '../chat/events';
import { getI18nInstance } from '../i18n';
import {
  AVAILABLE_LANGS,
  buildLocalePath,
  extractLocaleFromPath,
  isSupportedLocale,
  type SupportedLocale,
} from './i18n';

const SSR_MENU_STYLE_ID = 'ssr-menu-shell-style';
const SSR_RIGHT_RAIL_ID = 'ssr-right-rail';
const SSR_SLOT_PROVIDER_ROOT_ID = 'ssr-slot-provider-root';
const SSR_CHAT_DOCK_ID = 'ssr-chat-dock';
const SSR_CHAT_INPUT_ID = 'ssr-chat-input';
const SSR_CHAT_FORM_ID = 'ssr-chat-form';
const SSR_CHAT_QUICK_ID = 'ssr-chat-quick';
const RIGHT_RAIL_QUERY_KEYS = ['sidebarTab', 'sidebarPanel', 'sidebarAction'] as const;
const QUICK_CHAT_PROMPTS = [
  'Tell us about the club',
  'What projects have you delivered?',
  'How can I join?',
  'Which plan is right for me?',
  'Can I migrate from Free to AI Portal?',
  'Is there vendor lock-in?',
] as const;
const CONTROL_ICON = {
  login:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>',
  logout:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4"/><path d="M14 7l5 5-5 5"/><path d="M19 12H8"/></svg>',
  sun:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
  moon:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a7 7 0 1 0 9 9 9 9 0 1 1-9-9z"/></svg>',
  maximize:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>',
  minimize:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H3v5"/><path d="M16 21h5v-5"/><path d="M3 8l7 7"/><path d="M21 16l-7-7"/></svg>',
  panelOpen:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16"/><path d="m14 9 3 3-3 3"/></svg>',
  panelClose:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16"/><path d="m17 9-3 3 3 3"/></svg>',
} as const;
let pendingNavigation: AbortController | null = null;
let stopMenuWatch: (() => void) | null = null;
const groupLoadPromises = new Map<string, Promise<void>>();
const loadedModules = new Set<string>();
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
let controlsBound = false;
let railTabsBound = false;
let chatDockBound = false;
let chatDockGeometryBound = false;
let chatDockResizeObserver: ResizeObserver | null = null;
let railWide = false;
type CenterViewState = ReturnType<typeof $centerView.getState>;

function getControl(name: string): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(`[data-ssr-control="${name}"]`);
}

function setControlIcon(button: HTMLButtonElement | null, icon: string): void {
  if (!button) return;
  button.innerHTML = icon;
}

function isDarkTheme(): boolean {
  return document.documentElement.classList.contains('dark');
}

function isAuthenticated(): boolean {
  return Boolean(window.localStorage.getItem('authToken'));
}

function isRightRailOpen(): boolean {
  const rail = document.getElementById(SSR_RIGHT_RAIL_ID);
  return rail?.dataset.open === '1';
}

function updateShellWidthMode(): void {
  const value = railWide ? '1' : '0';
  document.getElementById('ssr-shell')?.setAttribute('data-rail-wide', value);
  document.getElementById('app-shell')?.setAttribute('data-rail-wide', value);
}

function refreshControlStates(): void {
  const auth = getControl('auth');
  const theme = getControl('theme');
  const constrain = getControl('constrain');
  const rail = getControl('rail');

  if (auth) {
    const authed = isAuthenticated();
    auth.setAttribute('aria-label', authed ? 'Log out' : 'Open login');
    setControlIcon(auth, authed ? CONTROL_ICON.logout : CONTROL_ICON.login);
  }

  if (theme) {
    const dark = isDarkTheme();
    theme.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    setControlIcon(theme, dark ? CONTROL_ICON.sun : CONTROL_ICON.moon);
  }

  if (constrain) {
    constrain.setAttribute('aria-pressed', railWide ? 'true' : 'false');
    constrain.setAttribute('aria-label', railWide ? 'Reduce panel width' : 'Expand panel width');
    setControlIcon(constrain, railWide ? CONTROL_ICON.minimize : CONTROL_ICON.maximize);
  }

  if (rail) {
    const open = isRightRailOpen();
    rail.setAttribute('aria-pressed', open ? 'true' : 'false');
    rail.setAttribute('aria-label', open ? 'Collapse panel' : 'Show panel');
    setControlIcon(rail, open ? CONTROL_ICON.panelClose : CONTROL_ICON.panelOpen);
  }
}

function applyTheme(next: 'light' | 'dark'): void {
  localStorage.setItem('theme', next);
  document.documentElement.classList.toggle('dark', next === 'dark');
  document.documentElement.style.colorScheme = next;
}

async function ensureAuthLoaded(): Promise<void> {
  const moduleName = 'mf-auth';
  if (loadedModules.has(moduleName)) return;
  initMicrofrontendEnv();
  try {
    const runtime = await import(moduleName);
    if (!loadedModules.has(moduleName) && runtime?.default?.plug) {
      runtime.default.plug(bus);
      loadedModules.add(moduleName);
    }
  } catch (error) {
    console.error('[ssr-menu] failed to load mf-auth', error);
  }
}

export async function openLoginPanel(): Promise<void> {
  await ensureRightRailRuntime();
  await ensureAuthLoaded();
  setRightRailOpen(true);
  setRightRailMode('tab');
  rightRailActionSelected('show_login');
  runActionEvent({ actionId: 'show_login', params: {} });
}

function installPanelControls(): void {
  if (controlsBound) {
    refreshControlStates();
    return;
  }

  const auth = getControl('auth');
  const theme = getControl('theme');
  const constrain = getControl('constrain');
  const rail = getControl('rail');
  if (!auth && !theme && !constrain && !rail) return;

  controlsBound = true;

  auth?.addEventListener('click', () => {
    if (isAuthenticated()) {
      window.localStorage.removeItem('authToken');
      window.dispatchEvent(new Event('auth-token-changed'));
      refreshControlStates();
      return;
    }
    void openLoginPanel();
  });

  theme?.addEventListener('click', () => {
    applyTheme(isDarkTheme() ? 'light' : 'dark');
    refreshControlStates();
  });

  constrain?.addEventListener('click', () => {
    railWide = !railWide;
    updateShellWidthMode();
    refreshControlStates();
  });

  rail?.addEventListener('click', () => {
    const next = !isRightRailOpen();
    setRightRailOpen(next);
    if (next && document.getElementById(SSR_RIGHT_RAIL_ID)?.dataset.mode !== 'tab') {
      setRightRailMode('chat');
    }
    refreshControlStates();
  });

  window.addEventListener('auth-token-changed', refreshControlStates);
  window.addEventListener('storage', refreshControlStates);

  updateShellWidthMode();
  refreshControlStates();
}

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
  refreshRightRailTabs();
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
  refreshControlStates();
  refreshRightRailTabs();
}

function refreshRightRailTabs(): void {
  const rail = document.getElementById(SSR_RIGHT_RAIL_ID);
  if (!rail) return;
  const mode = rail.dataset.mode === 'tab' ? 'tab' : 'chat';
  const chat = rail.querySelector<HTMLButtonElement>('[data-ssr-rail-tab="chat"]');
  const tab = rail.querySelector<HTMLButtonElement>('[data-ssr-rail-tab="tab"]');
  if (chat) {
    chat.setAttribute('aria-pressed', mode === 'chat' ? 'true' : 'false');
  }
  if (tab) {
    tab.setAttribute('aria-pressed', mode === 'tab' ? 'true' : 'false');
  }
}

function installRightRailTabs(): void {
  const rail = document.getElementById(SSR_RIGHT_RAIL_ID);
  if (!rail) return;
  const chat = rail.querySelector<HTMLButtonElement>('[data-ssr-rail-tab="chat"]');
  const tab = rail.querySelector<HTMLButtonElement>('[data-ssr-rail-tab="tab"]');
  if (!chat && !tab) return;

  if (!railTabsBound) {
    railTabsBound = true;
    chat?.addEventListener('click', () => {
      setRightRailOpen(true);
      setRightRailMode('chat');
      void ensureRightRailRuntime().then(() => {
        runActionEvent({ actionId: 'chats.show', params: {} });
      });
    });
    tab?.addEventListener('click', () => {
      setRightRailOpen(true);
      setRightRailMode('tab');
    });
  }

  refreshRightRailTabs();
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
    const groupId = getMfGroup(moduleName);

    if (!loadedModules.has(moduleName) && runtime?.default?.plug) {
      runtime.default.plug(bus);
      loadedModules.add(moduleName);
    }

    if (runtime?.MENU) {
      if (!loadedGroupMenus[groupId]) loadedGroupMenus[groupId] = [];
      const alreadyAdded = loadedGroupMenus[groupId].some(
        (item) => item && item.key === runtime.MENU.key,
      );
      if (!alreadyAdded) {
        loadedGroupMenus[groupId].push(runtime.MENU);
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

    if (!rightRailChatBootstrapped && isAuthenticated()) {
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
  background: color-mix(in oklch, var(--ui-muted) 88%, transparent);
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
  color: color-mix(in oklch, currentColor 72%, transparent);
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
  color: color-mix(in oklch, currentColor 84%, transparent);
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
  bottom: auto !important;
  height: fit-content !important;
  max-height: calc(100vh - (var(--ssr-pad) * 2) - var(--ssr-dock-height)) !important;
  overflow: hidden !important;
}
.ssr-panel-groups {
  overflow-y: auto;
  overflow-x: hidden;
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

/* ── nav progress bar ── */
#ssr-nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 2px;
  width: 0%;
  background: var(--primary, #6366f1);
  z-index: 9999;
  transition: none;
  pointer-events: none;
  border-radius: 0 2px 2px 0;
}
#ssr-nav-bar.nav-running {
  transition: width 1.4s cubic-bezier(0.1, 0.05, 0.0, 1.0);
  width: 85%;
}
#ssr-nav-bar.nav-done {
  transition: width 0.15s ease-out, opacity 0.25s ease 0.15s;
  width: 100%;
  opacity: 0;
}

/* ── root leave (old content, menu not affected) ── */
#root.nav-leaving {
  transition: opacity 0.45s ease, filter 0.45s ease;
  opacity: 0.5;
  filter: blur(2px);
  pointer-events: none;
}

/* ── root enter (new content) ── */
#root.nav-entering {
  opacity: 0;
  transform: translateY(6px);
}
#root.nav-entered {
  transition: opacity 0.2s ease, transform 0.2s ease;
  opacity: 1;
  transform: translateY(0);
}
`;
  document.head.appendChild(style);
}

/* ── navigation progress ── */
let navBarEl: HTMLElement | null = null;
let navDoneTimer: ReturnType<typeof setTimeout> | null = null;

function getNavBar(): HTMLElement {
  if (!navBarEl) {
    navBarEl = document.createElement('div');
    navBarEl.id = 'ssr-nav-bar';
    document.body.appendChild(navBarEl);
  }
  return navBarEl;
}

function navProgressStart(): void {
  const bar = getNavBar();
  if (navDoneTimer) { clearTimeout(navDoneTimer); navDoneTimer = null; }
  bar.className = '';
  bar.style.opacity = '1';
  bar.getBoundingClientRect();
  bar.className = 'nav-running';

  const root = document.getElementById('root');
  if (root) {
    root.classList.remove('nav-entering', 'nav-entered');
    root.getBoundingClientRect();
    root.classList.add('nav-leaving');
  }
}

function navProgressDone(): void {
  const bar = getNavBar();
  bar.className = 'nav-done';
  navDoneTimer = setTimeout(() => {
    bar.className = '';
    bar.style.opacity = '1';
  }, 450);

  const root = document.getElementById('root');
  if (root) {
    root.classList.add('nav-entering');
    root.getBoundingClientRect();
    root.classList.replace('nav-entering', 'nav-entered');
  }
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
  href?: string;
  items?: RuntimeMenuItem[];
};

type InitialDataShape = {
  microfrontends?: string[];
  mfEnv?: Record<string, unknown>;
  guestMenu?: Array<{ title: string; href: string; iconName?: string }>;
};


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
    const i18n = getI18nInstance();
    if (i18n.isInitialized) {
      const translated = i18n.t(raw, { ns: "menu-groups" });
      if (translated && translated !== raw) return translated;
    }
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
  if (!isAuthenticated()) return;
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

const MF_GROUPS: Record<string, string> = {
  'mf-assistants': 'ai',
  'mf-agents': 'ai',
  'mf-logs': 'analytics',
  'mf-telemetry': 'analytics',
  'mf-usage': 'analytics',
  'mf-dasboards': 'analytics',
  'mf-dag': 'workflows',
  'mf-requests': 'workflows',
  'mf-sheduller': 'workflows',
  'mf-webhooks': 'workflows',
  'mf-docs': 'content',
  'mf-landing': 'content',
  'mf-markdown': 'content',
  'mf-struct': 'content',
  'mf-galery': 'content',
  'mf-threads': 'content',
  'mf-dumps': 'data',
  'mf-calls': 'social',
  'mf-community': 'social',
  'mf-charts': 'social',
  'mf-marker': 'marketing',
  'mf-mailing': 'sales',
  'mf-sales': 'sales',
  'mf-geo': 'geo',
  'mf-places': 'geo',
  'mf-companies': 'geo',
};

function getMfGroup(name: string): string {
  return MF_GROUPS[name] ?? 'content';
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

    const toLoad = names.filter((name) => getMfGroup(name) === groupId);

    if (!loadedGroupMenus[groupId]) loadedGroupMenus[groupId] = [];

    for (const name of toLoad) {
      try {
        const runtime = await import(name);

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

  const href = typeof item.href === 'string' && item.href.length > 0 ? item.href : null;
  if (href) {
    const a = document.createElement('a');
    a.href = href;
    a.className = 'ssr-panel-link ssr-menu-action';
    a.style.paddingLeft = `${8 + depth * 16}px`;
    const chevron = document.createElement('span');
    setMenuChevron(chevron, false);
    const icon = document.createElement('span');
    setMenuIcon(icon, iconName);
    const text = document.createElement('span');
    text.className = 'ssr-menu-label';
    text.textContent = label;
    a.append(chevron, icon, text);
    return a;
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

    if (!isAuthenticated()) {
      // Guests: render Docs + Catalog links from SSR-embedded initial data
      const initial = readInitialData();
      const guestItems: RuntimeMenuItem[] = Array.isArray(initial.guestMenu) ? initial.guestMenu : [];
      for (const item of guestItems) {
        groupsHost.appendChild(buildTreeNode(item, 0, 0));
      }
      return;
    }

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
      navProgressDone();
      window.location.assign(url.toString());
      return;
    }

    const html = await response.text();
    const encodedTitle = response.headers.get('X-Page-Title-B64')?.trim() || '';
    let nextTitle = '';
    if (encodedTitle.length > 0) {
      try {
        const binary = atob(encodedTitle);
        const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
        nextTitle = new TextDecoder().decode(bytes);
      } catch {
        nextTitle = '';
      }
    }
    const nextRoot = extractRootFromHtml(html);
    if (!nextRoot) {
      navProgressDone();
      window.location.assign(url.toString());
      return;
    }

    currentRoot.replaceWith(nextRoot);
    if (nextTitle.length > 0) {
      document.title = nextTitle;
    }
    navProgressDone();

    if (mode === 'push') {
      history.pushState({ by: 'fragment-nav' }, '', url.toString());
    } else if (mode === 'replace') {
      history.replaceState({ by: 'fragment-nav' }, '', url.toString());
    }
  } catch {
    if (!controller.signal.aborted) {
      navProgressDone();
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
    navProgressStart();
    void navigateByFragment(url, 'push');
  });

  window.addEventListener('popstate', () => {
    const url = new URL(window.location.href);
    navProgressStart();
    void navigateByFragment(url, 'none');
  });
}

async function openAiChat(message?: string): Promise<void> {
  setRightRailOpen(true);
  setRightRailMode('chat');
  await ensureRightRailRuntime();
  runActionEvent({ actionId: 'chats.show', params: {} });
  const text = message?.trim();
  if (text) {
    chatSendRequested(text);
  }
}

function installChatDock(): void {
  const dock = document.getElementById(SSR_CHAT_DOCK_ID);
  const form = document.getElementById(SSR_CHAT_FORM_ID) as HTMLFormElement | null;
  const input = document.getElementById(SSR_CHAT_INPUT_ID) as HTMLInputElement | null;
  const quick = document.getElementById(SSR_CHAT_QUICK_ID);
  if (!dock || !form || !input || !quick) return;

  if (!chatDockBound) {
    chatDockBound = true;

    const submitMessage = () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      void openAiChat(text);
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submitMessage();
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        submitMessage();
      }
    });
    input.addEventListener('focus', () => {
      void openAiChat();
    });

    const renderPrompts = (prompts: readonly string[]) => {
      quick.innerHTML = '';
      prompts.forEach((prompt) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ssr-chat-quick-btn';
        button.textContent = prompt;
        button.addEventListener('click', () => {
          void openAiChat(prompt);
        });
        quick.appendChild(button);
      });
    };

    renderPrompts(QUICK_CHAT_PROMPTS);

    const locale = extractLocaleFromPath(window.location.pathname) ?? 'en';
    try {
      structClient.readJson(`${locale}/magic/chat-prompts.json`)
        .then((data) => {
          const prompts = Array.isArray(data?.prompts) ? data.prompts : null;
          if (prompts) renderPrompts(prompts);
        })
        .catch(() => {});
    } catch {
      // no auth token in browser — skip
    }
  }

  let lastDockHeight = -1;
  const syncDockGeometry = () => {
    const dockHeight = Math.ceil(dock.getBoundingClientRect().height);
    if (dockHeight === lastDockHeight) return;
    lastDockHeight = dockHeight;
    document.documentElement.style.setProperty('--ssr-dock-height', `${dockHeight}px`);
    dock.dataset.overlap = '0';
  };

  syncDockGeometry();
  if (!chatDockGeometryBound) {
    chatDockGeometryBound = true;
    chatDockResizeObserver = new ResizeObserver(syncDockGeometry);
    chatDockResizeObserver.observe(dock);
    const observer = new MutationObserver(syncDockGeometry);
    observer.observe(dock, { childList: true, subtree: true, attributes: true });
  }
}

function hasRightRailDeepLink(): boolean {
  const search = new URLSearchParams(window.location.search);
  return RIGHT_RAIL_QUERY_KEYS.some((key) => search.has(key));
}

function stripLocalePrefix(pathname: string): string {
  const locale = extractLocaleFromPath(pathname);
  if (!locale) return pathname || '/';
  const rest = pathname.slice(locale.length + 1);
  return rest.length > 0 ? rest : '/';
}

function isSsrPublicRoute(pathname: string): boolean {
  const locale = extractLocaleFromPath(pathname);
  if (!locale) return false;

  const rest = pathname.slice(locale.length + 1) || '/';
  return rest === '/' || rest.startsWith('/docs/');
}

function buildLocaleTargetUrl(locale: SupportedLocale): URL {
  const target = new URL(window.location.href);
  target.pathname = buildLocalePath(locale, stripLocalePrefix(target.pathname));
  return target;
}

function setLangMenuOpen(root: HTMLElement, control: HTMLButtonElement, open: boolean): void {
  root.dataset.open = open ? '1' : '0';
  control.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function syncLangMenuSelection(): void {
  const root = document.querySelector<HTMLElement>('[data-ssr-lang-root]');
  const control = getControl('lang');
  const current = document.querySelector<HTMLElement>('[data-ssr-lang-current]');
  if (!root || !control) return;

  const localeController = LocaleController.getInstance();
  const activeLocale = localeController.hydrateFromPath(window.location.pathname);
  root.dataset.activeLocale = activeLocale;

  const selectedLabel =
    AVAILABLE_LANGS.find((item) => item.code === activeLocale)?.name ??
    activeLocale.toUpperCase();
  control.setAttribute('aria-label', `Language: ${selectedLabel}`);
  if (current) {
    current.textContent = activeLocale.toUpperCase();
  }

  const options = document.querySelectorAll<HTMLButtonElement>('[data-ssr-lang-option]');
  options.forEach((option) => {
    const code = option.dataset.ssrLangOption;
    const isSelected = code === activeLocale;
    option.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
  });
}

async function applyLocaleChange(nextLocaleRaw: string): Promise<void> {
  if (!isSupportedLocale(nextLocaleRaw)) return;

  const nextLocale = nextLocaleRaw;
  const localeController = LocaleController.getInstance();
  const targetUrl = buildLocaleTargetUrl(nextLocale);

  if (isSsrPublicRoute(window.location.pathname)) {
    await navigateByFragment(targetUrl, 'replace');
    localeController.hydrateFromPath(targetUrl.pathname);
    syncLangMenuSelection();
    return;
  }

  await localeController.switchSpaLocale(nextLocale);
  const nextHref = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
  window.history.replaceState(window.history.state, '', nextHref);
  window.dispatchEvent(new PopStateEvent('popstate'));
  syncLangMenuSelection();
}

function installLangControl(): void {
  const root = document.querySelector<HTMLElement>('[data-ssr-lang-root]');
  const control = getControl('lang');
  const menu = document.querySelector<HTMLElement>('[data-ssr-lang-menu]');
  if (!root || !control || !menu) return;

  const closeMenu = () => setLangMenuOpen(root, control, false);

  if (root.dataset.langBound === '1') {
    syncLangMenuSelection();
    return;
  }

  root.dataset.langBound = '1';
  setLangMenuOpen(root, control, false);
  syncLangMenuSelection();

  control.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const open = root.dataset.open === '1';
    setLangMenuOpen(root, control, !open);
  });

  menu.addEventListener('click', (event) => {
    const eventEl = resolveEventElement(event.target);
    if (!eventEl) return;
    const option = eventEl.closest('[data-ssr-lang-option]') as HTMLButtonElement | null;
    if (!option) return;

    event.preventDefault();
    const nextLocale = option.dataset.ssrLangOption;
    closeMenu();
    if (!nextLocale) return;
    void applyLocaleChange(nextLocale);
  });

  document.addEventListener('click', (event) => {
    const eventEl = resolveEventElement(event.target);
    if (!eventEl || !root.contains(eventEl)) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
    }
  });

  window.addEventListener('popstate', syncLangMenuSelection);
}

export function mountSsrMenuShell(): void {
  if (typeof document === 'undefined') return;

  const menuPanel = document.getElementById('ssr-left-panel');
  if (!menuPanel) return;
  menuPanel.dataset.ssrMenuShell = '1';

  ensureStyles();

  installPanelControls();
  installRightRailTabs();
  installDynamicMenu(menuPanel);
  installChatDock();
  installLinkInterceptor();
  installLangControl();
  // Keep first paint stable: bootstrap right rail runtime lazily.
  // Only eager-init when URL explicitly deep-links into right rail state.
  if (hasRightRailDeepLink()) {
    void ensureRightRailRuntime();
  }
}
