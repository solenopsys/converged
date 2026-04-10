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

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
}

export type TelemetryStatistic = {
  totalHot: number;
  totalCold: number;
  byDevice: Record<string, number>;
  byParam: Record<string, number>;
};

export interface TelemetryService {
  write(event: TelemetryEventInput): Promise<void>;
  listHot(params: TelemetryQueryParams): Promise<PaginatedResult<TelemetryEvent>>;
  listCold(params: TelemetryQueryParams): Promise<PaginatedResult<TelemetryEvent>>;
  getStatistic(): Promise<TelemetryStatistic>;
}
