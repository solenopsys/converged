import { serializePermission, toPermissionEntries } from "nrpc";
import { accessClient, authClient, identityClient } from "./clients";

const ROOT_PRESET = "root";
/** The base every signed-in person carries; a role is linked on top of it. */
const USER_PRESET = "user";
const DEMO_PRESET = "demo";
const ANONYMOUS_PRESET = "anonymous";

/**
 * Role presets, in the order a promotion should unlink the others.
 *
 * Roles do not stack: linking one drops the rest, so somebody moved from
 * manager to viewer does not quietly keep yesterday's rights. The names match
 * the files in `modules/commands/presets`.
 */
const ROLE_PRESETS = ["owner", "manager", "operator", "viewer"];
type GatewaySession = {
	token: string;
	refreshToken: string;
	userId: string;
	email: string;
};

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

/**
 * The role an address arrives with.
 *
 * `ROOT_EMAIL` is the bootstrap: the first person has to get in before there is
 * anybody to invite them. Everyone else takes the role written on their
 * invitation, and an address with no invitation has no role at all — which is
 * the whole of the sign-in gate.
 */
function bootstrapPreset(email: string): string | null {
	const rootEmail = normalizeEmail(process.env.ROOT_EMAIL ?? "");
	return rootEmail && normalizeEmail(email) === rootEmail ? ROOT_PRESET : null;
}

/**
 * May this address be sent a sign-in link at all?
 *
 * Three ways in, and no fourth: the bootstrap owner, somebody who already has
 * an account, or an address with a live invitation. Before this existed,
 * `ensureUserByEmail` created a user for whoever asked, so any address on the
 * internet could sign into the company console.
 *
 * The caller must not learn which of the three it was — see the endpoint.
 */
export async function isAddressAllowedIn(email: string): Promise<boolean> {
	const normalized = normalizeEmail(email);
	if (!normalized) return false;
	if (bootstrapPreset(normalized)) return true;

	const identity = identityClient();
	if (await identity.getUserByEmail(normalized)) return true;
	return (await identity.getInviteByEmail(normalized)) !== null;
}

function normalizeSessionId(sessionId?: string): string {
	const raw = sessionId?.trim() ?? "";
	return (
		raw.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 128) || crypto.randomUUID()
	);
}

function isGuestUser(userId: string): boolean {
	return userId.startsWith("temp:");
}

async function provisionGuestAccess(userId: string): Promise<void> {
	const access = accessClient();
	const directPermissions = await access.getPermissionsFromUser(userId);
	await Promise.all(
		toPermissionEntries(directPermissions).map((entry) =>
			access.removePermissionFromUser(userId, serializePermission(entry)),
		),
	);
	await access.linkPresetToUser(userId, ANONYMOUS_PRESET);
}

/**
 * Put the user on the base preset plus at most one role.
 *
 * Presets merge rather than override — `rp-access` unions every linked tree —
 * so the base is what makes the console usable at all and the role is what adds
 * a domain. Unlinking the other roles is the half that matters: without it a
 * demotion would leave the old grants attached and merge straight back in.
 */
async function syncAccessPreset(
	userId: string,
	role: string | null,
): Promise<void> {
	const access = accessClient();
	const keep = role === ROOT_PRESET ? ROOT_PRESET : role;

	for (const stale of [ROOT_PRESET, ...ROLE_PRESETS]) {
		if (stale !== keep) await access.unlinkPresetFromUser(userId, stale);
	}
	await access.linkPresetToUser(userId, USER_PRESET);
	if (keep) await access.linkPresetToUser(userId, keep);
}

/**
 * The account behind a verified address, created only if it is allowed to exist.
 *
 * This used to create a user for any address that reached it, which is how a
 * stranger with a mailbox got into the company console. Now an unknown address
 * has to be carrying an invitation, and the invitation is also where the role
 * comes from — it is closed here, on the first successful sign-in, so the same
 * link cannot let a second person in later.
 */
async function ensureUserByEmail(email: string, name?: string) {
	const identity = identityClient();
	const normalizedEmail = normalizeEmail(email);
	const bootstrap = bootstrapPreset(normalizedEmail);

	let user = await identity.getUserByEmail(normalizedEmail);
	const invite = await identity.getInviteByEmail(normalizedEmail);

	if (!user && !invite && !bootstrap) {
		throw new Error("this address has not been invited");
	}

	const role = bootstrap ?? invite?.preset ?? user?.preset ?? null;

	if (user) {
		if (role && user.preset !== role)
			user = await identity.updateUser(user.id, { preset: role });
	} else {
		user = await identity.createUser({
			id: crypto.randomUUID(),
			email: normalizedEmail,
			name:
				name?.trim() ||
				invite?.name?.trim() ||
				normalizedEmail.split("@")[0] ||
				"User",
			preset: role ?? USER_PRESET,
		});
	}

	await syncAccessPreset(user.id, role);

	// Group tags ride the JWT, so they have to be granted before it is minted.
	for (const tag of invite?.tags ?? []) {
		await accessClient().addTagToUser(user.id, tag, "rwx");
	}
	if (invite) await identity.consumeInvite(normalizedEmail);

	return user;
}

async function issueSession(
	userId: string,
	email: string,
	clientId?: string,
): Promise<GatewaySession> {
	const token = await accessClient().emitJWT(userId);
	const refresh = await authClient().createRefreshSession(userId, clientId);
	return { token, refreshToken: refresh.refreshToken, userId, email };
}

export async function createGuestSession(
	sessionId?: string,
): Promise<GatewaySession> {
	const normalizedSessionId = normalizeSessionId(sessionId);
	const identity = identityClient();
	const existing = await identity.getAuthMethodByProvider(
		"temporary",
		normalizedSessionId,
	);
	let user = existing ? await identity.getUser(existing.userId) : null;
	if (existing && !user)
		throw new Error("temporary identity references a missing user");
	if (!user) {
		user = await identity.createUser({
			id: `temp:${crypto.randomUUID()}`,
			email: `temp+${normalizedSessionId}@guest.local`,
			name: "Guest",
			emailVerified: false,
		});
		await identity.linkAuthMethod(
			user.id,
			"temporary",
			normalizedSessionId,
			user.email,
		);
	}
	await provisionGuestAccess(user.id);
	return issueSession(user.id, user.email, `guest:${normalizedSessionId}`);
}

export async function verifyMagicLink(
	token: string,
): Promise<GatewaySession & { returnTo?: string }> {
	const link = await authClient().consumeMagicLink(token);
	const user = await ensureUserByEmail(link.email);
	return {
		...(await issueSession(user.id, user.email)),
		returnTo: link.returnTo,
	};
}

export async function createProviderSession(
	provider: string,
	providerUserId: string,
	email: string,
	name?: string,
): Promise<GatewaySession> {
	const identity = identityClient();
	const existing = await identity.getAuthMethodByProvider(
		provider,
		providerUserId,
	);
	let user = existing ? await identity.getUser(existing.userId) : null;
	if (existing && !user)
		throw new Error("provider identity references a missing user");
	if (!user) {
		user = await ensureUserByEmail(email, name);
		await identity.linkAuthMethod(
			user.id,
			provider,
			providerUserId,
			normalizeEmail(email),
		);
	}
	return issueSession(user.id, user.email);
}

export async function createDemoSession(): Promise<GatewaySession> {
	const scope = process.env.STORAGE_SCOPE?.trim();
	if (!scope) throw new Error("STORAGE_SCOPE is required for demo login");
	const identity = identityClient();
	const existing = await identity.getAuthMethodByProvider("demo", scope);
	let user = existing ? await identity.getUser(existing.userId) : null;
	if (existing && !user)
		throw new Error("demo identity references a missing user");
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

export async function refreshGatewaySession(
	refreshToken: string,
): Promise<GatewaySession> {
	const refresh = await authClient().refreshSession(refreshToken);
	const user = await identityClient().getUser(refresh.userId);
	if (!user) throw new Error("refresh session references a missing user");
	// Refresh tokens can outlive the migration from direct guest permissions to
	// the anonymous preset. Repair them before minting the next access JWT.
	if (isGuestUser(user.id)) await provisionGuestAccess(user.id);
	const token = await accessClient().emitJWT(user.id);
	return {
		token,
		refreshToken: refresh.refreshToken,
		userId: user.id,
		email: user.email,
	};
}
