// The OAuth2 handshake itself: building the authorize URL, exchanging the code
// and reading userinfo. Plain fetch against the external provider — no nrpc
// here. Provider records and state tokens come from ms-oauth (see clients.ts).
import type { OAuthProvider } from "g-oauth";

export type ExternalIdentity = {
	providerUserId: string;
	email: string;
	name?: string;
};

export function redirectUri(baseUrl: string, provider: string): string {
	return `${baseUrl}/auth/oauth/${provider}/callback`;
}

export function authorizeUrl(
	provider: OAuthProvider,
	state: string,
	callbackUrl: string,
): string {
	const url = new URL(provider.authorizeUrl);
	url.searchParams.set("client_id", provider.clientId);
	url.searchParams.set("redirect_uri", callbackUrl);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("scope", provider.scopes.join(" "));
	url.searchParams.set("state", state);
	return url.toString();
}

async function exchangeCode(
	provider: OAuthProvider,
	code: string,
	callbackUrl: string,
): Promise<string> {
	const response = await fetch(provider.tokenUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Accept: "application/json",
		},
		body: new URLSearchParams({
			grant_type: "authorization_code",
			code,
			redirect_uri: callbackUrl,
			client_id: provider.clientId,
			client_secret: provider.clientSecret,
		}).toString(),
	});
	if (!response.ok) {
		throw new Error(
			`[auth-gateway] ${provider.provider} token exchange failed: HTTP ${response.status}`,
		);
	}
	const payload = (await response.json()) as { access_token?: string };
	if (!payload.access_token) {
		throw new Error(
			`[auth-gateway] ${provider.provider} token response carried no access_token`,
		);
	}
	return payload.access_token;
}

// Providers disagree on the userinfo shape; normalise the three fields the
// session needs and fail loudly when the account has no usable id or address.
function normalizeIdentity(
	provider: OAuthProvider,
	raw: Record<string, unknown>,
): ExternalIdentity {
	const providerUserId = String(raw.id ?? raw.sub ?? "").trim();
	const email = String(raw.email ?? "")
		.trim()
		.toLowerCase();
	const nameValue = raw.name ?? raw.login;
	const name = typeof nameValue === "string" ? nameValue : undefined;

	if (!providerUserId) {
		throw new Error(
			`[auth-gateway] ${provider.provider} userinfo carried no account id`,
		);
	}
	if (!email) {
		throw new Error(
			`[auth-gateway] ${provider.provider} account has no verified email`,
		);
	}
	return { providerUserId, email, name };
}

export async function resolveExternalIdentity(
	provider: OAuthProvider,
	code: string,
	callbackUrl: string,
): Promise<ExternalIdentity> {
	const accessToken = await exchangeCode(provider, code, callbackUrl);
	const response = await fetch(provider.userinfoUrl, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/json",
			// GitHub rejects API calls without one.
			"User-Agent": "auth-gateway",
		},
	});
	if (!response.ok) {
		throw new Error(
			`[auth-gateway] ${provider.provider} userinfo failed: HTTP ${response.status}`,
		);
	}
	return normalizeIdentity(
		provider,
		(await response.json()) as Record<string, unknown>,
	);
}
