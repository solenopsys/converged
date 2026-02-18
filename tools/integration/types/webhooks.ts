export type ProviderParam = {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
};

export type ProviderDefinition = {
  code: string;
  title?: string;
  params?: ProviderParam[];
};

export type WebhookEndpoint = {
  id: string;
  name: string;
  provider: string;
  params?: Record<string, any>;
  enabled: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type WebhookEndpointInput = {
  name: string;
  provider: string;
  params?: Record<string, any>;
  enabled?: boolean;
};

export type WebhookEndpointUpdate = {
  name?: string;
  provider?: string;
  params?: Record<string, any>;
  enabled?: boolean;
};

export type WebhookEndpointListParams = {
  offset: number;
  limit: number;
  provider?: string;
  enabled?: boolean;
};

export type WebhookLogEntry = {
  id: number;
  endpointId: string;
  provider: string;
  method: string;
  path: string;
  headers?: Record<string, any>;
  body?: string;
  ip?: string;
  status?: number;
  error?: string;
  createdAt: string;
};

export type WebhookLogListParams = {
  offset: number;
  limit: number;
  endpointId?: string;
  provider?: string;
};

export interface PaginatedResult<T> {
  items: T[];
  totalCount?: number;
}

export interface WebhooksService {
  listProviders(): Promise<ProviderDefinition[]>;
  createEndpoint(input: WebhookEndpointInput): Promise<{ id: string }>;
  updateEndpoint(id: string, updates: WebhookEndpointUpdate): Promise<WebhookEndpoint | null>;
  deleteEndpoint(id: string): Promise<boolean>;
  getEndpoint(id: string): Promise<WebhookEndpoint | null>;
  listEndpoints(params: WebhookEndpointListParams): Promise<PaginatedResult<WebhookEndpoint>>;
  listLogs(params: WebhookLogListParams): Promise<PaginatedResult<WebhookLogEntry>>;
}
