// Auto-generated package
import { createHttpClient } from "nrpc";

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

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
};

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

export const metadata = {
  "interfaceName": "ShedullerService",
  "serviceName": "sheduller",
  "filePath": "services/automation/sheduller.ts",
  "methods": [
    {
      "name": "createCron",
      "parameters": [
        {
          "name": "input",
          "type": "CronInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "updateCron",
      "parameters": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "updates",
          "type": "CronUpdate",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "CronEntry | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "deleteCron",
      "parameters": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "boolean",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getCron",
      "parameters": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "CronEntry | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listCrons",
      "parameters": [
        {
          "name": "params",
          "type": "CronListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<CronEntry>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "recordHistory",
      "parameters": [
        {
          "name": "entry",
          "type": "CronHistoryInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "CronHistoryEntry",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listProviders",
      "parameters": [],
      "returnType": "ProviderDefinition",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "listHistory",
      "parameters": [
        {
          "name": "params",
          "type": "CronHistoryListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<CronHistoryEntry>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getStats",
      "parameters": [],
      "returnType": "ShedullerStats",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "CronStatus",
      "kind": "type",
      "definition": "\"active\" | \"paused\""
    },
    {
      "name": "ProviderSettings",
      "kind": "type",
      "definition": "Record<string, any>"
    },
    {
      "name": "ProviderDefinition",
      "kind": "type",
      "definition": "{\n  code: string;\n  title?: string;\n  actions: string[];\n}"
    },
    {
      "name": "CronEntry",
      "kind": "type",
      "definition": "{\n  id: string;\n  name: string;\n  expression: string;\n  provider: string;\n  action: string;\n  params?: Record<string, any>;\n  providerSettings?: ProviderSettings;\n  status: CronStatus;\n  createdAt: string;\n  updatedAt?: string;\n}"
    },
    {
      "name": "CronInput",
      "kind": "type",
      "definition": "{\n  name: string;\n  expression: string;\n  provider: string;\n  action: string;\n  params?: Record<string, any>;\n  providerSettings?: ProviderSettings;\n  status?: CronStatus;\n}"
    },
    {
      "name": "CronUpdate",
      "kind": "type",
      "definition": "{\n  name?: string;\n  expression?: string;\n  provider?: string;\n  action?: string;\n  params?: Record<string, any>;\n  providerSettings?: ProviderSettings;\n  status?: CronStatus;\n}"
    },
    {
      "name": "CronListParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n  status?: CronStatus;\n}"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    },
    {
      "name": "CronHistoryEntry",
      "kind": "type",
      "definition": "{\n  id: string;\n  cronId: string;\n  cronName: string;\n  provider: string;\n  action: string;\n  firedAt: string;\n  success: boolean;\n  message?: string;\n}"
    },
    {
      "name": "CronHistoryInput",
      "kind": "type",
      "definition": "{\n  cronId: string;\n  cronName: string;\n  provider: string;\n  action: string;\n  success: boolean;\n  message?: string;\n}"
    },
    {
      "name": "CronHistoryListParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n  cronId?: string;\n}"
    },
    {
      "name": "ShedullerStats",
      "kind": "type",
      "definition": "{\n  crons: number;\n  activeCrons: number;\n  pausedCrons: number;\n  history: number;\n  dailyRuns: ShedullerDailyRun[];\n}"
    },
    {
      "name": "ShedullerDailyRun",
      "kind": "type",
      "definition": "{\n  date: string;\n  total: number;\n  success: number;\n  failed: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface ShedullerService {
  createCron(input: CronInput): Promise<any>;
  updateCron(id: string, updates: CronUpdate): Promise<CronEntry | any>;
  deleteCron(id: string): Promise<boolean>;
  getCron(id: string): Promise<CronEntry | any>;
  listCrons(params: CronListParams): Promise<PaginatedResult<CronEntry>>;
  recordHistory(entry: CronHistoryInput): Promise<CronHistoryEntry>;
  listProviders(): Promise<ProviderDefinition[]>;
  listHistory(params: CronHistoryListParams): Promise<PaginatedResult<CronHistoryEntry>>;
  getStats(): Promise<ShedullerStats>;
}

// Client interface
export interface ShedullerServiceClient {
  createCron(input: CronInput): Promise<any>;
  updateCron(id: string, updates: CronUpdate): Promise<CronEntry | any>;
  deleteCron(id: string): Promise<boolean>;
  getCron(id: string): Promise<CronEntry | any>;
  listCrons(params: CronListParams): Promise<PaginatedResult<CronEntry>>;
  recordHistory(entry: CronHistoryInput): Promise<CronHistoryEntry>;
  listProviders(): Promise<ProviderDefinition[]>;
  listHistory(params: CronHistoryListParams): Promise<PaginatedResult<CronHistoryEntry>>;
  getStats(): Promise<ShedullerStats>;
}

// Factory function
export function createShedullerServiceClient(
  config?: { baseUrl?: string },
): ShedullerServiceClient {
  return createHttpClient<ShedullerServiceClient>(metadata, config);
}

// Ready-to-use client
export const shedullerClient = createShedullerServiceClient();
