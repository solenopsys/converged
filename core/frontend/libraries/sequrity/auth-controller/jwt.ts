import type { JwtPayload } from "./types";

type JwtHeader = { alg?: string; kid?: string };

function decodeBase64Url(input: string): string {
	const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
	const runtime = globalThis as {
		atob?: (value: string) => string;
		Buffer?: { from(value: string, encoding: string): { toString(encoding: string): string } };
	};
	if (typeof runtime.atob === "function") return runtime.atob(padded);
	if (runtime.Buffer) return runtime.Buffer.from(padded, "base64").toString("utf8");
	throw new Error("No base64 decoder available");
}

export function decodeJwtPayload(token: string): JwtPayload | null {
	const parts = token.split(".");
	if (parts.length !== 3) return null;
	try {
		return JSON.parse(decodeBase64Url(parts[1])) as JwtPayload;
	} catch {
		return null;
	}
}

function decodeJwtHeader(token: string): JwtHeader | null {
	const parts = token.split(".");
	if (parts.length !== 3) return null;
	try {
		return JSON.parse(decodeBase64Url(parts[0])) as JwtHeader;
	} catch {
		return null;
	}
}

/** Structural validation only. The gateway validates the JWT signature. */
export function isClusterAccessJwt(token: string): boolean {
	const header = decodeJwtHeader(token);
	return header?.alg === "EdDSA" && typeof header.kid === "string" && header.kid.length > 0;
}

export function getJwtExpiry(token: string): number | null {
	const expiry = decodeJwtPayload(token)?.exp;
	return typeof expiry === "number" ? expiry : null;
}
