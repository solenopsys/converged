// Auto-generated package
import { createHttpClient, type ServiceMetadata } from "nrpc";

export type TransactionId = string;

export type ISODateString = string;

export type TransactionType = "income" | "expense" | "transfer";

export type Transaction = {
  id: TransactionId;
  type: TransactionType;
  category: string;
  amount: number;
  currency: string;
  description?: string;
  orderId?: string;
  counterparty?: string;
  dueAt?: ISODateString;
  paidAt?: ISODateString;
  isPaid: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type TransactionInput = {
  type: TransactionType;
  category: string;
  amount: number;
  currency?: string;
  description?: string;
  orderId?: string;
  counterparty?: string;
  dueAt?: ISODateString;
  paidAt?: ISODateString;
  isPaid?: boolean;
};

export type TransactionPatch = {
  category?: string;
  amount?: number;
  description?: string;
  orderId?: string;
  counterparty?: string;
  dueAt?: ISODateString;
  paidAt?: ISODateString;
  isPaid?: boolean;
};

export type TransactionListParams = {
  offset: number;
  limit: number;
  type?: TransactionType;
  category?: string;
  orderId?: string;
  isPaid?: boolean;
  from?: ISODateString;
  to?: ISODateString;
};

export type PeriodParams = {
  from: ISODateString;
  to: ISODateString;
  currency?: string;
};

export type PeriodSummary = {
  revenue: number;
  expenses: number;
  profit: number;
  marginPercent: number;
  currency: string;
};

export type CashflowDay = {
  date: string;
  income: number;
  expenses: number;
  balance: number;
};

export type ReceivableItem = {
  transactionId: TransactionId;
  counterparty?: string;
  amount: number;
  currency: string;
  dueAt?: ISODateString;
  daysPastDue: number;
};

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
};

export const metadata: ServiceMetadata = {
  "interfaceName": "FinanceService",
  "serviceName": "finance",
  "filePath": "services/business/finance.ts",
  "methods": [
    {
      "name": "addTransaction",
      "parameters": [
        {
          "name": "input",
          "type": "TransactionInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "TransactionId",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getTransaction",
      "parameters": [
        {
          "name": "id",
          "type": "TransactionId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Transaction | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "patchTransaction",
      "parameters": [
        {
          "name": "id",
          "type": "TransactionId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "patch",
          "type": "TransactionPatch",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "deleteTransaction",
      "parameters": [
        {
          "name": "id",
          "type": "TransactionId",
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
      "name": "listTransactions",
      "parameters": [
        {
          "name": "params",
          "type": "TransactionListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<Transaction>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getPeriodSummary",
      "parameters": [
        {
          "name": "params",
          "type": "PeriodParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PeriodSummary",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getCashflowCalendar",
      "parameters": [
        {
          "name": "params",
          "type": "PeriodParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "CashflowDay",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "getReceivables",
      "parameters": [],
      "returnType": "ReceivableItem",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "getPayables",
      "parameters": [],
      "returnType": "ReceivableItem",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "TransactionId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "TransactionType",
      "kind": "type",
      "definition": "\"income\" | \"expense\" | \"transfer\""
    },
    {
      "name": "Transaction",
      "kind": "type",
      "definition": "{\n  id: TransactionId;\n  type: TransactionType;\n  category: string;\n  amount: number;\n  currency: string;\n  description?: string;\n  orderId?: string;\n  counterparty?: string;\n  dueAt?: ISODateString;\n  paidAt?: ISODateString;\n  isPaid: boolean;\n  createdAt: ISODateString;\n  updatedAt: ISODateString;\n}"
    },
    {
      "name": "TransactionInput",
      "kind": "type",
      "definition": "{\n  type: TransactionType;\n  category: string;\n  amount: number;\n  currency?: string;\n  description?: string;\n  orderId?: string;\n  counterparty?: string;\n  dueAt?: ISODateString;\n  paidAt?: ISODateString;\n  isPaid?: boolean;\n}"
    },
    {
      "name": "TransactionPatch",
      "kind": "type",
      "definition": "{\n  category?: string;\n  amount?: number;\n  description?: string;\n  orderId?: string;\n  counterparty?: string;\n  dueAt?: ISODateString;\n  paidAt?: ISODateString;\n  isPaid?: boolean;\n}"
    },
    {
      "name": "TransactionListParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n  type?: TransactionType;\n  category?: string;\n  orderId?: string;\n  isPaid?: boolean;\n  from?: ISODateString;\n  to?: ISODateString;\n}"
    },
    {
      "name": "PeriodParams",
      "kind": "type",
      "definition": "{\n  from: ISODateString;\n  to: ISODateString;\n  currency?: string;\n}"
    },
    {
      "name": "PeriodSummary",
      "kind": "type",
      "definition": "{\n  revenue: number;\n  expenses: number;\n  profit: number;\n  marginPercent: number;\n  currency: string;\n}"
    },
    {
      "name": "CashflowDay",
      "kind": "type",
      "definition": "{\n  date: string;\n  income: number;\n  expenses: number;\n  balance: number;\n}"
    },
    {
      "name": "ReceivableItem",
      "kind": "type",
      "definition": "{\n  transactionId: TransactionId;\n  counterparty?: string;\n  amount: number;\n  currency: string;\n  dueAt?: ISODateString;\n  daysPastDue: number;\n}"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface FinanceService {
  addTransaction(input: TransactionInput): Promise<TransactionId>;
  getTransaction(id: TransactionId): Promise<Transaction | any>;
  patchTransaction(id: TransactionId, patch: TransactionPatch): Promise<void>;
  deleteTransaction(id: TransactionId): Promise<boolean>;
  listTransactions(params: TransactionListParams): Promise<PaginatedResult<Transaction>>;
  getPeriodSummary(params: PeriodParams): Promise<PeriodSummary>;
  getCashflowCalendar(params: PeriodParams): Promise<CashflowDay[]>;
  getReceivables(): Promise<ReceivableItem[]>;
  getPayables(): Promise<ReceivableItem[]>;
}

// Client interface
export interface FinanceServiceClient {
  addTransaction(input: TransactionInput): Promise<TransactionId>;
  getTransaction(id: TransactionId): Promise<Transaction | any>;
  patchTransaction(id: TransactionId, patch: TransactionPatch): Promise<void>;
  deleteTransaction(id: TransactionId): Promise<boolean>;
  listTransactions(params: TransactionListParams): Promise<PaginatedResult<Transaction>>;
  getPeriodSummary(params: PeriodParams): Promise<PeriodSummary>;
  getCashflowCalendar(params: PeriodParams): Promise<CashflowDay[]>;
  getReceivables(): Promise<ReceivableItem[]>;
  getPayables(): Promise<ReceivableItem[]>;
}

// Factory function
export function createFinanceServiceClient(
  config?: { baseUrl?: string },
): FinanceServiceClient {
  return createHttpClient<FinanceServiceClient>(metadata, config);
}

// Ready-to-use client
export const financeClient = createFinanceServiceClient();
