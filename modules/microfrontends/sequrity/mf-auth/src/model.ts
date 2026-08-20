import {
	createAuthController,
	type TokenStorage,
} from "auth-controller";
import { createEffect, createEvent, createStore, sample } from "effector";
import { setSignalChannelAuth } from "signal-channel";
import {
	createGuestSession,
	endSession,
	refreshSession,
	restoreSession,
	sendMagicLink,
} from "./service";
import { authStorageRelease, createBrowserTokenStorage } from "./token-storage";

export type AuthStatus = "anonymous" | "authenticated";
export type MagicLinkStatus = "idle" | "sending" | "sent" | "error";
export type TemporarySessionStatus = "idle" | "creating" | "ready" | "error";

const TEMP_USER_ID_KEY = "tempUserId";
const TEMP_SESSION_ID_KEY = "tempSessionId";
const TEMP_SESSION_COOKIE = "temp_sid";

export const authenticationRequested = createEvent<void>("authenticationRequested");

function readCookie(name: string): string | null {
	if (typeof document === "undefined") return null;
	const prefix = `${name}=`;
	const item = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
	return item ? decodeURIComponent(item.slice(prefix.length)) : null;
}

function writeSessionCookie(name: string, value: string): void {
	if (typeof document !== "undefined") {
		document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`;
	}
}

function resolveOrCreateTempSessionId(): string {
	if (typeof window === "undefined") return crypto.randomUUID();
	const stored = window.sessionStorage.getItem(TEMP_SESSION_ID_KEY);
	if (stored) return stored;
	const cookie = readCookie(TEMP_SESSION_COOKIE);
	if (cookie) {
		window.sessionStorage.setItem(TEMP_SESSION_ID_KEY, cookie);
		return cookie;
	}
	const sessionId = crypto.randomUUID();
	window.sessionStorage.setItem(TEMP_SESSION_ID_KEY, sessionId);
	writeSessionCookie(TEMP_SESSION_COOKIE, sessionId);
	return sessionId;
}

/** Browser persistence adapter. The generic controller never imports localStorage. */
function browserTokenStorage(): TokenStorage {
	if (typeof window === "undefined") {
		return { read: () => null, write: () => {}, clear: () => {} };
	}
	const scope = document.getElementById("app")?.dataset.scope ?? "";
	return createBrowserTokenStorage(
		window.localStorage,
		authStorageRelease(import.meta.url, scope),
	);
}

export const authController = createAuthController({
	storage: browserTokenStorage(),
	flow: {
		async refresh() {
			const refreshed = await refreshSession();
			return refreshed ? { accessToken: refreshed.token } : null;
		},
		async createGuest() {
			// An OAuth or magic-link callback sets the refresh cookie. Restore it
			// before minting a new guest session for this browser tab.
			const restored = await restoreSession();
			if (restored) {
				if (typeof window !== "undefined") window.sessionStorage.removeItem(TEMP_USER_ID_KEY);
				return { accessToken: restored.token };
			}
			const sessionId = resolveOrCreateTempSessionId();
			const guest = await createGuestSession(sessionId);
			if (typeof window !== "undefined") {
				if (guest.userId) window.sessionStorage.setItem(TEMP_USER_ID_KEY, guest.userId);
				window.sessionStorage.setItem(TEMP_SESSION_ID_KEY, sessionId);
			}
			writeSessionCookie(TEMP_SESSION_COOKIE, sessionId);
			return { accessToken: guest.token };
		},
		async revoke(current) {
			await endSession(current?.accessToken ?? null);
		},
		async authenticate() {
			authenticationRequested();
			return null;
		},
	},
});

// The transport is a consumer of auth state. A state notification must not
// start ensureSession again, otherwise a failed guest request loops forever.
setSignalChannelAuth({
	getCurrentAccessToken: () => authController.snapshot().tokens?.accessToken ?? null,
	getAccessToken: () => authController.getAccessToken(),
	setTokens: (tokens) => authController.setTokens(tokens),
	subscribe: (listener) => authController.subscribe(listener),
});

export const logoutPressed = createEvent<void>("logoutPressed");
export const magicLinkSend = createEvent<string>("magicLinkSend");
export const temporarySessionRequested = createEvent<void>("temporarySessionRequested");

export const logoutFx = createEffect("logoutFx", {
	async handler() {
		if (typeof window !== "undefined") {
			window.sessionStorage.removeItem(TEMP_USER_ID_KEY);
			window.sessionStorage.removeItem(TEMP_SESSION_ID_KEY);
		}
		await authController.logout();
	},
});

export const sendMagicLinkFx = createEffect("sendMagicLinkFx", {
	async handler(email: string) {
		await sendMagicLink(email);
	},
});

export const ensureTemporarySessionFx = createEffect("ensureTemporarySessionFx", {
	handler: () => authController.ensureSession(),
});

export const $authStatus = createStore<AuthStatus>("anonymous", { name: "$authStatus" });
export const $isAuthenticated = $authStatus.map((status) => status === "authenticated");
export const $magicLinkStatus = createStore<MagicLinkStatus>("idle", { name: "$magicLinkStatus" });
export const $magicLinkError = createStore<string | null>(null, { name: "$magicLinkError" });
export const $temporarySessionStatus = createStore<TemporarySessionStatus>("idle", { name: "$temporarySessionStatus" });
export const $temporarySessionError = createStore<string | null>(null, { name: "$temporarySessionError" });

authController.subscribe((snapshot) => {
	// Auth state can be published from an Effector effect handler. Defer UI
	// notification to avoid calling a unit while that pure graph is running.
	queueMicrotask(() => {
		$authStatus.setState(snapshot.session === "account" ? "authenticated" : "anonymous");
		if (typeof window !== "undefined") {
			window.dispatchEvent(new Event("auth-token-changed"));
		}
	});
});

$magicLinkStatus
	.on(sendMagicLinkFx, () => "sending")
	.on(sendMagicLinkFx.done, () => "sent")
	.on(sendMagicLinkFx.fail, () => "error")
	.reset(magicLinkSend);

$magicLinkError
	.on(sendMagicLinkFx.fail, (_, { error }) => error.message)
	.reset(magicLinkSend);

$temporarySessionStatus
	.on(ensureTemporarySessionFx, () => "creating")
	.on(ensureTemporarySessionFx.done, () => "ready")
	.on(ensureTemporarySessionFx.fail, () => "error")
	.reset(logoutFx.done);

$temporarySessionError
	.on(ensureTemporarySessionFx.fail, (_, { error }) => error.message)
	.reset(ensureTemporarySessionFx, logoutFx.done);

sample({ clock: logoutPressed, target: logoutFx });
sample({ clock: magicLinkSend, target: sendMagicLinkFx });
sample({ clock: temporarySessionRequested, target: ensureTemporarySessionFx });
