import {
	AccessTags,
	applyKyselyFilter,
	generateULID,
	type KyselyFilterSchema,
	type SqlStore,
	visibleFrom,
} from "back-core";
import type {
	CommunitySection,
	CommunitySectionInput,
	CommunityTopic,
	CommunityTopicInput,
	CreateTopicInput,
	FilterObject,
	PaginatedResult,
	SectionId,
	SectionListParams,
	SectionTreeNode,
	TopicId,
	TopicListParams,
	Visibility,
} from "../../types";
import {
	type CommunitySectionEntity,
	CommunitySectionRepository,
	type CommunityTopicEntity,
	CommunityTopicRepository,
} from "./entities";

const topicFilterSchema: KyselyFilterSchema = {
	id: { valueType: "string", operators: ["eq", "in"], column: "obj.id" },
	sectionId: {
		valueType: "string",
		operators: ["eq", "in", "notEq", "notIn"],
		column: "obj.sectionId",
	},
	title: {
		valueType: "string",
		operators: ["eq", "in", "contains", "startsWith", "isNull"],
		column: "obj.title",
	},
	createdBy: {
		valueType: "string",
		operators: ["eq", "in", "notEq", "notIn"],
		column: "obj.createdBy",
	},
	isPinned: {
		valueType: "boolean",
		operators: ["eq", "notEq"],
		column: "obj.isPinned",
	},
	isLocked: {
		valueType: "boolean",
		operators: ["eq", "notEq"],
		column: "obj.isLocked",
	},
	isArchived: {
		valueType: "boolean",
		operators: ["eq", "notEq"],
		column: "obj.isArchived",
	},
	lastActivityAt: {
		valueType: "date",
		operators: ["gt", "gte", "lt", "lte", "between"],
		column: "obj.lastActivityAt",
	},
	createdAt: {
		valueType: "date",
		operators: ["gt", "gte", "lt", "lte", "between"],
		column: "obj.createdAt",
	},
};

export class CommunityStoreService {
	private readonly sectionRepo: CommunitySectionRepository;
	private readonly topicRepo: CommunityTopicRepository;
	/**
	 * Who may see what, in this store and decided by this store.
	 *
	 * Both tables share one relation, which is what `access-control.md` asks for:
	 * a section id and a topic id never collide because both are ULIDs minted
	 * here, so the `JOIN` back to the owning table is what separates them.
	 */
	readonly access: AccessTags;

	constructor(private store: SqlStore) {
		this.access = new AccessTags(store);
		this.sectionRepo = new CommunitySectionRepository(
			store,
			"community_sections",
			{
				primaryKey: "id",
				extractKey: (entry) => ({ id: entry.id }),
				buildWhereCondition: (key) => ({ id: key.id }),
			},
		);

		this.topicRepo = new CommunityTopicRepository(store, "community_topics", {
			primaryKey: "id",
			extractKey: (entry) => ({ id: entry.id }),
			buildWhereCondition: (key) => ({ id: key.id }),
		});
	}

	async saveSection(
		input: CommunitySectionInput,
		actor?: string,
	): Promise<SectionId> {
		const now = new Date().toISOString();

		if (input.id) {
			const existing = await this.sectionRepo.findById({ id: input.id });
			if (existing) {
				// Editing is not reading: an open section is visible to everyone but
				// belongs to its author and to whoever holds a tag it carries.
				await this.access.requireWrite(input.id);
				const visibility = (input.visibility ??
					existing.visibility ??
					"authenticated") as Visibility;
				await this.sectionRepo.update(
					{ id: input.id },
					{
						parentId: input.parentId ?? null,
						slug: input.slug,
						title: input.title,
						description: input.description ?? null,
						sortOrder: input.sortOrder ?? existing.sortOrder ?? 0,
						isHidden: input.isHidden === true ? 1 : 0,
						visibility,
						updatedAt: now,
					},
				);
				await this.access.setVisibility(input.id, visibility);
				return input.id;
			}
		}

		const sectionId = input.id ?? generateULID();
		const visibility = (input.visibility ?? "authenticated") as Visibility;
		const entity: CommunitySectionEntity = {
			id: sectionId,
			parentId: input.parentId ?? null,
			slug: input.slug,
			title: input.title,
			description: input.description ?? null,
			sortOrder: input.sortOrder ?? 0,
			isHidden: input.isHidden === true ? 1 : 0,
			visibility,
			createdBy: actor ?? null,
			createdAt: now,
			updatedAt: now,
		};

		await this.sectionRepo.create(entity as any);
		await this.access.tagNew(sectionId, {
			visibility,
			owner: actor ?? undefined,
			// A subsection inherits the parent's grants for the same reason a topic
			// inherits its section's: access was decided once, at the top, and the
			// server copies it down. A client that passed its own tags here would be
			// choosing who may read it.
			tags: entity.parentId ? await this.access.tagsOf(entity.parentId) : [],
		});
		return sectionId;
	}

	/**
	 * A section the caller may not see reads as absent rather than as forbidden:
	 * telling them it exists is most of what the privacy was for.
	 */
	async readSection(id: SectionId): Promise<CommunitySection | null> {
		if (!(await this.access.canRead(id))) return null;
		const entity = await this.sectionRepo.findById({ id });
		return entity ? this.toSection(entity) : null;
	}

	async deleteSection(id: SectionId): Promise<boolean> {
		await this.access.requireWrite(id);

		const rows = (await this.store.db
			.selectFrom("community_sections")
			.select(["id", "parentId"])
			.execute()) as Array<{ id: string; parentId: string | null }>;

		const targetExists = rows.some((row) => row.id === id);
		if (!targetExists) return false;

		const byParent: Record<string, string[]> = {};
		for (const row of rows) {
			if (!row.parentId) continue;
			byParent[row.parentId] ??= [];
			byParent[row.parentId].push(row.id);
		}

		const queue = [id];
		const allIds: string[] = [];
		while (queue.length > 0) {
			const current = queue.shift()!;
			allIds.push(current);
			const children = byParent[current] ?? [];
			for (const childId of children) {
				queue.push(childId);
			}
		}

		// Tags outlive the row unless they are dropped with it, and a leftover grant
		// silently opens whatever id lands on next.
		const doomedTopics = (await this.store.db
			.selectFrom("community_topics")
			.select("id")
			.where("sectionId", "in", allIds)
			.execute()) as Array<{ id: string }>;

		await this.store.db
			.deleteFrom("community_topics")
			.where("sectionId", "in", allIds)
			.execute();

		await this.store.db
			.deleteFrom("community_sections")
			.where("id", "in", allIds)
			.execute();

		for (const topic of doomedTopics) await this.access.dropObject(topic.id);
		for (const sectionId of allIds) await this.access.dropObject(sectionId);

		return true;
	}

	/**
	 * Sections the caller may see, narrowed in the query and not after it.
	 *
	 * The narrowing and the count come from the same builder, so the total never
	 * announces how many sections were hidden — which is the one number that would
	 * give a private section away.
	 */
	private visibleSections(params: {
		parentId?: SectionId | null;
		includeHidden?: boolean;
	}) {
		let query = visibleFrom(this.store.db, "community_sections");

		if (params.parentId !== undefined) {
			query = params.parentId
				? query.where("obj.parentId", "=", params.parentId)
				: query.where("obj.parentId", "is", null);
		}

		if (params.includeHidden !== true) {
			query = query.where("obj.isHidden", "=", 0);
		}

		return query;
	}

	async listSections(
		params: SectionListParams,
	): Promise<PaginatedResult<CommunitySection>> {
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;

		const rows = await this.visibleSections(params)
			.selectAll("obj")
			.orderBy("obj.sortOrder", "asc")
			.orderBy("obj.title", "asc")
			.limit(limit)
			.offset(offset)
			.execute();

		const countResult = await this.visibleSections(params)
			.select((eb: any) => eb.fn.countAll().as("count"))
			.executeTakeFirst();

		return {
			items: (rows as CommunitySectionEntity[]).map((row) =>
				this.toSection(row),
			),
			totalCount: Number(countResult?.count ?? 0),
		};
	}

	async readSectionsTree(
		rootId?: SectionId,
		includeHidden?: boolean,
	): Promise<SectionTreeNode[]> {
		// A section whose parent is closed to the caller surfaces as a root here
		// rather than disappearing: it was granted to them on its own, and hanging
		// it under a parent they cannot see would be the only alternative.
		const query = this.visibleSections({ includeHidden });

		const rows = (await query
			.selectAll("obj")
			.orderBy("obj.sortOrder", "asc")
			.orderBy("obj.title", "asc")
			.execute()) as CommunitySectionEntity[];

		const nodeMap = new Map<string, SectionTreeNode>();
		for (const row of rows) {
			nodeMap.set(row.id, { ...this.toSection(row), children: [] });
		}

		const roots: SectionTreeNode[] = [];
		for (const row of rows) {
			const node = nodeMap.get(row.id);
			if (!node) continue;

			if (row.parentId && nodeMap.has(row.parentId)) {
				nodeMap.get(row.parentId)!.children.push(node);
			} else {
				roots.push(node);
			}
		}

		if (!rootId) {
			return roots;
		}

		const rootNode = nodeMap.get(rootId);
		return rootNode ? [rootNode] : [];
	}

	async saveTopic(input: CommunityTopicInput, actor: string): Promise<TopicId> {
		const now = new Date().toISOString();

		if (input.id) {
			const existing = await this.topicRepo.findById({ id: input.id });
			if (existing) {
				await this.access.requireWrite(input.id);
				const visibility = (input.visibility ??
					existing.visibility ??
					"authenticated") as Visibility;
				await this.topicRepo.update(
					{ id: input.id },
					{
						sectionId: input.sectionId,
						threadId: input.threadId,
						title: input.title,
						isPinned: input.isPinned === true ? 1 : 0,
						isLocked: input.isLocked === true ? 1 : 0,
						isArchived: input.isArchived === true ? 1 : 0,
						visibility,
						lastActivityAt: input.lastActivityAt ?? now,
						updatedAt: now,
					},
				);
				await this.access.setVisibility(input.id, visibility);
				return input.id;
			}
		}

		await this.access.requireRead(input.sectionId);

		const topicId = input.id ?? generateULID();
		const visibility = (input.visibility ?? "authenticated") as Visibility;
		const entity: CommunityTopicEntity = {
			id: topicId,
			sectionId: input.sectionId,
			threadId: input.threadId,
			title: input.title,
			createdBy: actor,
			isPinned: input.isPinned === true ? 1 : 0,
			isLocked: input.isLocked === true ? 1 : 0,
			isArchived: input.isArchived === true ? 1 : 0,
			visibility,
			lastActivityAt: input.lastActivityAt ?? now,
			createdAt: now,
			updatedAt: now,
		};

		await this.topicRepo.create(entity as any);
		await this.access.tagNew(topicId, {
			visibility,
			owner: actor,
			tags: await this.access.tagsOf(input.sectionId),
		});
		return topicId;
	}

	/**
	 * Starts a topic. Both ids are minted here, never accepted from the caller:
	 * an id a client may choose is an id it may steal, and the access tags that
	 * will hang off it in `access_tags` carry no object type to catch the
	 * collision (`access-control.md`, "Требования к идентификаторам").
	 *
	 * The opening post is NOT written here. Writing it would mean `rp-community`
	 * calling `rp-threads`, and services do not call each other. The caller
	 * registers the returned `threadId` and posts the body itself.
	 *
	 * A new topic inherits its section's visibility unless it asks for something
	 * narrower — the inheritance rule from `access-control.md` runs here, on the
	 * server, and not in the browser, for the same reason authorship does.
	 */
	async createTopic(
		input: CreateTopicInput,
		actor: string,
	): Promise<CommunityTopic> {
		// Posting into a section starts by being able to see it. Checked before the
		// row is read, so a closed section answers the same whether it exists here
		// or not.
		await this.access.requireRead(input.sectionId);

		const section = await this.sectionRepo.findById({ id: input.sectionId });
		if (!section) throw new Error(`Unknown section: ${input.sectionId}`);

		const title = input.title?.trim();
		if (!title) throw new Error("Topic title is required");

		const now = new Date().toISOString();
		const entity: CommunityTopicEntity = {
			id: generateULID(),
			sectionId: input.sectionId,
			threadId: generateULID(),
			title,
			createdBy: actor,
			isPinned: 0,
			isLocked: 0,
			isArchived: 0,
			visibility: input.visibility ?? section.visibility ?? "authenticated",
			lastActivityAt: now,
			createdAt: now,
			updatedAt: now,
		};

		await this.topicRepo.create(entity as any);
		// Inheritance is a copy made here, from tags this service reads in its own
		// store — not tags the browser passed in. A client that names its own tags
		// names any of them.
		await this.access.tagNew(entity.id, {
			visibility: entity.visibility as Visibility,
			owner: actor,
			tags: await this.access.tagsOf(input.sectionId),
		});
		return this.toTopic(entity);
	}

	/**
	 * Bumps a topic after a reply. Refuses a locked one, which is the only place
	 * the lock can be enforced at all: `rp-threads` accepts the message and has
	 * no idea a topic exists, so this is what a screen has to call before it
	 * treats a post as delivered.
	 */
	async touchTopicActivity(id: TopicId): Promise<boolean> {
		// Bumping a topic is evidence someone replied to it, so the bar is reading
		// it, not owning it.
		await this.access.requireRead(id);
		const existing = await this.topicRepo.findById({ id });
		if (!existing) return false;
		if (existing.isLocked === 1) throw new Error("Topic is locked");
		const now = new Date().toISOString();
		await this.topicRepo.update(
			{ id },
			{ lastActivityAt: now, updatedAt: now },
		);
		return true;
	}

	async readTopic(id: TopicId): Promise<CommunityTopic | null> {
		if (!(await this.access.canRead(id))) return null;
		const entity = await this.topicRepo.findById({ id });
		return entity ? this.toTopic(entity) : null;
	}

	async deleteTopic(id: TopicId): Promise<boolean> {
		await this.access.requireWrite(id);
		const deleted = await this.topicRepo.delete({ id });
		if (deleted) await this.access.dropObject(id);
		return deleted;
	}

	/**
	 * Topics the caller may see, with the caller's own conditions on top.
	 *
	 * Access comes first and the client filter second, which is the order that
	 * matters: the filter can only ever shrink an already-narrowed set, so no
	 * combination of `filter` and `query` reaches a topic that was not open to
	 * begin with.
	 */
	private visibleTopics(params: {
		sectionId?: SectionId;
		includeArchived?: boolean;
		query?: string;
		filter?: FilterObject;
	}) {
		let query = visibleFrom(this.store.db, "community_topics");

		if (params.sectionId) {
			query = query.where("obj.sectionId", "=", params.sectionId);
		}

		if (params.includeArchived !== true) {
			query = query.where("obj.isArchived", "=", 0);
		}

		const q = params.query?.trim();
		if (q) {
			query = query.where("obj.title", "like", `%${q}%`);
		}

		return applyKyselyFilter(query, params.filter, topicFilterSchema);
	}

	async listTopics(
		params: TopicListParams,
	): Promise<PaginatedResult<CommunityTopic>> {
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;

		const rows = await this.visibleTopics(params)
			.selectAll("obj")
			.orderBy("obj.isPinned", "desc")
			.orderBy("obj.lastActivityAt", "desc")
			.orderBy("obj.updatedAt", "desc")
			.limit(limit)
			.offset(offset)
			.execute();

		const countResult = await this.visibleTopics(params)
			.select((eb: any) => eb.fn.countAll().as("count"))
			.executeTakeFirst();

		return {
			items: (rows as CommunityTopicEntity[]).map((row) => this.toTopic(row)),
			totalCount: Number(countResult?.count ?? 0),
		};
	}

	/**
	 * The count behind the selection UI. It is the caller's own count: two people
	 * with different tags get different numbers for the same filter, and that is
	 * the correct answer for each of them.
	 */
	async countTopics(filter?: FilterObject): Promise<number> {
		const result = await this.visibleTopics({ filter })
			.select((eb: any) => eb.fn.countAll().as("count"))
			.executeTakeFirst();
		return Number(result?.count ?? 0);
	}

	private toSection(entity: CommunitySectionEntity): CommunitySection {
		return {
			id: entity.id,
			parentId: entity.parentId ?? undefined,
			slug: entity.slug,
			title: entity.title,
			description: entity.description ?? undefined,
			sortOrder: entity.sortOrder,
			isHidden: entity.isHidden === 1,
			visibility: (entity.visibility ?? "authenticated") as Visibility,
			createdBy: entity.createdBy ?? undefined,
			createdAt: entity.createdAt,
			updatedAt: entity.updatedAt,
		};
	}

	private toTopic(entity: CommunityTopicEntity): CommunityTopic {
		return {
			id: entity.id,
			sectionId: entity.sectionId,
			threadId: entity.threadId,
			title: entity.title,
			createdBy: entity.createdBy,
			isPinned: entity.isPinned === 1,
			isLocked: entity.isLocked === 1,
			isArchived: entity.isArchived === 1,
			visibility: (entity.visibility ?? "authenticated") as Visibility,
			lastActivityAt: entity.lastActivityAt,
			createdAt: entity.createdAt,
			updatedAt: entity.updatedAt,
		};
	}
}
