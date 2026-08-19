import { describe, expect, test } from "bun:test";
import { authorizeUrl, redirectUri } from "./oauth";
import {
	clearedRefreshCookie,
	isSecureRequest,
	noSessionResponse,
	publicBaseUrl,
	readCookie,
	refreshCookie,
	REFRESH_COOKIE,
	safeReturnTo,
} from "./session";

describe("cookies", () => {
	test("refresh cookie is httpOnly and only Secure behind TLS", () => {
		const secure = refreshCookie("tok en", true);
		expect(secure).toContain(`${REFRESH_COOKIE}=tok%20en`);
		expect(secure).toContain("HttpOnly");
		expect(secure).toContain("SameSite=Lax");
		expect(secure).toContain("Secure");
		expect(refreshCookie("t", false)).not.toContain("Secure");
	});

	test("clearing expires the cookie immediately", () => {
		expect(clearedRefreshCookie(false)).toContain("Max-Age=0");
	});

	test("reads one cookie out of a multi-value header", () => {
		const headers = { cookie: `a=1; ${REFRESH_COOKIE}=r%2Ft; b=2` };
		expect(readCookie(headers, REFRESH_COOKIE)).toBe("r/t");
		expect(readCookie(headers, "missing")).toBeUndefined();
		expect(readCookie({}, REFRESH_COOKIE)).toBeUndefined();
	});
});

describe("no session", () => {
	test("is 204, not 401 — absence of a session is not an error", () => {
		const response = noSessionResponse();
		expect(response.status).toBe(204);
		expect(response.headers.get("set-cookie")).toBeNull();
	});

	test("clears a rejected refresh token on the way out", () => {
		const response = noSessionResponse(clearedRefreshCookie(true));
		expect(response.status).toBe(204);
		expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
	});
});

describe("request origin", () => {
	test("proxy headers decide scheme and host", () => {
		expect(isSecureRequest({ "x-forwarded-proto": "https,http" })).toBe(true);
		expect(isSecureRequest({ "x-forwarded-proto": "http" })).toBe(false);
		expect(
			publicBaseUrl({ host: "app.local", "x-forwarded-proto": "https" }),
		).toBe("https://app.local");
		expect(
			publicBaseUrl({ host: "ignored", "x-forwarded-host": "outer.example" }),
		).toBe("http://outer.example");
	});

	test("a request without Host fails loudly", () => {
		expect(() => publicBaseUrl({})).toThrow(/Host/);
	});
});

describe("returnTo", () => {
	test("keeps same-origin paths and rejects open redirects", () => {
		expect(safeReturnTo("/dashboard?tab=1")).toBe("/dashboard?tab=1");
		expect(safeReturnTo(undefined)).toBe("/");
		expect(safeReturnTo("https://evil.example/x")).toBe("/");
		expect(safeReturnTo("//evil.example/x")).toBe("/");
	});
});

describe("oauth authorize url", () => {
	test("carries client, scopes, state and the gateway callback", () => {
		const url = new URL(
			authorizeUrl(
				{
					provider: "github",
					clientId: "cid",
					clientSecret: "secret",
					authorizeUrl: "https://github.com/login/oauth/authorize",
					tokenUrl: "https://github.com/login/oauth/access_token",
					userinfoUrl: "https://api.github.com/user",
					scopes: ["read:user", "user:email"],
					enabled: true,
					createdAt: 0,
				},
				"state-token",
				redirectUri("https://app.local", "github"),
			),
		);
		expect(url.origin + url.pathname).toBe(
			"https://github.com/login/oauth/authorize",
		);
		expect(url.searchParams.get("client_id")).toBe("cid");
		expect(url.searchParams.get("state")).toBe("state-token");
		expect(url.searchParams.get("scope")).toBe("read:user user:email");
		expect(url.searchParams.get("redirect_uri")).toBe(
			"https://app.local/auth/oauth/github/callback",
		);
		// The secret is for the token exchange only; it must never be in a URL
		// the browser follows.
		expect(url.search).not.toContain("secret");
	});
});
