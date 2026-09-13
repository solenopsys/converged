import { beforeEach, expect, mock, test } from "bun:test";

// The sign-in gate: who gets a link, who gets an account, and with what role.
// Before it existed, `ensureUserByEmail` created a user for whoever asked, so
// any address on the internet could sign into the company console.

type Invite = {
	id: string;
	email: string;
	name?: string;
	preset: string;
	tags: string[];
	status: string;
};

const users = new Map<
	string,
	{ id: string; email: string; name: string; preset?: string }
>();
const invites = new Map<string, Invite>();
const linked: Array<{ userId: string; preset: string }> = [];
const unlinked: Array<{ userId: string; preset: string }> = [];
const tagged: Array<{ userId: string; tag: string }> = [];
const consumed: string[] = [];

mock.module("./clients", () => ({
	accessClient: () => ({
		emitJWT: async () => "access-token",
		getPermissionsFromUser: async () => ({}),
		removePermissionFromUser: async () => undefined,
		linkPresetToUser: async (userId: string, preset: string) => {
			linked.push({ userId, preset });
		},
		unlinkPresetFromUser: async (userId: string, preset: string) => {
			unlinked.push({ userId, preset });
		},
		addTagToUser: async (userId: string, tag: string) => {
			tagged.push({ userId, tag });
		},
	}),
	authClient: () => ({
		consumeMagicLink: async (token: string) => ({ email: token }),
		createRefreshSession: async () => ({ refreshToken: "refresh-token" }),
	}),
	identityClient: () => ({
		getUserByEmail: async (email: string) => users.get(email) ?? null,
		getInviteByEmail: async (email: string) => {
			const invite = invites.get(email);
			return invite && (invite.status === "pending" || invite.status === "sent")
				? invite
				: null;
		},
		createUser: async (user: {
			id: string;
			email: string;
			name: string;
			preset?: string;
		}) => {
			users.set(user.email, user);
			return user;
		},
		updateUser: async (userId: string, patch: { preset?: string }) => {
			for (const user of users.values()) {
				if (user.id === userId) {
					Object.assign(user, patch);
					return user;
				}
			}
			throw new Error("no such user");
		},
		consumeInvite: async (email: string) => {
			consumed.push(email);
			const invite = invites.get(email);
			if (invite) invite.status = "accepted";
			return invite ?? null;
		},
	}),
}));

const { isAddressAllowedIn, verifyMagicLink } = await import("./sessions");

function invite(email: string, preset = "operator", tags: string[] = []) {
	invites.set(email, {
		id: `invite-${email}`,
		email,
		preset,
		tags,
		status: "pending",
	});
}

beforeEach(() => {
	users.clear();
	invites.clear();
	linked.length = 0;
	unlinked.length = 0;
	tagged.length = 0;
	consumed.length = 0;
	process.env.ROOT_EMAIL = "owner@shop.test";
});

test("a stranger is not sent a link", async () => {
	expect(await isAddressAllowedIn("stranger@example.test")).toBe(false);
});

test("the bootstrap owner is let in before anybody exists to invite them", async () => {
	expect(await isAddressAllowedIn("owner@shop.test")).toBe(true);
	expect(await isAddressAllowedIn("OWNER@Shop.test")).toBe(true);
});

test("an invited address is let in, and a revoked one is not", async () => {
	invite("anna@shop.test");
	expect(await isAddressAllowedIn("anna@shop.test")).toBe(true);

	invites.get("anna@shop.test")!.status = "revoked";
	expect(await isAddressAllowedIn("anna@shop.test")).toBe(false);
});

test("somebody who already has an account keeps getting in", async () => {
	users.set("boris@shop.test", {
		id: "u-boris",
		email: "boris@shop.test",
		name: "Boris",
		preset: "manager",
	});
	expect(await isAddressAllowedIn("boris@shop.test")).toBe(true);
});

test("a verified link for an uninvited address creates nothing", async () => {
	expect(verifyMagicLink("stranger@example.test")).rejects.toThrow(
		"has not been invited",
	);
	expect(users.size).toBe(0);
	expect(linked).toEqual([]);
});

test("the first sign-in takes the role off the invitation and closes it", async () => {
	invite("anna@shop.test", "manager", ["team-ops"]);

	const session = await verifyMagicLink("anna@shop.test");

	expect(session.token).toBe("access-token");
	const user = users.get("anna@shop.test")!;
	expect(user.preset).toBe("manager");
	// Base plus exactly one role: the presets merge, so the base is what makes
	// the console work and the role is what adds a domain.
	expect(linked).toEqual([
		{ userId: user.id, preset: "user" },
		{ userId: user.id, preset: "manager" },
	]);
	expect(tagged).toEqual([{ userId: user.id, tag: "team-ops" }]);
	expect(consumed).toEqual(["anna@shop.test"]);
});

test("a consumed invitation does not let a second person in", async () => {
	invite("anna@shop.test");
	await verifyMagicLink("anna@shop.test");

	invites.get("anna@shop.test")!.status = "accepted";
	users.delete("anna@shop.test");

	expect(await isAddressAllowedIn("anna@shop.test")).toBe(false);
});

test("a promotion unlinks the role it replaces", async () => {
	users.set("anna@shop.test", {
		id: "u-anna",
		email: "anna@shop.test",
		name: "Anna",
		preset: "viewer",
	});
	invite("anna@shop.test", "manager");

	await verifyMagicLink("anna@shop.test");

	expect(users.get("anna@shop.test")!.preset).toBe("manager");
	// Without this half a demotion would leave yesterday's grants attached and
	// merge straight back into the next token.
	expect(unlinked.map((entry) => entry.preset).sort()).toEqual([
		"operator",
		"owner",
		"root",
		"viewer",
	]);
	expect(linked).toEqual([
		{ userId: "u-anna", preset: "user" },
		{ userId: "u-anna", preset: "manager" },
	]);
});

test("the bootstrap owner gets root regardless of any invitation", async () => {
	invite("owner@shop.test", "viewer");

	await verifyMagicLink("owner@shop.test");

	expect(users.get("owner@shop.test")!.preset).toBe("root");
	expect(linked).toContainEqual({
		userId: users.get("owner@shop.test")!.id,
		preset: "root",
	});
});
