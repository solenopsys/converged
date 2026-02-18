import type {
  UsageService,
  UsageEventInput,
  UsageListParams,
  UsageStatsParams,
  UsageEvent,
  UsageDailyStatsItem,
  UsageTotalStats,
  PaginatedResult,
} from "./types";
import { StoresController } from "./stores";

const MS_ID = "usage-ms";

export class UsageServiceImpl implements UsageService {
  private stores!: StoresController;

  constructor() {
    this.init();
  }

  async init() {
    this.stores = new StoresController(MS_ID);
    await this.stores.init();
  }

  async recordUsage(events: UsageEventInput[]): Promise<{ inserted: number }> {
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

  listUsage(params: UsageListParams): Promise<PaginatedResult<UsageEvent>> {
    return this.stores.usage.listUsage(params);
  }

  getUsageTotal(params?: UsageStatsParams): Promise<UsageTotalStats> {
    return this.stores.usage.getUsageTotal(params ?? {});
  }

  getUsageDaily(params?: UsageStatsParams): Promise<UsageDailyStatsItem[]> {
    return this.stores.usage.getUsageDaily(params ?? {});
  }
}

export default UsageServiceImpl;
