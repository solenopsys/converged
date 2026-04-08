import { CronEngine } from "converged-runtime/engines/cron";
import type {
  ShedullerService,
  CronEntry,
  CronInput,
  CronUpdate,
  CronListParams,
  CronHistoryEntry,
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
  private engine!: CronEngine;

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
      this.engine = new CronEngine((record) => {
        void this.stores.history.record(record);
      });
      this.rescheduleActive();
    })();

    return this.initPromise;
  }

  createCron(input: CronInput): Promise<{ id: string }> {
    this.assertInput(input);
    const entry = this.stores.crons.create(input);
    this.syncJob(entry);
    return Promise.resolve({ id: entry.id });
  }

  updateCron(id: string, updates: CronUpdate): Promise<CronEntry | null> {
    if (!id) {
      throw new Error("id is required");
    }
    const updated = this.stores.crons.update(id, updates);
    if (!updated) {
      return Promise.resolve(null);
    }
    this.syncJob(updated);
    return Promise.resolve(updated);
  }

  deleteCron(id: string): Promise<boolean> {
    if (!id) {
      throw new Error("id is required");
    }
    const removed = this.stores.crons.delete(id);
    if (removed) {
      this.engine.unschedule(id);
    }
    return Promise.resolve(removed);
  }

  getCron(id: string): Promise<CronEntry | null> {
    if (!id) {
      throw new Error("id is required");
    }
    return Promise.resolve(this.stores.crons.get(id));
  }

  listCrons(params: CronListParams): Promise<PaginatedResult<CronEntry>> {
    return Promise.resolve(this.stores.crons.list(params));
  }

  listProviders(): Promise<ProviderDefinition[]> {
    return Promise.resolve(listProviderDefinitions());
  }

  async listHistory(params: CronHistoryListParams): Promise<PaginatedResult<CronHistoryEntry>> {
    return this.stores.history.list(params);
  }

  async getStats(): Promise<ShedullerStats> {
    const [crons, activeCrons, pausedCrons, history, dailyRuns] = await Promise.all([
      Promise.resolve(this.stores.crons.list({ offset: 0, limit: 0 })),
      Promise.resolve(this.stores.crons.list({ offset: 0, limit: 0, status: "active" })),
      Promise.resolve(this.stores.crons.list({ offset: 0, limit: 0, status: "paused" })),
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

  private syncJob(entry: CronEntry) {
    if (entry.status === "active") {
      this.engine.schedule(entry);
    } else {
      this.engine.unschedule(entry.id);
    }
  }

  private rescheduleActive() {
    const list = this.stores.crons.list({ offset: 0, limit: 10000 });
    this.engine.rescheduleAll(list.items);
  }
}

export default ShedullerServiceImpl;
