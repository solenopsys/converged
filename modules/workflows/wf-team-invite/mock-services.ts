// Mock identity / access / staff / auth / mail universe for the wf-team-invite
// tests (test-only, never bundled). Each service keeps just enough state to
// answer the question the workflow asks it, so the assertions can be about the
// cascade rather than about any one repository.

export type TeamUniverse = {
	filesById: Map<string, { name: string; text: string }>;
	users: Map<string, { id: string; email: string; name: string; preset?: string }>;
	/** userId -> linked preset names, in the order they were linked */
	presets: Map<string, string[]>;
	/** userId -> group tags */
	tags: Map<string, string[]>;
	staff: Map<string, any>;
	invites: Map<string, any>;
	mails: { to: string; subject: string; body: string }[];
	journal: any[];
	calls: string[];

	addFile(fileId: string, name: string, text: string): void;
	addUser(email: string, name?: string): string;
	addStaff(email: string, name?: string): string;
	failOn(service: string, method: string, message: string): void;
	handler(
		service: string,
		method: string,
		params: any,
		cache: Map<string, string>,
	): unknown;
};

export function createTeamUniverse(): TeamUniverse {
	const failures = new Map<string, string>();
	let seq = 0;
	const nextId = (prefix: string) => `${prefix}-${++seq}`;
	const normalize = (email: string) => String(email).trim().toLowerCase();

	const u: TeamUniverse = {
		filesById: new Map(),
		users: new Map(),
		presets: new Map(),
		tags: new Map(),
		staff: new Map(),
		invites: new Map(),
		mails: [],
		journal: [],
		calls: [],

		addFile(fileId, name, text) {
			u.filesById.set(fileId, { name, text });
		},

		addUser(email, name = "Existing") {
			const id = nextId("user");
			u.users.set(normalize(email), { id, email: normalize(email), name });
			return id;
		},

		addStaff(email, name = "Existing") {
			const id = nextId("staff");
			u.staff.set(id, { id, email: normalize(email), name, active: true });
			return id;
		},

		failOn(service, method, message) {
			failures.set(`${service}.${method}`, message);
		},

		handler(service, method, params, cache) {
			const key = `${service}.${method}`;
			u.calls.push(key);
			const failure = failures.get(key);
			if (failure) throw new Error(failure);

			switch (key) {
				case "files.materialize": {
					const file = u.filesById.get(params.fileId);
					if (!file) throw new Error(`file not found: ${params.fileId}`);
					const cacheKey = `blob:${params.fileId}`;
					cache.set(cacheKey, file.text);
					return {
						ref: { cacheKey, sizeBytes: file.text.length },
						metadata: { id: params.fileId, name: file.name, fileSize: file.text.length },
					};
				}
				case "files.extractText": {
					const { ref, maxChars } = params.input;
					const text = cache.get(ref.cacheKey) ?? "";
					const capped = maxChars > 0 && text.length > maxChars;
					return {
						text: capped ? text.slice(0, maxChars) : text,
						chars: text.length,
						truncated: capped,
					};
				}

				case "identity.getUserByEmail":
					return u.users.get(normalize(params.email)) ?? null;
				case "identity.createUser": {
					const input = params.user;
					const email = normalize(input.email);
					if (u.users.has(email)) throw new Error("user already exists");
					const user = {
						id: input.id,
						email,
						name: input.name,
						preset: input.preset,
					};
					u.users.set(email, user);
					return user;
				}

				case "access.linkPresetToUser": {
					const linked = u.presets.get(params.userId) ?? [];
					if (!linked.includes(params.presetName)) linked.push(params.presetName);
					u.presets.set(params.userId, linked);
					return null;
				}
				case "access.addTagToUser": {
					const held = u.tags.get(params.userId) ?? [];
					if (!held.includes(params.tag)) held.push(params.tag);
					u.tags.set(params.userId, held);
					return null;
				}

				case "staff.getStaffByEmail": {
					const email = normalize(params.email);
					for (const card of u.staff.values())
						if (card.email === email) return card;
					return undefined;
				}
				case "staff.createStaff": {
					const id = nextId("staff");
					u.staff.set(id, { id, ...params.input, email: normalize(params.input.email) });
					return id;
				}
				case "staff.updateStaff": {
					const card = u.staff.get(params.id);
					if (!card) throw new Error(`staff not found: ${params.id}`);
					u.staff.set(params.id, { ...card, ...params.patch });
					return null;
				}

				case "identity.createInvite": {
					const email = normalize(params.input.email);
					const existing = [...u.invites.values()].find(
						(invite) => invite.email === email && invite.status !== "accepted",
					);
					if (existing) {
						Object.assign(existing, params.input, { email, status: "pending" });
						return existing;
					}
					const invite = {
						id: nextId("invite"),
						...params.input,
						email,
						status: "pending",
						tags: params.input.tags ?? [],
					};
					u.invites.set(invite.id, invite);
					return invite;
				}
				case "identity.getInviteByEmail": {
					const email = normalize(params.email);
					return (
						[...u.invites.values()].find(
							(invite) =>
								invite.email === email &&
								(invite.status === "pending" || invite.status === "sent"),
						) ?? null
					);
				}
				case "identity.markInviteSent": {
					const invite = u.invites.get(params.id);
					if (invite) invite.status = "sent";
					return invite ?? null;
				}

				case "auth.getMagicLink":
					return { ok: true, token: `magic-${normalize(params.email)}`, expiresAt: 0 };

				case "ses.sendEmail":
				case "smtp.sendEmail": {
					const payload = params.payload;
					u.mails.push({
						to: payload.to,
						subject: payload.subject,
						body: payload.body,
					});
					return { success: true, messageId: nextId("msg") };
				}

				case "notify.recordSend": {
					u.journal.push(params.input);
					return nextId("send");
				}

				default:
					throw new Error(`unexpected call ${key}`);
			}
		},
	};

	return u;
}
