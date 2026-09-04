// UI auth-gateway: the browser-facing half of authentication.
//
// The cluster is WebSocket-only and every WS connection must present a user
// JWT — which is exactly what an anonymous browser does not have yet. Instead
// of poking a hole in that gate, the bootstrap flows (guest session, magic
// link, OAuth2) run as ordinary same-origin HTTP here, in the UI process, and
// reach the auth repositories over nrpc with the cluster SERVICE_TOKEN. The
// repositories keep only data; redirects, cookies and provider handshakes live
// in this file. Once the browser holds a JWT it opens the WS as usual.
import type { PluginConfig } from "back-core";
import type {
	ServerApp,
	RouteContext,
	RouteHandler,
} from "back-core/server-app";
import { settings } from "back-core/settings";
import type { OAuthProviderName } from "g-oauth";
import {
	createLocalJWKSet,
	decodeJwt,
	jwtVerify,
	type JSONWebKeySet,
} from "jose";
import { authClient, oauthClient } from "./clients";
import { sendMagicLinkEmail } from "./mail";
import { authorizeUrl, redirectUri, resolveExternalIdentity } from "./oauth";
import {
	clearedRefreshCookie,
	isSecureRequest,
	jsonResponse,
	noSessionResponse,
	publicBaseUrl,
	readCookie,
	redirectResponse,
	refreshCookie,
	REFRESH_COOKIE,
	safeReturnTo,
} from "./session";
import {
	createDemoSession,
	createGuestSession,
	createProviderSession,
	refreshGatewaySession,
	verifyMagicLink,
} from "./sessions";

function stringField(body: unknown, name: string): string | undefined {
	if (!body || typeof body !== "object") return undefined;
	const value = (body as Record<string, unknown>)[name];
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isUnprovisionedGuestToken(token: string): boolean {
	try {
		const payload = decodeJwt(token);
		return (
			typeof payload.sub === "string" &&
			payload.sub.startsWith("temp:") &&
			(!Array.isArray(payload.perm) || payload.perm.length === 0)
		);
	} catch {
		return false;
	}
}

/**
 * userId for logout comes from the caller's own access token, verified against
 * the cluster JWKS. Trusting a userId from the request body would let anyone
 * revoke anyone else's sessions.
 */
async function verifiedUserId(context: RouteContext): Promise<string | undefined> {
	const header = context.headers.authorization ?? context.headers.Authorization;
	const token = header?.replace(/^Bearer\s+/i, "").trim();
	if (!token) return undefined;
	try {
		const keySet = createLocalJWKSet(
			settings.core.accessJwtPublicJwks() as JSONWebKeySet,
		);
		const { payload } = await jwtVerify(token, keySet, {
			issuer: settings.core.accessJwtIssuer(),
			audience: settings.core.accessJwtAudience(),
			algorithms: ["EdDSA"],
		});
		return typeof payload.sub === "string" ? payload.sub : undefined;
	} catch {
		return undefined;
	}
}

async function rotateSession(context: RouteContext): Promise<Response> {
	const refreshToken = readCookie(context.headers, REFRESH_COOKIE);
	// No cookie at all is the ordinary first-visit case, not an error.
	if (!refreshToken) return noSessionResponse();
	try {
		const session = await refreshGatewaySession(refreshToken);
		// A guest can outlive a data restore that dropped its access record.
		// Never hand the browser a valid-but-useless JWT: clearing the cookie
		// makes the auth controller bootstrap a new anonymous session instead.
		if (isUnprovisionedGuestToken(session.token)) {
			console.warn("[auth-gateway] dropping unprovisioned guest refresh session");
			return noSessionResponse(clearedRefreshCookie(isSecureRequest(context.headers)));
		}
		return jsonResponse(
			{ token: session.token },
			{ cookie: refreshCookie(session.refreshToken, isSecureRequest(context.headers)) },
		);
	} catch {
		// A rejected refresh token is spent or revoked: drop it so the browser
		// falls back to a fresh guest session instead of retrying forever. This is
		// an ordinary post-deploy/browser-state recovery path, not a UI error.
		return noSessionResponse(clearedRefreshCookie(isSecureRequest(context.headers)));
	}
}

/**
 * ServerApp turns a thrown error into a 500 JSON body and nothing else — the
 * reason never reaches the process log. For the bootstrap path that is the
 * difference between "the page is broken" and "ms:auth did not answer", so
 * every route is wrapped to log before the framework swallows it.
 */
function logged(name: string, handler: RouteHandler): RouteHandler {
	return async (context) => {
		try {
			return await handler(context);
		} catch (error) {
			console.error(`[auth-gateway] ${name} failed:`, error);
			throw error;
		}
	};
}

export default function authGatewayPlugin(_config: PluginConfig = {} as PluginConfig) {
	return (app: ServerApp) => {
		app.post("/auth/guest", logged("POST /auth/guest", async (context) => {
			const session = await createGuestSession(
				stringField(context.body, "sessionId"),
			);
			return jsonResponse(
				{
					token: session.token,
					userId: session.userId,
					email: session.email,
					temporary: true,
				},
				{ cookie: refreshCookie(session.refreshToken, isSecureRequest(context.headers)) },
			);
		}));

		app.get("/auth/session", logged("GET /auth/session", (context) => rotateSession(context)));
		app.post("/auth/refresh", logged("POST /auth/refresh", (context) => rotateSession(context)));

		app.post("/auth/logout", logged("POST /auth/logout", async (context) => {
			const userId = await verifiedUserId(context);
			if (userId) await authClient().logout(userId);
			return jsonResponse(
				{ ok: true },
				{ cookie: clearedRefreshCookie(isSecureRequest(context.headers)) },
			);
		}));

		app.post("/auth/magic-link", logged("POST /auth/magic-link", async (context) => {
			const email = stringField(context.body, "email");
			if (!email) return jsonResponse({ error: "email is required" }, { status: 400 });
			const returnTo = safeReturnTo(stringField(context.body, "returnTo"));

			const link = await authClient().getMagicLink(email, returnTo);
			const url = `${publicBaseUrl(context.headers)}/auth/verify?token=${encodeURIComponent(link.token)}`;
			await sendMagicLinkEmail({ to: email, link: url });
			// Always the same answer: whether an address is registered is not
			// something an unauthenticated caller gets to probe.
			return jsonResponse({ ok: true });
		}));

		app.get("/auth/verify", logged("GET /auth/verify", async (context) => {
			const token = context.query.token?.trim();
			if (!token) return jsonResponse({ error: "token is required" }, { status: 400 });
			const session = await verifyMagicLink(token);
			// The access token stays out of the URL — the SPA picks it up from
			// /auth/session using the cookie set here.
			return redirectResponse(safeReturnTo(session.returnTo), {
				cookie: refreshCookie(session.refreshToken, isSecureRequest(context.headers)),
			});
		}));

		// Demo "Admin login". Fail-closed: only a tenant that opted in via
		// LANDING_DEMO_MODE gets a sandboxed demo session; everyone else is sent
		// to the normal sign-in splash — no token, no hole.
		app.get("/demo-login", async (context) => {
			if (!settings.demo.landingDemoMode()) return redirectResponse("/console/");
			try {
				const session = await createDemoSession();
				return redirectResponse("/console/", {
					cookie: refreshCookie(
						session.refreshToken,
						isSecureRequest(context.headers),
					),
				});
			} catch (error) {
				console.error("[auth-gateway] demo session failed", error);
				return redirectResponse("/console/");
			}
		});

		app.get("/auth/providers", logged("GET /auth/providers", async () => {
			const oauth = oauthClient();
			const [enabled, templates] = await Promise.all([
				oauth.listEnabledProviders(),
				oauth.listProviderTemplates(),
			]);
			const displayNames = new Map(
				templates.map((template) => [template.provider, template.displayName]),
			);
			return jsonResponse(
				enabled.map((provider) => ({
					provider: provider.provider,
					displayName: displayNames.get(provider.provider) ?? provider.provider,
				})),
			);
		}));

		app.get("/auth/oauth/:provider", logged("GET /auth/oauth/:provider", async (context) => {
			const name = context.params.provider as OAuthProviderName;
			const provider = await oauthClient().getProvider(name);
			if (!provider || !provider.enabled) {
				return jsonResponse({ error: `Unknown provider: ${name}` }, { status: 404 });
			}
			const returnTo = safeReturnTo(context.query.returnTo);
			const state = await oauthClient().generateState(name, returnTo);
			return redirectResponse(
				authorizeUrl(
					provider,
					state,
					redirectUri(publicBaseUrl(context.headers), name),
				),
			);
		}));

		app.get("/auth/oauth/:provider/callback", logged("GET /auth/oauth/:provider/callback", async (context) => {
			const name = context.params.provider as OAuthProviderName;
			const code = context.query.code?.trim();
			const stateToken = context.query.state?.trim();
			if (!code || !stateToken) {
				return jsonResponse({ error: "code and state are required" }, { status: 400 });
			}

			// consumeState is single-use, which is what makes it a CSRF guard.
			const state = await oauthClient().consumeState(stateToken);
			if (!state || state.provider !== name) {
				return jsonResponse({ error: "Invalid or expired state" }, { status: 400 });
			}
			const provider = await oauthClient().getProvider(name);
			if (!provider || !provider.enabled) {
				return jsonResponse({ error: `Unknown provider: ${name}` }, { status: 404 });
			}

			const identity = await resolveExternalIdentity(
				provider,
				code,
				redirectUri(publicBaseUrl(context.headers), name),
			);
			const session = await createProviderSession(
				name,
				identity.providerUserId,
				identity.email,
				identity.name,
			);
			return redirectResponse(safeReturnTo(state.returnTo), {
				cookie: refreshCookie(session.refreshToken, isSecureRequest(context.headers)),
			});
		}));

		return app;
	};
}

// Browser-facing routes live at the server root, not under /services.
authGatewayPlugin.mount = "root" as const;
