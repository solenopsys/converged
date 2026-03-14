import type {
  TelemetryService,
  TelemetryEvent,
  TelemetryEventInput,
  TelemetryQueryParams,
  TelemetryStatistic,
  PaginatedResult,
} from "./types";
import { StoresController } from "./stores";

const MS_ID = "telemetry-ms";

export class TelemetryServiceImpl implements TelemetryService {
  stores!: StoresController;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.init();
  }

  async init() {
    this.stores = new StoresController(MS_ID);
    await this.stores.init();
  }

  async write(event: TelemetryEventInput): Promise<void> {
    await this.ensureReady();
    const ts = event.ts ?? Date.now();
    const unit = event.unit ?? "";
    await this.stores.hot.insert([{ ...event, ts, unit }]);
  }

  async listHot(params: TelemetryQueryParams): Promise<PaginatedResult<TelemetryEvent>> {
    await this.ensureReady();
    return this.stores.hot.list(params);
  }

  async listCold(params: TelemetryQueryParams): Promise<PaginatedResult<TelemetryEvent>> {
    await this.ensureReady();
    return this.stores.cold.list(params);
  }

  async getStatistic(): Promise<TelemetryStatistic> {
    await this.ensureReady();
    const [hotStats, coldStats] = await Promise.all([
      this.stores.hot.getStatistic(),
      this.stores.cold.getStatistic(),
    ]);
    const mergeByKey = (a: Record<string, number>, b: Record<string, number>) => {
      const result = { ...a };
      for (const [k, v] of Object.entries(b)) result[k] = (result[k] ?? 0) + v;
      return result;
    };
    return {
      totalHot: hotStats.total,
      totalCold: coldStats.total,
      byDevice: mergeByKey(hotStats.byDevice, coldStats.byDevice),
      byParam: mergeByKey(hotStats.byParam, coldStats.byParam),
    };
  }

  private async ensureReady(): Promise<void> {
    await this.initPromise;
  }
}
