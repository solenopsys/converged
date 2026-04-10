import { createStore, createEvent, createEffect, sample } from "effector";
import { authToken } from "front-core";
import { sendMagicLink } from "./service";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthStatus = "anonymous" | "authenticated";
export type MagicLinkStatus = "idle" | "sending" | "sent" | "error";

// ─── Events ──────────────────────────────────────────────────────────────────

export const tokenChanged    = createEvent<void>("tokenChanged");
export const logoutPressed   = createEvent<void>("logoutPressed");
export const magicLinkSend   = createEvent<string>("magicLinkSend"); // email

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

// ─── Wiring ──────────────────────────────────────────────────────────────────

sample({ clock: logoutPressed, target: logoutFx });
sample({ clock: magicLinkSend, target: sendMagicLinkFx });
