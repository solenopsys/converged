import { describe, expect, it, mock } from "bun:test";
import { allSettled, fork } from "effector";

mock.module("./service", () => ({
	createGuestSession: async () => ({ token: "unused" }),
	restoreSession: async () => null,
	refreshSession: async () => null,
	endSession: async () => undefined,
	sendMagicLink: async (email: string) => {
		if (email === "fail@example.com") throw new Error("Rate limit exceeded");
	},
}));

const {
	$authStatus,
	$isAuthenticated,
	$magicLinkError,
	$magicLinkStatus,
	magicLinkSend,
} = await import("./model");

describe("auth view state", () => {
	it("treats guest and absent sessions as anonymous", () => {
		const scope = fork({ values: [[$authStatus, "anonymous"]] });
		expect(scope.getState($isAuthenticated)).toBe(false);
	});

	it("treats an account session as authenticated", () => {
		const scope = fork({ values: [[$authStatus, "authenticated"]] });
		expect(scope.getState($isAuthenticated)).toBe(true);
	});
});

describe("magic link flow", () => {
	it("records a successful request", async () => {
		const scope = fork();
		await allSettled(magicLinkSend, { scope, params: "user@example.com" });
		expect(scope.getState($magicLinkStatus)).toBe("sent");
		expect(scope.getState($magicLinkError)).toBeNull();
	});

	it("preserves the gateway error", async () => {
		const scope = fork();
		await allSettled(magicLinkSend, { scope, params: "fail@example.com" });
		expect(scope.getState($magicLinkStatus)).toBe("error");
		expect(scope.getState($magicLinkError)).toBe("Rate limit exceeded");
	});
});
