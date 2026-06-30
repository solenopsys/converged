import { type SqlStore, sql } from "back-core";
import {
	type ContactEntity,
	ContactRepository,
	type LeadEntity,
	type LeadEventEntity,
	LeadEventRepository,
	LeadRepository,
	type LeadTagEntity,
	type OfferEntity,
	OfferRepository,
	TouchRepository,
} from "./entities";

type CountRow = { count?: number | string | bigint | null };
type KeyCountRow = CountRow & { key?: string | null };
type DailyStatsRow = CountRow & { date?: string | null };
type CodeOwnerRow = {
	contactId?: string | null;
	leadId?: string | null;
};

function readCount(row: CountRow | undefined): number {
	return Number(row?.count ?? 0);
}

function groupCountRows(rows: KeyCountRow[]): Record<string, number> {
	return rows.reduce((acc: Record<string, number>, row) => {
		acc[String(row.key)] = readCount(row);
		return acc;
	}, {});
}

export class SalesStoreService {
	private readonly store: SqlStore;
	public readonly touchRepo: TouchRepository;
	public readonly leadRepo: LeadRepository;
	public readonly offerRepo: OfferRepository;
	public readonly contactRepo: ContactRepository;
	public readonly leadEventRepo: LeadEventRepository;

	constructor(store: SqlStore) {
		this.store = store;
		this.touchRepo = new TouchRepository(store, "touches", {
			primaryKey: "id",
			extractKey: (conversation) => ({ id: conversation.id }),
			buildWhereCondition: (key) => ({ id: key.id }),
		});

		this.leadEventRepo = new LeadEventRepository(store, "lead_events", {
			primaryKey: "id",
			extractKey: (event) => ({ id: event.id }),
			buildWhereCondition: (key) => ({ id: key.id }),
		});

		this.leadRepo = new LeadRepository(store, "leads", {
			primaryKey: "id",
			extractKey: (lead) => ({ id: lead.id }),
			buildWhereCondition: (key) => ({ id: key.id }),
		});

		this.offerRepo = new OfferRepository(store, "offers", {
			primaryKey: "id",
			extractKey: (offer) => ({ id: offer.id }),
			buildWhereCondition: (key) => ({ id: key.id }),
		});

		this.contactRepo = new ContactRepository(store, "contacts", {
			primaryKey: "id",
			extractKey: (contact) => ({ id: contact.id }),
			buildWhereCondition: (key) => ({ id: key.id }),
		});
	}

	createLead(threadId: string, title: string) {
		this.leadRepo.create({
			id: threadId,
			title,
			createdAt: Date.now(),
			messagesCount: 1,
		});
	}

	async updateLeadCatalogId(
		leadId: string,
		catalogId: string,
	): Promise<boolean> {
		const existing = await this.leadRepo.findById({ id: leadId });
		if (!existing) return false;

		await this.leadRepo.update({ id: leadId }, { catalogId });
		return true;
	}

	async getDailyStatistics(): Promise<{
		[key: string]: { leads: number; touches: number };
	}> {
		const [leadsStats, touchesStats] = await Promise.all([
			this.store.db
				.selectFrom("leads")
				.select(({ fn }) => [
					sql<string>`DATE(datetime(createdAt, 'unixepoch'))`.as("date"),
					fn.count<number>("id").as("count"),
				])
				.groupBy(sql`DATE(datetime(createdAt, 'unixepoch'))`)
				.execute(),
			this.store.db
				.selectFrom("touches")
				.select(({ fn }) => [
					sql<string>`DATE(datetime(createdAt, 'unixepoch'))`.as("date"),
					fn.count<number>("id").as("count"),
				])
				.groupBy(sql`DATE(datetime(createdAt, 'unixepoch'))`)
				.execute(),
		]);

		const result: { [key: string]: { leads: number; touches: number } } = {};

		leadsStats.forEach((row: DailyStatsRow) => {
			const date = row.date;
			if (!date) return;
			if (!result[date]) {
				result[date] = { leads: 0, touches: 0 };
			}
			result[date].leads = readCount(row);
		});

		touchesStats.forEach((row: DailyStatsRow) => {
			const date = row.date;
			if (!date) return;
			if (!result[date]) {
				result[date] = { leads: 0, touches: 0 };
			}
			result[date].touches = readCount(row);
		});

		return result;
	}

	async getLeadTypeStats(): Promise<Record<string, number>> {
		const rows = await this.store.db
			.selectFrom("leads")
			.select(({ fn }) => [
				sql<string>`coalesce(nullif(type, ''), 'unknown')`.as("key"),
				fn.count<number>("id").as("count"),
			])
			.groupBy(sql`coalesce(nullif(type, ''), 'unknown')`)
			.orderBy("count", "desc")
			.execute();

		return groupCountRows(rows);
	}

	async getLeadLangStats(): Promise<Record<string, number>> {
		const rows = await this.store.db
			.selectFrom("leads")
			.select(({ fn }) => [
				sql<string>`coalesce(nullif(lang, ''), 'unknown')`.as("key"),
				fn.count<number>("id").as("count"),
			])
			.groupBy(sql`coalesce(nullif(lang, ''), 'unknown')`)
			.orderBy("count", "desc")
			.execute();

		return groupCountRows(rows);
	}

	async getContactTypeStats(): Promise<Record<string, number>> {
		const rows = await this.store.db
			.selectFrom("contacts")
			.select(({ fn }) => [
				sql<string>`coalesce(nullif(contactType, ''), 'unknown')`.as("key"),
				fn.count<number>("id").as("count"),
			])
			.groupBy(sql`coalesce(nullif(contactType, ''), 'unknown')`)
			.orderBy("count", "desc")
			.execute();

		return groupCountRows(rows);
	}

	async getTouchCompanyNameStats(): Promise<Record<string, number>> {
		const rows = await this.store.db
			.selectFrom("touches")
			.select(({ fn }) => [
				sql<string>`coalesce(nullif(companyName, ''), 'unknown')`.as("key"),
				fn.count<number>("id").as("count"),
			])
			.groupBy(sql`coalesce(nullif(companyName, ''), 'unknown')`)
			.orderBy("count", "desc")
			.execute();

		return groupCountRows(rows);
	}

	async assignLeadTag(leadId: string, tagName: string): Promise<void> {
		await this.store.db
			.insertInto("lead_tags")
			.values({
				leadId,
				tagName,
				createdAt: Math.floor(Date.now() / 1000),
			})
			.onConflict((oc) => oc.columns(["leadId", "tagName"]).doNothing())
			.execute();
	}

	async removeLeadTag(leadId: string, tagName: string): Promise<boolean> {
		const result = await this.store.db
			.deleteFrom("lead_tags")
			.where("leadId", "=", leadId)
			.where("tagName", "=", tagName)
			.executeTakeFirst();

		return Number(result.numDeletedRows ?? 0) > 0;
	}

	async listLeadTags(leadId: string): Promise<LeadTagEntity[]> {
		return this.store.db
			.selectFrom("lead_tags")
			.selectAll()
			.where("leadId", "=", leadId)
			.orderBy("tagName", "asc")
			.execute() as Promise<LeadTagEntity[]>;
	}

	async listLeadTagLinks(params: {
		offset?: number;
		limit?: number;
	}): Promise<{ items: LeadTagEntity[]; totalCount: number }> {
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;
		const [items, countRows] = await Promise.all([
			this.store.db
				.selectFrom("lead_tags")
				.selectAll()
				.orderBy("createdAt", "desc")
				.limit(limit)
				.offset(offset)
				.execute() as Promise<LeadTagEntity[]>,
			this.store.db
				.selectFrom("lead_tags")
				.select(({ fn }) => [fn.count<number>("leadId").as("count")])
				.execute(),
		]);

		return {
			items,
			totalCount: readCount(countRows[0]),
		};
	}

	async saveOffer(offer: OfferEntity): Promise<void> {
		await this.store.db
			.insertInto("offers")
			.values(offer)
			.onConflict((oc) =>
				oc.column("id").doUpdateSet({
					description: offer.description,
					template_path: offer.template_path,
				}),
			)
			.execute();
	}

	async listLeadsAfter(
		after: string,
		limit: number,
	): Promise<{ items: LeadEntity[]; totalCount: number }> {
		const base = this.store.db
			.selectFrom("leads")
			.selectAll()
			.orderBy("id", "asc")
			.limit(limit);
		const query = after.length > 0 ? base.where("id", ">", after) : base;

		const [items, totalCount] = await Promise.all([
			query.execute() as Promise<LeadEntity[]>,
			this.leadRepo.count(),
		]);

		return { items, totalCount };
	}

	async listLeadsByTags(
		tagNames: string[],
		params: { offset?: number; limit?: number },
	): Promise<{ items: LeadEntity[]; totalCount: number }> {
		const tags = this.normalizeTagNames(tagNames);
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;

		if (tags.length === 0) {
			const [items, totalCount] = await Promise.all([
				this.leadRepo.findAll({ limit, offset }),
				this.leadRepo.count(),
			]);
			return { items, totalCount };
		}

		const tagFilter = sql<boolean>`
      leads.id in (
        select leadId
        from lead_tags
        where tagName in (${sql.join(tags)})
        group by leadId
        having count(distinct tagName) = ${tags.length}
      )
    `;

		const [items, countRows] = await Promise.all([
			this.store.db
				.selectFrom("leads")
				.selectAll()
				.where(tagFilter)
				.orderBy("createdAt", "desc")
				.limit(limit)
				.offset(offset)
				.execute() as Promise<LeadEntity[]>,
			this.store.db
				.selectFrom("leads")
				.select(({ fn }) => [fn.count<number>("id").as("count")])
				.where(tagFilter)
				.execute(),
		]);

		return {
			items,
			totalCount: readCount(countRows[0]),
		};
	}

	async listLeadContacts(leadId: string): Promise<ContactEntity[]> {
		const itemsQuery = this.store.db
			.selectFrom("contacts")
			.selectAll()
			.where("leadId", "=", leadId);

		return itemsQuery.execute() as Promise<ContactEntity[]>;
	}

	async findOutreachCandidate(
		lang: string,
	): Promise<{ lead: LeadEntity; contact: ContactEntity } | null> {
		const normalizedLang = lang.trim();
		if (!normalizedLang) return null;

		const row = await this.store.db
			.selectFrom("contacts as c")
			.innerJoin("leads as l", "l.id", "c.leadId")
			.leftJoin("touches as t", "t.contactId", "c.id")
			.select([
				"c.id as contactId",
				"c.leadId as contactLeadId",
				"c.createdAt as contactCreatedAt",
				"c.contactType as contactType",
				"c.value as contactValue",
				"c.role as contactRole",
				"c.description as contactDescription",
				"l.id as leadId",
				"l.createdAt as leadCreatedAt",
				"l.description as leadDescription",
				"l.lang as leadLang",
				"l.type as leadType",
				"l.catalogId as leadCatalogId",
			])
			.where("c.contactType", "=", "EMAIL")
			.where("l.lang", "=", normalizedLang)
			.where("c.value", "like", "%@%")
			.where("t.id", "is", null)
			.orderBy("c.createdAt", "asc")
			.limit(1)
			.executeTakeFirst();

		if (!row) return null;

		return {
			contact: {
				id: row.contactId,
				leadId: row.contactLeadId,
				createdAt: Number(row.contactCreatedAt),
				contactType: row.contactType,
				value: row.contactValue,
				role: row.contactRole,
				description: row.contactDescription,
			} satisfies ContactEntity,
			lead: {
				id: row.leadId,
				createdAt: Number(row.leadCreatedAt),
				description: row.leadDescription,
				lang: row.leadLang,
				type: row.leadType,
				catalogId: row.leadCatalogId,
			} satisfies LeadEntity,
		};
	}

	async findRandomLeadByLang(lang: string): Promise<LeadEntity | null> {
		const normalizedLang = lang.trim();
		if (!normalizedLang) return null;

		const row = await this.store.db
			.selectFrom("leads")
			.selectAll()
			.where("lang", "=", normalizedLang)
			.orderBy(sql`RANDOM()`)
			.limit(1)
			.executeTakeFirst();

		return (row as LeadEntity | undefined) ?? null;
	}

	async leadHasTouches(leadId: string): Promise<boolean> {
		const row = await this.store.db
			.selectFrom("contacts as c")
			.innerJoin("touches as t", "t.contactId", "c.id")
			.select(({ fn }) => [fn.count<number>("t.id").as("count")])
			.where("c.leadId", "=", leadId)
			.executeTakeFirst();

		return readCount(row) > 0;
	}

	async leadHasCompanyTouch(
		leadId: string,
		companyName: string,
	): Promise<boolean> {
		const row = await this.store.db
			.selectFrom("contacts as c")
			.innerJoin("touches as t", "t.contactId", "c.id")
			.select(({ fn }) => [fn.count<number>("t.id").as("count")])
			.where("c.leadId", "=", leadId)
			.where("t.companyName", "=", companyName)
			.executeTakeFirst();

		return readCount(row) > 0;
	}

	private normalizeTagNames(tagNames: string[] = []): string[] {
		return [...new Set(tagNames.map((tag) => tag.trim()).filter(Boolean))];
	}

	// --- Lead events (cross-channel tracking, attributed via `code`) ---

	/**
	 * Resolve contactId/leadId for a tracking code from the earliest event that
	 * already carries them (normally the `email_sent` event written at send time).
	 */
	async resolveCodeOwner(
		code: string,
	): Promise<{ contactId: string | null; leadId: string | null }> {
		const row = await this.store.db
			.selectFrom("lead_events")
			.select(["contactId", "leadId"])
			.where("code", "=", code)
			.where("contactId", "is not", null)
			.orderBy("createdAt", "asc")
			.limit(1)
			.executeTakeFirst();

		return {
			contactId: (row as CodeOwnerRow | undefined)?.contactId ?? null,
			leadId: (row as CodeOwnerRow | undefined)?.leadId ?? null,
		};
	}

	async addLeadEvent(event: {
		id: string;
		code: string;
		type: string;
		contactId: string | null;
		leadId: string | null;
		url: string | null;
		referrer: string | null;
		userAgent: string | null;
		createdAt: number;
	}): Promise<LeadEventEntity> {
		return this.leadEventRepo.create(event);
	}

	async listLeadEvents(params: {
		offset?: number;
		limit?: number;
	}): Promise<{ items: LeadEventEntity[]; totalCount: number }> {
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;
		const [items, countRows] = await Promise.all([
			this.store.db
				.selectFrom("lead_events")
				.selectAll()
				.orderBy("createdAt", "desc")
				.limit(limit)
				.offset(offset)
				.execute() as Promise<LeadEventEntity[]>,
			this.store.db
				.selectFrom("lead_events")
				.select(({ fn }) => [fn.count<number>("id").as("count")])
				.execute(),
		]);

		return {
			items,
			totalCount: readCount(countRows[0]),
		};
	}

	/** Counts of events grouped by type (sent/open/click/page_view funnel). */
	async getEventFunnel(): Promise<Record<string, number>> {
		const rows = await this.store.db
			.selectFrom("lead_events")
			.select(({ fn }) => ["type as key", fn.count<number>("id").as("count")])
			.groupBy("type")
			.execute();

		return groupCountRows(rows);
	}
}
