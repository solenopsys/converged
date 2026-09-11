import { Access, getCurrentWorkspaceContext } from "nrpc";
import type {
  CommunityService,
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
  SelectionDescriptor,
  SelectionStats,
} from "./types";
import { StoresController } from "./stores";

const REPOSITORY_ID = "rp-community";

/**
 * Who is calling, from the verified token and from nothing else.
 *
 * `messaging-backend` puts the token's subject into the request context and
 * prefers it over whatever the envelope claimed, so this is the one value in
 * the process a caller cannot choose for itself. Everything that records
 * authorship goes through here; the forum's input types no longer carry a
 * `createdBy` field for a client to fill in.
 */
function requireActor(): string {
  const actor = getCurrentWorkspaceContext()?.user?.trim();
  if (!actor) throw new Error("Authenticated caller is required");
  return actor;
}

export class CommunityServiceImpl implements CommunityService {
  private stores: StoresController;
  private initPromise?: Promise<void>;

  constructor() {
    this.init();
  }

  private async init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      this.stores = new StoresController(REPOSITORY_ID);
      await this.stores.init();
    })();

    return this.initPromise;
  }

  private async ready(): Promise<void> {
    await this.init();
  }

  // Every method carries a deliberate level. The decorator is not redundant
  // with the default: an undecorated method also resolves to `"user"`, so a
  // reader cannot tell a considered decision from an oversight — and
  // `deleteSection` cascades every topic under it.
  @Access("user")
  async saveSection(input: CommunitySectionInput): Promise<SectionId> {
    await this.ready();
    return this.stores.community.saveSection(input, requireActor());
  }

  @Access("user")
  async readSection(id: SectionId): Promise<CommunitySection | null> {
    await this.ready();
    return this.stores.community.readSection(id);
  }

  @Access("user")
  async deleteSection(id: SectionId): Promise<boolean> {
    await this.ready();
    return this.stores.community.deleteSection(id);
  }

  @Access("user")
  async listSections(params: SectionListParams): Promise<PaginatedResult<CommunitySection>> {
    await this.ready();
    return this.stores.community.listSections(params);
  }

  @Access("user")
  async readSectionsTree(rootId?: SectionId, includeHidden?: boolean): Promise<SectionTreeNode[]> {
    await this.ready();
    return this.stores.community.readSectionsTree(rootId, includeHidden);
  }

  @Access("user")
  async createTopic(input: CreateTopicInput): Promise<CommunityTopic> {
    await this.ready();
    return this.stores.community.createTopic(input, requireActor());
  }

  @Access("user")
  async saveTopic(input: CommunityTopicInput): Promise<TopicId> {
    await this.ready();
    return this.stores.community.saveTopic(input, requireActor());
  }

  @Access("user")
  async readTopic(id: TopicId): Promise<CommunityTopic | null> {
    await this.ready();
    return this.stores.community.readTopic(id);
  }

  @Access("user")
  async deleteTopic(id: TopicId): Promise<boolean> {
    await this.ready();
    return this.stores.community.deleteTopic(id);
  }

  @Access("user")
  async touchTopicActivity(id: TopicId): Promise<boolean> {
    await this.ready();
    return this.stores.community.touchTopicActivity(id);
  }

  @Access("user")
  async listTopics(params: TopicListParams): Promise<PaginatedResult<CommunityTopic>> {
    await this.ready();
    return this.stores.community.listTopics(params);
  }

  @Access("user")
  async describeSelection(objectType: string): Promise<SelectionDescriptor> {
    if (objectType !== "community.topic") {
      throw new Error(`Unsupported community selection object: ${objectType}`);
    }
    return {
      objectType,
      title: "Forum topics",
      fields: [
        { id: "title", label: "Topic", valueType: "string", operators: ["eq", "in", "contains", "startsWith", "isNull"] },
        { id: "sectionId", label: "Section", valueType: "string", operators: ["eq", "in", "notEq", "notIn"] },
        { id: "createdBy", label: "Author", valueType: "string", operators: ["eq", "in", "notEq", "notIn"] },
        { id: "isPinned", label: "Pinned", valueType: "boolean", operators: ["eq", "notEq"] },
        { id: "lastActivityAt", label: "Last activity", valueType: "date", operators: ["gt", "gte", "lt", "lte", "between"] },
      ],
      revision: "community-v1",
    };
  }

  @Access("user")
  async inspectTopics(filter?: FilterObject): Promise<SelectionStats> {
    await this.ready();
    return { totalCount: await this.stores.community.countTopics(filter) };
  }
}

export default CommunityServiceImpl;
