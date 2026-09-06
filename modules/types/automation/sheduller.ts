export type CronStatus = "active" | "paused";

export type ProviderSettings = Record<string, any>;

export type ProviderDefinition = {
  code: string;
  title?: string;
  actions: string[];
};

export type CronEntry = {
  id: string;
  name: string;
  expression: string;
  /**
   * Bus topic emitted when the expression elapses. Defaults to
   * `cron.<name>`. The schedule is a source of events now: what should happen
   * is decided by whoever subscribed, not by this row.
   */
  topic?: string;
  /** IANA zone the expression is read in. Defaults to the cluster's own. */
  timezone?: string;
  provider: string;
  action: string;
  params?: Record<string, any>;
  providerSettings?: ProviderSettings;
  status: CronStatus;
  createdAt: string;
  updatedAt?: string;
};

export type CronInput = {
  name: string;
  expression: string;
  topic?: string;
  timezone?: string;
  provider: string;
  action: string;
  params?: Record<string, any>;
  providerSettings?: ProviderSettings;
  status?: CronStatus;
};

export type CronUpdate = {
  name?: string;
  expression?: string;
  topic?: string;
  timezone?: string;
  provider?: string;
  action?: string;
  params?: Record<string, any>;
  providerSettings?: ProviderSettings;
  status?: CronStatus;
};

export type CronListParams = {
  offset: number;
  limit: number;
  status?: CronStatus;
  filter?: FilterObject;
};

export type FilterObject = Record<string, unknown>;
export type SelectionFieldDescriptor = { id: string; label: string; valueType: "string" | "number" | "boolean" | "date" | "enum"; operators: string[] };
export type SelectionDescriptor = { objectType: string; title: string; fields: SelectionFieldDescriptor[]; filterExample?: FilterObject; revision?: string };
export type SelectionStats = { totalCount: number };

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
}

export type CronHistoryEntry = {
  id: string;
  cronId: string;
  cronName: string;
  provider: string;
  action: string;
  firedAt: string;
  success: boolean;
  message?: string;
};

export type CronHistoryInput = {
  cronId: string;
  cronName: string;
  provider: string;
  action: string;
  success: boolean;
  message?: string;
};

export type CronHistoryListParams = {
  offset: number;
  limit: number;
  cronId?: string;
  filter?: FilterObject;
};

export type ShedullerStats = {
  crons: number;
  activeCrons: number;
  pausedCrons: number;
  history: number;
  dailyRuns: ShedullerDailyRun[];
};

export type ShedullerDailyRun = {
  date: string;
  total: number;
  success: number;
  failed: number;
};

/**
 * One schedule entry, already reduced to numbers.
 *
 * Cron expressions, time zones and DST are interpreted here, where a real cron
 * library lives; what leaves this service is a list of absolute instants. The
 * ticker that fires them needs no calendar at all.
 */
export type ScheduledTopic = {
  cronId: string;
  name: string;
  topic: string;
  payload?: Record<string, unknown>;
  /** Epoch milliseconds, ascending, inside the requested window. */
  occurrences: number[];
};

export type SchedulePlan = {
  items: ScheduledTopic[];
  /** Window this plan covers, from the moment it was computed. */
  horizonMs: number;
};

export interface ShedullerService {
  /**
   * Every occurrence due in the next `horizonMs`. Called by the ticker on a
   * cycle shorter than the window, so a missed poll is caught by the next one.
   */
  schedule(params: { horizonMs?: number }): Promise<SchedulePlan>;
  createCron(input: CronInput): Promise<{ id: string }>;
  updateCron(id: string, updates: CronUpdate): Promise<CronEntry | null>;
  deleteCron(id: string): Promise<boolean>;
  getCron(id: string): Promise<CronEntry | null>;
  listCrons(params: CronListParams): Promise<PaginatedResult<CronEntry>>;
  recordHistory(entry: CronHistoryInput): Promise<CronHistoryEntry>;
  listProviders(): Promise<ProviderDefinition[]>;
  listHistory(
    params: CronHistoryListParams,
  ): Promise<PaginatedResult<CronHistoryEntry>>;
  getStats(): Promise<ShedullerStats>;
  describeSelection(objectType: string): Promise<SelectionDescriptor>;
  inspectCrons(filter?: FilterObject): Promise<SelectionStats>;
  inspectHistory(filter?: FilterObject): Promise<SelectionStats>;
}
