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
  provider: string;
  action: string;
  params?: Record<string, any>;
  providerSettings?: ProviderSettings;
  status?: CronStatus;
};

export type CronUpdate = {
  name?: string;
  expression?: string;
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
};

export interface PaginatedResult<T> {
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
  message?: string;
};

export type CronHistoryListParams = {
  offset: number;
  limit: number;
  cronId?: string;
};

export type ShedullerStats = {
  crons: number;
  history: number;
};

export interface ShedullerService {
  createCron(input: CronInput): Promise<{ id: string }>;
  updateCron(id: string, updates: CronUpdate): Promise<CronEntry | null>;
  deleteCron(id: string): Promise<boolean>;
  getCron(id: string): Promise<CronEntry | null>;
  listCrons(params: CronListParams): Promise<PaginatedResult<CronEntry>>;
  listProviders(): Promise<ProviderDefinition[]>;
  listHistory(params: CronHistoryListParams): Promise<PaginatedResult<CronHistoryEntry>>;
  getStats(): Promise<ShedullerStats>;
}
