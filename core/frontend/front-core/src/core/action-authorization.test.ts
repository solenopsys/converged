import { expect, test } from "bun:test";
import {
	ActionAuthorizationError,
	authorizeAction,
	canRunAction,
	setActionAuthorizationController,
} from "./action-authorization";

const protectedAction = {
	id: "logs.hot.show",
	description: "Show logs",
	capability: "logs/listHot(r)",
	invoke: () => undefined,
};

test("does not authorize a protected action for a guest", async () => {
	let loginRequested = 0;
	setActionAuthorizationController({
		snapshot: () => ({ session: "guest" }),
		ensureSession: async () => undefined,
		authenticate: async () => { loginRequested += 1; },
		can: () => false,
	});

	expect(canRunAction(protectedAction)).toBe(false);
	await expect(authorizeAction(protectedAction)).rejects.toMatchObject({
		code: "authentication_required",
	});
	expect(loginRequested).toBe(1);
	setActionAuthorizationController(null);
});

test("rejects an account missing the action capability", async () => {
	setActionAuthorizationController({
		snapshot: () => ({ session: "account" }),
		ensureSession: async () => undefined,
		authenticate: async () => undefined,
		can: () => false,
	});

	await expect(authorizeAction(protectedAction)).rejects.toBeInstanceOf(ActionAuthorizationError);
	setActionAuthorizationController(null);
});

test("allows an explicit public action without auth configuration", () => {
	expect(canRunAction({ access: "public" })).toBe(true);
});
