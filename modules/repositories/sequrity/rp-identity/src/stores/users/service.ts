import { generateULID, type SqlStore } from "back-core";
import type {
	AuthMethod,
	Invite,
	InviteInput,
	InviteList,
	InviteListParams,
	InviteStatus,
	User,
	UserInput,
	UserUpdate,
} from "../../types";
import {
	type AuthMethodEntity,
	AuthMethodRepository,
	type InviteEntity,
	InviteRepository,
	type UserEntity,
	UserRepository,
} from "./entities";

const INVITE_TTL_DAYS = 14;

/** Addresses are compared, so they are stored the way they are compared. */
function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export class UsersStoreService {
	private readonly userRepo: UserRepository;
	private readonly authRepo: AuthMethodRepository;
	private readonly inviteRepo: InviteRepository;

	constructor(private store: SqlStore) {
		this.userRepo = new UserRepository(store, "users", {
			primaryKey: "id",
			extractKey: (entry) => ({ id: entry.id }),
			buildWhereCondition: (key) => ({ id: key.id }),
		});
		this.authRepo = new AuthMethodRepository(store, "auth_methods", {
			primaryKey: "id",
			extractKey: (entry) => ({ id: entry.id }),
			buildWhereCondition: (key) => ({ id: key.id }),
		});
		this.inviteRepo = new InviteRepository(store, "invites", {
			primaryKey: "id",
			extractKey: (entry) => ({ id: entry.id }),
			buildWhereCondition: (key) => ({ id: key.id }),
		});
	}

	async createUser(input: UserInput): Promise<User> {
		const entity: UserEntity = {
			id: input.id,
			email: normalizeEmail(input.email),
			name: input.name,
			picture: input.picture ?? null,
			emailVerified: input.emailVerified ? 1 : 0,
			preset: input.preset ?? "user",
			lang: input.lang ?? null,
			createdAt: new Date().toISOString(),
		};
		const created = await this.userRepo.create(entity as any);
		return this.toUser(created);
	}

	async listUsers(): Promise<User[]> {
		const items = await this.userRepo.findAll({ limit: 10000 });
		return items.map((item) => this.toUser(item));
	}

	async getUser(userId: string): Promise<User | null> {
		const entity = await this.userRepo.findById({ id: userId });
		return entity ? this.toUser(entity) : null;
	}

	async getUserByEmail(email: string): Promise<User | null> {
		const result = await this.store.db
			.selectFrom("users")
			.selectAll()
			.where("email", "=", normalizeEmail(email))
			.executeTakeFirst();
		return result ? this.toUser(result as UserEntity) : null;
	}

	async updateUser(userId: string, updates: UserUpdate): Promise<User> {
		const updateEntity: Partial<UserEntity> = {
			email: updates.email ? normalizeEmail(updates.email) : undefined,
			name: updates.name,
			picture: updates.picture,
			preset: updates.preset,
			lang: updates.lang,
			emailVerified:
				updates.emailVerified === undefined
					? undefined
					: updates.emailVerified
						? 1
						: 0,
		};
		const updated = await this.userRepo.update({ id: userId }, updateEntity);
		if (!updated) {
			throw new Error(`User ${userId} not found`);
		}
		return this.toUser(updated);
	}

	async deleteUser(userId: string): Promise<boolean> {
		await this.store.db
			.deleteFrom("auth_methods")
			.where("userId", "=", userId)
			.execute();
		return this.userRepo.delete({ id: userId });
	}

	async linkAuthMethod(
		userId: string,
		provider: string,
		providerUserId: string,
		email: string,
	): Promise<void> {
		const id = this.buildAuthId(provider, providerUserId);
		const now = new Date().toISOString();
		const entity: AuthMethodEntity = {
			id,
			userId,
			provider,
			providerUserId,
			email,
			lastUsedAt: now,
			createdAt: now,
		};

		const existing = await this.authRepo.findById({ id });
		if (existing) {
			await this.authRepo.update({ id }, { userId, email, lastUsedAt: now });
			return;
		}
		await this.authRepo.create(entity as any);
	}

	async unlinkAuthMethod(userId: string, provider: string): Promise<void> {
		const methods = await this.getUserAuthMethods(userId);
		const match = methods.find((m) => m.provider === provider);
		if (!match) return;
		await this.authRepo.delete({
			id: this.buildAuthId(provider, match.providerUserId),
		});
	}

	async getAuthMethodByProvider(
		provider: string,
		providerUserId: string,
	): Promise<AuthMethod | null> {
		const id = this.buildAuthId(provider, providerUserId);
		const entity = await this.authRepo.findById({ id });
		return entity ? this.toAuthMethod(entity) : null;
	}

	async getUserAuthMethods(userId: string): Promise<AuthMethod[]> {
		const items = await this.store.db
			.selectFrom("auth_methods")
			.selectAll()
			.where("userId", "=", userId)
			.execute();
		return (items as AuthMethodEntity[]).map((item) => this.toAuthMethod(item));
	}

	// ---- invitations -------------------------------------------------------

	async createInvite(input: InviteInput): Promise<Invite> {
		const email = normalizeEmail(input.email);
		// Re-inviting an address that is already waiting is not a second
		// invitation: it is the same one, with whatever role was just chosen. Two
		// open rows for one address would make the gate pick between them.
		const open = await this.getInviteByEmail(email);
		if (open) {
			const refreshed = await this.inviteRepo.update(
				{ id: open.id },
				{
					name: input.name ?? open.name ?? null,
					preset: input.preset,
					tags: JSON.stringify(input.tags ?? open.tags),
					invitedBy: input.invitedBy,
					status: "pending",
					expiresAt: input.expiresAt ?? defaultExpiry(),
					updatedAt: new Date().toISOString(),
				},
			);
			return this.toInvite(refreshed as InviteEntity);
		}

		const now = new Date().toISOString();
		const entity: InviteEntity = {
			id: generateULID(),
			email,
			name: input.name ?? null,
			preset: input.preset,
			tags: JSON.stringify(input.tags ?? []),
			invitedBy: input.invitedBy,
			status: "pending",
			expiresAt: input.expiresAt ?? defaultExpiry(),
			sentAt: null,
			acceptedAt: null,
			createdAt: now,
			updatedAt: now,
		};
		const created = await this.inviteRepo.create(entity as any);
		return this.toInvite(created);
	}

	async listInvites(params: InviteListParams = {}): Promise<InviteList> {
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;

		let query = this.store.db.selectFrom("invites").selectAll();
		let counter = this.store.db
			.selectFrom("invites")
			.select((eb: any) => eb.fn.countAll().as("count"));

		if (params.status) {
			query = query.where("status", "=", params.status) as any;
			counter = counter.where("status", "=", params.status) as any;
		}
		if (params.email) {
			const email = normalizeEmail(params.email);
			query = query.where("email", "=", email) as any;
			counter = counter.where("email", "=", email) as any;
		}

		const items = await query
			.orderBy("createdAt", "desc")
			.limit(limit)
			.offset(offset)
			.execute();
		const counted = await counter.executeTakeFirst();

		return {
			items: (items as InviteEntity[]).map((item) => this.toInvite(item)),
			totalCount: Number((counted as any)?.count ?? 0),
		};
	}

	async getInvite(id: string): Promise<Invite | null> {
		const entity = await this.inviteRepo.findById({ id });
		return entity ? this.toInvite(entity) : null;
	}

	/**
	 * The live invitation for an address, or nothing.
	 *
	 * "Live" is decided here rather than by a sweep: an invitation whose date has
	 * passed reads as expired the moment it is asked about, so a gate that never
	 * runs a cleanup job still cannot let a stale address in.
	 */
	async getInviteByEmail(email: string): Promise<Invite | null> {
		const rows = await this.store.db
			.selectFrom("invites")
			.selectAll()
			.where("email", "=", normalizeEmail(email))
			.orderBy("createdAt", "desc")
			.execute();

		for (const row of rows as InviteEntity[]) {
			const invite = this.toInvite(row);
			if (invite.status !== "pending" && invite.status !== "sent") continue;
			if (Date.parse(invite.expiresAt) <= Date.now()) {
				await this.setInviteStatus(invite.id, "expired");
				continue;
			}
			return invite;
		}
		return null;
	}

	async markInviteSent(id: string): Promise<Invite | null> {
		return this.setInviteStatus(id, "sent", {
			sentAt: new Date().toISOString(),
		});
	}

	async revokeInvite(id: string): Promise<Invite | null> {
		return this.setInviteStatus(id, "revoked");
	}

	async consumeInvite(email: string): Promise<Invite | null> {
		const invite = await this.getInviteByEmail(email);
		if (!invite) return null;
		return this.setInviteStatus(invite.id, "accepted", {
			acceptedAt: new Date().toISOString(),
		});
	}

	private async setInviteStatus(
		id: string,
		status: InviteStatus,
		extra: Partial<InviteEntity> = {},
	): Promise<Invite | null> {
		const updated = await this.inviteRepo.update(
			{ id },
			{ status, updatedAt: new Date().toISOString(), ...extra },
		);
		return updated ? this.toInvite(updated as InviteEntity) : null;
	}

	private toInvite(entity: InviteEntity): Invite {
		return {
			id: entity.id,
			email: entity.email,
			name: entity.name ?? undefined,
			preset: entity.preset,
			tags: parseTags(entity.tags),
			invitedBy: entity.invitedBy,
			status: entity.status as InviteStatus,
			expiresAt: entity.expiresAt,
			createdAt: entity.createdAt,
			updatedAt: entity.updatedAt,
			sentAt: entity.sentAt ?? undefined,
			acceptedAt: entity.acceptedAt ?? undefined,
		};
	}

	private toUser(entity: UserEntity): User {
		return {
			id: entity.id,
			email: entity.email,
			name: entity.name,
			picture: entity.picture ?? undefined,
			emailVerified: Boolean(entity.emailVerified),
			preset: entity.preset,
			lang: entity.lang ?? undefined,
			createdAt: entity.createdAt,
		};
	}

	private toAuthMethod(entity: AuthMethodEntity): AuthMethod {
		return {
			userId: entity.userId,
			provider: entity.provider,
			providerUserId: entity.providerUserId,
			email: entity.email,
			lastUsedAt: entity.lastUsedAt,
		};
	}

	private buildAuthId(provider: string, providerUserId: string): string {
		return `${provider}:${providerUserId}`;
	}
}

function defaultExpiry(): string {
	return new Date(
		Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
	).toISOString();
}

function parseTags(raw: string): string[] {
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.map(String) : [];
	} catch {
		return [];
	}
}
