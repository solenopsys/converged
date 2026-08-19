import { createLocalJWKSet, jwtVerify, type JWK, type JWTVerifyResult } from "jose";
import { resolveAccessForMethod, AccessMatcher } from "./access-control";
import type { AccessLevel } from "../decorator/access.decorator";

export type MessagingAccessMode = "off" | "audit" | "required";

export interface MessagingAccessConfig {
	mode?: MessagingAccessMode;
	issuer?: string;
	audience?: string;
	jwks?: string | { keys: JWK[] };
	cacheSize?: number;
	log?: (message: string, details: Record<string, unknown>) => void;
}

export interface TrustedMessagingContext {
	user: string;
	scope?: string;
	auth: string;
}

export interface MessagingAuthorizationRequest {
	token: string | undefined;
	envelopeScope: string | undefined;
	serviceName: string;
	methodName: string;
	access: AccessLevel;
}

type VerifiedToken = TrustedMessagingContext & {
	type: "user" | "service";
	permissions: string[];
	expiresAt: number;
};

/**
 * Authentication boundary for NRPC message receivers. Its successful result
 * is the only source from which a handler receives user and scope data.
 */
export class MessagingAccessGuard {
	readonly mode: MessagingAccessMode;
	private readonly issuer?: string;
	private readonly audience?: string;
	private readonly keySet?: ReturnType<typeof createLocalJWKSet>;
	private readonly cache = new Map<string, VerifiedToken>();
	private readonly cacheSize: number;
	private readonly log: (message: string, details: Record<string, unknown>) => void;

	constructor(config: MessagingAccessConfig = {}) {
		this.mode = resolveMode(config.mode);
		this.issuer = config.issuer ?? process.env.ACCESS_JWT_ISSUER ?? "ms-access";
		this.audience = config.audience ?? process.env.ACCESS_JWT_AUDIENCE ?? "cluster";
		this.cacheSize = config.cacheSize ?? 1_024;
		this.log = config.log ?? ((message, details) => console.warn(`[nrpc auth] ${message}`, details));

		const jwks = config.jwks ?? process.env.ACCESS_JWT_PUBLIC_JWKS;
		if (this.mode !== "off") {
			if (!jwks) throw new Error("ACCESS_JWT_PUBLIC_JWKS is required when NRPC access control is enabled");
			const parsed = typeof jwks === "string" ? parseJwks(jwks) : jwks;
			this.keySet = createLocalJWKSet(parsed);
		}
	}

	async authorize(request: MessagingAuthorizationRequest): Promise<TrustedMessagingContext | undefined> {
		if (this.mode === "off") return undefined;
		// Public methods are deliberately callable without credentials. This must
		// happen before JWT parsing: SSR and unauthenticated browser requests do
		// not have an auth envelope at all.
		if (request.access === "public") return undefined;
		try {
			const verified = await this.verify(request.token);
			this.enforce(verified, request);
			return { user: verified.user, scope: verified.scope, auth: verified.auth };
		} catch (cause) {
			if (this.mode === "audit") {
				this.log("would reject incoming NRPC request", {
					serviceName: request.serviceName,
					methodName: request.methodName,
					reason: messageOf(cause),
				});
				return undefined;
			}
			throw asAuthorizationError(cause, request);
		}
	}

	private async verify(token: string | undefined): Promise<VerifiedToken> {
		const normalized = token?.trim();
		if (!normalized) throw new MessagingAuthorizationError("unauthenticated", "missing bearer token");
		const cached = this.cache.get(normalized);
		if (cached && cached.expiresAt > nowSeconds()) return cached;
		if (cached) this.cache.delete(normalized);

		const result = await jwtVerify(normalized, this.keySet!, {
			issuer: this.issuer,
			audience: this.audience,
			algorithms: ["EdDSA"],
		});
		const verified = claimsFrom(result, normalized);
		this.cache.set(normalized, verified);
		while (this.cache.size > this.cacheSize) this.cache.delete(this.cache.keys().next().value!);
		return verified;
	}

	private enforce(token: VerifiedToken, request: MessagingAuthorizationRequest): void {
		if (token.type === "user" && request.envelopeScope && request.envelopeScope !== token.scope) {
			throw new MessagingAuthorizationError("unauthenticated", "envelope scope does not match JWT scope");
		}
		if (request.access === "internal" && token.type !== "service") {
			throw new MessagingAuthorizationError("internal_only", "service JWT required");
		}
		// A service JWT is the standard identity for service-to-service calls.
		// `user` describes the browser-facing caller class, not an exclusion of
		// trusted services. Its permissions still have to grant this exact method.

		const required = resolveAccessForMethod(request.methodName);
		if (!new AccessMatcher(token.permissions).can(request.serviceName, request.methodName, required)) {
			throw new MessagingAuthorizationError("forbidden", `missing ${required} permission`);
		}
	}
}

export class MessagingAuthorizationError extends Error {
	constructor(readonly code: "unauthenticated" | "forbidden" | "internal_only", message: string) {
		super(message);
	}
}

function claimsFrom(result: JWTVerifyResult, token: string): VerifiedToken {
	const payload = result.payload;
	const type = payload.typ;
	if (type !== "user" && type !== "service") throw new MessagingAuthorizationError("unauthenticated", "invalid token type");
	if (typeof payload.sub !== "string" || payload.sub.length === 0) throw new MessagingAuthorizationError("unauthenticated", "missing subject");
	if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) throw new MessagingAuthorizationError("unauthenticated", "missing expiry");
	if (typeof payload.iat !== "number" || !Number.isFinite(payload.iat)) throw new MessagingAuthorizationError("unauthenticated", "missing issued-at time");
	if (!Array.isArray(payload.perm) || !payload.perm.every((value) => typeof value === "string")) {
		throw new MessagingAuthorizationError("unauthenticated", "missing permissions");
	}
	// Service identities are cluster-wide. Keep an absent service scope undefined
	// so the authenticated caller does not erase the tenant scope in the envelope.
	const scope = typeof payload.scope === "string" && payload.scope.trim() ? payload.scope.trim() : undefined;
	if (type === "user" && !scope) throw new MessagingAuthorizationError("unauthenticated", "missing user scope");
	return { user: payload.sub, scope, auth: token, type, permissions: payload.perm as string[], expiresAt: payload.exp };
}

function resolveMode(configMode: MessagingAccessMode | undefined): MessagingAccessMode {
	const raw = (configMode ?? process.env.NRPC_ACCESS_MODE ?? "off").toLowerCase();
	if (raw === "required" || raw === "strict") return "required";
	if (raw === "audit" || raw === "optional") return "audit";
	return "off";
}

function parseJwks(value: string): { keys: JWK[] } {
	try {
		const parsed = JSON.parse(value) as { keys?: unknown };
		if (!Array.isArray(parsed.keys) || parsed.keys.length === 0) throw new Error("keys must be a non-empty array");
		return { keys: parsed.keys as JWK[] };
	} catch (cause) {
		throw new Error(`ACCESS_JWT_PUBLIC_JWKS is invalid: ${messageOf(cause)}`);
	}
}

function asAuthorizationError(cause: unknown, request: MessagingAuthorizationRequest): MessagingAuthorizationError {
	if (cause instanceof MessagingAuthorizationError) return cause;
	return new MessagingAuthorizationError("unauthenticated", `JWT rejected for ${request.serviceName}.${request.methodName}`);
}

function messageOf(cause: unknown): string {
	return cause instanceof Error ? cause.message : String(cause);
}

function nowSeconds(): number {
	return Math.floor(Date.now() / 1_000);
}
