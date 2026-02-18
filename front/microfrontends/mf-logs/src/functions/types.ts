export interface PaginationParams {
  offset: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount?: number;
}

export interface LogEvent {
  ts: number;
  source: string;
  level: number;
  code: number;
  message: string;
}
