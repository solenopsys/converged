// Auto-generated package
import { createHttpClient, type ServiceMetadata } from "nrpc";

export enum LeadType {
	CNC = "cnc",
	PRINT_3D = "3dprint",
}

export type Lead = {
	id: string;
	description: string;
	lang: string;
	type: LeadType | string;
	catalogId: string;
	createdAt: Date;
};

export type LeadTag = {
	leadId: string;
	tagName: string;
	createdAt: Date;
};

export type Offer = {
	id: string;
	description: string;
	template_path: string;
};

export enum ContactType {
	EMAIL = "EMAIL",
	PHONE = "PHONE",
	LINKEDIN = "LINKEDIN",
	DOMAIN = "DOMAIN",
}

export type Contact = {
	id: string;
	leadId: string;
	type: ContactType;
	value: string;
	role: string;
	description: string;
	createdAt: Date;
};

export type Touch = {
	id: number;
	contactId: string;
	description: string;
	companyName?: string;
	outreachId?: string;
	createdAt: Date;
};

export type OutreachStatus = | "draft"
	| "planning"
	| "ready"
	| "running"
	| "paused"
	| "done";

export type Outreach = {
	id: string;
	name: string;
	status: OutreachStatus | string;
	lang: string;
	description: string;
	createdAt: Date;
	updatedAt: Date;
};

export type OutreachTargetStatus = | "planned"
	| "claimed"
	| "sent"
	| "completed"
	| "failed"
	| "skipped";

export type OutreachTarget = {
	id: string;
	outreachId: string;
	status: OutreachTargetStatus | string;
	position: number;
	payload: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
};

export type OutreachTargetInput = {
	id?: string;
	outreachId: string;
	status?: OutreachTargetStatus | string;
	position?: number;
	payload: Record<string, unknown>;
};

export type OutreachTargetListParams = PaginationParams & {
	outreachId?: string;
	status?: OutreachTargetStatus | string;
};

export type OutreachTargetStatusUpdate = {
	id: string;
	status: OutreachTargetStatus | string;
};

export type OutreachProgressStat = {
	outreachId: string;
	name: string;
	total: number;
	planned: number;
	claimed: number;
	sent: number;
	completedStatus: number;
	failed: number;
	skipped: number;
	completed: number;
	completionPercent: number;
};

export enum LeadEventType {
	EMAIL_SENT = "email_sent",
	EMAIL_OPEN = "email_open",
	CLICK = "click",
	PAGE_VIEW = "page_view",
}

export type LeadEvent = {
	id: string;
	code: string;
	type: LeadEventType | string;
	contactId?: string | null;
	leadId?: string | null;
	url?: string | null;
	referrer?: string | null;
	userAgent?: string | null;
	createdAt: Date;
};

export type OutreachCandidate = {
	lead: Lead;
	contact: Contact;
};

export type Statistic = {
	leads: number;
	touches: number;
	byType?: Record<string, number>;
	byLang?: Record<string, number>;
	contactsByType?: Record<string, number>;
	touchesByCompanyName?: Record<string, number>;
	outreachProgress?: OutreachProgressStat[];
};

export type PaginationParams = {
	offset: number;
	limit: number;
};

export type LeadListParams = PaginationParams & {
	tags?: string[];
	// Keyset cursor: when set, returns leads with id > after, ordered by id ASC
	// (ignores offset). Not supported together with tags.
	after?: string;
};

export type PaginatedResult<T> = {
	items: T[];
	totalCount?: number;
};

export const metadata: ServiceMetadata = {
  "interfaceName": "SalesService",
  "serviceName": "sales",
  "filePath": "services/business/sales.ts",
  "methods": [
    {
      "name": "addLead",
      "parameters": [
        {
          "name": "lead",
          "type": "Lead",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "string",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getLead",
      "parameters": [
        {
          "name": "leadId",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Lead | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "updateLeadCatalogId",
      "parameters": [
        {
          "name": "leadId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "catalogId",
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
      "name": "assignLeadTag",
      "parameters": [
        {
          "name": "leadId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "tagName",
          "type": "string",
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
      "name": "removeLeadTag",
      "parameters": [
        {
          "name": "leadId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "tagName",
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
      "name": "listLeadTags",
      "parameters": [
        {
          "name": "leadId",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "LeadTag",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "listLeadTagLinks",
      "parameters": [
        {
          "name": "params",
          "type": "PaginationParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<LeadTag>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "saveOffer",
      "parameters": [
        {
          "name": "offer",
          "type": "Offer",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "string",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listOffers",
      "parameters": [
        {
          "name": "params",
          "type": "PaginationParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<Offer>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "addContact",
      "parameters": [
        {
          "name": "contact",
          "type": "Contact",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "string",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getContact",
      "parameters": [
        {
          "name": "contactId",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Contact | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "addTouch",
      "parameters": [
        {
          "name": "touch",
          "type": "Touch",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "number",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "saveOutreach",
      "parameters": [
        {
          "name": "outreach",
          "type": "Outreach",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "string",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listOutreaches",
      "parameters": [
        {
          "name": "params",
          "type": "PaginationParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<Outreach>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "addOutreachTargets",
      "parameters": [
        {
          "name": "targets",
          "type": "OutreachTargetInput",
          "optional": false,
          "isArray": true
        }
      ],
      "returnType": "number",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listOutreachTargets",
      "parameters": [
        {
          "name": "params",
          "type": "OutreachTargetListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<OutreachTarget>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "claimNextOutreachTarget",
      "parameters": [
        {
          "name": "outreachId",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "OutreachTarget | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "updateOutreachTargetStatus",
      "parameters": [
        {
          "name": "update",
          "type": "OutreachTargetStatusUpdate",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "OutreachTarget | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getStatistic",
      "parameters": [],
      "returnType": "Statistic",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getDailyStatistic",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listLeads",
      "parameters": [
        {
          "name": "params",
          "type": "LeadListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<Lead>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listContacts",
      "parameters": [
        {
          "name": "params",
          "type": "PaginationParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<Contact>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listLeadContacts",
      "parameters": [
        {
          "name": "leadId",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<Contact>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listTouches",
      "parameters": [
        {
          "name": "params",
          "type": "PaginationParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<Touch>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "recordEvent",
      "parameters": [
        {
          "name": "event",
          "type": "LeadEvent",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "string",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listEvents",
      "parameters": [
        {
          "name": "params",
          "type": "PaginationParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<LeadEvent>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getEventFunnel",
      "parameters": [],
      "returnType": "Record<string, number>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "findOutreachCandidate",
      "parameters": [
        {
          "name": "lang",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "OutreachCandidate | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "findRandomLeadByLang",
      "parameters": [
        {
          "name": "lang",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Lead | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "leadHasTouches",
      "parameters": [
        {
          "name": "leadId",
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
      "name": "leadHasCompanyTouch",
      "parameters": [
        {
          "name": "leadId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "companyName",
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
      "name": "leadHasOutreachTouch",
      "parameters": [
        {
          "name": "leadId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "outreachId",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "boolean",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "LeadType",
      "kind": "raw",
      "definition": "export enum LeadType {\n\tCNC = \"cnc\",\n\tPRINT_3D = \"3dprint\",\n}"
    },
    {
      "name": "Lead",
      "kind": "type",
      "definition": "{\n\tid: string;\n\tdescription: string;\n\tlang: string;\n\ttype: LeadType | string;\n\tcatalogId: string;\n\tcreatedAt: Date;\n}"
    },
    {
      "name": "LeadTag",
      "kind": "type",
      "definition": "{\n\tleadId: string;\n\ttagName: string;\n\tcreatedAt: Date;\n}"
    },
    {
      "name": "Offer",
      "kind": "type",
      "definition": "{\n\tid: string;\n\tdescription: string;\n\ttemplate_path: string;\n}"
    },
    {
      "name": "ContactType",
      "kind": "raw",
      "definition": "export enum ContactType {\n\tEMAIL = \"EMAIL\",\n\tPHONE = \"PHONE\",\n\tLINKEDIN = \"LINKEDIN\",\n\tDOMAIN = \"DOMAIN\",\n}"
    },
    {
      "name": "Contact",
      "kind": "type",
      "definition": "{\n\tid: string;\n\tleadId: string;\n\ttype: ContactType;\n\tvalue: string;\n\trole: string;\n\tdescription: string;\n\tcreatedAt: Date;\n}"
    },
    {
      "name": "Touch",
      "kind": "type",
      "definition": "{\n\tid: number;\n\tcontactId: string;\n\tdescription: string;\n\tcompanyName?: string;\n\toutreachId?: string;\n\tcreatedAt: Date;\n}"
    },
    {
      "name": "OutreachStatus",
      "kind": "type",
      "definition": "| \"draft\"\n\t| \"planning\"\n\t| \"ready\"\n\t| \"running\"\n\t| \"paused\"\n\t| \"done\""
    },
    {
      "name": "Outreach",
      "kind": "type",
      "definition": "{\n\tid: string;\n\tname: string;\n\tstatus: OutreachStatus | string;\n\tlang: string;\n\tdescription: string;\n\tcreatedAt: Date;\n\tupdatedAt: Date;\n}"
    },
    {
      "name": "OutreachTargetStatus",
      "kind": "type",
      "definition": "| \"planned\"\n\t| \"claimed\"\n\t| \"sent\"\n\t| \"completed\"\n\t| \"failed\"\n\t| \"skipped\""
    },
    {
      "name": "OutreachTarget",
      "kind": "type",
      "definition": "{\n\tid: string;\n\toutreachId: string;\n\tstatus: OutreachTargetStatus | string;\n\tposition: number;\n\tpayload: Record<string, unknown>;\n\tcreatedAt: Date;\n\tupdatedAt: Date;\n}"
    },
    {
      "name": "OutreachTargetInput",
      "kind": "type",
      "definition": "{\n\tid?: string;\n\toutreachId: string;\n\tstatus?: OutreachTargetStatus | string;\n\tposition?: number;\n\tpayload: Record<string, unknown>;\n}"
    },
    {
      "name": "OutreachTargetListParams",
      "kind": "type",
      "definition": "PaginationParams & {\n\toutreachId?: string;\n\tstatus?: OutreachTargetStatus | string;\n}"
    },
    {
      "name": "OutreachTargetStatusUpdate",
      "kind": "type",
      "definition": "{\n\tid: string;\n\tstatus: OutreachTargetStatus | string;\n}"
    },
    {
      "name": "OutreachProgressStat",
      "kind": "type",
      "definition": "{\n\toutreachId: string;\n\tname: string;\n\ttotal: number;\n\tplanned: number;\n\tclaimed: number;\n\tsent: number;\n\tcompletedStatus: number;\n\tfailed: number;\n\tskipped: number;\n\tcompleted: number;\n\tcompletionPercent: number;\n}"
    },
    {
      "name": "LeadEventType",
      "kind": "raw",
      "definition": "export enum LeadEventType {\n\tEMAIL_SENT = \"email_sent\",\n\tEMAIL_OPEN = \"email_open\",\n\tCLICK = \"click\",\n\tPAGE_VIEW = \"page_view\",\n}"
    },
    {
      "name": "LeadEvent",
      "kind": "type",
      "definition": "{\n\tid: string;\n\tcode: string;\n\ttype: LeadEventType | string;\n\tcontactId?: string | null;\n\tleadId?: string | null;\n\turl?: string | null;\n\treferrer?: string | null;\n\tuserAgent?: string | null;\n\tcreatedAt: Date;\n}"
    },
    {
      "name": "OutreachCandidate",
      "kind": "type",
      "definition": "{\n\tlead: Lead;\n\tcontact: Contact;\n}"
    },
    {
      "name": "Statistic",
      "kind": "type",
      "definition": "{\n\tleads: number;\n\ttouches: number;\n\tbyType?: Record<string, number>;\n\tbyLang?: Record<string, number>;\n\tcontactsByType?: Record<string, number>;\n\ttouchesByCompanyName?: Record<string, number>;\n\toutreachProgress?: OutreachProgressStat[];\n}"
    },
    {
      "name": "PaginationParams",
      "kind": "type",
      "definition": "{\n\toffset: number;\n\tlimit: number;\n}"
    },
    {
      "name": "LeadListParams",
      "kind": "type",
      "definition": "PaginationParams & {\n\ttags?: string[];\n\t// Keyset cursor: when set, returns leads with id > after, ordered by id ASC\n\t// (ignores offset). Not supported together with tags.\n\tafter?: string;\n}"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n\titems: T[];\n\ttotalCount?: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface SalesService {
  addLead(lead: Lead): Promise<string>;
  getLead(leadId: string): Promise<Lead | any>;
  updateLeadCatalogId(leadId: string, catalogId: string): Promise<boolean>;
  assignLeadTag(leadId: string, tagName: string): Promise<void>;
  removeLeadTag(leadId: string, tagName: string): Promise<boolean>;
  listLeadTags(leadId: string): Promise<LeadTag[]>;
  listLeadTagLinks(params: PaginationParams): Promise<PaginatedResult<LeadTag>>;
  saveOffer(offer: Offer): Promise<string>;
  listOffers(params: PaginationParams): Promise<PaginatedResult<Offer>>;
  addContact(contact: Contact): Promise<string>;
  getContact(contactId: string): Promise<Contact | any>;
  addTouch(touch: Touch): Promise<number>;
  saveOutreach(outreach: Outreach): Promise<string>;
  listOutreaches(params: PaginationParams): Promise<PaginatedResult<Outreach>>;
  addOutreachTargets(targets: OutreachTargetInput[]): Promise<number>;
  listOutreachTargets(params: OutreachTargetListParams): Promise<PaginatedResult<OutreachTarget>>;
  claimNextOutreachTarget(outreachId: string): Promise<OutreachTarget | any>;
  updateOutreachTargetStatus(update: OutreachTargetStatusUpdate): Promise<OutreachTarget | any>;
  getStatistic(): Promise<Statistic>;
  getDailyStatistic(): Promise<any>;
  listLeads(params: LeadListParams): Promise<PaginatedResult<Lead>>;
  listContacts(params: PaginationParams): Promise<PaginatedResult<Contact>>;
  listLeadContacts(leadId: string): Promise<PaginatedResult<Contact>>;
  listTouches(params: PaginationParams): Promise<PaginatedResult<Touch>>;
  recordEvent(event: LeadEvent): Promise<string>;
  listEvents(params: PaginationParams): Promise<PaginatedResult<LeadEvent>>;
  getEventFunnel(): Promise<Record<string, number>>;
  findOutreachCandidate(lang: string): Promise<OutreachCandidate | any>;
  findRandomLeadByLang(lang: string): Promise<Lead | any>;
  leadHasTouches(leadId: string): Promise<boolean>;
  leadHasCompanyTouch(leadId: string, companyName: string): Promise<boolean>;
  leadHasOutreachTouch(leadId: string, outreachId: string): Promise<boolean>;
}

// Client interface
export interface SalesServiceClient {
  addLead(lead: Lead): Promise<string>;
  getLead(leadId: string): Promise<Lead | any>;
  updateLeadCatalogId(leadId: string, catalogId: string): Promise<boolean>;
  assignLeadTag(leadId: string, tagName: string): Promise<void>;
  removeLeadTag(leadId: string, tagName: string): Promise<boolean>;
  listLeadTags(leadId: string): Promise<LeadTag[]>;
  listLeadTagLinks(params: PaginationParams): Promise<PaginatedResult<LeadTag>>;
  saveOffer(offer: Offer): Promise<string>;
  listOffers(params: PaginationParams): Promise<PaginatedResult<Offer>>;
  addContact(contact: Contact): Promise<string>;
  getContact(contactId: string): Promise<Contact | any>;
  addTouch(touch: Touch): Promise<number>;
  saveOutreach(outreach: Outreach): Promise<string>;
  listOutreaches(params: PaginationParams): Promise<PaginatedResult<Outreach>>;
  addOutreachTargets(targets: OutreachTargetInput[]): Promise<number>;
  listOutreachTargets(params: OutreachTargetListParams): Promise<PaginatedResult<OutreachTarget>>;
  claimNextOutreachTarget(outreachId: string): Promise<OutreachTarget | any>;
  updateOutreachTargetStatus(update: OutreachTargetStatusUpdate): Promise<OutreachTarget | any>;
  getStatistic(): Promise<Statistic>;
  getDailyStatistic(): Promise<any>;
  listLeads(params: LeadListParams): Promise<PaginatedResult<Lead>>;
  listContacts(params: PaginationParams): Promise<PaginatedResult<Contact>>;
  listLeadContacts(leadId: string): Promise<PaginatedResult<Contact>>;
  listTouches(params: PaginationParams): Promise<PaginatedResult<Touch>>;
  recordEvent(event: LeadEvent): Promise<string>;
  listEvents(params: PaginationParams): Promise<PaginatedResult<LeadEvent>>;
  getEventFunnel(): Promise<Record<string, number>>;
  findOutreachCandidate(lang: string): Promise<OutreachCandidate | any>;
  findRandomLeadByLang(lang: string): Promise<Lead | any>;
  leadHasTouches(leadId: string): Promise<boolean>;
  leadHasCompanyTouch(leadId: string, companyName: string): Promise<boolean>;
  leadHasOutreachTouch(leadId: string, outreachId: string): Promise<boolean>;
}

// Factory function
export function createSalesServiceClient(
  config?: { baseUrl?: string },
): SalesServiceClient {
  return createHttpClient<SalesServiceClient>(metadata, config);
}

// Ready-to-use client
export const salesClient = createSalesServiceClient();
