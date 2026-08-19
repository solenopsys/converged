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
} from "./types";
import { StoresController } from "./stores";

const MS_ID = "community-ms";

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
      this.stores = new StoresController(MS_ID);
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
}

export default CommunityServiceImpl;
