export type UsageEventInput = {
  function: string;
  user: string;
  date?: string;
};

export type UsageEvent = {
  id: string;
  function: string;
  user: string;
  date: string;
  createdAt?: string;
};

export type UsageListParams = {
  offset: number;
  limit: number;
  function?: string;
  user?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type UsageStatsParams = {
  function?: string;
  user?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type UsageTotalStats = {
  total: number;
};

export type UsageDailyStatsItem = {
  date: string;
  total: number;
};

export interface PaginatedResult<T> {
  items: T[];
  totalCount?: number;
}

export interface UsageService {
  recordUsage(events: UsageEventInput[]): Promise<{ inserted: number }>;
  listUsage(params: UsageListParams): Promise<PaginatedResult<UsageEvent>>;
  getUsageTotal(params?: UsageStatsParams): Promise<UsageTotalStats>;
  getUsageDaily(params?: UsageStatsParams): Promise<UsageDailyStatsItem[]>;
}
