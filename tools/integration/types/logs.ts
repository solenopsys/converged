export type LogEvent = {
  ts: number;
  source: string;
  level: number;
  code: number;
  message: string;
};

export type LogEventInput = {
  ts?: number;
  source: string;
  level: number;
  code: number;
  message: string;
};

export type LogQueryParams = {
  offset: number;
  limit: number;
  source?: string;
  level?: number;
  code?: number;
  from_ts?: number;
  to_ts?: number;
};

export type LogRestoreParams = {
  source?: string;
  level?: number;
  code?: number;
  from_ts?: number;
  to_ts?: number;
  batchSize?: number;
};

export interface PaginatedResult<T> {
  items: T[];
  totalCount?: number;
}

export type LogsStatistic = {
  totalHot: number;
  totalCold: number;
  byLevel: Record<number, number>;
  bySource: Record<string, number>;
  errors: number;
  warnings: number;
};

export interface LogsService {
  write(event: LogEventInput): Promise<void>;
  listHot(params: LogQueryParams): Promise<PaginatedResult<LogEvent>>;
  listCold(params: LogQueryParams): Promise<PaginatedResult<LogEvent>>;
  flushHot(date?: string): Promise<number>;
  flushOldHot(): Promise<number>;
  restoreHot(params?: LogRestoreParams): Promise<number>;
  getStatistic(): Promise<LogsStatistic>;
}
