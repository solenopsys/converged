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
	touchesByCompanyName?: Record<string, number>;
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
	leadHasCompanyTouch(leadId: string, companyName: string): Promise<boolean>;
}
