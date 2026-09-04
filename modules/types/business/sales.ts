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

/** A named label a lead can carry. Naming a selection of leads is the only
 *  way a group gets a name here: there is no second grouping entity. */
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

export type OutreachStatus =
	| "draft"
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

/** Business-facing name. Outreach remains as a storage/API compatibility alias. */
export type Campaign = Outreach;

export type OutreachTargetStatus =
	| "planned"
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

// ---- lead import (wf-sales-import) -----------------------------------------
// One raw row as it came out of a spreadsheet, a JSON dump or an LLM answer:
// every field optional, nothing normalized yet.

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

/** Which parser produced the rows: JSON payload, delimited table (csv/tsv with
 *  a header), loose per-line scraping, or nothing recognizable. */
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

/**
 * What a group operation is applied to. `ids` is an explicit subset — the rows
 * a person ticked. Without it the operation runs over everything `filter`
 * matches, so a selection of 12 000 leads never travels as 12 000 identifiers.
 * Empty means every lead.
 */
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

export type PaginatedResult<T> = {
	items: T[];
	totalCount?: number;
};

export interface SalesService {
	addLead(lead: Lead): Promise<string>;
	getLead(leadId: string): Promise<Lead | null>;
	updateLead(lead: LeadUpdate): Promise<boolean>;
	updateLeadCatalogId(leadId: string, catalogId: string): Promise<boolean>;
	assignLeadTag(leadId: string, tagName: string): Promise<void>;
	removeLeadTag(leadId: string, tagName: string): Promise<boolean>;
	listLeadTags(leadId: string): Promise<LeadTag[]>;
	listLeadTagLinks(
		params: PaginationParams,
	): Promise<PaginatedResult<LeadTagLink>>;
	saveTag(tag: LeadTagInput): Promise<string>;
	/** Upserts by name: what "name this selection" needs and nothing more. */
	ensureTag(name: string, description?: string): Promise<string>;
	findTagId(name: string): Promise<string | null>;
	getTag(tagId: string): Promise<LeadTag | null>;
	listTags(params: PaginationParams): Promise<PaginatedResult<LeadTag>>;
	deleteTag(tagId: string): Promise<boolean>;
	assignTag(tagId: string, selection: LeadSelection): Promise<number>;
	unassignTag(tagId: string, selection: LeadSelection): Promise<number>;
	listTagLeads(
		tagId: string,
		params: PaginationParams,
	): Promise<PaginatedResult<Lead>>;
	describeSelection(objectType: string): Promise<SelectionDescriptor>;
	inspectLeads(filter?: FilterObject): Promise<SelectionStats>;
	saveOffer(offer: Offer): Promise<string>;
	getOffer(offerId: string): Promise<Offer | null>;
	listOffers(params: PaginationParams): Promise<PaginatedResult<Offer>>;
	addContact(contact: Contact): Promise<string>;
	getContact(contactId: string): Promise<Contact | null>;
	addTouch(touch: Touch): Promise<number>;
	saveOutreach(outreach: Outreach): Promise<string>;
	getOutreach(outreachId: string): Promise<Outreach | null>;
	listOutreaches(params: PaginationParams): Promise<PaginatedResult<Outreach>>;
	addOutreachTargets(targets: OutreachTargetInput[]): Promise<number>;
	listOutreachTargets(
		params: OutreachTargetListParams,
	): Promise<PaginatedResult<OutreachTarget>>;
	claimNextOutreachTarget(outreachId: string): Promise<OutreachTarget | null>;
	updateOutreachTargetStatus(
		update: OutreachTargetStatusUpdate,
	): Promise<OutreachTarget | null>;
	getStatistic(keys?: SalesStatisticKey[]): Promise<Statistic>;
	getDailyStatistic(): Promise<{ [key: string]: Statistic }>;
	listLeads(params: LeadListParams): Promise<PaginatedResult<Lead>>;
	listContacts(params: PaginationParams): Promise<PaginatedResult<Contact>>;
	listLeadContacts(leadId: string): Promise<PaginatedResult<Contact>>;
	listTouches(params: PaginationParams): Promise<PaginatedResult<Touch>>;
	recordEvent(event: LeadEvent): Promise<string>;
	listEvents(params: PaginationParams): Promise<PaginatedResult<LeadEvent>>;
	getEventFunnel(): Promise<Record<string, number>>;
	parseImportLeads(
		input: ParseImportLeadsInput,
	): Promise<ParseImportLeadsResult>;
	normalizeImportLeads(
		input: NormalizeImportLeadsInput,
	): Promise<NormalizeImportLeadsResult>;
	findOutreachCandidate(lang: string): Promise<OutreachCandidate | null>;
	findRandomLeadByLang(lang: string): Promise<Lead | null>;
	leadHasTouches(leadId: string): Promise<boolean>;
	leadHasCompanyTouch(leadId: string, companyName: string): Promise<boolean>;
	leadHasOutreachTouch(leadId: string, outreachId: string): Promise<boolean>;
}
