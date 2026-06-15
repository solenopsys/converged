import type {
  ContextsService,
  Context,
  ContextInput,
  ContextLanguage,
  ContextListParams,
  ContextName,
  ContextSummary,
  PaginatedResult,
} from "./types";
import { StoresController } from "./stores";

const MS_ID = "contexts-ms";

export class ContextsServiceImpl implements ContextsService {
  private stores!: StoresController;
  private initPromise?: Promise<void>;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      this.stores = new StoresController(MS_ID);
      await this.stores.init();
    })();
    return this.initPromise;
  }

  private async ready(): Promise<void> {
    await this.init();
  }

  async saveContext(input: ContextInput): Promise<ContextSummary> {
    await this.ready();
    return this.stores.contexts.saveContext(input);
  }

  async getContext(
    name: ContextName,
    language?: ContextLanguage,
  ): Promise<Context | null> {
    await this.ready();
    return this.stores.contexts.getContext(name, language);
  }

  async listContexts(
    params: ContextListParams,
  ): Promise<PaginatedResult<ContextSummary>> {
    await this.ready();
    return this.stores.contexts.listContexts(params ?? {});
  }

  async deleteContext(
    name: ContextName,
    language?: ContextLanguage,
  ): Promise<boolean> {
    await this.ready();
    return this.stores.contexts.deleteContext(name, language);
  }
}

export default ContextsServiceImpl;
