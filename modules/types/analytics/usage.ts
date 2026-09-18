/**
 * `user` is a claim, not a fact: from a person it is ignored in favour of the
 * token's subject, because an event whose author is chosen by the caller can be
 * filed against anybody. Only a service is believed — a writer legitimately
 * records the call it just carried for somebody else.
 */
export type UsageEventInput = {
  function: string;
  user?: string;
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

/**
 * A solution declares which functions mean "this solution was used". One
 * function may belong to several solutions, so the pair is the key and neither
 * side is unique on its own.
 *
 * Counters live here and the catalogue lives in `rp-registry`: this repository
 * never learns what a solution is, it only groups functions under a name.
 */
export type UsageSolutionLink = {
  solution: string;
  function: string;
};

export type UsageBySolutionParams = {
  solution?: string;
  dateFrom?: string;
  dateTo?: string;
};

/**
 * What a solution was used for over a period. A solution with `total: 0` was
 * not used — which is the answer to "is this solution worth what is paid for
 * it", and the reason `lastUsedAt` is here rather than derived in the surface.
 */
export type UsageBySolutionItem = {
  solution: string;
  total: number;
  users: number;
  lastUsedAt?: string;
};

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
  linkFunctions(solution: string, functions: string[]): Promise<{ linked: number }>;
  unlinkFunction(solution: string, func: string): Promise<boolean>;
  listSolutionFunctions(solution?: string): Promise<UsageSolutionLink[]>;
  getUsageBySolution(params?: UsageBySolutionParams): Promise<UsageBySolutionItem[]>;
}
