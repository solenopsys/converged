// Browser half of authentication. Plain fetch against the UI's own /auth/*
// routes — deliberately NOT nrpc: the cluster WebSocket requires a JWT, and
// these are precisely the calls made before the browser has one. Everything
// past this point (the auth microservices) is reached by the gateway.
const AUTH_BASE = "/auth";

export type GatewaySession = {
	token: string;
	userId?: string;
	email?: string;
};

export type AuthProvider = {
	provider: string;
	displayName: string;
};

async function post<T>(path: string, body?: unknown): Promise<T> {
	const response = await fetch(`${AUTH_BASE}${path}`, {
		method: "POST",
		credentials: "same-origin",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body ?? {}),
	});
	if (!response.ok) {
		throw new Error(`[auth] POST ${path} failed: HTTP ${response.status}`);
	}
	return (await response.json()) as T;
}

/** Guest bootstrap: mints the anonymous session the WebSocket authenticates with. */
export function createGuestSession(sessionId: string): Promise<GatewaySession> {
	return post<GatewaySession>("/guest", { sessionId });
}

/**
 * Restores a session from the httpOnly refresh cookie — how a magic-link or
 * OAuth redirect hands the browser its token, without ever putting one in a URL.
 * Returns null when there is no live session (401), which is not an error.
 */
export async function restoreSession(): Promise<GatewaySession | null> {
	const response = await fetch(`${AUTH_BASE}/session`, {
		credentials: "same-origin",
	});
	// 204: no refresh cookie yet — the expected answer before the first session.
	if (response.status === 204) return null;
	if (!response.ok) {
		throw new Error(`[auth] GET /session failed: HTTP ${response.status}`);
	}
	return (await response.json()) as GatewaySession;
}

export async function refreshSession(): Promise<GatewaySession | null> {
	const response = await fetch(`${AUTH_BASE}/refresh`, {
		method: "POST",
		credentials: "same-origin",
	});
	if (response.status === 204) return null;
	if (!response.ok) {
		throw new Error(`[auth] POST /refresh failed: HTTP ${response.status}`);
	}
	return (await response.json()) as GatewaySession;
}

export async function endSession(accessToken: string | null): Promise<void> {
	await fetch(`${AUTH_BASE}/logout`, {
		method: "POST",
		credentials: "same-origin",
		// The gateway revokes the sessions of whoever this token belongs to; a
		// userId in the body would be forgeable.
		headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
	});
}

export async function sendMagicLink(
	email: string,
	returnTo?: string,
): Promise<void> {
	await post("/magic-link", { email, returnTo });
}

export async function listAuthProviders(): Promise<AuthProvider[]> {
	const response = await fetch(`${AUTH_BASE}/providers`, {
		credentials: "same-origin",
	});
	if (!response.ok) {
		throw new Error(`[auth] GET /providers failed: HTTP ${response.status}`);
	}
	return (await response.json()) as AuthProvider[];
}

export function oauthStartUrl(provider: string, returnTo: string): string {
	return `${AUTH_BASE}/oauth/${provider}?returnTo=${encodeURIComponent(returnTo)}`;
}
