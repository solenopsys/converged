// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

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
	disabled?: boolean;
	createdAt: Date;
};

export type LeadUpdate = {
	id: string;
	description?: string;
	lang?: string;
	type?: LeadType | string;
	catalogId?: string;
	disabled?: boolean;
};

export type LeadTag = {
	id: string;
	name: string;
	description: string;
	createdAt: Date;
	updatedAt: Date;
};

export type LeadTagInput = {
	id?: string;
	name: string;
	description?: string;
};

export type LeadTagLink = {
	tagId: string;
	leadId: string;
	createdAt: Date;
};

export type Offer = {
	id: string;
	name?: string;
	description: string;
	template_path: string;
	subjectTemplate?: string;
	bodyTemplate?: string;
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
	/** The tag whose leads this campaign is planned into. */
	tagId?: string;
	templateId?: string;
	planWorkflow?: string;
	sendWorkflow?: string;
	sendCronId?: string;
	baseUrl?: string;
	demoUrl?: string;
	senders?: Record<string, string>;
	jitterMaxSeconds?: number;
	createdAt: Date;
	updatedAt: Date;
};

export type Campaign = Outreach;

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

export type ImportContact = {
	type?: string;
	value?: string;
	role?: string;
	description?: string;
};

export type ImportLead = {
	id?: string;
	company?: string;
	name?: string;
	description?: string;
	lang?: string;
	type?: string;
	catalogId?: string;
	contacts?: ImportContact[];
	tags?: string[];
};

export type ParseImportLeadsInput = {
	text: string;
};

export type ImportSourceFormat = "json" | "delimited" | "lines" | "none";

export type ParseImportLeadsResult = {
	leads: ImportLead[];
	format: ImportSourceFormat;
};

export type NormalizeImportLeadsInput = {
	leads: ImportLead[];
	defaultLang?: string;
	defaultType?: string;
	tags?: string[];
};

export type ImportItem = {
	lead: Lead;
	contacts: Contact[];
	tags: string[];
};

export type NormalizeImportLeadsResult = {
	items: ImportItem[];
	/** rows dropped because they had no description and no company/name */
	dropped: number;
};

export type OutreachCandidate = {
	lead: Lead;
	contact: Contact;
};

export type Statistic = {
	leads: number;
	touches: number;
	daily?: Record<string, { leads: number; touches: number }>;
	byType?: Record<string, number>;
	byLang?: Record<string, number>;
	contactsByType?: Record<string, number>;
	touchesByCompanyName?: Record<string, number>;
	outreachProgress?: OutreachProgressStat[];
};

export type SalesStatisticKey = "title";

export type PaginationParams = {
	offset: number;
	limit: number;
};

export type FilterObject = Record<string, unknown>;

export type SelectionValue = {
	id: string | number | boolean | null;
	label: string;
	aliases?: string[];
};

export type SelectionFieldDescriptor = {
	id: string;
	label: string;
	description?: string;
	valueType: "string" | "number" | "boolean" | "date" | "enum";
	operators: string[];
	control?: "text" | "select" | "multi-select" | "boolean" | "date-range";
	values?: SelectionValue[];
	valuesComplete?: boolean;
	lookup?: boolean;
};

export type SelectionDescriptor = {
	objectType: string;
	title: string;
	description?: string;
	fields: SelectionFieldDescriptor[];
	filterExample?: FilterObject;
	revision?: string;
};

export type SelectionStats = { totalCount: number };

export type LeadSelection = {
	ids?: string[];
	filter?: FilterObject;
};

export type LeadListParams = PaginationParams & {
	// Canonical predicate shared by the table header, the assistant and
	// group operations.
	filter?: FilterObject;
	tags?: string[];
	// Case-insensitive search over id, description and contact values.
	query?: string;
	// Case-insensitive substring match over the lead's contact values
	// (email, domain, phone…). Combinable with tags.
	contact?: string;
	// Keyset cursor: when set, returns leads with id > after, ordered by id ASC
	// (ignores offset). Not supported together with filters (tags/contact).
	after?: string;
};

export type ContactListParams = PaginationParams & {
	filter?: FilterObject;
};

export type PaginatedResult<T> = {
	items: T[];
	totalCount?: number;
};

const metadata: ServiceMetadata = {
  "interfaceName": "SalesService",
  "serviceName": "sales",
  "filePath": "business/sales.ts",
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
      "name": "updateLead",
      "parameters": [
        {
          "name": "lead",
          "type": "LeadUpdate",
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
      "returnType": "PaginatedResult<LeadTagLink>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "saveTag",
      "parameters": [
        {
          "name": "tag",
          "type": "LeadTagInput",
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
      "name": "ensureTag",
      "parameters": [
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "description",
          "type": "string",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "string",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "findTagId",
      "parameters": [
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "string | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getTag",
      "parameters": [
        {
          "name": "tagId",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "LeadTag | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listTags",
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
      "name": "deleteTag",
      "parameters": [
        {
          "name": "tagId",
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
      "name": "assignTag",
      "parameters": [
        {
          "name": "tagId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "selection",
          "type": "LeadSelection",
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
      "name": "unassignTag",
      "parameters": [
        {
          "name": "tagId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "selection",
          "type": "LeadSelection",
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
      "name": "listTagLeads",
      "parameters": [
        {
          "name": "tagId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "params",
          "type": "PaginationParams",
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
      "name": "describeSelection",
      "parameters": [
        {
          "name": "objectType",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "SelectionDescriptor",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "inspectLeads",
      "parameters": [
        {
          "name": "filter",
          "type": "FilterObject",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "SelectionStats",
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
      "name": "getOffer",
      "parameters": [
        {
          "name": "offerId",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Offer | any",
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
      "name": "getOutreach",
      "parameters": [
        {
          "name": "outreachId",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Outreach | any",
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
      "parameters": [
        {
          "name": "keys",
          "type": "SalesStatisticKey",
          "optional": true,
          "isArray": true
        }
      ],
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
          "type": "ContactListParams",
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
      "name": "parseImportLeads",
      "parameters": [
        {
          "name": "input",
          "type": "ParseImportLeadsInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ParseImportLeadsResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "normalizeImportLeads",
      "parameters": [
        {
          "name": "input",
          "type": "NormalizeImportLeadsInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "NormalizeImportLeadsResult",
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
      "definition": "{\n\tid: string;\n\tdescription: string;\n\tlang: string;\n\ttype: LeadType | string;\n\tcatalogId: string;\n\tdisabled?: boolean;\n\tcreatedAt: Date;\n}"
    },
    {
      "name": "LeadUpdate",
      "kind": "type",
      "definition": "{\n\tid: string;\n\tdescription?: string;\n\tlang?: string;\n\ttype?: LeadType | string;\n\tcatalogId?: string;\n\tdisabled?: boolean;\n}"
    },
    {
      "name": "LeadTag",
      "kind": "type",
      "definition": "{\n\tid: string;\n\tname: string;\n\tdescription: string;\n\tcreatedAt: Date;\n\tupdatedAt: Date;\n}"
    },
    {
      "name": "LeadTagInput",
      "kind": "type",
      "definition": "{\n\tid?: string;\n\tname: string;\n\tdescription?: string;\n}"
    },
    {
      "name": "LeadTagLink",
      "kind": "type",
      "definition": "{\n\ttagId: string;\n\tleadId: string;\n\tcreatedAt: Date;\n}"
    },
    {
      "name": "Offer",
      "kind": "type",
      "definition": "{\n\tid: string;\n\tname?: string;\n\tdescription: string;\n\ttemplate_path: string;\n\tsubjectTemplate?: string;\n\tbodyTemplate?: string;\n}"
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
      "definition": "{\n\tid: string;\n\tname: string;\n\tstatus: OutreachStatus | string;\n\tlang: string;\n\tdescription: string;\n\t/** The tag whose leads this campaign is planned into. */\n\ttagId?: string;\n\ttemplateId?: string;\n\tplanWorkflow?: string;\n\tsendWorkflow?: string;\n\tsendCronId?: string;\n\tbaseUrl?: string;\n\tdemoUrl?: string;\n\tsenders?: Record<string, string>;\n\tjitterMaxSeconds?: number;\n\tcreatedAt: Date;\n\tupdatedAt: Date;\n}"
    },
    {
      "name": "Campaign",
      "kind": "type",
      "definition": "Outreach"
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
      "name": "ImportContact",
      "kind": "type",
      "definition": "{\n\ttype?: string;\n\tvalue?: string;\n\trole?: string;\n\tdescription?: string;\n}"
    },
    {
      "name": "ImportLead",
      "kind": "type",
      "definition": "{\n\tid?: string;\n\tcompany?: string;\n\tname?: string;\n\tdescription?: string;\n\tlang?: string;\n\ttype?: string;\n\tcatalogId?: string;\n\tcontacts?: ImportContact[];\n\ttags?: string[];\n}"
    },
    {
      "name": "ParseImportLeadsInput",
      "kind": "type",
      "definition": "{\n\ttext: string;\n}"
    },
    {
      "name": "ImportSourceFormat",
      "kind": "type",
      "definition": "\"json\" | \"delimited\" | \"lines\" | \"none\""
    },
    {
      "name": "ParseImportLeadsResult",
      "kind": "type",
      "definition": "{\n\tleads: ImportLead[];\n\tformat: ImportSourceFormat;\n}"
    },
    {
      "name": "NormalizeImportLeadsInput",
      "kind": "type",
      "definition": "{\n\tleads: ImportLead[];\n\tdefaultLang?: string;\n\tdefaultType?: string;\n\ttags?: string[];\n}"
    },
    {
      "name": "ImportItem",
      "kind": "type",
      "definition": "{\n\tlead: Lead;\n\tcontacts: Contact[];\n\ttags: string[];\n}"
    },
    {
      "name": "NormalizeImportLeadsResult",
      "kind": "type",
      "definition": "{\n\titems: ImportItem[];\n\t/** rows dropped because they had no description and no company/name */\n\tdropped: number;\n}"
    },
    {
      "name": "OutreachCandidate",
      "kind": "type",
      "definition": "{\n\tlead: Lead;\n\tcontact: Contact;\n}"
    },
    {
      "name": "Statistic",
      "kind": "type",
      "definition": "{\n\tleads: number;\n\ttouches: number;\n\tdaily?: Record<string, { leads: number; touches: number }>;\n\tbyType?: Record<string, number>;\n\tbyLang?: Record<string, number>;\n\tcontactsByType?: Record<string, number>;\n\ttouchesByCompanyName?: Record<string, number>;\n\toutreachProgress?: OutreachProgressStat[];\n}"
    },
    {
      "name": "SalesStatisticKey",
      "kind": "type",
      "definition": "\"title\""
    },
    {
      "name": "PaginationParams",
      "kind": "type",
      "definition": "{\n\toffset: number;\n\tlimit: number;\n}"
    },
    {
      "name": "FilterObject",
      "kind": "type",
      "definition": "Record<string, unknown>"
    },
    {
      "name": "SelectionValue",
      "kind": "type",
      "definition": "{\n\tid: string | number | boolean | null;\n\tlabel: string;\n\taliases?: string[];\n}"
    },
    {
      "name": "SelectionFieldDescriptor",
      "kind": "type",
      "definition": "{\n\tid: string;\n\tlabel: string;\n\tdescription?: string;\n\tvalueType: \"string\" | \"number\" | \"boolean\" | \"date\" | \"enum\";\n\toperators: string[];\n\tcontrol?: \"text\" | \"select\" | \"multi-select\" | \"boolean\" | \"date-range\";\n\tvalues?: SelectionValue[];\n\tvaluesComplete?: boolean;\n\tlookup?: boolean;\n}"
    },
    {
      "name": "SelectionDescriptor",
      "kind": "type",
      "definition": "{\n\tobjectType: string;\n\ttitle: string;\n\tdescription?: string;\n\tfields: SelectionFieldDescriptor[];\n\tfilterExample?: FilterObject;\n\trevision?: string;\n}"
    },
    {
      "name": "SelectionStats",
      "kind": "type",
      "definition": "{ totalCount: number }"
    },
    {
      "name": "LeadSelection",
      "kind": "type",
      "definition": "{\n\tids?: string[];\n\tfilter?: FilterObject;\n}"
    },
    {
      "name": "LeadListParams",
      "kind": "type",
      "definition": "PaginationParams & {\n\t// Canonical predicate shared by the table header, the assistant and\n\t// group operations.\n\tfilter?: FilterObject;\n\ttags?: string[];\n\t// Case-insensitive search over id, description and contact values.\n\tquery?: string;\n\t// Case-insensitive substring match over the lead's contact values\n\t// (email, domain, phone…). Combinable with tags.\n\tcontact?: string;\n\t// Keyset cursor: when set, returns leads with id > after, ordered by id ASC\n\t// (ignores offset). Not supported together with filters (tags/contact).\n\tafter?: string;\n}"
    },
    {
      "name": "ContactListParams",
      "kind": "type",
      "definition": "PaginationParams & {\n\tfilter?: FilterObject;\n}"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n\titems: T[];\n\ttotalCount?: number;\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface SalesServiceRtClient {
  addLead(lead: Lead): string;
  getLead(leadId: string): Lead | any;
  updateLead(lead: LeadUpdate): boolean;
  updateLeadCatalogId(leadId: string, catalogId: string): boolean;
  assignLeadTag(leadId: string, tagName: string): void;
  removeLeadTag(leadId: string, tagName: string): boolean;
  listLeadTags(leadId: string): LeadTag[];
  listLeadTagLinks(params: PaginationParams): PaginatedResult<LeadTagLink>;
  saveTag(tag: LeadTagInput): string;
  ensureTag(name: string, description?: string): string;
  findTagId(name: string): string | any;
  getTag(tagId: string): LeadTag | any;
  listTags(params: PaginationParams): PaginatedResult<LeadTag>;
  deleteTag(tagId: string): boolean;
  assignTag(tagId: string, selection: LeadSelection): number;
  unassignTag(tagId: string, selection: LeadSelection): number;
  listTagLeads(tagId: string, params: PaginationParams): PaginatedResult<Lead>;
  describeSelection(objectType: string): SelectionDescriptor;
  inspectLeads(filter?: FilterObject): SelectionStats;
  saveOffer(offer: Offer): string;
  getOffer(offerId: string): Offer | any;
  listOffers(params: PaginationParams): PaginatedResult<Offer>;
  addContact(contact: Contact): string;
  getContact(contactId: string): Contact | any;
  addTouch(touch: Touch): number;
  saveOutreach(outreach: Outreach): string;
  getOutreach(outreachId: string): Outreach | any;
  listOutreaches(params: PaginationParams): PaginatedResult<Outreach>;
  addOutreachTargets(targets: OutreachTargetInput[]): number;
  listOutreachTargets(params: OutreachTargetListParams): PaginatedResult<OutreachTarget>;
  claimNextOutreachTarget(outreachId: string): OutreachTarget | any;
  updateOutreachTargetStatus(update: OutreachTargetStatusUpdate): OutreachTarget | any;
  getStatistic(keys?: SalesStatisticKey[]): Statistic;
  getDailyStatistic(): any;
  listLeads(params: LeadListParams): PaginatedResult<Lead>;
  listContacts(params: ContactListParams): PaginatedResult<Contact>;
  listLeadContacts(leadId: string): PaginatedResult<Contact>;
  listTouches(params: PaginationParams): PaginatedResult<Touch>;
  recordEvent(event: LeadEvent): string;
  listEvents(params: PaginationParams): PaginatedResult<LeadEvent>;
  getEventFunnel(): Record<string, number>;
  parseImportLeads(input: ParseImportLeadsInput): ParseImportLeadsResult;
  normalizeImportLeads(input: NormalizeImportLeadsInput): NormalizeImportLeadsResult;
  findOutreachCandidate(lang: string): OutreachCandidate | any;
  findRandomLeadByLang(lang: string): Lead | any;
  leadHasTouches(leadId: string): boolean;
  leadHasCompanyTouch(leadId: string, companyName: string): boolean;
  leadHasOutreachTouch(leadId: string, outreachId: string): boolean;
}

export function createSalesServiceRtClient(): SalesServiceRtClient {
  return createRtClient<SalesServiceRtClient>(metadata);
}
