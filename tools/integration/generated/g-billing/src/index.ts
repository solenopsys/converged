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

export type PaginatedResult<T> = {
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
  "filePath": "services/business/billing.ts",
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
      "returnType": "BillingEntry | any",
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
      "returnType": "PaginatedResult<BillingEntry>",
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
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "BillingCategory",
      "kind": "type",
      "definition": "\"tokens\" | \"resources\" | \"module\""
    },
    {
      "name": "BillingEntry",
      "kind": "type",
      "definition": "{\n  id: BillingEntryId;\n  owner: string;\n  category: BillingCategory;\n  amount: number;\n  currency: string;\n  description?: string;\n  createdAt: ISODateString;\n}"
    },
    {
      "name": "BillingEntryInput",
      "kind": "type",
      "definition": "{\n  owner: string;\n  category: BillingCategory;\n  amount: number;\n  currency?: string;\n  description?: string;\n}"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    },
    {
      "name": "BillingListParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n  owner?: string;\n  category?: BillingCategory;\n  from?: ISODateString;\n  to?: ISODateString;\n}"
    },
    {
      "name": "BillingTotalParams",
      "kind": "type",
      "definition": "{\n  owner?: string;\n  category?: BillingCategory;\n  from?: ISODateString;\n  to?: ISODateString;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface BillingService {
  addEntry(entry: BillingEntryInput): Promise<BillingEntryId>;
  getEntry(id: BillingEntryId): Promise<BillingEntry | any>;
  listEntries(params: BillingListParams): Promise<PaginatedResult<BillingEntry>>;
  total(params: BillingTotalParams): Promise<number>;
}

// Client interface
export interface BillingServiceClient {
  addEntry(entry: BillingEntryInput): Promise<BillingEntryId>;
  getEntry(id: BillingEntryId): Promise<BillingEntry | any>;
  listEntries(params: BillingListParams): Promise<PaginatedResult<BillingEntry>>;
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
