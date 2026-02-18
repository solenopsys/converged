// Auto-generated package
import { createHttpClient } from "nrpc";

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

export interface PaginatedResult {
  items: T[];
  totalCount?: number;
}

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
      "name": "ProviderParam",
      "definition": "{\n  name: string;\n  type: string;\n  required?: boolean;\n  description?: string;\n}"
    },
    {
      "name": "ProviderActionDefinition",
      "definition": "{\n  name: string;\n  description?: string;\n  params?: ProviderParam[];\n}"
    },
    {
      "name": "ProviderDefinition",
      "definition": "{\n  code: string;\n  title?: string;\n  settings?: ProviderParam[];\n  actions: ProviderActionDefinition[];\n}"
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
}

// Client interface
export interface ShedullerServiceClient {
  createCron(input: CronInput): Promise<any>;
  updateCron(id: string, updates: CronUpdate): Promise<any>;
  deleteCron(id: string): Promise<any>;
  getCron(id: string): Promise<any>;
  listCrons(params: CronListParams): Promise<any>;
  listProviders(): Promise<any>;
}

// Factory function
export function createShedullerServiceClient(
  config?: { baseUrl?: string },
): ShedullerServiceClient {
  return createHttpClient<ShedullerServiceClient>(metadata, config);
}

// Ready-to-use client
export const shedullerClient = createShedullerServiceClient();
