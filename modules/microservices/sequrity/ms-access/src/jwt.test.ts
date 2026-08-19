import { expect, test } from "bun:test";
import { exportJWK, generateKeyPair, importJWK, jwtVerify } from "jose";
import { UserJwtIssuer } from "./jwt";

test("UserJwtIssuer creates an EdDSA JWT with cluster claims", async () => {
	const { privateKey, publicKey } = await generateKeyPair("EdDSA", { extractable: true });
	const privateJwk = await exportJWK(privateKey);
	const issuer = new UserJwtIssuer({
		privateJwk: JSON.stringify(privateJwk),
		kid: "current",
		issuer: "ms-access",
		audience: "cluster",
	});
	const token = await issuer.issue("admin", "club", ["fujin/getState(r)"], 60);
	const result = await jwtVerify(token, publicKey, {
		issuer: "ms-access",
		audience: "cluster",
		algorithms: ["EdDSA"],
	});
	expect(result.protectedHeader.kid).toBe("current");
	expect(result.payload).toMatchObject({ typ: "user", sub: "admin", scope: "club", perm: ["fujin/getState(r)"] });
});

test("UserJwtIssuer creates an expiring EdDSA service token", async () => {
	const privateKey = await generateKeyPair("EdDSA", { extractable: true });
	const privateJwk = await exportJWK(privateKey.privateKey);
	const publicJwk = await exportJWK(privateKey.publicKey);
	const issuer = new UserJwtIssuer({
		privateJwk: JSON.stringify(privateJwk),
		kid: "service-key",
		issuer: "ms-access",
		audience: "cluster",
	});

	const token = await issuer.issueService("resonus", ["resonus/call.offer(w)"], 60);
	const verified = await jwtVerify(token, await importJWK(publicJwk, "EdDSA"), {
		issuer: "ms-access",
		audience: "cluster",
		algorithms: ["EdDSA"],
	});

	expect(verified.payload.typ).toBe("service");
	expect(verified.payload.sub).toBe("resonus");
	expect(verified.payload.perm).toEqual(["resonus/call.offer(w)"]);
	expect(verified.payload.exp).toBeTypeOf("number");
});
