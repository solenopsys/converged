export type TelemetryEvent = {
  ts: number;
  device_id: string;
  param: string;
  value: number;
  unit: string;
};

export type TelemetryEventInput = {
  ts?: number;
  device_id: string;
  param: string;
  value: number;
  unit?: string;
};

export type TelemetryQueryParams = {
  offset: number;
  limit: number;
  device_id?: string;
  param?: string;
  from_ts?: number;
  to_ts?: number;
};

export type TelemetryRestoreParams = {
  device_id?: string;
  param?: string;
  from_ts?: number;
  to_ts?: number;
  batchSize?: number;
};

export interface PaginatedResult<T> {
  items: T[];
  totalCount?: number;
}

export interface TelemetryService {
  write(event: TelemetryEventInput): Promise<void>;
  listHot(
    params: TelemetryQueryParams,
  ): Promise<PaginatedResult<TelemetryEvent>>;
  listCold(
    params: TelemetryQueryParams,
  ): Promise<PaginatedResult<TelemetryEvent>>;
  flushHot(date?: string): Promise<number>;
  flushOldHot(): Promise<number>;
  restoreHot(params?: TelemetryRestoreParams): Promise<number>;
}
