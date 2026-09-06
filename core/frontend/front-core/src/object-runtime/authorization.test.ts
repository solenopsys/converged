import { afterEach, expect, test } from "bun:test";
import {
	authorizeObjectType,
	canDiscover,
	OperationAuthorizationError,
	operationAuthorizationSession,
	requestOperationAuthentication,
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

test("the shell can explicitly open login for a guest", async () => {
	let ensureCalls = 0;
	let authenticateCalls = 0;
	setOperationAuthorizationController({
		snapshot: () => ({ session: "guest" }),
		ensureSession: async () => {
			ensureCalls += 1;
		},
		authenticate: async () => {
			authenticateCalls += 1;
		},
		can: () => false,
	});

	expect(operationAuthorizationSession()).toBe("guest");
	await requestOperationAuthentication();
	expect(ensureCalls).toBe(1);
	expect(authenticateCalls).toBe(1);
});
