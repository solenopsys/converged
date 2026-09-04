import type {
  UsageService,
  UsageEventInput,
  UsageListParams,
  UsageStatsParams,
  UsageEvent,
  UsageDailyStatsItem,
  UsageFunctionStatsItem,
	UsageTotalStats,
	UsageStatistic,
	UsageStatisticKey,
  PaginatedResult,
  SelectionDescriptor,
  SelectionStats,
} from "./types";
import { StoresController } from "./stores";

const REPOSITORY_ID = "rp-usage";

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
      this.stores = new StoresController(REPOSITORY_ID);
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

  async describeSelection(objectType: string): Promise<SelectionDescriptor> {
    if (objectType !== "usage.record") {
      throw new Error(`Unsupported usage selection object: ${objectType}`);
    }
    return {
      objectType,
      title: "Usage events",
      fields: [
        { id: "function", label: "Function", valueType: "string", operators: ["eq", "in", "contains"] },
        { id: "user", label: "User", valueType: "string", operators: ["eq", "in", "contains"] },
        { id: "date", label: "Date", valueType: "date", operators: ["eq", "gt", "gte", "lt", "lte", "between"] },
      ],
      filterExample: { function: { contains: "select" } },
      revision: "usage-v1",
    };
  }

  async inspectUsage(filter?: Record<string, unknown>): Promise<SelectionStats> {
    await this.ensureReady();
    return { totalCount: await this.stores.usage.countUsage(filter) };
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

	async getStatistic(_keys?: UsageStatisticKey[]): Promise<UsageStatistic> {
		await this.ensureReady();
		const [total, daily, functions] = await Promise.all([
			this.stores.usage.getUsageTotal({}),
			this.stores.usage.getUsageDaily({}),
			this.stores.usage.getUsageByFunction({}),
		]);
		return { total: total.total, daily, functions: functions.length };
	}

  private async ensureReady(): Promise<void> {
    await this.initPromise;
  }
}

export default UsageServiceImpl;
