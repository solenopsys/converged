export { MENU } from "./menu";
export const ID = "auth-mf";

export const SIDEBAR_TABS = [
  { id: "auth", title: "Login", iconName: "IconUserCircle", order: 10 },
];

import { LocaleController, authToken, upsertSidebarTab } from "front-core";
import type { EventBus } from "front-core";
import { ACTIONS } from "./functions";
import { SHOW_LOGIN } from "./functions/login";
import { LOGOUT } from "./functions/logout";
import { $isAuthenticated, tokenChanged } from "./model";
import { authClient } from "./service";

const SEND_MAGIC_LINK   = "auth.send-magic-link";
const TEMP_USER_ID_KEY  = "tempUserId";
const TEMP_SESSION_ID_KEY = "tempSessionId";
const TEMP_SESSION_COOKIE = "temp_sid";

LocaleController.getInstance().setLocales(ID, {
  en: "/locales/en/mf-auth.json",
  ru: "/locales/ru/mf-auth.json",
  de: "/locales/de/mf-auth.json",
  es: "/locales/es/mf-auth.json",
  fr: "/locales/fr/mf-auth.json",
  it: "/locales/it/mf-auth.json",
  pt: "/locales/pt/mf-auth.json",
});

// ─── Temporary session ────────────────────────────────────────────────────────

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const item = document.cookie.split(";").map((p) => p.trim()).find((p) => p.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : null;
}

function writeSessionCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`;
}

function resolveOrCreateTempSessionId(): string {
  if (typeof window === "undefined") return crypto.randomUUID();
  const fromSession = window.sessionStorage.getItem(TEMP_SESSION_ID_KEY);
  if (fromSession) return fromSession;
  const fromCookie = readCookie(TEMP_SESSION_COOKIE);
  if (fromCookie) { window.sessionStorage.setItem(TEMP_SESSION_ID_KEY, fromCookie); return fromCookie; }
  const next = crypto.randomUUID();
  window.sessionStorage.setItem(TEMP_SESSION_ID_KEY, next);
  writeSessionCookie(TEMP_SESSION_COOKIE, next);
  return next;
}

async function ensureTemporarySession(): Promise<void> {
  if (typeof window === "undefined") return;
  if (authToken.isAuthenticated()) return;
  const current = authToken.get();
  if (current && !authToken.isAuthenticated()) return;

  const sessionId = resolveOrCreateTempSessionId();
  const payload = await authClient.createTemporaryUser(sessionId);

  if (authToken.isAuthenticated()) return;
  window.localStorage.setItem("authToken", payload.token);
  window.sessionStorage.setItem(TEMP_USER_ID_KEY, payload.userId);
  window.sessionStorage.setItem(TEMP_SESSION_ID_KEY, sessionId);
  writeSessionCookie(TEMP_SESSION_COOKIE, sessionId);
  window.dispatchEvent(new Event("auth-token-changed"));
}

function applyAuthStateFromCallback(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const authTokenParam =
    url.searchParams.get("auth_token") ||
    url.searchParams.get("token") ||
    url.searchParams.get("access_token");
  const oauthProvider = url.searchParams.get("oauth_provider");
  const oauthCode    = url.searchParams.get("oauth_code");
  const oauthState   = url.searchParams.get("oauth_state");

  const token =
    authTokenParam ||
    (oauthProvider && oauthCode
      ? `oauth:${oauthProvider}:${oauthState ?? "nostate"}:${oauthCode}`
      : null);

  if (!token) return;

  window.localStorage.setItem("authToken", token);
  window.sessionStorage.removeItem(TEMP_USER_ID_KEY);
  window.sessionStorage.removeItem(TEMP_SESSION_ID_KEY);
  window.dispatchEvent(new Event("auth-token-changed"));

  ["oauth_provider", "oauth_code", "oauth_state", "auth_token", "token", "access_token"]
    .forEach((k) => url.searchParams.delete(k));
  window.history.replaceState({}, document.title, url.toString());
}

// ─── Sync sidebar tab label ───────────────────────────────────────────────────

function syncAuthTab(isAuthenticated: boolean): void {
  upsertSidebarTab({
    id: "auth",
    title: isAuthenticated ? "Logout" : "Login",
    iconName: isAuthenticated ? "IconLogout" : "IconUserCircle",
    order: 10,
  });
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

class AuthPlugin {
  public readonly name = ID;
  private panelInitialized = false;
  private onDocumentClick?: (e: MouseEvent) => void;
  private onStorageChange?: () => void;
  private unsubscribe?: () => void;

  plug(bus: EventBus) {
    bus.register({
      id: SEND_MAGIC_LINK,
      description: "Send magic link",
      invoke: (params: { email: string; returnTo?: string }) =>
        authClient.getMagicLink(params.email, params.returnTo),
    });
    ACTIONS.forEach((action) => bus.register(action(bus)));

    applyAuthStateFromCallback();
    ensureTemporarySession().catch(console.error);

    // Subscribe to model — single source of truth for sidebar tab
    this.unsubscribe = $isAuthenticated.watch((isAuth) => syncAuthTab(isAuth));

    if (typeof document !== "undefined") {
      this.onDocumentClick = (e: MouseEvent) => {
        const tabButton = (e.target as HTMLElement | null)?.closest?.('[data-tab-id="auth"]');
        if (!tabButton) return;

        if (authToken.isAuthenticated()) {
          bus.run(LOGOUT, {});
          return;
        }

        if (this.panelInitialized) return;
        this.panelInitialized = true;
        bus.run(SHOW_LOGIN, {});
      };
      document.addEventListener("click", this.onDocumentClick);

      this.onStorageChange = () => {
        tokenChanged();
        if (!authToken.isAuthenticated()) {
          this.panelInitialized = false;
          ensureTemporarySession().catch(console.error);
        }
      };
      window.addEventListener("auth-token-changed", this.onStorageChange as EventListener);
      window.addEventListener("storage", this.onStorageChange as EventListener);
    }
  }

  unplug() {
    this.unsubscribe?.();
    if (this.onDocumentClick)  document.removeEventListener("click", this.onDocumentClick);
    if (this.onStorageChange) {
      window.removeEventListener("auth-token-changed", this.onStorageChange as EventListener);
      window.removeEventListener("storage", this.onStorageChange as EventListener);
    }
    this.onDocumentClick = undefined;
    this.onStorageChange = undefined;
    this.panelInitialized = false;
  }
}

export default new AuthPlugin();
