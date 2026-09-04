import type {
  CommunityService,
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
  FilterObject,
  SelectionDescriptor,
  SelectionStats,
} from "./types";
import { StoresController } from "./stores";

const REPOSITORY_ID = "rp-community";

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

  async saveSection(input: CommunitySectionInput): Promise<SectionId> {
    await this.ready();
    return this.stores.community.saveSection(input);
  }

  async readSection(id: SectionId): Promise<CommunitySection | null> {
    await this.ready();
    return this.stores.community.readSection(id);
  }

  async deleteSection(id: SectionId): Promise<boolean> {
    await this.ready();
    return this.stores.community.deleteSection(id);
  }

  async listSections(params: SectionListParams): Promise<PaginatedResult<CommunitySection>> {
    await this.ready();
    return this.stores.community.listSections(params);
  }

  async readSectionsTree(rootId?: SectionId, includeHidden?: boolean): Promise<SectionTreeNode[]> {
    await this.ready();
    return this.stores.community.readSectionsTree(rootId, includeHidden);
  }

  async saveTopic(input: CommunityTopicInput): Promise<TopicId> {
    await this.ready();
    return this.stores.community.saveTopic(input);
  }

  async readTopic(id: TopicId): Promise<CommunityTopic | null> {
    await this.ready();
    return this.stores.community.readTopic(id);
  }

  async deleteTopic(id: TopicId): Promise<boolean> {
    await this.ready();
    return this.stores.community.deleteTopic(id);
  }

  async listTopics(params: TopicListParams): Promise<PaginatedResult<CommunityTopic>> {
    await this.ready();
    return this.stores.community.listTopics(params);
  }

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

  async inspectTopics(filter?: FilterObject): Promise<SelectionStats> {
    await this.ready();
    return { totalCount: await this.stores.community.countTopics(filter) };
  }
}

export default CommunityServiceImpl;
