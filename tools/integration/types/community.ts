export type SectionId = string;
export type TopicId = string;
export type ThreadId = string;
export type UserId = string;
export type ISODateString = string;

export interface PaginatedResult<T> {
  items: T[];
  totalCount?: number;
}

export type ListParams = {
  offset: number;
  limit: number;
};

export type CommunitySection = {
  id: SectionId;
  parentId?: SectionId;
  slug: string;
  title: string;
  description?: string;
  sortOrder: number;
  isHidden: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type CommunitySectionInput = {
  id?: SectionId;
  parentId?: SectionId;
  slug: string;
  title: string;
  description?: string;
  sortOrder?: number;
  isHidden?: boolean;
};

export type CommunityTopic = {
  id: TopicId;
  sectionId: SectionId;
  threadId: ThreadId;
  title: string;
  createdBy: UserId;
  isPinned: boolean;
  isLocked: boolean;
  isArchived: boolean;
  lastActivityAt: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type CommunityTopicInput = {
  id?: TopicId;
  sectionId: SectionId;
  threadId: ThreadId;
  title: string;
  createdBy: UserId;
  isPinned?: boolean;
  isLocked?: boolean;
  isArchived?: boolean;
  lastActivityAt?: ISODateString;
};

export type SectionListParams = ListParams & {
  parentId?: SectionId;
  includeHidden?: boolean;
};

export type TopicListParams = ListParams & {
  sectionId?: SectionId;
  includeArchived?: boolean;
  query?: string;
};

export type SectionTreeNode = CommunitySection & {
  children: SectionTreeNode[];
};

export interface CommunityService {
  saveSection(input: CommunitySectionInput): Promise<SectionId>;
  readSection(id: SectionId): Promise<CommunitySection | null>;
  deleteSection(id: SectionId): Promise<boolean>;
  listSections(params: SectionListParams): Promise<PaginatedResult<CommunitySection>>;
  readSectionsTree(rootId?: SectionId, includeHidden?: boolean): Promise<SectionTreeNode[]>;

  saveTopic(input: CommunityTopicInput): Promise<TopicId>;
  readTopic(id: TopicId): Promise<CommunityTopic | null>;
  deleteTopic(id: TopicId): Promise<boolean>;
  listTopics(params: TopicListParams): Promise<PaginatedResult<CommunityTopic>>;
}
