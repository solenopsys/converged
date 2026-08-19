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
const DEFAULT_ARCHIVE_BATCH_SIZE = 5_000;
const DEFAULT_HOT_BUFFER_SIZE = 5_000;

export class TelemetryServiceImpl implements TelemetryService {
  stores!: StoresController;
  private initPromise: Promise<void>;
  private archiveInProgress = false;
  private readonly archiveBatchSize: number;
  private readonly hotBufferSize: number;

  constructor(config?: { archiveBatchSize?: number; hotBufferSize?: number }) {
    this.archiveBatchSize = this.resolvePositiveNumber(
      config?.archiveBatchSize ?? process.env.TELEMETRY_ARCHIVE_BATCH_SIZE,
      DEFAULT_ARCHIVE_BATCH_SIZE,
    );
    this.hotBufferSize = this.resolvePositiveNumber(
      config?.hotBufferSize ?? process.env.TELEMETRY_HOT_BUFFER_SIZE,
      DEFAULT_HOT_BUFFER_SIZE,
    );
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

  async archiveHotToCold(): Promise<number> {
    await this.ensureReady();
    if (this.archiveInProgress) {
      return 0;
    }

    this.archiveInProgress = true;
    try {
      let total = 0;
      while (true) {
        const moved = await this.stores.hot.moveOldestBeyondLimitTo(
          this.stores.cold,
          this.hotBufferSize,
          this.archiveBatchSize,
        );
        total += moved;
        if (moved < this.archiveBatchSize) {
          break;
        }
      }
      return total;
    } finally {
      this.archiveInProgress = false;
    }
  }

  async destroy(): Promise<void> {
    await this.stores?.destroy();
  }

  private async ensureReady(): Promise<void> {
    await this.initPromise;
  }

  private resolvePositiveNumber(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  }
}
