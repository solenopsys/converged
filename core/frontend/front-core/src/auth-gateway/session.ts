// Cookie + redirect helpers. Deliberately dependency-free utility functions:
// the gateway is the only place in the UI process that speaks HTTP auth, and
// nothing here may reach for nrpc.
import type { HeaderMap } from "back-core/server-app";

export const REFRESH_COOKIE = "auth_refresh";

// One tenant per domain, so a single host-scoped cookie is enough — there is no
// cross-tenant session sharing to support.
const COOKIE_PATH = "/";
const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function readCookie(headers: HeaderMap, name: string): string | undefined {
	const header = headers.cookie ?? headers.Cookie;
	if (!header) return undefined;
	for (const part of header.split(";")) {
		const separator = part.indexOf("=");
		if (separator === -1) continue;
		if (part.slice(0, separator).trim() !== name) continue;
		const value = part.slice(separator + 1).trim();
		return value ? decodeURIComponent(value) : undefined;
	}
	return undefined;
}

export function isSecureRequest(headers: HeaderMap): boolean {
	const proto = headers["x-forwarded-proto"]?.split(",")[0]?.trim();
	return proto === "https";
}

export function refreshCookie(token: string, secure: boolean): string {
	return [
		`${REFRESH_COOKIE}=${encodeURIComponent(token)}`,
		`Path=${COOKIE_PATH}`,
		`Max-Age=${REFRESH_MAX_AGE_SECONDS}`,
		"HttpOnly",
		"SameSite=Lax",
		secure ? "Secure" : undefined,
	]
		.filter(Boolean)
		.join("; ");
}

export function clearedRefreshCookie(secure: boolean): string {
	return [
		`${REFRESH_COOKIE}=`,
		`Path=${COOKIE_PATH}`,
		"Max-Age=0",
		"HttpOnly",
		"SameSite=Lax",
		secure ? "Secure" : undefined,
	]
		.filter(Boolean)
		.join("; ");
}

/**
 * External base URL of this tenant. Derived from the request rather than an env
 * var: one UI image serves several hosts and the scope itself is resolved from
 * Host at the edge, so a pinned URL would be wrong for every tenant but one.
 */
export function publicBaseUrl(headers: HeaderMap): string {
	const host = headers["x-forwarded-host"]?.split(",")[0]?.trim() || headers.host;
	if (!host) throw new Error("[auth-gateway] request has no Host header");
	return `${isSecureRequest(headers) ? "https" : "http"}://${host}`;
}

/**
 * Only same-origin paths may be used as a post-login destination — an absolute
 * URL from the query string would turn the callback into an open redirect.
 */
export function safeReturnTo(value: string | undefined): string {
	if (!value) return "/";
	if (!value.startsWith("/") || value.startsWith("//")) return "/";
	return value;
}

export function jsonResponse(
	body: unknown,
	init: { status?: number; cookie?: string } = {},
): Response {
	const headers = new Headers({ "Content-Type": "application/json" });
	if (init.cookie) headers.append("Set-Cookie", init.cookie);
	return new Response(JSON.stringify(body), {
		status: init.status ?? 200,
		headers,
	});
}

/**
 * "There is no session" is this endpoint's normal answer on a first visit, not
 * a failure — 204 keeps it out of the browser's error log and out of the way of
 * anything that treats a 401 as a reason to tear the app down.
 */
export function noSessionResponse(cookie?: string): Response {
	const headers = new Headers();
	if (cookie) headers.append("Set-Cookie", cookie);
	return new Response(null, { status: 204, headers });
}

export function redirectResponse(
	location: string,
	init: { cookie?: string } = {},
): Response {
	const headers = new Headers({ Location: location });
	if (init.cookie) headers.append("Set-Cookie", init.cookie);
	return new Response(null, { status: 302, headers });
}
