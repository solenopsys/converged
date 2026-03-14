import type {
  UsageService,
  UsageEventInput,
  UsageListParams,
  UsageStatsParams,
  UsageEvent,
  UsageDailyStatsItem,
  UsageFunctionStatsItem,
  UsageTotalStats,
  PaginatedResult,
} from "./types";
import { StoresController } from "./stores";

const MS_ID = "usage-ms";

export class UsageServiceImpl implements UsageService {
  private stores!: StoresController;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.init();
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

  async recordUsage(events: UsageEventInput[]): Promise<{ inserted: number }> {
    await this.ensureReady();
    if (!events?.length) {
      return { inserted: 0 };
    }

    for (const event of events) {
      if (!event?.function || !event?.user) {
        const error: any = new Error("function and user are required");
        error.statusCode = 400;
        throw error;
      }
    }

    const inserted = await this.stores.usage.recordUsage(events);
    return { inserted };
  }

  async listUsage(params: UsageListParams): Promise<PaginatedResult<UsageEvent>> {
    await this.ensureReady();
    return this.stores.usage.listUsage(params);
  }

  async getUsageTotal(params?: UsageStatsParams): Promise<UsageTotalStats> {
    await this.ensureReady();
    return this.stores.usage.getUsageTotal(params ?? {});
  }

  async getUsageDaily(params?: UsageStatsParams): Promise<UsageDailyStatsItem[]> {
    await this.ensureReady();
    return this.stores.usage.getUsageDaily(params ?? {});
  }

  async getUsageByFunction(params?: UsageStatsParams): Promise<UsageFunctionStatsItem[]> {
    await this.ensureReady();
    return this.stores.usage.getUsageByFunction(params ?? {});
  }

  private async ensureReady(): Promise<void> {
    await this.initPromise;
  }
}

export default UsageServiceImpl;
