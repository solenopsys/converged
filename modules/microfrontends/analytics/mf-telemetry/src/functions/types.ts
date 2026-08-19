export interface PaginationParams {
  offset: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount?: number;
}

export interface TelemetryEvent {
  ts: number;
  device_id: string;
  param: string;
  value: number;
  unit: string;
}
