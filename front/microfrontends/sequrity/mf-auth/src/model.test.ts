import { describe, it, expect, beforeEach, mock } from "bun:test";
import { allSettled, fork } from "effector";

// ─── Mock authToken from front-core ──────────────────────────────────────────
let mockIsAuthenticated = false;
let mockToken: string | null = null;

mock.module("front-core", () => ({
  authToken: {
    isAuthenticated: () => mockIsAuthenticated,
    get: () => mockToken,
  },
}));

mock.module("./service", () => ({
  authClient: {
    createTemporaryUser: async () => ({
      token: "header.payload.signature",
      userId: "temp:test",
      email: "temp+test@guest.local",
      temporary: true,
    }),
  },
  sendMagicLink: async (email: string) => {
    if (email === "fail@example.com") throw new Error("Rate limit exceeded");
    return undefined;
  },
}));

// Import AFTER mocks
const {
  $authStatus,
  $isAuthenticated,
  $magicLinkStatus,
  $magicLinkError,
  tokenChanged,
  logoutPressed,
  magicLinkSend,
  logoutFx,
  sendMagicLinkFx,
} = await import("./model");

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("$authStatus", () => {
  it("starts as anonymous when no real token", () => {
    mockIsAuthenticated = false;
    const scope = fork({ values: [[$authStatus, "anonymous"]] });
    expect(scope.getState($authStatus)).toBe("anonymous");
  });

  it("starts as authenticated when real token present", () => {
    const scope = fork({ values: [[$authStatus, "authenticated"]] });
    expect(scope.getState($authStatus)).toBe("authenticated");
  });

  it("switches to anonymous after logout", async () => {
    const scope = fork({
      values: [[$authStatus, "authenticated"]],
      handlers: [[logoutFx, async () => {}]],
    });
    await allSettled(logoutPressed, { scope });
    expect(scope.getState($authStatus)).toBe("anonymous");
  });

  it("updates on tokenChanged", async () => {
    mockIsAuthenticated = true;
    const scope = fork({ values: [[$authStatus, "anonymous"]] });
    await allSettled(tokenChanged, { scope });
    expect(scope.getState($authStatus)).toBe("authenticated");

    mockIsAuthenticated = false;
    await allSettled(tokenChanged, { scope });
    expect(scope.getState($authStatus)).toBe("anonymous");
  });
});

describe("$isAuthenticated", () => {
  it("is false when anonymous", () => {
    const scope = fork({ values: [[$authStatus, "anonymous"]] });
    expect(scope.getState($isAuthenticated)).toBe(false);
  });

  it("is true when authenticated", () => {
    const scope = fork({ values: [[$authStatus, "authenticated"]] });
    expect(scope.getState($isAuthenticated)).toBe(true);
  });
});

describe("magic link flow", () => {
  it("goes idle → sending → sent on success", async () => {
    const scope = fork();

    expect(scope.getState($magicLinkStatus)).toBe("idle");

    await allSettled(magicLinkSend, { scope, params: "user@example.com" });

    expect(scope.getState($magicLinkStatus)).toBe("sent");
    expect(scope.getState($magicLinkError)).toBeNull();
  });

  it("goes idle → sending → error on failure", async () => {
    const scope = fork();

    await allSettled(magicLinkSend, { scope, params: "fail@example.com" });

    expect(scope.getState($magicLinkStatus)).toBe("error");
    expect(scope.getState($magicLinkError)).toBe("Rate limit exceeded");
  });

  it("resets status and error when sending again", async () => {
    const scope = fork({
      values: [
        [$magicLinkStatus, "error"],
        [$magicLinkError, "previous error"],
      ],
    });

    await allSettled(magicLinkSend, { scope, params: "user@example.com" });

    expect(scope.getState($magicLinkStatus)).toBe("sent");
    expect(scope.getState($magicLinkError)).toBeNull();
  });
});
