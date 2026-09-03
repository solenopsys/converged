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

export type FilterObject = Record<string, unknown>;

export type SelectionFieldDescriptor = {
  id: string;
  label: string;
  valueType: "string" | "number" | "boolean" | "date" | "enum";
  operators: string[];
};

export type SelectionDescriptor = {
  objectType: string;
  title: string;
  fields: SelectionFieldDescriptor[];
  filterExample?: FilterObject;
  revision?: string;
};

export type SelectionStats = { totalCount: number };

export type UsageListParams = {
  offset: number;
  limit: number;
  function?: string;
  user?: string;
  dateFrom?: string;
  dateTo?: string;
  filter?: FilterObject;
};

export type UsageStatsParams = {
  function?: string;
  user?: string;
  dateFrom?: string;
  dateTo?: string;
  filter?: FilterObject;
};

export type UsageTotalStats = {
  total: number;
};

export type UsageDailyStatsItem = {
  date: string;
  total: number;
};

export type UsageFunctionStatsItem = {
  function: string;
  total: number;
};

export type UsageStatistic = {
	total: number;
	daily: UsageDailyStatsItem[];
	functions: number;
};

export type UsageStatisticKey = "title";

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
}

export interface UsageService {
  recordUsage(events: UsageEventInput[]): Promise<{ inserted: number }>;
  listUsage(params: UsageListParams): Promise<PaginatedResult<UsageEvent>>;
  describeSelection(objectType: string): Promise<SelectionDescriptor>;
  inspectUsage(filter?: FilterObject): Promise<SelectionStats>;
  getUsageTotal(params?: UsageStatsParams): Promise<UsageTotalStats>;
  getUsageDaily(params?: UsageStatsParams): Promise<UsageDailyStatsItem[]>;
	getUsageByFunction(params?: UsageStatsParams): Promise<UsageFunctionStatsItem[]>;
	getStatistic(keys?: UsageStatisticKey[]): Promise<UsageStatistic>;
}
