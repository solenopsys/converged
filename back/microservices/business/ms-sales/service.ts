import { randomUUID } from "node:crypto";
import { BaseService, badRequestError, conflictError } from "back-core";
import { StoresController } from "./store";
import type {
	Contact,
	Lead,
	LeadEvent,
	LeadListParams,
	LeadTag,
	LeadUpdate,
	Offer,
	Outreach,
	OutreachCandidate,
	OutreachTarget,
	OutreachTargetInput,
	OutreachTargetListParams,
	OutreachTargetStatusUpdate,
	PaginatedResult,
	PaginationParams,
	SalesService,
	Statistic,
	Touch,
} from "./types";

function normalizeDate(value: unknown): Date {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value;
	}

	if (typeof value === "string" || typeof value === "number") {
		const timestamp =
			typeof value === "number" && value > 0 && value < 100000000000
				? value * 1000
				: value;
		const date = new Date(timestamp);
		if (!Number.isNaN(date.getTime())) {
			return date;
		}
	}

	return new Date();
}

function normalizePayload(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw badRequestError("target payload is required");
	}
	return value as Record<string, unknown>;
}

function parsePayload(value: string): Record<string, unknown> {
	try {
		const parsed = JSON.parse(value);
		return parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: {};
	} catch {
		return {};
	}
}

function createTouchId(): string {
	const suffix = Math.floor(Math.random() * 1000)
		.toString()
		.padStart(3, "0");
	return `${Date.now()}${suffix}`;
}

function toSeconds(value: unknown): number {
	return Math.floor(normalizeDate(value).getTime() / 1000);
}

function isPrimaryKeyConflict(error: unknown): boolean {
	const err = error as { code?: string; errno?: number } | null;
	return err?.code === "SQLITE_CONSTRAINT_PRIMARYKEY" || err?.errno === 1555;
}

function readBoolean(value: unknown): boolean {
	return value === true || value === 1 || value === "1";
}

function mapLead(entity: any): Lead {
	return {
		id: entity.id,
		description: entity.description,
		lang: entity.lang,
		type: entity.type,
		catalogId: entity.catalogId,
		disabled: readBoolean(entity.disabled),
		createdAt: new Date(entity.createdAt * 1000),
	};
}

class SalesServiceImpl
	extends BaseService<StoresController>
	implements SalesService
{
	constructor() {
		super("sales-ms");
	}

	protected createStores(msId: string): StoresController {
		return new StoresController(msId);
	}

	async addLead(lead: Lead): Promise<string> {
		await this.ready();
		if (!lead.id || !lead.description) {
			throw badRequestError("Lead id and description are required");
		}

		try {
			const createdAt = normalizeDate(lead.createdAt);
			const leadEntity = {
				id: lead.id,
				createdAt: Math.floor(createdAt.getTime() / 1000),
				description: lead.description,
				lang: lead.lang ?? "",
				type: lead.type ?? "",
				catalogId: lead.catalogId ?? "",
				disabled: Boolean(lead.disabled),
			};
			await this.stores.salesStoreSevice.leadRepo.create(leadEntity);
			return lead.id;
		} catch (err) {
			if (isPrimaryKeyConflict(err)) {
				throw conflictError(`Lead with id '${lead.id}' already exists`);
			}
			throw err;
		}
	}

	async getLead(leadId: string): Promise<Lead | null> {
		await this.ready();
		const normalizedLeadId = leadId?.trim();
		if (!normalizedLeadId) {
			throw badRequestError("leadId is required");
		}

		const entity = await this.stores.salesStoreSevice.leadRepo.findById({
			id: normalizedLeadId,
		});
		if (!entity) return null;

		return mapLead(entity);
	}

	async updateLead(lead: LeadUpdate): Promise<boolean> {
		await this.ready();
		const normalizedLeadId = lead.id?.trim();
		if (!normalizedLeadId) {
			throw badRequestError("lead id is required");
		}

		const patch: Record<string, unknown> = {};
		if (lead.description !== undefined) patch.description = lead.description;
		if (lead.lang !== undefined) patch.lang = lead.lang;
		if (lead.type !== undefined) patch.type = lead.type;
		if (lead.catalogId !== undefined) patch.catalogId = lead.catalogId;
		if (lead.disabled !== undefined) patch.disabled = Boolean(lead.disabled);

		if (Object.keys(patch).length === 0) return false;

		const updated = await this.stores.salesStoreSevice.leadRepo.update(
			{ id: normalizedLeadId },
			patch,
		);
		return Boolean(updated);
	}

	async updateLeadCatalogId(
		leadId: string,
		catalogId: string,
	): Promise<boolean> {
		await this.ready();
		const normalizedLeadId = leadId?.trim();
		const normalizedCatalogId = catalogId?.trim();

		if (!normalizedLeadId || !normalizedCatalogId) {
			throw badRequestError("leadId and catalogId are required");
		}

		return this.stores.salesStoreSevice.updateLeadCatalogId(
			normalizedLeadId,
			normalizedCatalogId,
		);
	}

	async assignLeadTag(leadId: string, tagName: string): Promise<void> {
		await this.ready();
		const normalizedTagName = tagName?.trim();
		if (!leadId || !normalizedTagName) {
			throw badRequestError("leadId and tagName are required");
		}

		await this.stores.salesStoreSevice.assignLeadTag(leadId, normalizedTagName);
	}

	async removeLeadTag(leadId: string, tagName: string): Promise<boolean> {
		await this.ready();
		const normalizedTagName = tagName?.trim();
		if (!leadId || !normalizedTagName) {
			throw badRequestError("leadId and tagName are required");
		}

		return this.stores.salesStoreSevice.removeLeadTag(
			leadId,
			normalizedTagName,
		);
	}

	async listLeadTags(leadId: string): Promise<LeadTag[]> {
		await this.ready();
		if (!leadId) {
			throw badRequestError("leadId is required");
		}

		const tags = await this.stores.salesStoreSevice.listLeadTags(leadId);
		return tags.map((tag) => ({
			leadId: tag.leadId,
			tagName: tag.tagName,
			createdAt: new Date(tag.createdAt * 1000),
		}));
	}

	async listLeadTagLinks(
		params: PaginationParams,
	): Promise<PaginatedResult<LeadTag>> {
		await this.ready();
		const result = await this.stores.salesStoreSevice.listLeadTagLinks(params);
		return {
			items: result.items.map((tag) => ({
				leadId: tag.leadId,
				tagName: tag.tagName,
				createdAt: new Date(tag.createdAt * 1000),
			})),
			totalCount: result.totalCount,
		};
	}

	async saveOffer(offer: Offer): Promise<string> {
		await this.ready();
		const id = offer.id?.trim();
		if (!id) {
			throw badRequestError("Offer id is required");
		}

		await this.stores.salesStoreSevice.saveOffer({
			id,
			description: offer.description ?? "",
			template_path: offer.template_path ?? "",
		});
		return id;
	}

	async listOffers(params: PaginationParams): Promise<PaginatedResult<Offer>> {
		await this.ready();
		const [items, totalCount] = await Promise.all([
			this.stores.salesStoreSevice.offerRepo.findAll({
				limit: params.limit,
				offset: params.offset,
			}),
			this.stores.salesStoreSevice.offerRepo.count(),
		]);

		return {
			items: items.map((offer) => ({
				id: offer.id,
				description: offer.description,
				template_path: offer.template_path,
			})),
			totalCount,
		};
	}

	async addContact(contact: Contact): Promise<string> {
		await this.ready();
		if (!contact.id || !contact.leadId || !contact.type) {
			throw badRequestError("Contact id, leadId, and type are required");
		}

		try {
			const createdAt = normalizeDate(contact.createdAt);
			const contactEntity = {
				id: contact.id,
				leadId: contact.leadId,
				createdAt: Math.floor(createdAt.getTime() / 1000),
				contactType: contact.type,
				value: contact.value ?? "",
				role: contact.role ?? "",
				description: contact.description ?? "",
			};
			await this.stores.salesStoreSevice.contactRepo.create(contactEntity);
			return contact.id;
		} catch (err) {
			if (isPrimaryKeyConflict(err)) {
				throw conflictError(`Contact with id '${contact.id}' already exists`);
			}
			throw err;
		}
	}

	async getContact(contactId: string): Promise<Contact | null> {
		await this.ready();
		const normalizedContactId = contactId?.trim();
		if (!normalizedContactId) {
			throw badRequestError("contactId is required");
		}

		const entity = await this.stores.salesStoreSevice.contactRepo.findById({
			id: normalizedContactId,
		});
		if (!entity) return null;

		return {
			id: entity.id,
			leadId: entity.leadId,
			type: entity.contactType as Contact["type"],
			value: entity.value,
			role: entity.role,
			description: entity.description,
			createdAt: new Date(entity.createdAt * 1000),
		};
	}

	async addTouch(touch: Touch): Promise<number> {
		await this.ready();
		if (!touch.contactId || !touch.description) {
			throw badRequestError("Touch contactId and description are required");
		}

		try {
			const createdAt = normalizeDate(touch.createdAt);
			const touchEntity = {
				id: createTouchId(),
				contactId: touch.contactId,
				createdAt: Math.floor(createdAt.getTime() / 1000),
				description: touch.description,
				companyName: touch.companyName ?? "",
				outreachId: touch.outreachId ?? null,
			};
			const result =
				await this.stores.salesStoreSevice.touchRepo.create(touchEntity);
			return result?.id ? Number(result.id) : 0;
		} catch (err) {
			if (isPrimaryKeyConflict(err)) {
				throw conflictError("Touch already exists");
			}
			throw err;
		}
	}

	async saveOutreach(outreach: Outreach): Promise<string> {
		await this.ready();
		const id = outreach.id?.trim();
		const name = outreach.name?.trim();
		if (!id || !name) {
			throw badRequestError("Outreach id and name are required");
		}

		const now = Math.floor(Date.now() / 1000);
		await this.stores.salesStoreSevice.saveOutreach({
			id,
			name,
			status: outreach.status?.trim() || "draft",
			lang: outreach.lang?.trim().toLowerCase() ?? "",
			description: outreach.description ?? "",
			createdAt: toSeconds(outreach.createdAt ?? now),
			updatedAt: now,
		});

		return id;
	}

	async listOutreaches(
		params: PaginationParams,
	): Promise<PaginatedResult<Outreach>> {
		await this.ready();
		const result = await this.stores.salesStoreSevice.listOutreaches(params);
		return {
			items: result.items.map((entity) => ({
				id: entity.id,
				name: entity.name,
				status: entity.status,
				lang: entity.lang,
				description: entity.description,
				createdAt: new Date(entity.createdAt * 1000),
				updatedAt: new Date(entity.updatedAt * 1000),
			})),
			totalCount: result.totalCount,
		};
	}

	async addOutreachTargets(targets: OutreachTargetInput[]): Promise<number> {
		await this.ready();
		if (!Array.isArray(targets) || targets.length === 0) return 0;

		const now = Math.floor(Date.now() / 1000);
		const entities = targets.map((target, index) => {
			const outreachId = target.outreachId?.trim();
			if (!outreachId) {
				throw badRequestError("outreachId is required");
			}
			const payload = normalizePayload(target.payload);

			return {
				id: target.id?.trim() || randomUUID(),
				outreachId,
				status: target.status?.trim() || "planned",
				position: Number.isFinite(target.position)
					? Number(target.position)
					: index,
				payload: JSON.stringify(payload),
				createdAt: now,
				updatedAt: now,
			};
		});

		return this.stores.salesStoreSevice.addOutreachTargets(entities);
	}

	async listOutreachTargets(
		params: OutreachTargetListParams,
	): Promise<PaginatedResult<OutreachTarget>> {
		await this.ready();
		const result = await this.stores.salesStoreSevice.listOutreachTargets({
			...params,
			outreachId: params.outreachId?.trim(),
			status: params.status?.trim(),
		});

		return {
			items: result.items.map((entity) => this.toOutreachTarget(entity)),
			totalCount: result.totalCount,
		};
	}

	async claimNextOutreachTarget(
		outreachId: string,
	): Promise<OutreachTarget | null> {
		await this.ready();
		const normalizedOutreachId = outreachId?.trim();
		if (!normalizedOutreachId) {
			throw badRequestError("outreachId is required");
		}

		const target =
			await this.stores.salesStoreSevice.claimNextOutreachTarget(
				normalizedOutreachId,
			);
		return target ? this.toOutreachTarget(target) : null;
	}

	async updateOutreachTargetStatus(
		update: OutreachTargetStatusUpdate,
	): Promise<OutreachTarget | null> {
		await this.ready();
		const id = update.id?.trim();
		const status = update.status?.trim();
		if (!id || !status) {
			throw badRequestError("target id and status are required");
		}

		const target =
			await this.stores.salesStoreSevice.updateOutreachTargetStatus({
				id,
				status,
			});

		return target ? this.toOutreachTarget(target) : null;
	}

	async getStatistic(): Promise<Statistic> {
		await this.ready();
		const [
			leads,
			touches,
			byType,
			byLang,
			contactsByType,
			touchesByCompanyName,
			outreachProgress,
		] = await Promise.all([
			this.stores.salesStoreSevice.leadRepo.count(),
			this.stores.salesStoreSevice.touchRepo.count(),
			this.stores.salesStoreSevice.getLeadTypeStats(),
			this.stores.salesStoreSevice.getLeadLangStats(),
			this.stores.salesStoreSevice.getContactTypeStats(),
			this.stores.salesStoreSevice.getTouchCompanyNameStats(),
			this.stores.salesStoreSevice.getOutreachProgressStats(),
		]);

		return {
			leads,
			touches,
			byType,
			byLang,
			contactsByType,
			touchesByCompanyName,
			outreachProgress,
		};
	}

	async getDailyStatistic(): Promise<{ [key: string]: Statistic }> {
		await this.ready();
		return await this.stores.salesStoreSevice.getDailyStatistics();
	}

	async listLeads(params: LeadListParams): Promise<PaginatedResult<Lead>> {
		await this.ready();
		const tags = params.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [];
		const contact = params.contact?.trim() ?? "";
		const useCursor = typeof params.after === "string";
		if (useCursor && (tags.length || contact)) {
			throw new Error(
				"listLeads: 'after' cursor is not supported together with filters (tags/contact)",
			);
		}
		const result = useCursor
			? await this.stores.salesStoreSevice.listLeadsAfter(
					params.after as string,
					params.limit,
				)
			: tags.length || contact
				? await this.stores.salesStoreSevice.listLeadsFiltered(
						{ tags, contact },
						params,
					)
				: {
						items: await this.stores.salesStoreSevice.leadRepo.findAll({
							limit: params.limit,
							offset: params.offset,
						}),
						totalCount: await this.stores.salesStoreSevice.leadRepo.count(),
					};

		const items = result.items.map(mapLead);

		return {
			items,
			totalCount: result.totalCount,
		};
	}

	async listContacts(
		params: PaginationParams,
	): Promise<PaginatedResult<Contact>> {
		await this.ready();
		const [contacts, totalCount] = await Promise.all([
			this.stores.salesStoreSevice.contactRepo.findAll({
				limit: params.limit,
				offset: params.offset,
			}),
			this.stores.salesStoreSevice.contactRepo.count(),
		]);

		const items = contacts.map((entity) => ({
			id: entity.id,
			leadId: entity.leadId,
			type: entity.contactType as Contact["type"],
			value: entity.value,
			role: entity.role,
			description: entity.description,
			createdAt: new Date(entity.createdAt * 1000),
		}));

		return {
			items,
			totalCount,
		};
	}

	async listLeadContacts(leadId: string): Promise<PaginatedResult<Contact>> {
		await this.ready();
		const contacts =
			await this.stores.salesStoreSevice.listLeadContacts(leadId);

		const items = contacts.map((entity) => ({
			id: entity.id,
			leadId: entity.leadId,
			type: entity.contactType as Contact["type"],
			value: entity.value,
			role: entity.role,
			description: entity.description,
			createdAt: new Date(entity.createdAt * 1000),
		}));

		return {
			items,
			totalCount: items.length,
		};
	}

	async listTouches(params: PaginationParams): Promise<PaginatedResult<Touch>> {
		await this.ready();
		const [touches, totalCount] = await Promise.all([
			this.stores.salesStoreSevice.touchRepo.findAll({
				limit: params.limit,
				offset: params.offset,
			}),
			this.stores.salesStoreSevice.touchRepo.count(),
		]);

		const items = touches.map((entity) => ({
			id: parseInt(entity.id, 10),
			contactId: entity.contactId,
			description: entity.description,
			companyName: entity.companyName ?? "",
			outreachId: entity.outreachId ?? "",
			createdAt: new Date(entity.createdAt * 1000),
		}));

		return {
			items,
			totalCount,
		};
	}

	async recordEvent(event: LeadEvent): Promise<string> {
		await this.ready();
		const code = event.code?.trim();
		const type = event.type?.toString().trim();
		if (!code || !type) {
			throw badRequestError("Event code and type are required");
		}

		// Use ids supplied by the caller; otherwise resolve them from the code's
		// owning `email_sent` event so opens/clicks/page-views attribute to the lead.
		let contactId = event.contactId ?? null;
		let leadId = event.leadId ?? null;
		if (!contactId || !leadId) {
			const owner = await this.stores.salesStoreSevice.resolveCodeOwner(code);
			contactId = contactId ?? owner.contactId;
			leadId = leadId ?? owner.leadId;
		}

		const createdAt = normalizeDate(event.createdAt);
		const id = createTouchId();
		await this.stores.salesStoreSevice.addLeadEvent({
			id,
			code,
			type,
			contactId,
			leadId,
			url: event.url ?? null,
			referrer: event.referrer ?? null,
			userAgent: event.userAgent ?? null,
			createdAt: Math.floor(createdAt.getTime() / 1000),
		});
		return id;
	}

	async listEvents(
		params: PaginationParams,
	): Promise<PaginatedResult<LeadEvent>> {
		await this.ready();
		const result = await this.stores.salesStoreSevice.listLeadEvents(params);
		return {
			items: result.items.map((entity) => ({
				id: entity.id,
				code: entity.code,
				type: entity.type,
				contactId: entity.contactId,
				leadId: entity.leadId,
				url: entity.url,
				referrer: entity.referrer,
				userAgent: entity.userAgent,
				createdAt: new Date(entity.createdAt * 1000),
			})),
			totalCount: result.totalCount,
		};
	}

	async getEventFunnel(): Promise<Record<string, number>> {
		await this.ready();
		return this.stores.salesStoreSevice.getEventFunnel();
	}

	async findOutreachCandidate(lang: string): Promise<OutreachCandidate | null> {
		await this.ready();
		const normalizedLang = lang?.trim().toLowerCase();
		if (!normalizedLang) {
			throw badRequestError("lang is required");
		}

		const candidate =
			await this.stores.salesStoreSevice.findOutreachCandidate(normalizedLang);
		if (!candidate) return null;

		return {
			contact: {
				id: candidate.contact.id,
				leadId: candidate.contact.leadId,
				type: candidate.contact.contactType as Contact["type"],
				value: candidate.contact.value,
				role: candidate.contact.role,
				description: candidate.contact.description,
				createdAt: new Date(candidate.contact.createdAt * 1000),
			},
			lead: mapLead(candidate.lead),
		};
	}

	async findRandomLeadByLang(lang: string): Promise<Lead | null> {
		await this.ready();
		const normalizedLang = lang?.trim().toLowerCase();
		if (!normalizedLang) {
			throw badRequestError("lang is required");
		}

		const lead =
			await this.stores.salesStoreSevice.findRandomLeadByLang(normalizedLang);
		if (!lead) return null;

		return mapLead(lead);
	}

	async leadHasTouches(leadId: string): Promise<boolean> {
		await this.ready();
		const normalizedLeadId = leadId?.trim();
		if (!normalizedLeadId) {
			throw badRequestError("leadId is required");
		}

		return this.stores.salesStoreSevice.leadHasTouches(normalizedLeadId);
	}

	async leadHasCompanyTouch(
		leadId: string,
		companyName: string,
	): Promise<boolean> {
		await this.ready();
		const normalizedLeadId = leadId?.trim();
		const normalizedCompanyName = companyName?.trim();
		if (!normalizedLeadId || !normalizedCompanyName) {
			throw badRequestError("leadId and companyName are required");
		}

		return this.stores.salesStoreSevice.leadHasCompanyTouch(
			normalizedLeadId,
			normalizedCompanyName,
		);
	}

	async leadHasOutreachTouch(
		leadId: string,
		outreachId: string,
	): Promise<boolean> {
		await this.ready();
		const normalizedLeadId = leadId?.trim();
		const normalizedOutreachId = outreachId?.trim();
		if (!normalizedLeadId || !normalizedOutreachId) {
			throw badRequestError("leadId and outreachId are required");
		}

		return this.stores.salesStoreSevice.leadHasOutreachTouch(
			normalizedLeadId,
			normalizedOutreachId,
		);
	}

	private toOutreachTarget(entity: {
		id: string;
		outreachId: string;
		status: string;
		position: number;
		payload: string;
		createdAt: number;
		updatedAt: number;
	}): OutreachTarget {
		return {
			id: entity.id,
			outreachId: entity.outreachId,
			status: entity.status,
			position: entity.position,
			payload: parsePayload(entity.payload),
			createdAt: new Date(entity.createdAt * 1000),
			updatedAt: new Date(entity.updatedAt * 1000),
		};
	}
}

export default SalesServiceImpl;
