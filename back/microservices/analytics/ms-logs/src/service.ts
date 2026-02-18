import type {
  LogsService,
  LogEvent,
  LogEventInput,
  LogQueryParams,
  LogRestoreParams,
  LogsStatistic,
  PaginatedResult,
} from "./types";
import { StoresController } from "./stores";
import { DATA_DIR } from "back-core";

const MS_ID = "logs-ms";

export class LogsServiceImpl implements LogsService {
  stores: StoresController;

  constructor(config: { dbPath?: string } = {}) {
    this.init(config);
  }

  async init(config: { dbPath?: string }) {
    const baseDir = config.dbPath ?? DATA_DIR;
    this.stores = new StoresController(MS_ID, baseDir);
    await this.stores.init();
  }

  write(event: LogEventInput): Promise<void> {
    return this.stores.hot.write(event);
  }

  listHot(params: LogQueryParams): Promise<PaginatedResult<LogEvent>> {
    return this.stores.hot.list(params);
  }

  listCold(params: LogQueryParams): Promise<PaginatedResult<LogEvent>> {
    return this.stores.cold.list(params);
  }

  flushHot(date?: string): Promise<number> {
    return this.stores.hot.flushToCold(this.stores.cold, date);
  }

  flushOldHot(): Promise<number> {
    return this.stores.hot.flushOldToCold(this.stores.cold);
  }

  restoreHot(params?: LogRestoreParams): Promise<number> {
    return this.stores.hot.restoreFromCold(this.stores.cold, params);
  }

  async getStatistic(): Promise<LogsStatistic> {
    const [hotStats, coldCount] = await Promise.all([
      this.stores.hot.getStatistic(),
      this.stores.cold.count(),
    ]);

    return {
      totalHot: hotStats.total,
      totalCold: coldCount,
      byLevel: hotStats.byLevel,
      bySource: hotStats.bySource,
      errors: hotStats.errors,
      warnings: hotStats.warnings,
    };
  }
}
