export { MENU } from "./menu";
export const ID = "auth-mf";

export const SIDEBAR_TABS = [
  {
    id: "auth",
    title: "Login",
    iconName: "IconUserCircle",
    order: 10,
  },
];

import { LocaleController } from "front-core";
import type { EventBus } from "front-core";
import { upsertSidebarTab } from "front-core";
import { ACTIONS } from "./functions";
import { SHOW_LOGIN } from "./functions/login";

LocaleController.getInstance().setLocales(ID, {
  en: "/locales/en/mf-auth.json",
  ru: "/locales/ru/mf-auth.json",
  de: "/locales/de/mf-auth.json",
  es: "/locales/es/mf-auth.json",
  fr: "/locales/fr/mf-auth.json",
  it: "/locales/it/mf-auth.json",
  pt: "/locales/pt/mf-auth.json",
});

class AuthPlugin {
  public readonly name = ID;
  private onDocumentClick?: (event: MouseEvent) => void;
  private onAuthTokenChanged?: () => void;
  private panelInitialized = false;
  private readonly authTokenKey = "authToken";

  private hasAuthToken(): boolean {
    if (typeof window === "undefined") return false;
    return Boolean(window.localStorage.getItem(this.authTokenKey));
  }

  private syncAuthTab() {
    upsertSidebarTab({
      id: "auth",
      title: this.hasAuthToken() ? "Logout" : "Login",
      iconName: this.hasAuthToken() ? "IconLogout" : "IconUserCircle",
      order: 10,
    });
  }

  private applyAuthStateFromCallback(): void {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const oauthProvider = url.searchParams.get("oauth_provider");
    const oauthCode = url.searchParams.get("oauth_code");
    const oauthState = url.searchParams.get("oauth_state");
    const authToken =
      url.searchParams.get("auth_token") ||
      url.searchParams.get("token") ||
      url.searchParams.get("access_token");

    // If backend eventually returns a real token, prefer it.
    const tokenFromCallback =
      authToken ||
      (oauthProvider && oauthCode
        ? `oauth:${oauthProvider}:${oauthState ?? "nostate"}:${oauthCode}`
        : null);

    if (!tokenFromCallback) return;

    window.localStorage.setItem(this.authTokenKey, tokenFromCallback);
    window.dispatchEvent(new Event("auth-token-changed"));

    url.searchParams.delete("oauth_provider");
    url.searchParams.delete("oauth_code");
    url.searchParams.delete("oauth_state");
    url.searchParams.delete("auth_token");
    url.searchParams.delete("token");
    url.searchParams.delete("access_token");
    window.history.replaceState({}, document.title, url.toString());
  }

  plug(bus: EventBus) {
    ACTIONS.forEach((action) => bus.register(action(bus)));
    this.applyAuthStateFromCallback();
    this.syncAuthTab();

    // First click on auth tab mounts the login form into sidebar:tab:auth.
    if (typeof document !== "undefined") {
      this.onDocumentClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement | null;
        const tabButton = target?.closest?.('[data-tab-id="auth"]');
        if (!tabButton) return;

        if (this.hasAuthToken()) {
          window.localStorage.removeItem(this.authTokenKey);
          window.dispatchEvent(new Event("auth-token-changed"));
        }

        if (this.panelInitialized) return;
        this.panelInitialized = true;
        bus.run(SHOW_LOGIN, {});
      };
      document.addEventListener("click", this.onDocumentClick);

      this.onAuthTokenChanged = () => {
        if (!this.hasAuthToken()) {
          this.panelInitialized = false;
        }
        this.syncAuthTab();
      };
      window.addEventListener("auth-token-changed", this.onAuthTokenChanged as EventListener);
      window.addEventListener("storage", this.onAuthTokenChanged as EventListener);
    }
  }

  unplug() {
    if (this.onDocumentClick && typeof document !== "undefined") {
      document.removeEventListener("click", this.onDocumentClick);
    }
    if (this.onAuthTokenChanged && typeof document !== "undefined") {
      window.removeEventListener("auth-token-changed", this.onAuthTokenChanged as EventListener);
      window.removeEventListener("storage", this.onAuthTokenChanged as EventListener);
    }
    this.onDocumentClick = undefined;
    this.onAuthTokenChanged = undefined;
    this.panelInitialized = false;
  }
}

export default new AuthPlugin();
