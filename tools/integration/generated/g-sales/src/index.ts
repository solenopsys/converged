// Auto-generated package
import { createHttpClient } from "nrpc";

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
	createdAt: Date;
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
};

export type PaginationParams = {
	offset: number;
	limit: number;
};

export type LeadListParams = PaginationParams & {
	tags?: string[];
};

export type PaginatedResult<T> = {
	items: T[];
	totalCount?: number;
};

export const metadata = {
	interfaceName: "SalesService",
	serviceName: "sales",
	filePath: "services/business/sales.ts",
	methods: [
		{
			name: "addLead",
			parameters: [
				{
					name: "lead",
					type: "Lead",
					optional: false,
					isArray: false,
				},
			],
			returnType: "string",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "updateLeadCatalogId",
			parameters: [
				{
					name: "leadId",
					type: "string",
					optional: false,
					isArray: false,
				},
				{
					name: "catalogId",
					type: "string",
					optional: false,
					isArray: false,
				},
			],
			returnType: "boolean",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "assignLeadTag",
			parameters: [
				{
					name: "leadId",
					type: "string",
					optional: false,
					isArray: false,
				},
				{
					name: "tagName",
					type: "string",
					optional: false,
					isArray: false,
				},
			],
			returnType: "void",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "removeLeadTag",
			parameters: [
				{
					name: "leadId",
					type: "string",
					optional: false,
					isArray: false,
				},
				{
					name: "tagName",
					type: "string",
					optional: false,
					isArray: false,
				},
			],
			returnType: "boolean",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "listLeadTags",
			parameters: [
				{
					name: "leadId",
					type: "string",
					optional: false,
					isArray: false,
				},
			],
			returnType: "LeadTag",
			isAsync: true,
			returnTypeIsArray: true,
			isAsyncIterable: false,
		},
		{
			name: "listLeadTagLinks",
			parameters: [
				{
					name: "params",
					type: "PaginationParams",
					optional: false,
					isArray: false,
				},
			],
			returnType: "PaginatedResult<LeadTag>",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "saveOffer",
			parameters: [
				{
					name: "offer",
					type: "Offer",
					optional: false,
					isArray: false,
				},
			],
			returnType: "string",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "listOffers",
			parameters: [
				{
					name: "params",
					type: "PaginationParams",
					optional: false,
					isArray: false,
				},
			],
			returnType: "PaginatedResult<Offer>",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "addContact",
			parameters: [
				{
					name: "contact",
					type: "Contact",
					optional: false,
					isArray: false,
				},
			],
			returnType: "string",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "addTouch",
			parameters: [
				{
					name: "touch",
					type: "Touch",
					optional: false,
					isArray: false,
				},
			],
			returnType: "number",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "getStatistic",
			parameters: [],
			returnType: "Statistic",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "getDailyStatistic",
			parameters: [],
			returnType: "{ [key: string]: Statistic }",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "listLeads",
			parameters: [
				{
					name: "params",
					type: "LeadListParams",
					optional: false,
					isArray: false,
				},
			],
			returnType: "PaginatedResult<Lead>",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "listContacts",
			parameters: [
				{
					name: "params",
					type: "PaginationParams",
					optional: false,
					isArray: false,
				},
			],
			returnType: "PaginatedResult<Contact>",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "listLeadContacts",
			parameters: [
				{
					name: "leadId",
					type: "string",
					optional: false,
					isArray: false,
				},
			],
			returnType: "PaginatedResult<Contact>",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "listTouches",
			parameters: [
				{
					name: "params",
					type: "PaginationParams",
					optional: false,
					isArray: false,
				},
			],
			returnType: "PaginatedResult<Touch>",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "recordEvent",
			parameters: [
				{
					name: "event",
					type: "LeadEvent",
					optional: false,
					isArray: false,
				},
			],
			returnType: "string",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "listEvents",
			parameters: [
				{
					name: "params",
					type: "PaginationParams",
					optional: false,
					isArray: false,
				},
			],
			returnType: "PaginatedResult<LeadEvent>",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "getEventFunnel",
			parameters: [],
			returnType: "Record<string, number>",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "findOutreachCandidate",
			parameters: [
				{
					name: "lang",
					type: "string",
					optional: false,
					isArray: false,
				},
			],
			returnType: "OutreachCandidate | null",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "findRandomLeadByLang",
			parameters: [
				{
					name: "lang",
					type: "string",
					optional: false,
					isArray: false,
				},
			],
			returnType: "Lead | null",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
		{
			name: "leadHasTouches",
			parameters: [
				{
					name: "leadId",
					type: "string",
					optional: false,
					isArray: false,
				},
			],
			returnType: "boolean",
			isAsync: true,
			returnTypeIsArray: false,
			isAsyncIterable: false,
		},
	],
	types: [
		{
			name: "LeadType",
			kind: "raw",
			definition:
				'export enum LeadType {\n  CNC = "cnc",\n  PRINT_3D = "3dprint",\n}',
		},
		{
			name: "Lead",
			kind: "type",
			definition:
				"{\n  id: string;\n  description: string;\n  lang: string;\n  type: LeadType | string;\n  catalogId: string;\n  createdAt: Date;\n}",
		},
		{
			name: "LeadTag",
			kind: "type",
			definition:
				"{\n  leadId: string;\n  tagName: string;\n  createdAt: Date;\n}",
		},
		{
			name: "Offer",
			kind: "type",
			definition:
				"{\n  id: string;\n  description: string;\n  template_path: string;\n}",
		},
		{
			name: "ContactType",
			kind: "raw",
			definition:
				'export enum ContactType {\n  EMAIL = "EMAIL",\n  PHONE = "PHONE",\n  LINKEDIN = "LINKEDIN",\n  DOMAIN = "DOMAIN",\n}',
		},
		{
			name: "Contact",
			kind: "type",
			definition:
				"{\n  id: string;\n  leadId: string;\n  type: ContactType;\n  value: string;\n  role: string;\n  description: string;\n  createdAt: Date;\n}",
		},
		{
			name: "Touch",
			kind: "type",
			definition:
				"{\n  id: number;\n  contactId: string;\n  description: string;\n  createdAt: Date;\n}",
		},
		{
			name: "LeadEventType",
			kind: "raw",
			definition:
				'export enum LeadEventType {\n  EMAIL_SENT = "email_sent",\n  EMAIL_OPEN = "email_open",\n  CLICK = "click",\n  PAGE_VIEW = "page_view",\n}',
		},
		{
			name: "LeadEvent",
			kind: "type",
			definition:
				"{\n  id: string;\n  code: string;\n  type: LeadEventType | string;\n  contactId?: string | null;\n  leadId?: string | null;\n  url?: string | null;\n  referrer?: string | null;\n  userAgent?: string | null;\n  createdAt: Date;\n}",
		},
		{
			name: "OutreachCandidate",
			kind: "type",
			definition: "{\n  lead: Lead;\n  contact: Contact;\n}",
		},
		{
			name: "Statistic",
			kind: "type",
			definition:
				"{\n  leads: number;\n  touches: number;\n  byType?: Record<string, number>;\n  byLang?: Record<string, number>;\n  contactsByType?: Record<string, number>;\n}",
		},
		{
			name: "PaginationParams",
			kind: "type",
			definition: "{\n  offset: number;\n  limit: number;\n}",
		},
		{
			name: "LeadListParams",
			kind: "type",
			definition: "PaginationParams & {\n  tags?: string[];\n}",
		},
		{
			name: "PaginatedResult",
			kind: "type",
			typeParameters: "<T>",
			definition: "{\n  items: T[];\n  totalCount?: number;\n}",
		},
	],
};

// Server interface (to be implemented in microservice)
export interface SalesService {
	addLead(lead: Lead): Promise<string>;
	updateLeadCatalogId(leadId: string, catalogId: string): Promise<boolean>;
	assignLeadTag(leadId: string, tagName: string): Promise<void>;
	removeLeadTag(leadId: string, tagName: string): Promise<boolean>;
	listLeadTags(leadId: string): Promise<LeadTag[]>;
	listLeadTagLinks(params: PaginationParams): Promise<PaginatedResult<LeadTag>>;
	saveOffer(offer: Offer): Promise<string>;
	listOffers(params: PaginationParams): Promise<PaginatedResult<Offer>>;
	addContact(contact: Contact): Promise<string>;
	addTouch(touch: Touch): Promise<number>;
	getStatistic(): Promise<Statistic>;
	getDailyStatistic(): Promise<{ [key: string]: Statistic }>;
	listLeads(params: LeadListParams): Promise<PaginatedResult<Lead>>;
	listContacts(params: PaginationParams): Promise<PaginatedResult<Contact>>;
	listLeadContacts(leadId: string): Promise<PaginatedResult<Contact>>;
	listTouches(params: PaginationParams): Promise<PaginatedResult<Touch>>;
	recordEvent(event: LeadEvent): Promise<string>;
	listEvents(params: PaginationParams): Promise<PaginatedResult<LeadEvent>>;
	getEventFunnel(): Promise<Record<string, number>>;
	findOutreachCandidate(lang: string): Promise<OutreachCandidate | null>;
	findRandomLeadByLang(lang: string): Promise<Lead | null>;
	leadHasTouches(leadId: string): Promise<boolean>;
}

// Client interface
export interface SalesServiceClient {
	addLead(lead: Lead): Promise<string>;
	updateLeadCatalogId(leadId: string, catalogId: string): Promise<boolean>;
	assignLeadTag(leadId: string, tagName: string): Promise<void>;
	removeLeadTag(leadId: string, tagName: string): Promise<boolean>;
	listLeadTags(leadId: string): Promise<LeadTag[]>;
	listLeadTagLinks(params: PaginationParams): Promise<PaginatedResult<LeadTag>>;
	saveOffer(offer: Offer): Promise<string>;
	listOffers(params: PaginationParams): Promise<PaginatedResult<Offer>>;
	addContact(contact: Contact): Promise<string>;
	addTouch(touch: Touch): Promise<number>;
	getStatistic(): Promise<Statistic>;
	getDailyStatistic(): Promise<{ [key: string]: Statistic }>;
	listLeads(params: LeadListParams): Promise<PaginatedResult<Lead>>;
	listContacts(params: PaginationParams): Promise<PaginatedResult<Contact>>;
	listLeadContacts(leadId: string): Promise<PaginatedResult<Contact>>;
	listTouches(params: PaginationParams): Promise<PaginatedResult<Touch>>;
	recordEvent(event: LeadEvent): Promise<string>;
	listEvents(params: PaginationParams): Promise<PaginatedResult<LeadEvent>>;
	getEventFunnel(): Promise<Record<string, number>>;
	findOutreachCandidate(lang: string): Promise<OutreachCandidate | null>;
	findRandomLeadByLang(lang: string): Promise<Lead | null>;
	leadHasTouches(leadId: string): Promise<boolean>;
}

// Factory function
export function createSalesServiceClient(config?: {
	baseUrl?: string;
}): SalesServiceClient {
	return createHttpClient<SalesServiceClient>(metadata, config);
}

// Ready-to-use client
export const salesClient = createSalesServiceClient();
