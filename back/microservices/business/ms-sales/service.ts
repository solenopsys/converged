import { BaseService, badRequestError, conflictError } from "back-core";
import { StoresController } from "./store";
import type {
	Contact,
	Lead,
	LeadEvent,
	LeadListParams,
	LeadTag,
	Offer,
	OutreachCandidate,
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

function createTouchId(): string {
	const suffix = Math.floor(Math.random() * 1000)
		.toString()
		.padStart(3, "0");
	return `${Date.now()}${suffix}`;
}

function isPrimaryKeyConflict(error: unknown): boolean {
	const err = error as { code?: string; errno?: number } | null;
	return err?.code === "SQLITE_CONSTRAINT_PRIMARYKEY" || err?.errno === 1555;
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

	async getStatistic(): Promise<Statistic> {
		await this.ready();
		const [leads, touches, byType, byLang, contactsByType] = await Promise.all([
			this.stores.salesStoreSevice.leadRepo.count(),
			this.stores.salesStoreSevice.touchRepo.count(),
			this.stores.salesStoreSevice.getLeadTypeStats(),
			this.stores.salesStoreSevice.getLeadLangStats(),
			this.stores.salesStoreSevice.getContactTypeStats(),
		]);

		return {
			leads,
			touches,
			byType,
			byLang,
			contactsByType,
		};
	}

	async getDailyStatistic(): Promise<{ [key: string]: Statistic }> {
		await this.ready();
		return await this.stores.salesStoreSevice.getDailyStatistics();
	}

	async listLeads(params: LeadListParams): Promise<PaginatedResult<Lead>> {
		await this.ready();
		const tags = params.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [];
		const result = tags.length
			? await this.stores.salesStoreSevice.listLeadsByTags(tags, params)
			: {
					items: await this.stores.salesStoreSevice.leadRepo.findAll({
						limit: params.limit,
						offset: params.offset,
					}),
					totalCount: await this.stores.salesStoreSevice.leadRepo.count(),
				};

		const items = result.items.map((entity) => ({
			id: entity.id,
			description: entity.description,
			lang: entity.lang,
			type: entity.type,
			catalogId: entity.catalogId,
			createdAt: new Date(entity.createdAt * 1000),
		}));

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
			lead: {
				id: candidate.lead.id,
				description: candidate.lead.description,
				lang: candidate.lead.lang,
				type: candidate.lead.type,
				catalogId: candidate.lead.catalogId,
				createdAt: new Date(candidate.lead.createdAt * 1000),
			},
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

		return {
			id: lead.id,
			description: lead.description,
			lang: lead.lang,
			type: lead.type,
			catalogId: lead.catalogId,
			createdAt: new Date(lead.createdAt * 1000),
		};
	}

	async leadHasTouches(leadId: string): Promise<boolean> {
		await this.ready();
		const normalizedLeadId = leadId?.trim();
		if (!normalizedLeadId) {
			throw badRequestError("leadId is required");
		}

		return this.stores.salesStoreSevice.leadHasTouches(normalizedLeadId);
	}
}

export default SalesServiceImpl;
