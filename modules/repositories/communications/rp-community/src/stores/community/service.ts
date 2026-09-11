import { applyKyselyFilter, SqlStore, generateULID, type KyselyFilterSchema } from "back-core";
import type {
  CommunitySection,
  CommunitySectionInput,
  CommunityTopic,
  CommunityTopicInput,
  CreateTopicInput,
  PaginatedResult,
  SectionId,
  SectionListParams,
  SectionTreeNode,
  TopicId,
  TopicListParams,
  FilterObject,
  Visibility,
} from "../../types";
import {
  CommunitySectionRepository,
  CommunityTopicRepository,
  type CommunitySectionEntity,
  type CommunityTopicEntity,
} from "./entities";

const topicFilterSchema: KyselyFilterSchema = {
  id: { valueType: "string", operators: ["eq", "in"], column: "id" },
  sectionId: { valueType: "string", operators: ["eq", "in", "notEq", "notIn"], column: "sectionId" },
  title: { valueType: "string", operators: ["eq", "in", "contains", "startsWith", "isNull"], column: "title" },
  createdBy: { valueType: "string", operators: ["eq", "in", "notEq", "notIn"], column: "createdBy" },
  isPinned: { valueType: "boolean", operators: ["eq", "notEq"], column: "isPinned" },
  isLocked: { valueType: "boolean", operators: ["eq", "notEq"], column: "isLocked" },
  isArchived: { valueType: "boolean", operators: ["eq", "notEq"], column: "isArchived" },
  lastActivityAt: { valueType: "date", operators: ["gt", "gte", "lt", "lte", "between"], column: "lastActivityAt" },
  createdAt: { valueType: "date", operators: ["gt", "gte", "lt", "lte", "between"], column: "createdAt" },
};

export class CommunityStoreService {
  private readonly sectionRepo: CommunitySectionRepository;
  private readonly topicRepo: CommunityTopicRepository;

  constructor(private store: SqlStore) {
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

  async saveSection(input: CommunitySectionInput, actor?: string): Promise<SectionId> {
    const now = new Date().toISOString();

    if (input.id) {
      const existing = await this.sectionRepo.findById({ id: input.id });
      if (existing) {
        await this.sectionRepo.update(
          { id: input.id },
          {
            parentId: input.parentId ?? null,
            slug: input.slug,
            title: input.title,
            description: input.description ?? null,
            sortOrder: input.sortOrder ?? existing.sortOrder ?? 0,
            isHidden: input.isHidden === true ? 1 : 0,
            visibility: input.visibility ?? existing.visibility ?? "authenticated",
            updatedAt: now,
          },
        );
        return input.id;
      }
    }

    const sectionId = input.id ?? generateULID();
    const entity: CommunitySectionEntity = {
      id: sectionId,
      parentId: input.parentId ?? null,
      slug: input.slug,
      title: input.title,
      description: input.description ?? null,
      sortOrder: input.sortOrder ?? 0,
      isHidden: input.isHidden === true ? 1 : 0,
      visibility: input.visibility ?? "authenticated",
      createdBy: actor ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await this.sectionRepo.create(entity as any);
    return sectionId;
  }

  async readSection(id: SectionId): Promise<CommunitySection | null> {
    const entity = await this.sectionRepo.findById({ id });
    return entity ? this.toSection(entity) : null;
  }

  async deleteSection(id: SectionId): Promise<boolean> {
    const rows = await this.store.db
      .selectFrom("community_sections")
      .select(["id", "parentId"])
      .execute() as Array<{ id: string; parentId: string | null }>;

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

    await this.store.db
      .deleteFrom("community_topics")
      .where("sectionId", "in", allIds)
      .execute();

    await this.store.db
      .deleteFrom("community_sections")
      .where("id", "in", allIds)
      .execute();

    return true;
  }

  async listSections(
    params: SectionListParams,
  ): Promise<PaginatedResult<CommunitySection>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let query = this.store.db
      .selectFrom("community_sections")
      .selectAll();

    if (params.parentId !== undefined) {
      query = params.parentId
        ? query.where("parentId", "=", params.parentId)
        : query.where("parentId", "is", null);
    }

    if (params.includeHidden !== true) {
      query = query.where("isHidden", "=", 0);
    }

    const rows = await query
      .orderBy("sortOrder", "asc")
      .orderBy("title", "asc")
      .limit(limit)
      .offset(offset)
      .execute();

    let countQuery = this.store.db
      .selectFrom("community_sections")
      .select(({ fn }) => fn.countAll().as("count"));

    if (params.parentId !== undefined) {
      countQuery = params.parentId
        ? countQuery.where("parentId", "=", params.parentId)
        : countQuery.where("parentId", "is", null);
    }

    if (params.includeHidden !== true) {
      countQuery = countQuery.where("isHidden", "=", 0);
    }

    const countResult = await countQuery.executeTakeFirst();

    return {
      items: (rows as CommunitySectionEntity[]).map((row) => this.toSection(row)),
      totalCount: Number(countResult?.count ?? 0),
    };
  }

  async readSectionsTree(
    rootId?: SectionId,
    includeHidden?: boolean,
  ): Promise<SectionTreeNode[]> {
    let query = this.store.db
      .selectFrom("community_sections")
      .selectAll();

    if (includeHidden !== true) {
      query = query.where("isHidden", "=", 0);
    }

    const rows = await query
      .orderBy("sortOrder", "asc")
      .orderBy("title", "asc")
      .execute() as CommunitySectionEntity[];

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
        await this.topicRepo.update(
          { id: input.id },
          {
            sectionId: input.sectionId,
            threadId: input.threadId,
            title: input.title,
            isPinned: input.isPinned === true ? 1 : 0,
            isLocked: input.isLocked === true ? 1 : 0,
            isArchived: input.isArchived === true ? 1 : 0,
            visibility: input.visibility ?? existing.visibility ?? "authenticated",
            lastActivityAt: input.lastActivityAt ?? now,
            updatedAt: now,
          },
        );
        return input.id;
      }
    }

    const topicId = input.id ?? generateULID();
    const entity: CommunityTopicEntity = {
      id: topicId,
      sectionId: input.sectionId,
      threadId: input.threadId,
      title: input.title,
      createdBy: actor,
      isPinned: input.isPinned === true ? 1 : 0,
      isLocked: input.isLocked === true ? 1 : 0,
      isArchived: input.isArchived === true ? 1 : 0,
      visibility: input.visibility ?? "authenticated",
      lastActivityAt: input.lastActivityAt ?? now,
      createdAt: now,
      updatedAt: now,
    };

    await this.topicRepo.create(entity as any);
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
  async createTopic(input: CreateTopicInput, actor: string): Promise<CommunityTopic> {
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
    return this.toTopic(entity);
  }

  /**
   * Bumps a topic after a reply. Refuses a locked one, which is the only place
   * the lock can be enforced at all: `rp-threads` accepts the message and has
   * no idea a topic exists, so this is what a screen has to call before it
   * treats a post as delivered.
   */
  async touchTopicActivity(id: TopicId): Promise<boolean> {
    const existing = await this.topicRepo.findById({ id });
    if (!existing) return false;
    if (existing.isLocked === 1) throw new Error("Topic is locked");
    const now = new Date().toISOString();
    await this.topicRepo.update({ id }, { lastActivityAt: now, updatedAt: now });
    return true;
  }

  async readTopic(id: TopicId): Promise<CommunityTopic | null> {
    const entity = await this.topicRepo.findById({ id });
    return entity ? this.toTopic(entity) : null;
  }

  async deleteTopic(id: TopicId): Promise<boolean> {
    return this.topicRepo.delete({ id });
  }

  async listTopics(params: TopicListParams): Promise<PaginatedResult<CommunityTopic>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let query = this.store.db
      .selectFrom("community_topics")
      .selectAll();

    if (params.sectionId) {
      query = query.where("sectionId", "=", params.sectionId);
    }

    if (params.includeArchived !== true) {
      query = query.where("isArchived", "=", 0);
    }

    const q = params.query?.trim();
    if (q) {
      query = query.where("title", "like", `%${q}%`);
    }
    query = applyKyselyFilter(query, params.filter, topicFilterSchema);

    const rows = await query
      .orderBy("isPinned", "desc")
      .orderBy("lastActivityAt", "desc")
      .orderBy("updatedAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    let countQuery = this.store.db
      .selectFrom("community_topics")
      .select(({ fn }) => fn.countAll().as("count"));

    if (params.sectionId) {
      countQuery = countQuery.where("sectionId", "=", params.sectionId);
    }

    if (params.includeArchived !== true) {
      countQuery = countQuery.where("isArchived", "=", 0);
    }

    if (q) {
      countQuery = countQuery.where("title", "like", `%${q}%`);
    }
    countQuery = applyKyselyFilter(countQuery, params.filter, topicFilterSchema);

    const countResult = await countQuery.executeTakeFirst();

    return {
      items: (rows as CommunityTopicEntity[]).map((row) => this.toTopic(row)),
      totalCount: Number(countResult?.count ?? 0),
    };
  }

  async countTopics(filter?: FilterObject): Promise<number> {
    let query = this.store.db
      .selectFrom("community_topics")
      .select(({ fn }) => fn.countAll().as("count"))
      .where("isArchived", "=", 0);
    query = applyKyselyFilter(query, filter, topicFilterSchema);
    const result = await query.executeTakeFirst();
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
