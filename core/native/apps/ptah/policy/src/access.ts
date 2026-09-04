/**
 * The platform's signing material, handed over by the host.
 *
 * Not generated here: the policy is re-evaluated on every pass, so a key minted
 * in this file would be a different key every pass and the platform's identity
 * would rotate once per resync. The host derives it from a seed it stored once
 * and gives back the same answer every time — which is what keeps this module a
 * pure function of its input like the rest of the policy.
 */

declare const __host: (what: string) => string;

export interface AccessMaterial {
	issuer: string;
	audience: string;
	kid: string;
	privateJwk: unknown;
	publicJwks: unknown;
	serviceToken: string;
}

/** The Secret ptah writes the material into, and the pods read it from. */
export const accessSecretName = (platform: string) => `${platform}-access`;

export function accessMaterial(): AccessMaterial | undefined {
	if (typeof __host !== "function") return undefined;
	const raw = __host("access-keys");
	if (!raw || raw === "null") return undefined;
	try {
		return JSON.parse(raw) as AccessMaterial;
	} catch {
		return undefined;
	}
}

/**
 * `ACCESS_JWT_*` as the containers expect them.
 *
 * The private key and the service token are in the same Secret as the public
 * set on purpose: every one of them is derived from one seed, so splitting them
 * across two objects would only create a way for half of a platform's identity
 * to be present.
 */
export function accessSecretData(
	material: AccessMaterial,
): Record<string, string> {
	return {
		ACCESS_JWT_ISSUER: material.issuer,
		ACCESS_JWT_AUDIENCE: material.audience,
		ACCESS_JWT_KID: material.kid,
		ACCESS_JWT_PUBLIC_JWKS: JSON.stringify(material.publicJwks),
		ACCESS_JWT_PRIVATE_KEY: JSON.stringify(material.privateJwk),
		SERVICE_TOKEN: material.serviceToken,
	};
}
