import { BaseRepositorySQL, KeySQL } from "back-core";

export interface CommunitySectionKey extends KeySQL {
  id: string;
}

export interface CommunitySectionEntity {
  id: string;
  parentId?: string | null;
  slug: string;
  title: string;
  description?: string | null;
  sortOrder: number;
  isHidden: number;
  createdAt: string;
  updatedAt: string;
}

export class CommunitySectionRepository extends BaseRepositorySQL<
  CommunitySectionKey,
  CommunitySectionEntity
> {}

export interface CommunityTopicKey extends KeySQL {
  id: string;
}

export interface CommunityTopicEntity {
  id: string;
  sectionId: string;
  threadId: string;
  title: string;
  createdBy: string;
  isPinned: number;
  isLocked: number;
  isArchived: number;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
}

export class CommunityTopicRepository extends BaseRepositorySQL<
  CommunityTopicKey,
  CommunityTopicEntity
> {}
