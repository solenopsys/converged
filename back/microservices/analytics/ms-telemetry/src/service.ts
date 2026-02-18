import type {
  TelemetryService,
  TelemetryEvent,
  TelemetryEventInput,
  TelemetryQueryParams,
  TelemetryRestoreParams,
  PaginatedResult,
} from "./types";
import { StoresController } from "./stores";
import { DATA_DIR } from "back-core";

const MS_ID = "telemetry-ms";

export class TelemetryServiceImpl implements TelemetryService {
  stores: StoresController;

  constructor(config: { dbPath?: string } = {}) {
    this.init(config);
  }

  async init(config: { dbPath?: string }) {
    const baseDir = config.dbPath ?? DATA_DIR;
    this.stores = new StoresController(MS_ID, baseDir);
    await this.stores.init();
  }

  write(event: TelemetryEventInput): Promise<void> {
    return this.stores.hot.write(event);
  }

  listHot(
    params: TelemetryQueryParams,
  ): Promise<PaginatedResult<TelemetryEvent>> {
    return this.stores.hot.list(params);
  }

  listCold(
    params: TelemetryQueryParams,
  ): Promise<PaginatedResult<TelemetryEvent>> {
    return this.stores.cold.list(params);
  }

  flushHot(date?: string): Promise<number> {
    return this.stores.hot.flushToCold(this.stores.cold, date);
  }

  flushOldHot(): Promise<number> {
    return this.stores.hot.flushOldToCold(this.stores.cold);
  }

  restoreHot(params?: TelemetryRestoreParams): Promise<number> {
    return this.stores.hot.restoreFromCold(this.stores.cold, params);
  }
}
