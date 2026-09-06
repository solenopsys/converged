export type ProviderParam = {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
};

/**
 * How a delivery proves it came from the configured producer. The endpoint is
 * public ingress — anyone can reach the URL — so this is the only thing between
 * the bus and the open internet.
 *
 * `secret`: a shared token in `X-Webhook-Token` (or `Authorization: Bearer`).
 * `hmac`: `X-Webhook-Signature: sha256=<hex>` over the raw body, which also
 *   survives a proxy that re-encodes headers and cannot be replayed against a
 *   different body.
 */
export type WebhookVerification = "none" | "secret" | "hmac";

export type ProviderDefinition = {
  code: string;
  title?: string;
  params?: ProviderParam[];
  /** What a new endpoint of this provider defaults to. */
  verify?: WebhookVerification;
};

export type WebhookEndpoint = {
  id: string;
  /** Last path segment of the public URL: `/webhooks/<slug>`. */
  slug: string;
  name: string;
  provider: string;
  /** Topic published on arrival. Defaults to `webhook.<provider>.<slug>`. */
  topic?: string;
  verify: WebhookVerification;
  params?: Record<string, any>;
  enabled: boolean;
  createdAt: string;
  updatedAt?: string;
};

/**
 * What the UI gateway needs to accept one delivery, and nothing more. Kept
 * separate from `WebhookEndpoint` because it carries the secret: it answers an
 * internal caller only, and the console never asks for it.
 */
export type WebhookResolution = {
  id: string;
  slug: string;
  provider: string;
  topic: string;
  verify: WebhookVerification;
  secret?: string;
  enabled: boolean;
};

/** One delivery, as the gateway saw it. */
export type WebhookDelivery = {
  endpointId: string;
  provider: string;
  method: string;
  path: string;
  headers?: Record<string, any>;
  body?: string;
  ip?: string;
  status?: number;
  error?: string;
};

export type WebhookEndpointInput = {
  name: string;
  provider: string;
  /** Generated from the name when omitted. */
  slug?: string;
  topic?: string;
  verify?: WebhookVerification;
  params?: Record<string, any>;
  enabled?: boolean;
};

export type WebhookEndpointUpdate = {
  name?: string;
  provider?: string;
  slug?: string;
  topic?: string;
  verify?: WebhookVerification;
  params?: Record<string, any>;
  enabled?: boolean;
};

export type WebhookEndpointListParams = {
  offset: number;
  limit: number;
  provider?: string;
  enabled?: boolean;
  filter?: FilterObject;
};

export type FilterObject = Record<string, unknown>;
export type SelectionFieldDescriptor = { id: string; label: string; valueType: "string" | "number" | "boolean" | "date" | "enum"; operators: string[] };
export type SelectionDescriptor = { objectType: string; title: string; fields: SelectionFieldDescriptor[]; filterExample?: FilterObject; revision?: string };
export type SelectionStats = { totalCount: number };

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
  filter?: FilterObject;
};

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
}

export interface WebhooksService {
  listProviders(): Promise<ProviderDefinition[]>;
  /** Public-URL lookup for the UI gateway. Returns null for an unknown slug. */
  resolveEndpoint(slug: string): Promise<WebhookResolution | null>;
  /** Records one delivery attempt, accepted or refused. */
  recordDelivery(delivery: WebhookDelivery): Promise<void>;
  createEndpoint(input: WebhookEndpointInput): Promise<{ id: string }>;
  updateEndpoint(id: string, updates: WebhookEndpointUpdate): Promise<WebhookEndpoint | null>;
  deleteEndpoint(id: string): Promise<boolean>;
  getEndpoint(id: string): Promise<WebhookEndpoint | null>;
  listEndpoints(params: WebhookEndpointListParams): Promise<PaginatedResult<WebhookEndpoint>>;
  listLogs(params: WebhookLogListParams): Promise<PaginatedResult<WebhookLogEntry>>;
  describeSelection(objectType: string): Promise<SelectionDescriptor>;
  inspectEndpoints(filter?: FilterObject): Promise<SelectionStats>;
  inspectLogs(filter?: FilterObject): Promise<SelectionStats>;
}
