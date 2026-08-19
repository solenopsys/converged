import { AccessMatcher, parsePermission } from "nrpc";
import { decodeJwtPayload, getJwtExpiry, isClusterAccessJwt } from "./jwt";
import {
	AuthError,
	type AuthController,
	type AuthControllerOptions,
	type AuthFlow,
	type AuthSessionKind,
	type AuthSnapshot,
	type GuestSessionReason,
	type JwtPayload,
	type TokenSet,
} from "./types";

function defaultSessionKind(claims: JwtPayload): AuthSessionKind {
	return claims.sub?.startsWith("temp:") || claims.temporary === true
		? "guest"
		: claims.sub ? "account" : "unknown";
}

function createSnapshot(
	status: AuthSnapshot["status"],
	tokens: TokenSet | null,
	claims: JwtPayload | null,
	error: AuthError | null,
	flow: AuthFlow,
): AuthSnapshot {
	return {
		status,
		session: claims ? (flow.classify?.(claims) ?? defaultSessionKind(claims)) : "unknown",
		tokens,
		claims,
		error,
	};
}

export function createAuthController(options: AuthControllerOptions): AuthController {
	const leewaySeconds = options.leewaySeconds ?? 30;
	const now = options.now ?? (() => Date.now());
	const listeners = new Set<(snapshot: AuthSnapshot) => void>();
	let state = createSnapshot("idle", null, null, null, options.flow);
	let restorePromise: Promise<AuthSnapshot> | undefined;
	let guestPromise: Promise<AuthSnapshot> | undefined;
	let refreshPromise: Promise<AuthSnapshot> | undefined;

	const publish = () => {
		for (const listener of listeners) listener(state);
	};

	const setState = (
		status: AuthSnapshot["status"],
		tokens: TokenSet | null,
		error: AuthError | null = null,
	): AuthSnapshot => {
		state = createSnapshot(status, tokens, tokens ? decodeJwtPayload(tokens.accessToken) : null, error, options.flow);
		publish();
		return state;
	};

	const isExpired = (tokens: TokenSet): boolean => {
		const expiresAt = tokens.expiresAt ?? getJwtExpiry(tokens.accessToken);
		return typeof expiresAt !== "number" || Math.floor(now() / 1000) + leewaySeconds >= expiresAt;
	};

	const validTokens = (tokens: TokenSet): boolean => {
		const claims = decodeJwtPayload(tokens.accessToken);
		return isClusterAccessJwt(tokens.accessToken) && Boolean(claims?.sub) && typeof claims?.exp === "number";
	};

	const isGuestToken = (tokens: TokenSet): boolean => {
		const claims = decodeJwtPayload(tokens.accessToken);
		return !!claims && defaultSessionKind(claims) === "guest";
	};

	const persist = async (tokens: TokenSet): Promise<AuthSnapshot> => {
		const normalized = { ...tokens, expiresAt: tokens.expiresAt ?? getJwtExpiry(tokens.accessToken) ?? undefined };
		if (!validTokens(normalized)) {
			await options.storage.clear();
			return setState("failed", null, new AuthError("invalid_token", "Authentication flow returned an invalid access token"));
		}
		await options.storage.write(normalized);
		return setState("active", normalized);
	};

	const ensureGuest = (reason: GuestSessionReason): Promise<AuthSnapshot> => {
		if (!options.flow.createGuest) return Promise.resolve(state);
		if (!guestPromise) {
			guestPromise = options.flow.createGuest(reason)
				.then(async (tokens) => tokens ? persist(tokens) : setState("failed", null, new AuthError("guest_session_failed", "Guest authentication did not return a session")))
				.catch(async (error) => {
					await options.storage.clear();
					return setState("failed", null, new AuthError("guest_session_failed", "Could not create a guest session", error));
				})
				.finally(() => { guestPromise = undefined; });
		}
		return guestPromise;
	};

	const refresh = (current: TokenSet): Promise<AuthSnapshot> => {
		if (!options.flow.refresh) return ensureGuest("expired");
		if (!refreshPromise) {
			refreshPromise = options.flow.refresh(current)
				.then(async (tokens) => {
					if (!tokens) return ensureGuest("refresh_failed");
					const refreshed = await persist({ ...tokens, refreshToken: tokens.refreshToken ?? current.refreshToken });
					return refreshed.status === "active" ? refreshed : ensureGuest("refresh_failed");
				})
				.catch(async (error) => {
					setState("failed", null, new AuthError("refresh_failed", "Could not refresh the session", error));
					await options.storage.clear();
					return ensureGuest("refresh_failed");
				})
				.finally(() => { refreshPromise = undefined; });
		}
		return refreshPromise;
	};

	return {
		snapshot: () => state,
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		async ensureSession() {
			if (state.status === "active" && state.tokens && validTokens(state.tokens) && !isExpired(state.tokens)) return state;
			if (restorePromise) return restorePromise;
			restorePromise = (async () => {
				setState("resolving", state.tokens, null);
				const stored = await options.storage.read();
				if (!stored) return ensureGuest("missing");
				if (!validTokens(stored)) {
					await options.storage.clear();
					return ensureGuest("missing");
				}
				// Guest permissions are embedded in the access JWT. Refresh once per
				// page load so a preset change takes effect without waiting for its TTL.
				if (!isExpired(stored) && !isGuestToken(stored)) return setState("active", stored);
				return refresh(stored);
			})().finally(() => { restorePromise = undefined; });
			return restorePromise;
		},
		async authenticate() {
			if (!options.flow.authenticate) return setState("failed", state.tokens, new AuthError("authentication_cancelled", "This host does not provide an authentication flow"));
			try {
				const tokens = await options.flow.authenticate();
				return tokens ? persist(tokens) : state;
			} catch (error) {
				return setState("failed", state.tokens, new AuthError("authentication_cancelled", "Authentication was not completed", error));
			}
		},
		async setTokens(tokens) {
			if (!tokens) {
				await options.storage.clear();
				return setState("idle", null);
			}
			return persist(tokens);
		},
		async logout() {
			const current = state.tokens ?? await options.storage.read();
			try { await options.flow.revoke?.(current); } finally {
				await options.storage.clear();
				setState("idle", null);
			}
			return ensureGuest("missing");
		},
		async getAccessToken() {
			const snapshot = await this.ensureSession();
			return snapshot.status === "active" ? snapshot.tokens?.accessToken ?? null : null;
		},
		can(requirement) {
			if (state.status !== "active" || !state.claims?.perm) return false;
			const target = typeof requirement === "string" ? parsePermission(requirement) : requirement;
			return target ? new AccessMatcher(state.claims.perm).can(target.service, target.method, target.mode) : false;
		},
	};
}
