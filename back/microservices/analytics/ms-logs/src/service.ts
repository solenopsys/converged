import type {
  LogsService,
  LogEvent,
  LogEventInput,
  LogQueryParams,
  LogsStatistic,
  PaginatedResult,
} from "./types";
import { StoresController } from "./stores";

const MS_ID = "logs-ms";

export class LogsServiceImpl implements LogsService {
  stores!: StoresController;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.init();
  }

  async init() {
    this.stores = new StoresController(MS_ID);
    await this.stores.init();
  }

  async write(event: LogEventInput): Promise<void> {
    await this.ensureReady();
    const ts = event.ts ?? Date.now();
    await this.stores.hot.insert([{ ...event, ts }]);
  }

  async listHot(params: LogQueryParams): Promise<PaginatedResult<LogEvent>> {
    await this.ensureReady();
    return this.stores.hot.list(params);
  }

  async listCold(params: LogQueryParams): Promise<PaginatedResult<LogEvent>> {
    await this.ensureReady();
    return this.stores.cold.list(params);
  }

  async getStatistic(): Promise<LogsStatistic> {
    await this.ensureReady();
    const [hotStats, coldStats] = await Promise.all([
      this.stores.hot.getStatistic(),
      this.stores.cold.getStatistic(),
    ]);
    const mergeByKey = (a: Record<any, number>, b: Record<any, number>) => {
      const result = { ...a };
      for (const [k, v] of Object.entries(b)) result[k] = (result[k] ?? 0) + v;
      return result;
    };
    return {
      totalHot: hotStats.total,
      totalCold: coldStats.total,
      byLevel: mergeByKey(hotStats.byLevel, coldStats.byLevel),
      bySource: mergeByKey(hotStats.bySource, coldStats.bySource),
      errors: hotStats.errors + coldStats.errors,
      warnings: hotStats.warnings + coldStats.warnings,
    };
  }

  private async ensureReady(): Promise<void> {
    await this.initPromise;
  }
}
