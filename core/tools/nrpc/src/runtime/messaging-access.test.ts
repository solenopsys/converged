import { describe, expect, test } from "bun:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { MessagingAccessGuard } from "./messaging-access";

const request = {
	envelopeScope: "club",
	serviceName: "fujin",
	methodName: "getState",
	access: "user" as const,
};

async function fixture(payload: Record<string, unknown> = {}) {
	const { privateKey, publicKey } = await generateKeyPair("EdDSA");
	const jwk = await exportJWK(publicKey);
	const token = await new SignJWT({
		typ: "user",
		scope: "club",
		perm: ["fujin/getState(r)"],
		...payload,
	})
		.setProtectedHeader({ alg: "EdDSA", kid: "test-key" })
		.setSubject("admin")
		.setIssuer("rp-access")
		.setAudience("cluster")
		.setIssuedAt()
		.setExpirationTime("5m")
		.sign(privateKey);
	return { token, jwks: { keys: [{ ...jwk, kid: "test-key", use: "sig" }] } };
}

describe("MessagingAccessGuard", () => {
	test("uses JWT claims instead of untrusted envelope identity", async () => {
		const { token, jwks } = await fixture();
		const guard = new MessagingAccessGuard({ mode: "required", jwks });
		await expect(guard.authorize({ ...request, token })).resolves.toEqual({
			user: "admin",
			scope: "club",
			auth: token,
		});
	});

	test("rejects a scope substitution and missing permission", async () => {
		const { token, jwks } = await fixture({ perm: ["fujin/reload(w)"] });
		const guard = new MessagingAccessGuard({ mode: "required", jwks });
		await expect(guard.authorize({ ...request, token })).rejects.toMatchObject({ code: "forbidden" });
		await expect(guard.authorize({ ...request, token, envelopeScope: "other" })).rejects.toMatchObject({ code: "unauthenticated" });
	});

	test("requires service JWT for internal methods", async () => {
		const { token, jwks } = await fixture();
		const guard = new MessagingAccessGuard({ mode: "required", jwks });
		await expect(guard.authorize({ ...request, token, access: "internal" })).rejects.toMatchObject({ code: "internal_only" });
	});

	test("keeps scope absent for a cluster-wide service JWT", async () => {
		const { token, jwks } = await fixture({
			typ: "service",
			perm: ["fujin/getState(r)"],
			scope: undefined,
		});
		const guard = new MessagingAccessGuard({ mode: "required", jwks });
		await expect(guard.authorize({ ...request, token })).resolves.toEqual({
			user: "admin",
			scope: undefined,
			auth: token,
		});
	});

	test("allows public methods without a bearer token", async () => {
		const { jwks } = await fixture();
		const guard = new MessagingAccessGuard({ mode: "required", jwks });
		await expect(guard.authorize({ ...request, token: undefined, access: "public" })).resolves.toBeUndefined();
	});

	test("allows a permitted service JWT for internal methods", async () => {
		const { token, jwks } = await fixture({
			typ: "service",
			perm: ["fujin/getState(r)"],
			scope: undefined,
		});
		const guard = new MessagingAccessGuard({ mode: "required", jwks });
		await expect(guard.authorize({ ...request, token, envelopeScope: undefined, access: "internal" })).resolves.toEqual({
			user: "admin",
			scope: undefined,
			auth: token,
		});
	});
});
