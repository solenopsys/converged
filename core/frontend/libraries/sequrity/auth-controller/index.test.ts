import { expect, test } from "bun:test";
import { createAuthController, createMemoryTokenStorage, isClusterAccessJwt } from "./index";

function jwt(payload: Record<string, unknown>, header = { alg: "EdDSA", kid: "access-2026" }): string {
	return `${Buffer.from(JSON.stringify(header)).toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
}

test("accepts only EdDSA access JWTs with a key id", () => {
	expect(isClusterAccessJwt(jwt({}, { alg: "EdDSA", kid: "access-2026" }))).toBe(true);
	expect(isClusterAccessJwt(jwt({}, { alg: "HS256", kid: "legacy" }))).toBe(false);
});

test("creates one guest session and exposes its permissions", async () => {
	let created = 0;
	const controller = createAuthController({
		storage: createMemoryTokenStorage(),
		flow: {
			createGuest: async () => {
				created += 1;
				return { accessToken: jwt({ sub: "temp:1", exp: 10_000, perm: ["catalog/list(r)"] }) };
			},
		},
		now: () => 1_000,
	});

	expect(await Promise.all([controller.getAccessToken(), controller.getAccessToken()])).toHaveLength(2);
	expect(created).toBe(1);
	expect(controller.snapshot().session).toBe("guest");
	expect(controller.can("catalog/list(r)")).toBe(true);
	expect(controller.can("admin/delete(w)")).toBe(false);
});

test("refreshes an expired token once for concurrent callers", async () => {
	let refreshes = 0;
	const controller = createAuthController({
		storage: createMemoryTokenStorage({ accessToken: jwt({ sub: "user:1", exp: 1 }), refreshToken: "refresh-1" }),
		flow: {
			refresh: async (current) => {
				refreshes += 1;
				expect(current.refreshToken).toBe("refresh-1");
				return { accessToken: jwt({ sub: "user:1", exp: 10_000, perm: [] }), refreshToken: "refresh-2" };
			},
		},
		now: () => 2_000,
	});

	expect(await Promise.all([controller.getAccessToken(), controller.getAccessToken()])).toEqual([
		expect.any(String), expect.any(String),
	]);
	expect(refreshes).toBe(1);
	expect(controller.snapshot().tokens?.refreshToken).toBe("refresh-2");
});

test("refreshes a valid guest token on startup to pick up preset changes", async () => {
	let refreshes = 0;
	const controller = createAuthController({
		storage: createMemoryTokenStorage({
			accessToken: jwt({ sub: "temp:1", exp: 10_000, perm: ["resonus/chat.message(w)"] }),
			refreshToken: "refresh-1",
		}),
		flow: {
			refresh: async () => {
				refreshes += 1;
				return {
					accessToken: jwt({
						sub: "temp:1",
						exp: 10_000,
						perm: ["resonus/chat.message(w)", "resonus/call.offer(w)"],
					}),
				};
			},
		},
		now: () => 1_000,
	});

	await controller.getAccessToken();
	expect(refreshes).toBe(1);
	expect(controller.can("resonus/call.offer(w)")).toBe(true);
});
