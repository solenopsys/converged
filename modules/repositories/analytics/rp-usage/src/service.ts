import { Access, getCurrentWorkspaceContext, isServiceActor } from "nrpc";
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
  UsageBySolutionItem,
  UsageBySolutionParams,
  UsageSolutionLink,
  PaginatedResult,
  SelectionDescriptor,
  SelectionStats,
} from "./types";
import { StoresController } from "./stores";

const REPOSITORY_ID = "rp-usage";

/** Who is calling, from the verified token and from nothing else. */
function requireActor(): string {
  const actor = getCurrentWorkspaceContext()?.user?.trim();
  if (!actor) {
    const error: any = new Error("Authenticated caller is required");
    error.statusCode = 401;
    throw error;
  }
  return actor;
}

/**
 * Whose call an event records.
 *
 * `user` arrives in the payload, so from a person it is a claim and nothing
 * more — believing it lets anybody file activity against a colleague, and this
 * log is what "is the solution used, and by how many people" is read from. A
 * service is believed, because a writer records the call it just carried on
 * somebody's behalf; naming nobody makes the event its own.
 */
function authorFor(claimed: string | undefined): string {
  const actor = requireActor();
  if (!isServiceActor()) return actor;
  return claimed?.trim() || actor;
}

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

  // Writing is `internal`: a usage event is a side effect of a call that
  // already happened, recorded by whatever carried it. A browser that can post
  // events directly can inflate the number a solution is judged by, and it has
  // no reason to — the surface it is using is itself the thing being counted.
  @Access("internal")
  async recordUsage(events: UsageEventInput[]): Promise<{ inserted: number }> {
    await this.ensureReady();
    if (!events?.length) {
      return { inserted: 0 };
    }

    const resolved = events.map((event) => {
      if (!event?.function) {
        const error: any = new Error("function is required");
        error.statusCode = 400;
        throw error;
      }
      return { ...event, user: authorFor(event.user) };
    });

    const inserted = await this.stores.usage.recordUsage(resolved);
    return { inserted };
  }

  @Access("user")
  async listUsage(params: UsageListParams): Promise<PaginatedResult<UsageEvent>> {
    await this.ensureReady();
    return this.stores.usage.listUsage(params);
  }

  @Access("user")
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

  @Access("user")
  async inspectUsage(filter?: Record<string, unknown>): Promise<SelectionStats> {
    await this.ensureReady();
    return { totalCount: await this.stores.usage.countUsage(filter) };
  }

  @Access("user")
  async getUsageTotal(params?: UsageStatsParams): Promise<UsageTotalStats> {
    await this.ensureReady();
    return this.stores.usage.getUsageTotal(params ?? {});
  }

  @Access("user")
  async getUsageDaily(params?: UsageStatsParams): Promise<UsageDailyStatsItem[]> {
    await this.ensureReady();
    return this.stores.usage.getUsageDaily(params ?? {});
  }

	@Access("user")
	async getUsageByFunction(params?: UsageStatsParams): Promise<UsageFunctionStatsItem[]> {
    await this.ensureReady();
    return this.stores.usage.getUsageByFunction(params ?? {});
	}

	@Access("user")
	async getStatistic(_keys?: UsageStatisticKey[]): Promise<UsageStatistic> {
		await this.ensureReady();
		const [total, daily, functions] = await Promise.all([
			this.stores.usage.getUsageTotal({}),
			this.stores.usage.getUsageDaily({}),
			this.stores.usage.getUsageByFunction({}),
		]);
		return { total: total.total, daily, functions: functions.length };
	}

  // Linking is `internal` for the same reason writing is: the links are laid
  // down by whatever installs a solution, and a person who can edit them can
  // move another solution's calls under their own name.
  @Access("internal")
  async linkFunctions(solution: string, functions: string[]): Promise<{ linked: number }> {
    await this.ensureReady();
    const name = solution?.trim();
    if (!name) {
      const error: any = new Error("solution is required");
      error.statusCode = 400;
      throw error;
    }
    return { linked: await this.stores.usage.linkFunctions(name, functions ?? []) };
  }

  @Access("internal")
  async unlinkFunction(solution: string, func: string): Promise<boolean> {
    await this.ensureReady();
    return this.stores.usage.unlinkFunction(solution, func);
  }

  @Access("user")
  async listSolutionFunctions(solution?: string): Promise<UsageSolutionLink[]> {
    await this.ensureReady();
    return this.stores.usage.listSolutionFunctions(solution);
  }

  @Access("user")
  async getUsageBySolution(params?: UsageBySolutionParams): Promise<UsageBySolutionItem[]> {
    await this.ensureReady();
    return this.stores.usage.getUsageBySolution(params ?? {});
  }

  private async ensureReady(): Promise<void> {
    await this.initPromise;
  }
}

export default UsageServiceImpl;
