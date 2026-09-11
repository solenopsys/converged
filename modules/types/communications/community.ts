export type SectionId = string;
export type TopicId = string;
export type ThreadId = string;
export type UserId = string;
export type ISODateString = string;

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
}

export type ListParams = {
  offset: number;
  limit: number;
};

/**
 * Row-level visibility. The mechanism behind `tagged` is the shared
 * `access_tags` table described in `access-control.md`: one relation table per
 * storage, owner expressed as the tag `u<userId>`, never a column of its own.
 */
export type Visibility = "public" | "authenticated" | "private" | "tagged";

export type CommunitySection = {
  id: SectionId;
  parentId?: SectionId;
  slug: string;
  title: string;
  description?: string;
  sortOrder: number;
  isHidden: boolean;
  visibility: Visibility;
  createdBy?: UserId;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

/**
 * `createdBy` is absent by design: the author is taken from the verified token
 * inside the service. A client that can name the author can forge one.
 */
export type CommunitySectionInput = {
  id?: SectionId;
  parentId?: SectionId;
  slug: string;
  title: string;
  description?: string;
  sortOrder?: number;
  isHidden?: boolean;
  visibility?: Visibility;
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
  visibility: Visibility;
  lastActivityAt: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type CommunityTopicInput = {
  id?: TopicId;
  sectionId: SectionId;
  threadId: ThreadId;
  title: string;
  isPinned?: boolean;
  isLocked?: boolean;
  isArchived?: boolean;
  visibility?: Visibility;
  lastActivityAt?: ISODateString;
};

/**
 * What the browser sends to start a topic. No `id` and no `threadId`: both are
 * minted by the service, because an id a client may choose is an id it may
 * steal (`access-control.md`, "Требования к идентификаторам").
 *
 * The service does NOT write the opening post. Writing it would mean
 * `rp-community` calling `rp-threads`, and services do not call each other —
 * the caller registers the thread and posts the body itself, using the
 * `threadId` this call returns.
 */
export type CreateTopicInput = {
  sectionId: SectionId;
  title: string;
  visibility?: Visibility;
};

export type SectionListParams = ListParams & {
  parentId?: SectionId;
  includeHidden?: boolean;
};

export type TopicListParams = ListParams & {
  sectionId?: SectionId;
  includeArchived?: boolean;
  query?: string;
	filter?: FilterObject;
};

export type FilterObject = Record<string, unknown>;
export type SelectionFieldDescriptor = { id: string; label: string; valueType: "string" | "number" | "boolean" | "date" | "enum"; operators: string[] };
export type SelectionDescriptor = { objectType: string; title: string; fields: SelectionFieldDescriptor[]; filterExample?: FilterObject; revision?: string };
export type SelectionStats = { totalCount: number };

export type SectionTreeNode = CommunitySection & {
  children: SectionTreeNode[];
};

export interface CommunityService {
  saveSection(input: CommunitySectionInput): Promise<SectionId>;
  readSection(id: SectionId): Promise<CommunitySection | null>;
  deleteSection(id: SectionId): Promise<boolean>;
  listSections(params: SectionListParams): Promise<PaginatedResult<CommunitySection>>;
  readSectionsTree(rootId?: SectionId, includeHidden?: boolean): Promise<SectionTreeNode[]>;

  /** Mints id + threadId, stamps the author from the token, returns the topic. */
  createTopic(input: CreateTopicInput): Promise<CommunityTopic>;
  saveTopic(input: CommunityTopicInput): Promise<TopicId>;
  readTopic(id: TopicId): Promise<CommunityTopic | null>;
  deleteTopic(id: TopicId): Promise<boolean>;
  /**
   * Moves a topic to the top of its section after a reply. Separate from
   * `saveTopic` so posting does not have to send the whole row back, and so a
   * locked topic can be refused in one place.
   */
  touchTopicActivity(id: TopicId): Promise<boolean>;
  listTopics(params: TopicListParams): Promise<PaginatedResult<CommunityTopic>>;
	describeSelection(objectType: string): Promise<SelectionDescriptor>;
	inspectTopics(filter?: FilterObject): Promise<SelectionStats>;
}
