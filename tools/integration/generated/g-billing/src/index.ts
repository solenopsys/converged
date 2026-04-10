// Auto-generated package
import { createHttpClient } from "nrpc";

export type BillingEntryId = string;

export type ISODateString = string;

export type BillingCategory = "tokens" | "resources" | "module";

export type BillingEntry = {
  id: BillingEntryId;
  owner: string;
  category: BillingCategory;
  amount: number;
  currency: string;
  description?: string;
  createdAt: ISODateString;
};

export type BillingEntryInput = {
  owner: string;
  category: BillingCategory;
  amount: number;
  currency?: string;
  description?: string;
};

export type PaginatedResult = {
  items: T[];
  totalCount?: number;
};

export type BillingListParams = {
  offset: number;
  limit: number;
  owner?: string;
  category?: BillingCategory;
  from?: ISODateString;
  to?: ISODateString;
};

export type BillingTotalParams = {
  owner?: string;
  category?: BillingCategory;
  from?: ISODateString;
  to?: ISODateString;
};

export const metadata = {
  "interfaceName": "BillingService",
  "serviceName": "billing",
  "filePath": "../types/billing.ts",
  "methods": [
    {
      "name": "addEntry",
      "parameters": [
        {
          "name": "entry",
          "type": "BillingEntryInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "BillingEntryId",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getEntry",
      "parameters": [
        {
          "name": "id",
          "type": "BillingEntryId",
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
      "name": "listEntries",
      "parameters": [
        {
          "name": "params",
          "type": "BillingListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "total",
      "parameters": [
        {
          "name": "params",
          "type": "BillingTotalParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "number",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "BillingEntryId",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "definition": "string"
    },
    {
      "name": "BillingCategory",
      "definition": "\"tokens\" | \"resources\" | \"module\""
    },
    {
      "name": "BillingEntry",
      "definition": "{\n  id: BillingEntryId;\n  owner: string;\n  category: BillingCategory;\n  amount: number;\n  currency: string;\n  description?: string;\n  createdAt: ISODateString;\n}"
    },
    {
      "name": "BillingEntryInput",
      "definition": "{\n  owner: string;\n  category: BillingCategory;\n  amount: number;\n  currency?: string;\n  description?: string;\n}"
    },
    {
      "name": "PaginatedResult",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    },
    {
      "name": "BillingListParams",
      "definition": "{\n  offset: number;\n  limit: number;\n  owner?: string;\n  category?: BillingCategory;\n  from?: ISODateString;\n  to?: ISODateString;\n}"
    },
    {
      "name": "BillingTotalParams",
      "definition": "{\n  owner?: string;\n  category?: BillingCategory;\n  from?: ISODateString;\n  to?: ISODateString;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface BillingService {
  addEntry(entry: BillingEntryInput): Promise<BillingEntryId>;
  getEntry(id: BillingEntryId): Promise<any>;
  listEntries(params: BillingListParams): Promise<PaginatedResult>;
  total(params: BillingTotalParams): Promise<number>;
}

// Client interface
export interface BillingServiceClient {
  addEntry(entry: BillingEntryInput): Promise<BillingEntryId>;
  getEntry(id: BillingEntryId): Promise<any>;
  listEntries(params: BillingListParams): Promise<PaginatedResult>;
  total(params: BillingTotalParams): Promise<number>;
}

// Factory function
export function createBillingServiceClient(
  config?: { baseUrl?: string },
): BillingServiceClient {
  return createHttpClient<BillingServiceClient>(metadata, config);
}

// Ready-to-use client
export const billingClient = createBillingServiceClient();
