import { createStore, createEvent, createEffect, sample } from "effector";
import { authToken } from "front-core";
import { authClient, sendMagicLink } from "./service";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthStatus = "anonymous" | "authenticated";
export type MagicLinkStatus = "idle" | "sending" | "sent" | "error";
export type TemporarySessionStatus = "idle" | "creating" | "ready" | "error";

const AUTH_TOKEN_KEY = "authToken";
const TEMP_USER_ID_KEY = "tempUserId";
const TEMP_SESSION_ID_KEY = "tempSessionId";
const TEMP_SESSION_COOKIE = "temp_sid";
const REQUIRED_TEMPORARY_PERMISSIONS = [
  "assistant/registerchat(w)",
  "assistant/recordchatmessage(w)",
  "assistant/recordchatfile(w)",
  "threads/savemessage(w)",
  "threads/readthread(r)",
  "chat/createsession(w)",
  "chat/sendmessage(w)",
  "store/save(w)",
  "store/get(r)",
  "files/save(w)",
  "files/savechunk(w)",
  "files/update(w)",
  "files/get(r)",
  "files/getchunks(r)",
];

type JwtPayload = {
  sub?: string;
  exp?: number;
  temporary?: boolean;
  perm?: string[];
};

let temporarySessionPromise: Promise<void> | null = null;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const item = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
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
  if (fromCookie) {
    window.sessionStorage.setItem(TEMP_SESSION_ID_KEY, fromCookie);
    return fromCookie;
  }

  const next = crypto.randomUUID();
  window.sessionStorage.setItem(TEMP_SESSION_ID_KEY, next);
  writeSessionCookie(TEMP_SESSION_COOKIE, next);
  return next;
}

function isValidJwtToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  return parts.every((part) => part.trim().length > 0);
}

function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const paddedBase64 = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(paddedBase64)) as JwtPayload;
  } catch {
    return null;
  }
}

function readAuthPayload(): JwtPayload | null {
  const token = authToken.get();
  return token ? decodeJwtPayload(token) : null;
}

function hasRequiredTemporaryPermissions(payload: JwtPayload): boolean {
  const permissions = new Set(
    (Array.isArray(payload.perm) ? payload.perm : []).map((permission) =>
      permission.toLowerCase(),
    ),
  );
  return REQUIRED_TEMPORARY_PERMISSIONS.every((permission) =>
    permissions.has(permission),
  );
}

function hasUsableAuthToken(): boolean {
  if (typeof window === "undefined") return true;

  const current = authToken.get();
  if (!current || !isValidJwtToken(current)) {
    if (current) window.localStorage.removeItem(AUTH_TOKEN_KEY);
    return false;
  }

  const payload = readAuthPayload();
  const isExpired = typeof payload?.exp === "number"
    ? payload.exp * 1000 < Date.now()
    : true;

  if (!payload?.sub || isExpired) {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    return false;
  }

  const isTemporary = Boolean(payload.temporary) || payload.sub.startsWith("temp:");
  if (!isTemporary) return true;

  return hasRequiredTemporaryPermissions(payload);
}

// ─── Events ──────────────────────────────────────────────────────────────────

export const tokenChanged    = createEvent<void>("tokenChanged");
export const logoutPressed   = createEvent<void>("logoutPressed");
export const magicLinkSend   = createEvent<string>("magicLinkSend"); // email
export const temporarySessionRequested = createEvent<void>("temporarySessionRequested");

// ─── Effects ─────────────────────────────────────────────────────────────────

export const logoutFx = createEffect("logoutFx", {
  async handler() {
    window.localStorage.removeItem("authToken");
    window.dispatchEvent(new Event("auth-token-changed"));
  },
});

export const sendMagicLinkFx = createEffect("sendMagicLinkFx", {
  async handler(email: string) {
    await sendMagicLink(email);
  },
});

export const ensureTemporarySessionFx = createEffect("ensureTemporarySessionFx", {
  async handler() {
    if (hasUsableAuthToken()) return;
    if (temporarySessionPromise) return temporarySessionPromise;

    temporarySessionPromise = (async () => {
      const sessionId = resolveOrCreateTempSessionId();
      const payload = await authClient.createTemporaryUser(sessionId);

      if (hasUsableAuthToken()) return;

      window.localStorage.setItem(AUTH_TOKEN_KEY, payload.token);
      window.sessionStorage.setItem(TEMP_USER_ID_KEY, payload.userId);
      window.sessionStorage.setItem(TEMP_SESSION_ID_KEY, sessionId);
      writeSessionCookie(TEMP_SESSION_COOKIE, sessionId);
      window.dispatchEvent(new Event("auth-token-changed"));
    })().finally(() => {
      temporarySessionPromise = null;
    });

    return temporarySessionPromise;
  },
});

// ─── Stores ──────────────────────────────────────────────────────────────────

export const $authStatus = createStore<AuthStatus>(
  authToken.isAuthenticated() ? "authenticated" : "anonymous",
  { name: "$authStatus" },
);

export const $isAuthenticated = $authStatus.map((s) => s === "authenticated");

export const $magicLinkStatus = createStore<MagicLinkStatus>("idle", {
  name: "$magicLinkStatus",
});

export const $magicLinkError = createStore<string | null>(null, {
  name: "$magicLinkError",
});

export const $temporarySessionStatus = createStore<TemporarySessionStatus>("idle", {
  name: "$temporarySessionStatus",
});

export const $temporarySessionError = createStore<string | null>(null, {
  name: "$temporarySessionError",
});

// ─── State machine ───────────────────────────────────────────────────────────

$authStatus
  .on(tokenChanged, () =>
    authToken.isAuthenticated() ? "authenticated" : "anonymous",
  )
  .on(logoutFx.done, () => "anonymous");

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

// ─── Wiring ──────────────────────────────────────────────────────────────────

sample({ clock: logoutPressed, target: logoutFx });
sample({ clock: magicLinkSend, target: sendMagicLinkFx });
sample({ clock: temporarySessionRequested, target: ensureTemporarySessionFx });
sample({ clock: ensureTemporarySessionFx.done, target: tokenChanged });
