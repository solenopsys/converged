import type {
  ShedullerService,
  CronEntry,
  CronInput,
  CronUpdate,
  CronListParams,
  CronHistoryEntry,
  CronHistoryInput,
  CronHistoryListParams,
  PaginatedResult,
  ProviderDefinition,
  ShedullerStats,
} from "./types";
import { StoresController } from "./stores";
import { getProviderDefinition, listProviderDefinitions } from "./providers";

const MS_ID = "sheduller-ms";

export class ShedullerServiceImpl implements ShedullerService {
  private stores!: StoresController;
  private initPromise?: Promise<void>;

  constructor() {
    this.init();
  }

  async init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      this.stores = new StoresController(MS_ID);
      await this.stores.init();
    })();

    return this.initPromise;
  }

  async createCron(input: CronInput): Promise<{ id: string }> {
    await this.init();
    this.assertInput(input);
    const entry = await this.stores.crons.create(input);
    return { id: entry.id };
  }

  async updateCron(id: string, updates: CronUpdate): Promise<CronEntry | null> {
    await this.init();
    if (!id) {
      throw new Error("id is required");
    }
    const updated = await this.stores.crons.update(id, updates);
    if (!updated) {
      return null;
    }
    return updated;
  }

  async deleteCron(id: string): Promise<boolean> {
    await this.init();
    if (!id) {
      throw new Error("id is required");
    }
    return this.stores.crons.delete(id);
  }

  async getCron(id: string): Promise<CronEntry | null> {
    await this.init();
    if (!id) {
      throw new Error("id is required");
    }
    return this.stores.crons.get(id);
  }

  async listCrons(params: CronListParams): Promise<PaginatedResult<CronEntry>> {
    await this.init();
    return this.stores.crons.list(params);
  }

  listProviders(): Promise<ProviderDefinition[]> {
    return Promise.resolve(listProviderDefinitions());
  }

  async recordHistory(entry: CronHistoryInput): Promise<CronHistoryEntry> {
    await this.init();
    return this.stores.history.record(entry);
  }

  async listHistory(params: CronHistoryListParams): Promise<PaginatedResult<CronHistoryEntry>> {
    await this.init();
    return this.stores.history.list(params);
  }

  async getStats(): Promise<ShedullerStats> {
    await this.init();
    const [crons, activeCrons, pausedCrons, history, dailyRuns] = await Promise.all([
      this.stores.crons.list({ offset: 0, limit: 0 }),
      this.stores.crons.list({ offset: 0, limit: 0, status: "active" }),
      this.stores.crons.list({ offset: 0, limit: 0, status: "paused" }),
      this.stores.history.list({ offset: 0, limit: 0 }),
      this.stores.history.getDailyRuns(30),
    ]);
    return {
      crons: crons.totalCount ?? 0,
      activeCrons: activeCrons.totalCount ?? 0,
      pausedCrons: pausedCrons.totalCount ?? 0,
      history: history.totalCount ?? 0,
      dailyRuns,
    };
  }

  private assertInput(input: CronInput) {
    if (!input?.name || !input?.expression || !input?.provider || !input?.action) {
      const error: any = new Error("name, expression, provider and action are required");
      error.statusCode = 400;
      throw error;
    }

    const provider = getProviderDefinition(input.provider);
    if (!provider) {
      const error: any = new Error(`Unknown provider: ${input.provider}`);
      error.statusCode = 400;
      throw error;
    }

    const action = provider.actions.includes(input.action);
    if (!action) {
      const error: any = new Error(`Unknown action: ${input.action}`);
      error.statusCode = 400;
      throw error;
    }
  }

}

export default ShedullerServiceImpl;
