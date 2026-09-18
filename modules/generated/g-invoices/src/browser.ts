// Auto-generated browser NRPC package
import {
  createWebSocketClient,
  type ServiceMetadata,
  type WebSocketClientConfig,
} from "nrpc";

export type InvoiceId = string;

export type ISODateString = string;

export type InvoiceCategory = "tokens" | "resources" | "module" | "membership";

export type InvoiceStatus = "draft" | "issued" | "paid" | "overdue" | "void";

export type InvoiceLine = {
	id: string;
	invoiceId: InvoiceId;
	description: string;
	category: InvoiceCategory;
	/** Whole currency units, like `rp-billing`. */
	amount: number;
	/**
	 * The billing entry this line was built from, when it was built from one.
	 *
	 * This is what stops a period being invoiced twice: the assembler asks which
	 * entries have already been billed instead of trusting a date range it
	 * computed itself.
	 */
	sourceEntryId?: string;
};

export type Invoice = {
	id: InvoiceId;
	/** Human-readable and never reused: "#2026-041" is what people say out loud. */
	number: number;
	owner: string;
	currency: string;
	/** The sum of the lines, kept here so a list does not have to join. */
	total: number;
	status: InvoiceStatus;
	/** What the invoice covers. Both ends inclusive of the day. */
	periodFrom: ISODateString;
	periodTo: ISODateString;
	issuedAt?: ISODateString;
	dueAt?: ISODateString;
	paidAt?: ISODateString;
	voidedAt?: ISODateString;
	/** Which provider took the money — `lemonsqueezy`, or whatever replaces it. */
	provider?: string;
	/**
	 * The provider's own id for the payment.
	 *
	 * Unique across the table, and that uniqueness is the whole defence against
	 * a webhook delivered twice. Every payment provider retries, and a retry
	 * that marks an invoice paid a second time is indistinguishable from a
	 * second payment.
	 */
	providerRef?: string;
	createdAt: ISODateString;
	updatedAt: ISODateString;
};

export type InvoiceWithLines = Invoice & { lines: InvoiceLine[] };

export type InvoiceLineInput = {
	description: string;
	category: InvoiceCategory;
	amount: number;
	sourceEntryId?: string;
};

export type CreateInvoiceInput = {
	owner?: string;
	currency?: string;
	periodFrom: ISODateString;
	periodTo: ISODateString;
	dueAt?: ISODateString;
	lines: InvoiceLineInput[];
};

export type MarkPaidInput = {
	provider: string;
	providerRef: string;
	paidAt?: ISODateString;
};

export type PaginatedResult<T> = {
	items: T[];
	totalCount?: number;
};

export type InvoiceListParams = {
	offset: number;
	limit: number;
	owner?: string;
	/** Filters on the derived status, which means it is computed, not indexed. */
	status?: InvoiceStatus;
	from?: ISODateString;
	to?: ISODateString;
};

export const metadata: ServiceMetadata = {
  "interfaceName": "InvoicesService",
  "serviceName": "invoices",
  "filePath": "business/invoices.ts",
  "methods": [
    {
      "name": "createInvoice",
      "parameters": [
        {
          "name": "input",
          "type": "CreateInvoiceInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "InvoiceWithLines",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getInvoice",
      "parameters": [
        {
          "name": "id",
          "type": "InvoiceId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "InvoiceWithLines | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listInvoices",
      "parameters": [
        {
          "name": "params",
          "type": "InvoiceListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<Invoice>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "issueInvoice",
      "parameters": [
        {
          "name": "id",
          "type": "InvoiceId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "dueAt",
          "type": "ISODateString",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "Invoice",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "markPaid",
      "parameters": [
        {
          "name": "id",
          "type": "InvoiceId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "input",
          "type": "MarkPaidInput",
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
      "name": "voidInvoice",
      "parameters": [
        {
          "name": "id",
          "type": "InvoiceId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "reason",
          "type": "string",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "Invoice",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "findByProviderRef",
      "parameters": [
        {
          "name": "providerRef",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Invoice | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "billedEntryIds",
      "parameters": [
        {
          "name": "entryIds",
          "type": "string",
          "optional": false,
          "isArray": true
        }
      ],
      "returnType": "string",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "InvoiceId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "InvoiceCategory",
      "kind": "type",
      "definition": "\"tokens\" | \"resources\" | \"module\" | \"membership\""
    },
    {
      "name": "InvoiceStatus",
      "kind": "type",
      "definition": "\"draft\" | \"issued\" | \"paid\" | \"overdue\" | \"void\""
    },
    {
      "name": "InvoiceLine",
      "kind": "type",
      "definition": "{\n\tid: string;\n\tinvoiceId: InvoiceId;\n\tdescription: string;\n\tcategory: InvoiceCategory;\n\t/** Whole currency units, like `rp-billing`. */\n\tamount: number;\n\t/**\n\t * The billing entry this line was built from, when it was built from one.\n\t *\n\t * This is what stops a period being invoiced twice: the assembler asks which\n\t * entries have already been billed instead of trusting a date range it\n\t * computed itself.\n\t */\n\tsourceEntryId?: string;\n}"
    },
    {
      "name": "Invoice",
      "kind": "type",
      "definition": "{\n\tid: InvoiceId;\n\t/** Human-readable and never reused: \"#2026-041\" is what people say out loud. */\n\tnumber: number;\n\towner: string;\n\tcurrency: string;\n\t/** The sum of the lines, kept here so a list does not have to join. */\n\ttotal: number;\n\tstatus: InvoiceStatus;\n\t/** What the invoice covers. Both ends inclusive of the day. */\n\tperiodFrom: ISODateString;\n\tperiodTo: ISODateString;\n\tissuedAt?: ISODateString;\n\tdueAt?: ISODateString;\n\tpaidAt?: ISODateString;\n\tvoidedAt?: ISODateString;\n\t/** Which provider took the money — `lemonsqueezy`, or whatever replaces it. */\n\tprovider?: string;\n\t/**\n\t * The provider's own id for the payment.\n\t *\n\t * Unique across the table, and that uniqueness is the whole defence against\n\t * a webhook delivered twice. Every payment provider retries, and a retry\n\t * that marks an invoice paid a second time is indistinguishable from a\n\t * second payment.\n\t */\n\tproviderRef?: string;\n\tcreatedAt: ISODateString;\n\tupdatedAt: ISODateString;\n}"
    },
    {
      "name": "InvoiceWithLines",
      "kind": "type",
      "definition": "Invoice & { lines: InvoiceLine[] }"
    },
    {
      "name": "InvoiceLineInput",
      "kind": "type",
      "definition": "{\n\tdescription: string;\n\tcategory: InvoiceCategory;\n\tamount: number;\n\tsourceEntryId?: string;\n}"
    },
    {
      "name": "CreateInvoiceInput",
      "kind": "type",
      "definition": "{\n\towner?: string;\n\tcurrency?: string;\n\tperiodFrom: ISODateString;\n\tperiodTo: ISODateString;\n\tdueAt?: ISODateString;\n\tlines: InvoiceLineInput[];\n}"
    },
    {
      "name": "MarkPaidInput",
      "kind": "type",
      "definition": "{\n\tprovider: string;\n\tproviderRef: string;\n\tpaidAt?: ISODateString;\n}"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n\titems: T[];\n\ttotalCount?: number;\n}"
    },
    {
      "name": "InvoiceListParams",
      "kind": "type",
      "definition": "{\n\toffset: number;\n\tlimit: number;\n\towner?: string;\n\t/** Filters on the derived status, which means it is computed, not indexed. */\n\tstatus?: InvoiceStatus;\n\tfrom?: ISODateString;\n\tto?: ISODateString;\n}"
    }
  ]
};

// Client interface
export interface InvoicesServiceClient {
  createInvoice(input: CreateInvoiceInput): Promise<InvoiceWithLines>;
  getInvoice(id: InvoiceId): Promise<InvoiceWithLines | any>;
  listInvoices(params: InvoiceListParams): Promise<PaginatedResult<Invoice>>;
  issueInvoice(id: InvoiceId, dueAt?: ISODateString): Promise<Invoice>;
  markPaid(id: InvoiceId, input: MarkPaidInput): Promise<boolean>;
  voidInvoice(id: InvoiceId, reason?: string): Promise<Invoice>;
  findByProviderRef(providerRef: string): Promise<Invoice | any>;
  billedEntryIds(entryIds: string[]): Promise<string[]>;
}

// Browser factory: frontend builds select this entrypoint automatically.
// The channel controller owns the shared WebSocket connection to Fujin.
export function createInvoicesServiceClient(
  config: WebSocketClientConfig,
): InvoicesServiceClient {
  return createWebSocketClient<InvoicesServiceClient>(metadata, config);
}

export function createInvoicesServiceWebSocketClient(
  config: WebSocketClientConfig,
): InvoicesServiceClient {
  return createInvoicesServiceClient(config);
}
