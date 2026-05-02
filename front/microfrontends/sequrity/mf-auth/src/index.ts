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
import {
  $isAuthenticated,
  ensureTemporarySessionFx,
  temporarySessionRequested,
  tokenChanged,
} from "./model";
import { sendMagicLink } from "./service";

const SEND_MAGIC_LINK   = "auth.send-magic-link";
const TEMP_USER_ID_KEY  = "tempUserId";
const TEMP_SESSION_ID_KEY = "tempSessionId";

LocaleController.getInstance().setLocales(ID, {
  en: "/locales/en/mf-auth.json",
  ru: "/locales/ru/mf-auth.json",
  de: "/locales/de/mf-auth.json",
  es: "/locales/es/mf-auth.json",
  fr: "/locales/fr/mf-auth.json",
  it: "/locales/it/mf-auth.json",
  pt: "/locales/pt/mf-auth.json",
});

function isValidJwtToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  return parts.every((p) => p.trim().length > 0);
}

function parseJwtPermissions(token: string): string[] {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return [];
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const paddedBase64 = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(paddedBase64)) as {
      perm?: unknown;
    };
    if (!Array.isArray(payload.perm)) return [];
    return payload.perm.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function applyAuthStateFromCallback(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const authTokenParam =
    url.searchParams.get("auth_token") ||
    url.searchParams.get("access_token");
  const oauthProvider = url.searchParams.get("oauth_provider");
  const oauthCode    = url.searchParams.get("oauth_code");
  const hasOauthCallback = Boolean(oauthProvider && oauthCode);
  const callbackFlow = hasOauthCallback ? "oauth_callback" : "magic_link_or_direct_token";

  if (authTokenParam && isValidJwtToken(authTokenParam)) {
    window.localStorage.setItem("authToken", authTokenParam);
    window.sessionStorage.removeItem(TEMP_USER_ID_KEY);
    window.sessionStorage.removeItem(TEMP_SESSION_ID_KEY);
    const permissions = parseJwtPermissions(authTokenParam);
    if (permissions.length === 0) {
      console.warn("[mf-auth] callback token has empty permissions", {
        flow: callbackFlow,
        reasonHint: "check ms-auth/ms-access logs for empty permission diagnostics",
        permissions,
      });
    } else {
      console.info("[mf-auth] callback token permissions resolved", {
        flow: callbackFlow,
        permissionsCount: permissions.length,
      });
    }
    tokenChanged();
  }

  if (!authTokenParam && !hasOauthCallback) return;

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
        sendMagicLink(params.email, params.returnTo),
    });
    ACTIONS.forEach((action) => bus.register(action(bus)));

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
          void ensureTemporarySessionFx();
        }
      };
      window.addEventListener("auth-token-changed", this.onStorageChange as EventListener);
      window.addEventListener("storage", this.onStorageChange as EventListener);
    }

    // Listeners must be registered before applying callback state,
    // so that auth-token-changed event reaches tokenChanged() in effector.
    applyAuthStateFromCallback();
    temporarySessionRequested();
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
export { ensureTemporarySessionFx } from "./model";
