import { SqlStore, generateULID } from "back-core";
import type {
  CommunitySection,
  CommunitySectionInput,
  CommunityTopic,
  CommunityTopicInput,
  PaginatedResult,
  SectionId,
  SectionListParams,
  SectionTreeNode,
  TopicId,
  TopicListParams,
} from "../../types";
import {
  CommunitySectionRepository,
  CommunityTopicRepository,
  type CommunitySectionEntity,
  type CommunityTopicEntity,
} from "./entities";

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

  async saveSection(input: CommunitySectionInput): Promise<SectionId> {
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

  async saveTopic(input: CommunityTopicInput): Promise<TopicId> {
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
            createdBy: input.createdBy,
            isPinned: input.isPinned === true ? 1 : 0,
            isLocked: input.isLocked === true ? 1 : 0,
            isArchived: input.isArchived === true ? 1 : 0,
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
      createdBy: input.createdBy,
      isPinned: input.isPinned === true ? 1 : 0,
      isLocked: input.isLocked === true ? 1 : 0,
      isArchived: input.isArchived === true ? 1 : 0,
      lastActivityAt: input.lastActivityAt ?? now,
      createdAt: now,
      updatedAt: now,
    };

    await this.topicRepo.create(entity as any);
    return topicId;
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

    const countResult = await countQuery.executeTakeFirst();

    return {
      items: (rows as CommunityTopicEntity[]).map((row) => this.toTopic(row)),
      totalCount: Number(countResult?.count ?? 0),
    };
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
      lastActivityAt: entity.lastActivityAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
