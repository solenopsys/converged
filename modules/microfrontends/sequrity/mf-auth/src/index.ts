export const ID = "auth-mf";
export { MENU } from "./menu";

import {
  BasePlugin,
  LocaleController,
  setActionAuthorizationController,
  upsertSidebarTab,
} from "front-core";
import type { ActionRegistry } from "front-core";
import { ACTIONS } from "./functions";
import { SHOW_LOGIN } from "./functions/login";
import { LOGOUT } from "./functions/logout";
import {
  $isAuthenticated,
	ensureTemporarySessionFx,
	temporarySessionRequested,
	authController,
	authenticationRequested,
} from "./model";
import { sendMagicLink } from "./service";

const SEND_MAGIC_LINK   = "auth.send-magic-link";

LocaleController.getInstance().setLocales(ID, {
  en: new URL("../locales/en.json", import.meta.url).toString(),
  ru: new URL("../locales/ru.json", import.meta.url).toString(),
  de: new URL("../locales/de.json", import.meta.url).toString(),
  es: new URL("../locales/es.json", import.meta.url).toString(),
  fr: new URL("../locales/fr.json", import.meta.url).toString(),
  it: new URL("../locales/it.json", import.meta.url).toString(),
  pt: new URL("../locales/pt.json", import.meta.url).toString(),
});

// Magic-link and OAuth callbacks used to hand the browser its JWT in the query
// string, which leaks it into logs, history and Referer. The gateway now sets an
// httpOnly cookie and redirects to a clean URL; ensureTemporarySessionFx turns
// that cookie into a token via /auth/session.

// ─── Sync sidebar tab label ───────────────────────────────────────────────────

function syncAuthTab(isAuthenticated: boolean): void {
  upsertSidebarTab({
    id: "auth",
    title: isAuthenticated ? "Logout" : "Login",
    iconName: isAuthenticated ? "log-out" : "user",
    order: 10,
  });
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

class AuthPlugin extends BasePlugin {
  private panelInitialized = false;
  private onDocumentClick?: (e: MouseEvent) => void;
  private onStorageChange?: () => void;
  private unsubscribe?: () => void;

  constructor() {
    super(ID, ACTIONS);
  }

  plug(bus: ActionRegistry) {
    super.plug(bus);

    setActionAuthorizationController({
      snapshot: () => authController.snapshot(),
      ensureSession: () => authController.ensureSession(),
      can: (capability) => authController.can(capability),
      subscribe: (listener) => authController.subscribe(listener),
      authenticate: async () => {
        bus.run(SHOW_LOGIN, {});
      },
    });

    bus.register({
      id: SEND_MAGIC_LINK,
      access: "public",
      description: "Send magic link",
      invoke: (params: { email: string; returnTo?: string }) =>
        sendMagicLink(params.email, params.returnTo),
    });

    // Subscribe to model — single source of truth for sidebar tab
    this.unsubscribe = $isAuthenticated.watch((isAuth) => syncAuthTab(isAuth));
    authenticationRequested.watch(() => bus.run(SHOW_LOGIN, {}));

    if (typeof document !== "undefined") {
      this.onDocumentClick = (e: MouseEvent) => {
        const tabButton = (e.target as HTMLElement | null)?.closest?.('[data-tab-id="auth"]');
        if (!tabButton) return;

		if (authController.snapshot().session === "account") {
          bus.run(LOGOUT, {});
          return;
        }

        if (this.panelInitialized) return;
        this.panelInitialized = true;
        bus.run(SHOW_LOGIN, {});
      };
      document.addEventListener("click", this.onDocumentClick);

		this.onStorageChange = () => {
			this.panelInitialized = false;
			void ensureTemporarySessionFx();
		};
      window.addEventListener("storage", this.onStorageChange as EventListener);
    }

    // Listeners must be registered before the initial session request so the
    // sidebar receives the state published by a restored or guest session.
    temporarySessionRequested();
  }

  unplug() {
    super.unplug();
    this.unsubscribe?.();
    if (this.onDocumentClick)  document.removeEventListener("click", this.onDocumentClick);
    if (this.onStorageChange) {
      window.removeEventListener("storage", this.onStorageChange as EventListener);
    }
    this.onDocumentClick = undefined;
    this.onStorageChange = undefined;
    this.panelInitialized = false;
    setActionAuthorizationController(null);
  }
}

export default new AuthPlugin();
export { ensureTemporarySessionFx } from "./model";
