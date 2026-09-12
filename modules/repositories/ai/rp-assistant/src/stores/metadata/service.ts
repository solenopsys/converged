import { AccessTags, type SqlStore, visibleFrom } from "back-core";

import type { FilterObject } from "g-assistant";
import { ConversationRepository } from "./entities";

export class MedatataStoreService {
	private readonly store: SqlStore;
	public readonly conversationRepo: ConversationRepository;
	/**
	 * Whose conversation is whose.
	 *
	 * Every row here is one person's chat with the assistant, and the listing
	 * used to return all of them to anybody — titles included, which is the
	 * substance of the conversation in one line.
	 */
	public readonly access: AccessTags;

	constructor(store: SqlStore) {
		this.store = store;
		this.access = new AccessTags(store);
		this.conversationRepo = new ConversationRepository(store, "conversations", {
			primaryKey: "id",
			extractKey: (conversation) => ({ id: conversation.id }),
			buildWhereCondition: (key) => ({ id: key.id }),
		});
	}

	async createConversation(threadId: string, title: string) {
		return this.registerConversation(threadId, title);
	}

	/** The caller's conversations, with the name filter applied on top. */
	private visible(filter?: FilterObject) {
		let query = visibleFrom(this.store.db, "conversations");
		const name = filter?.name;
		if (name && typeof name === "object") {
			const clause = name as Record<string, unknown>;
			if (typeof clause.contains === "string") {
				query = query.where("obj.title", "like", `%${clause.contains}%`);
			} else if (typeof clause.eq === "string") {
				query = query.where("obj.title", "=", clause.eq);
			}
		}
		return query;
	}

	async listConversations(params: {
		limit: number;
		offset: number;
		filter?: FilterObject;
	}) {
		return this.visible(params.filter)
			.selectAll("obj")
			.orderBy("obj.updatedAt", "desc")
			.limit(params.limit)
			.offset(params.offset)
			.execute();
	}

	async countConversations(filter?: FilterObject): Promise<number> {
		const result = await this.visible(filter)
			.select((eb: any) => eb.fn.countAll().as("count"))
			.executeTakeFirst();
		return Number(result?.count ?? 0);
	}

	/**
	 * Claims a conversation or renames one already held.
	 *
	 * The id comes from the caller — it is the thread id the browser minted — so
	 * the check is on the second registration, not the first: an id that is
	 * already somebody's can only be re-registered by them.
	 */
	async registerConversation(threadId: string, title: string, actor?: string) {
		const now = new Date().getTime();
		const existing = await this.conversationRepo.findById({ id: threadId });

		if (existing) {
			await this.access.requireWrite(threadId);
			const updated = await this.conversationRepo.update(
				{ id: threadId },
				{
					title: title || existing.title,
					updatedAt: now,
				},
			);
			return updated ?? existing;
		}

		const created = await this.conversationRepo.create({
			id: threadId,
			title,
			createdAt: now,
			updatedAt: now,
			messagesCount: 0,
			filesCount: 0,
			filesSize: 0,
		});
		await this.access.tagNew(threadId, { visibility: "private", owner: actor });
		return created;
	}

	async recordMessage(threadId: string, actor?: string) {
		const now = new Date().getTime();
		const existing = await this.conversationRepo.findById({ id: threadId });

		if (existing) {
			await this.access.requireWrite(threadId);
			const updated = await this.conversationRepo.update(
				{ id: threadId },
				{
					updatedAt: now,
					messagesCount: (existing.messagesCount ?? 0) + 1,
				},
			);
			return updated ?? existing;
		}

		const created = await this.conversationRepo.create({
			id: threadId,
			title: `Chat ${threadId.slice(0, 8)}`,
			createdAt: now,
			updatedAt: now,
			messagesCount: 1,
			filesCount: 0,
			filesSize: 0,
		});
		await this.access.tagNew(threadId, { visibility: "private", owner: actor });
		return created;
	}

	async recordFile(threadId: string, fileSize = 0, actor?: string) {
		const now = new Date().getTime();
		const existing = await this.conversationRepo.findById({ id: threadId });
		const normalizedFileSize =
			Number.isFinite(fileSize) && fileSize > 0 ? Math.round(fileSize) : 0;

		if (existing) {
			await this.access.requireWrite(threadId);
			const updated = await this.conversationRepo.update(
				{ id: threadId },
				{
					updatedAt: now,
					filesCount: (existing.filesCount ?? 0) + 1,
					filesSize: (existing.filesSize ?? 0) + normalizedFileSize,
				},
			);
			return updated ?? existing;
		}

		const created = await this.conversationRepo.create({
			id: threadId,
			title: `Chat ${threadId.slice(0, 8)}`,
			createdAt: now,
			updatedAt: now,
			messagesCount: 0,
			filesCount: 1,
			filesSize: normalizedFileSize,
		});
		await this.access.tagNew(threadId, { visibility: "private", owner: actor });
		return created;
	}
}
