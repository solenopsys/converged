import { expect, mock, test } from "bun:test";

const calls: Array<{ userId: string; preset: string }> = [];
const removed: string[] = [];

mock.module("./clients", () => ({
	accessClient: () => ({
		emitJWT: async () => "access-token",
		getPermissionsFromUser: async () => ["legacy/read(r)"],
		linkPresetToUser: async (userId: string, preset: string) => {
			calls.push({ userId, preset });
		},
		removePermissionFromUser: async (_userId: string, permission: string) => {
			removed.push(permission);
		},
	}),
	authClient: () => ({
		createRefreshSession: async () => ({ refreshToken: "refresh-token" }),
	}),
	identityClient: () => ({
		getAuthMethodByProvider: async () => null,
		getUser: async () => null,
		createUser: async (user: { id: string; email: string }) => user,
		linkAuthMethod: async () => undefined,
	}),
}));

const { createGuestSession } = await import("./sessions");

test("guest sessions receive the anonymous preset", async () => {
	const session = await createGuestSession("browser-session");

	expect(session.token).toBe("access-token");
	expect(removed).toEqual(["legacy/read(r)"]);
	expect(calls).toEqual([{ userId: session.userId, preset: "anonymous" }]);
});
