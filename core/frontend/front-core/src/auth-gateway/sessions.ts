import { accessClient, authClient, identityClient } from "./clients";

const ROOT_PRESET = "root";
const USER_PRESET = "user";
const DEMO_PRESET = "demo";
const ANONYMOUS_PRESET = "anonymous";
type GatewaySession = {
	token: string;
	refreshToken: string;
	userId: string;
	email: string;
};

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

function desiredPreset(email: string): string {
	const rootEmail = normalizeEmail(process.env.ROOT_EMAIL ?? "");
	return rootEmail && normalizeEmail(email) === rootEmail ? ROOT_PRESET : USER_PRESET;
}

function normalizeSessionId(sessionId?: string): string {
	const raw = sessionId?.trim() ?? "";
	return raw.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 128) || crypto.randomUUID();
}

async function syncAccessPreset(userId: string, preset: string): Promise<void> {
	const access = accessClient();
	const resolved = preset === ROOT_PRESET ? ROOT_PRESET : USER_PRESET;
	const stale = resolved === ROOT_PRESET ? USER_PRESET : ROOT_PRESET;
	await access.unlinkPresetFromUser(userId, stale);
	await access.linkPresetToUser(userId, resolved);
}

async function ensureUserByEmail(email: string, name?: string) {
	const identity = identityClient();
	const normalizedEmail = normalizeEmail(email);
	const preset = desiredPreset(normalizedEmail);
	let user = await identity.getUserByEmail(normalizedEmail);
	if (user) {
		if (user.preset !== preset) user = await identity.updateUser(user.id, { preset });
		await syncAccessPreset(user.id, user.preset ?? preset);
		return user;
	}
	user = await identity.createUser({
		id: crypto.randomUUID(),
		email: normalizedEmail,
		name: name?.trim() || normalizedEmail.split("@")[0] || "User",
		preset,
	});
	await syncAccessPreset(user.id, user.preset ?? preset);
	return user;
}

async function issueSession(userId: string, email: string, clientId?: string): Promise<GatewaySession> {
	const token = await accessClient().emitJWT(userId);
	const refresh = await authClient().createRefreshSession(userId, clientId);
	return { token, refreshToken: refresh.refreshToken, userId, email };
}

export async function createGuestSession(sessionId?: string): Promise<GatewaySession> {
	const normalizedSessionId = normalizeSessionId(sessionId);
	const identity = identityClient();
	const existing = await identity.getAuthMethodByProvider("temporary", normalizedSessionId);
	let user = existing ? await identity.getUser(existing.userId) : null;
	if (existing && !user) throw new Error("temporary identity references a missing user");
	if (!user) {
		user = await identity.createUser({
			id: `temp:${crypto.randomUUID()}`,
			email: `temp+${normalizedSessionId}@guest.local`,
			name: "Guest",
			emailVerified: false,
		});
		await identity.linkAuthMethod(user.id, "temporary", normalizedSessionId, user.email);
	}
	const access = accessClient();
	const directPermissions = await access.getPermissionsFromUser(user.id);
	await Promise.all(
		directPermissions.map((permission) =>
			access.removePermissionFromUser(user.id, permission),
		),
	);
	await access.linkPresetToUser(user.id, ANONYMOUS_PRESET);
	return issueSession(user.id, user.email, `guest:${normalizedSessionId}`);
}

export async function verifyMagicLink(token: string): Promise<GatewaySession & { returnTo?: string }> {
	const link = await authClient().consumeMagicLink(token);
	const user = await ensureUserByEmail(link.email);
	return { ...(await issueSession(user.id, user.email)), returnTo: link.returnTo };
}

export async function createProviderSession(
	provider: string,
	providerUserId: string,
	email: string,
	name?: string,
): Promise<GatewaySession> {
	const identity = identityClient();
	const existing = await identity.getAuthMethodByProvider(provider, providerUserId);
	let user = existing ? await identity.getUser(existing.userId) : null;
	if (existing && !user) throw new Error("provider identity references a missing user");
	if (!user) {
		user = await ensureUserByEmail(email, name);
		await identity.linkAuthMethod(user.id, provider, providerUserId, normalizeEmail(email));
	}
	return issueSession(user.id, user.email);
}

export async function createDemoSession(): Promise<GatewaySession> {
	const scope = process.env.STORAGE_SCOPE?.trim();
	if (!scope) throw new Error("STORAGE_SCOPE is required for demo login");
	const identity = identityClient();
	const existing = await identity.getAuthMethodByProvider("demo", scope);
	let user = existing ? await identity.getUser(existing.userId) : null;
	if (existing && !user) throw new Error("demo identity references a missing user");
	if (!user) {
		user = await identity.createUser({
			id: `demo:${scope}`,
			email: `demo+${scope}@demo.local`,
			name: "Demo",
			emailVerified: false,
		});
		await identity.linkAuthMethod(user.id, "demo", scope, user.email);
	}
	await accessClient().linkPresetToUser(user.id, DEMO_PRESET);
	return issueSession(user.id, user.email);
}

export async function refreshGatewaySession(refreshToken: string): Promise<GatewaySession> {
	const refresh = await authClient().refreshSession(refreshToken);
	const user = await identityClient().getUser(refresh.userId);
	if (!user) throw new Error("refresh session references a missing user");
	const token = await accessClient().emitJWT(user.id);
	return { token, refreshToken: refresh.refreshToken, userId: user.id, email: user.email };
}
