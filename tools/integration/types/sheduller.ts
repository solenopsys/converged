export type CronStatus = "active" | "paused";

export type ProviderSettings = Record<string, any>;

export type ProviderParam = {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
};

export type ProviderActionDefinition = {
  name: string;
  description?: string;
  params?: ProviderParam[];
};

export type ProviderDefinition = {
  code: string;
  title?: string;
  settings?: ProviderParam[];
  actions: ProviderActionDefinition[];
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

export interface ShedullerService {
  createCron(input: CronInput): Promise<{ id: string }>;
  updateCron(id: string, updates: CronUpdate): Promise<CronEntry | null>;
  deleteCron(id: string): Promise<boolean>;
  getCron(id: string): Promise<CronEntry | null>;
  listCrons(params: CronListParams): Promise<PaginatedResult<CronEntry>>;
  listProviders(): Promise<ProviderDefinition[]>;
}
