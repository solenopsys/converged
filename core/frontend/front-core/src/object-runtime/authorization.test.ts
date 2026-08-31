import { afterEach, expect, test } from "bun:test";
import {
	authorizeObjectType,
	canDiscover,
	OperationAuthorizationError,
	setOperationAuthorizationController,
} from "./authorization";

afterEach(() => setOperationAuthorizationController(null));

test("an internal generic command opens login for a guest", async () => {
	let authenticateCalls = 0;
	setOperationAuthorizationController({
		snapshot: () => ({ session: "guest" }),
		ensureSession: async () => undefined,
		authenticate: async () => {
			authenticateCalls += 1;
		},
		can: () => false,
	});

	expect(canDiscover({ access: "public" })).toBe(true);
	expect(canDiscover({ access: "user" })).toBe(false);
	await expect(
		authorizeObjectType({ id: "logs.entry", access: "user" }),
	).rejects.toBeInstanceOf(OperationAuthorizationError);
	expect(authenticateCalls).toBe(1);
});
