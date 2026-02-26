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

export interface PaginatedResult {
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

export type CronHistoryListParams = {
  offset: number;
  limit: number;
  cronId?: string;
};

export type ShedullerStats = {
  crons: number;
  history: number;
};

export const metadata = {
  "interfaceName": "ShedullerService",
  "serviceName": "sheduller",
  "filePath": "../types/sheduller.ts",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listProviders",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getStats",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "CronStatus",
      "definition": "\"active\" | \"paused\""
    },
    {
      "name": "ProviderSettings",
      "definition": "Record<string, any>"
    },
    {
      "name": "ProviderDefinition",
      "definition": "{\n  code: string;\n  title?: string;\n  actions: string[];\n}"
    },
    {
      "name": "CronEntry",
      "definition": "{\n  id: string;\n  name: string;\n  expression: string;\n  provider: string;\n  action: string;\n  params?: Record<string, any>;\n  providerSettings?: ProviderSettings;\n  status: CronStatus;\n  createdAt: string;\n  updatedAt?: string;\n}"
    },
    {
      "name": "CronInput",
      "definition": "{\n  name: string;\n  expression: string;\n  provider: string;\n  action: string;\n  params?: Record<string, any>;\n  providerSettings?: ProviderSettings;\n  status?: CronStatus;\n}"
    },
    {
      "name": "CronUpdate",
      "definition": "{\n  name?: string;\n  expression?: string;\n  provider?: string;\n  action?: string;\n  params?: Record<string, any>;\n  providerSettings?: ProviderSettings;\n  status?: CronStatus;\n}"
    },
    {
      "name": "CronListParams",
      "definition": "{\n  offset: number;\n  limit: number;\n  status?: CronStatus;\n}"
    },
    {
      "name": "PaginatedResult",
      "definition": "",
      "properties": [
        {
          "name": "items",
          "type": "T",
          "optional": false,
          "isArray": true
        },
        {
          "name": "totalCount",
          "type": "number",
          "optional": true,
          "isArray": false
        }
      ]
    },
    {
      "name": "CronHistoryEntry",
      "definition": "{\n  id: string;\n  cronId: string;\n  cronName: string;\n  provider: string;\n  action: string;\n  firedAt: string;\n  success: boolean;\n  message?: string;\n}"
    },
    {
      "name": "CronHistoryListParams",
      "definition": "{\n  offset: number;\n  limit: number;\n  cronId?: string;\n}"
    },
    {
      "name": "ShedullerStats",
      "definition": "{\n  crons: number;\n  history: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface ShedullerService {
  createCron(input: CronInput): Promise<any>;
  updateCron(id: string, updates: CronUpdate): Promise<any>;
  deleteCron(id: string): Promise<any>;
  getCron(id: string): Promise<any>;
  listCrons(params: CronListParams): Promise<any>;
  listProviders(): Promise<any>;
  listHistory(params: CronHistoryListParams): Promise<any>;
  getStats(): Promise<any>;
}

// Client interface
export interface ShedullerServiceClient {
  createCron(input: CronInput): Promise<any>;
  updateCron(id: string, updates: CronUpdate): Promise<any>;
  deleteCron(id: string): Promise<any>;
  getCron(id: string): Promise<any>;
  listCrons(params: CronListParams): Promise<any>;
  listProviders(): Promise<any>;
  listHistory(params: CronHistoryListParams): Promise<any>;
  getStats(): Promise<any>;
}

// Factory function
export function createShedullerServiceClient(
  config?: { baseUrl?: string },
): ShedullerServiceClient {
  return createHttpClient<ShedullerServiceClient>(metadata, config);
}

// Ready-to-use client
export const shedullerClient = createShedullerServiceClient();
