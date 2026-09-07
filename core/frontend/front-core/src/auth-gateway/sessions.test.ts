import { beforeEach, expect, mock, test } from "bun:test";

const calls: Array<{ userId: string; preset: string }> = [];
const removed: string[] = [];
const guestUser = {
	id: "temp:existing-browser-session",
	email: "temp+existing-browser-session@guest.local",
};

mock.module("./clients", () => ({
	accessClient: () => ({
		emitJWT: async () => "access-token",
		getPermissionsFromUser: async () => ({ "*": { legacy: { read: "r" } } }),
		linkPresetToUser: async (userId: string, preset: string) => {
			calls.push({ userId, preset });
		},
		removePermissionFromUser: async (_userId: string, permission: string) => {
			removed.push(permission);
		},
	}),
	authClient: () => ({
		createRefreshSession: async () => ({ refreshToken: "refresh-token" }),
		refreshSession: async () => ({
			userId: guestUser.id,
			refreshToken: "rotated-refresh-token",
		}),
	}),
	identityClient: () => ({
		getAuthMethodByProvider: async () => null,
		getUser: async (userId: string) => (userId === guestUser.id ? guestUser : null),
		createUser: async (user: { id: string; email: string }) => user,
		linkAuthMethod: async () => undefined,
	}),
}));

const { createGuestSession, refreshGatewaySession } = await import("./sessions");

beforeEach(() => {
	calls.length = 0;
	removed.length = 0;
});

test("guest sessions receive the anonymous preset", async () => {
	const session = await createGuestSession("browser-session");

	expect(session.token).toBe("access-token");
	expect(removed).toEqual(["*/legacy/read(r)"]);
	expect(calls).toEqual([{ userId: session.userId, preset: "anonymous" }]);
});

test("refresh repairs legacy guest permissions before issuing a token", async () => {
	const session = await refreshGatewaySession("legacy-refresh-token");

	expect(session).toMatchObject({
		token: "access-token",
		refreshToken: "rotated-refresh-token",
		userId: guestUser.id,
	});
	expect(removed).toEqual(["*/legacy/read(r)"]);
	expect(calls).toEqual([{ userId: guestUser.id, preset: "anonymous" }]);
});
