import {
	AccessTags,
	applyKyselyFilter,
	type FilterInput,
	type KyselyFilterSchema,
	type SqlStore,
	sql,
	visibleFrom,
} from "back-core";
import {
	type ContactEntity,
	ContactRepository,
	type LeadEntity,
	type LeadEventEntity,
	LeadEventRepository,
	LeadRepository,
	type LeadTagEntity,
	type LeadTagLinkEntity,
	LeadTagRepository,
	type OfferEntity,
	OfferRepository,
	type OutreachEntity,
	OutreachRepository,
	type OutreachTargetEntity,
	OutreachTargetRepository,
	TouchRepository,
} from "./entities";

/**
 * The lead query language, in logical field names. Membership in a tag and a
 * contact value are not columns on `leads`, but they are the two things people
 * filter by most, so they compile to subqueries and stay ordinary fields —
 * there is no second, special-cased filtering path for them.
 */
const leadFilterSchema: KyselyFilterSchema = {
	id: {
		valueType: "string",
		operators: ["eq", "notEq", "in", "notIn", "contains", "startsWith"],
		column: "leads.id",
	},
	description: {
		valueType: "string",
		operators: ["eq", "contains", "startsWith"],
		column: "leads.description",
	},
	lang: {
		valueType: "string",
		operators: ["eq", "notEq", "in", "notIn"],
		column: "leads.lang",
	},
	type: {
		valueType: "string",
		operators: ["eq", "notEq", "in", "notIn"],
		column: "leads.type",
	},
	catalogId: {
		valueType: "string",
		operators: ["eq", "in", "isNull", "isNotNull"],
		column: "leads.catalogId",
	},
	disabled: {
		valueType: "boolean",
		operators: ["eq"],
		compile: (eb, condition) =>
			eb("leads.disabled", condition.value === true ? "=" : "!=", 1 as any),
	},
	createdAt: {
		valueType: "date",
		operators: ["gt", "gte", "lt", "lte", "between"],
		column: "leads.createdAt",
	},
	tag: {
		valueType: "string",
		operators: ["eq", "notEq", "in", "notIn", "isNull", "isNotNull"],
		compile: (eb, condition) => {
			const ids =
				condition.operator === "in" || condition.operator === "notIn"
					? (condition.value as string[])
					: [condition.value as string];
			const member = sql<boolean>`
      leads.id in (select leadId from lead_tag_links where tagId in (${sql.join(ids)}))
    `;
			const any = sql<boolean>`
      leads.id in (select leadId from lead_tag_links)
    `;
			switch (condition.operator) {
				case "eq":
				case "in":
					return member;
				case "notEq":
				case "notIn":
					return eb.not(member);
				case "isNotNull":
					return any;
				default:
					return eb.not(any);
			}
		},
	},
	contact: {
		valueType: "string",
		operators: ["contains", "eq", "startsWith"],
		compile: (_eb, condition) => {
			const value = String(condition.value ?? "").toLowerCase();
			const pattern =
				condition.operator === "eq"
					? value
					: condition.operator === "startsWith"
						? `${value}%`
						: `%${value}%`;
			return sql<boolean>`
      leads.id in (select leadId from contacts where lower(value) like ${pattern})
    `;
		},
	},
};

const contactFilterSchema: KyselyFilterSchema = {
	id: {
		valueType: "string",
		operators: ["eq", "notEq", "in", "notIn", "contains", "startsWith"],
		column: "contacts.id",
	},
	leadId: {
		valueType: "string",
		operators: ["eq", "notEq", "in", "notIn", "contains", "startsWith"],
		column: "contacts.leadId",
	},
	type: {
		valueType: "string",
		operators: ["eq", "notEq", "in", "notIn"],
		column: "contacts.contactType",
	},
	role: {
		valueType: "string",
		operators: ["eq", "contains", "startsWith"],
		column: "contacts.role",
	},
};

type CountRow = { count?: number | string | bigint | null };
type KeyCountRow = CountRow & { key?: string | null };
type DailyStatsRow = CountRow & { date?: string | null };
type OutreachProgressRow = {
	outreachId?: string | null;
	name?: string | null;
	total?: number | string | bigint | null;
	planned?: number | string | bigint | null;
	claimed?: number | string | bigint | null;
	sent?: number | string | bigint | null;
	completedStatus?: number | string | bigint | null;
	failed?: number | string | bigint | null;
	skipped?: number | string | bigint | null;
};
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
	public readonly outreachRepo: OutreachRepository;
	public readonly outreachTargetRepo: OutreachTargetRepository;
	public readonly leadTagRepo: LeadTagRepository;

	/**
	 * Who may see which lead, tag, offer and campaign.
	 *
	 * Four objects carry tags; everything else in this store hangs off one of
	 * them and is narrowed by it — a contact through its lead, a touch through
	 * its contact's lead, an event through the lead it attributes to, a campaign
	 * target through its campaign. That is the same arrangement `rp-requests`
	 * uses for its processing trail, and it is what keeps the relation's ids
	 * unique: only the four root tables put ids into it.
	 *
	 * All four are created `authenticated`, which is the reach the CRM screens
	 * had, and carry the tag of whoever created them. What that buys immediately
	 * is that editing is the owner's or a `team-*` holder's, and that an
	 * untokened caller reads nothing — this store holds names, addresses and
	 * correspondence of every prospect. Narrowing a desk to its own book is then
	 * dropping the open tag and granting `team-*`, with no query to rewrite.
	 */
	public readonly access: AccessTags;

	constructor(store: SqlStore) {
		this.store = store;
		this.access = new AccessTags(store);
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

		this.outreachRepo = new OutreachRepository(store, "outreaches", {
			primaryKey: "id",
			extractKey: (outreach) => ({ id: outreach.id }),
			buildWhereCondition: (key) => ({ id: key.id }),
		});

		this.outreachTargetRepo = new OutreachTargetRepository(
			store,
			"outreach_targets",
			{
				primaryKey: "id",
				extractKey: (target) => ({ id: target.id }),
				buildWhereCondition: (key) => ({ id: key.id }),
			},
		);

		this.leadTagRepo = new LeadTagRepository(store, "lead_tags", {
			primaryKey: "id",
			extractKey: (tag) => ({ id: tag.id }),
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

	/**
	 * Objects of `table` the caller may see.
	 *
	 * Aliased to the table's own name rather than `obj`, because the filter
	 * schemas and the raw `sql` fragments in this file address columns as
	 * `leads.lang` and `leads.id`; a fragment left pointing at an alias that no
	 * longer exists is a query that either fails or, worse, resolves against the
	 * unnarrowed table.
	 */
	private visible(table: string) {
		return visibleFrom(this.store.db, table, { alias: table });
	}

	/** The same set as bare ids, for narrowing what hangs off it. */
	private visibleIds(table: string) {
		return this.visible(table).select(`${table}.id` as any);
	}

	/**
	 * Refuses an id that something else in this store already answers for.
	 *
	 * Ids here come from outside — a lead is named by the thread it came from, a
	 * campaign and an offer by their slug — and the relation is keyed by id
	 * alone, with no object type in it. Without this check, filing a lead under
	 * an existing campaign's id would hand its author a tag on that campaign,
	 * which is the escalation `access-control.md` warns about; with it, the id is
	 * simply taken and the write is refused.
	 */
	private async claimId(id: string): Promise<void> {
		if ((await this.access.tagsOf(id)).length > 0) {
			const error = new Error(`id is already taken: ${id}`) as Error & {
				statusCode?: number;
			};
			error.statusCode = 409;
			throw error;
		}
	}

	/**
	 * Files a lead and tags it to the caller.
	 *
	 * The id comes from outside — a lead is a company or a thread the world
	 * already has a name for — so a repeated id is a primary-key conflict and
	 * not a takeover: the row it would occupy is already somebody's, and the tag
	 * relation is written only after the insert succeeds.
	 */
	async addLead(lead: LeadEntity): Promise<void> {
		await this.claimId(lead.id);
		await this.leadRepo.create(lead as any);
		await this.access.tagNew(lead.id, { visibility: "authenticated" });
	}

	/** A lead the caller holds no tag for reads as absent. */
	async getLead(id: string): Promise<LeadEntity | undefined> {
		if (!(await this.access.canRead(id))) return undefined;
		return this.leadRepo.findById({ id });
	}

	async updateLead(
		id: string,
		patch: Record<string, unknown>,
	): Promise<boolean> {
		await this.access.requireWrite(id);
		return Boolean(await this.leadRepo.update({ id }, patch as any));
	}

	/**
	 * Adding a contact or a touch is annotating a lead, not owning it: the check
	 * is read, so the desk that works the book keeps working it, while renaming
	 * or disabling the lead itself stays with its own people. The alternative —
	 * demanding a write tag here — would stop an outreach workflow recording a
	 * send against a lead it did not import.
	 */
	async addContact(contact: ContactEntity): Promise<void> {
		await this.access.requireRead(contact.leadId);
		await this.contactRepo.create(contact as any);
	}

	/** A contact is seen by whoever sees its lead. */
	async getContact(id: string): Promise<ContactEntity | undefined> {
		const contact = (await this.contactRepo.findById({ id })) as
			| ContactEntity
			| undefined;
		if (!contact) return undefined;
		return (await this.access.canRead(contact.leadId)) ? contact : undefined;
	}

	async addTouch(touch: {
		id: string;
		contactId: string;
		createdAt: number;
		description: string;
		companyName: string;
		outreachId: string | null;
	}): Promise<{ id: string } | undefined> {
		const contact = (await this.contactRepo.findById({
			id: touch.contactId,
		})) as ContactEntity | undefined;
		if (!contact) throw new Error(`Unknown contact: ${touch.contactId}`);
		await this.access.requireRead(contact.leadId);
		return this.touchRepo.create(touch as any);
	}

	async listTouches(params: {
		offset?: number;
		limit?: number;
	}): Promise<{ items: any[]; totalCount: number }> {
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;
		const [items, countRows] = await Promise.all([
			this.visibleTouches()
				.selectAll()
				.orderBy("createdAt", "desc")
				.limit(limit)
				.offset(offset)
				.execute(),
			this.visibleTouches()
				.select(({ fn }) => [fn.count<number>("id").as("count")])
				.execute(),
		]);
		return { items, totalCount: readCount(countRows[0] as CountRow) };
	}

	async getOffer(id: string): Promise<OfferEntity | undefined> {
		if (!(await this.access.canRead(id))) return undefined;
		return this.offerRepo.findById({ id });
	}

	async listOffers(params: {
		offset?: number;
		limit?: number;
	}): Promise<{ items: OfferEntity[]; totalCount: number }> {
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;
		const [items, countRows] = await Promise.all([
			this.visible("offers")
				.selectAll("offers")
				.orderBy("offers.id", "asc")
				.limit(limit)
				.offset(offset)
				.execute() as Promise<OfferEntity[]>,
			this.visible("offers")
				.select(({ fn }: any) => [fn.count<number>("offers.id").as("count")])
				.execute(),
		]);
		return { items, totalCount: readCount(countRows[0] as CountRow) };
	}

	async getTag(id: string): Promise<LeadTagEntity | undefined> {
		if (!(await this.access.canRead(id))) return undefined;
		return this.leadTagRepo.findById({ id });
	}

	async getOutreach(id: string): Promise<OutreachEntity | undefined> {
		if (!(await this.access.canRead(id))) return undefined;
		return this.outreachRepo.findById({ id });
	}

	async createLead(threadId: string, title: string) {
		await this.leadRepo.create({
			id: threadId,
			title,
			createdAt: Date.now(),
			messagesCount: 1,
		});
		await this.access.tagNew(threadId, { visibility: "authenticated" });
	}

	async updateLeadCatalogId(
		leadId: string,
		catalogId: string,
	): Promise<boolean> {
		await this.access.requireWrite(leadId);
		const existing = await this.leadRepo.findById({ id: leadId });
		if (!existing) return false;

		await this.leadRepo.update({ id: leadId }, { catalogId });
		return true;
	}

	async getDailyStatistics(): Promise<{
		[key: string]: { leads: number; touches: number };
	}> {
		const [leadsStats, touchesStats] = await Promise.all([
			this.visible("leads")
				.select(({ fn }: any) => [
					sql<string>`DATE(datetime(leads.createdAt, 'unixepoch'))`.as("date"),
					fn.count<number>("leads.id").as("count"),
				])
				.groupBy(sql`DATE(datetime(leads.createdAt, 'unixepoch'))`)
				.execute(),
			this.visibleTouches()
				.select(({ fn }: any) => [
					sql<string>`DATE(datetime(touches.createdAt, 'unixepoch'))`.as(
						"date",
					),
					fn.count<number>("touches.id").as("count"),
				])
				.groupBy(sql`DATE(datetime(touches.createdAt, 'unixepoch'))`)
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

	async getRecentDailyStatistics(
		days = 12,
	): Promise<Record<string, { leads: number; touches: number }>> {
		const leadDate = sql<string>`DATE(datetime(leads.createdAt, 'unixepoch'))`;
		const touchDate = sql<string>`DATE(datetime(touches.createdAt, 'unixepoch'))`;
		const currentDayStart = new Date();
		currentDayStart.setUTCHours(0, 0, 0, 0);
		const since =
			Math.floor(currentDayStart.getTime() / 1000) - (days - 1) * 24 * 60 * 60;
		const [leadsStats, touchesStats] = await Promise.all([
			this.visible("leads")
				.select(({ fn }: any) => [
					leadDate.as("date"),
					fn.count<number>("leads.id").as("count"),
				])
				.where("leads.createdAt", ">=", since)
				.groupBy(leadDate)
				.execute(),
			this.visibleTouches()
				.select(({ fn }: any) => [
					touchDate.as("date"),
					fn.count<number>("touches.id").as("count"),
				])
				.where("touches.createdAt", ">=", since)
				.groupBy(touchDate)
				.execute(),
		]);

		const byDate: Record<string, { leads: number; touches: number }> = {};
		for (const row of leadsStats as DailyStatsRow[]) {
			if (!row.date) continue;
			byDate[row.date] ??= { leads: 0, touches: 0 };
			byDate[row.date].leads = readCount(row);
		}
		for (const row of touchesStats as DailyStatsRow[]) {
			if (!row.date) continue;
			byDate[row.date] ??= { leads: 0, touches: 0 };
			byDate[row.date].touches = readCount(row);
		}

		return Object.fromEntries(
			Object.entries(byDate).sort(([left], [right]) =>
				left.localeCompare(right),
			),
		);
	}

	async getLeadTypeStats(): Promise<Record<string, number>> {
		const rows = await this.visible("leads")
			.select(({ fn }: any) => [
				sql<string>`coalesce(nullif(leads.type, ''), 'unknown')`.as("key"),
				fn.count<number>("leads.id").as("count"),
			])
			.groupBy(sql`coalesce(nullif(leads.type, ''), 'unknown')`)
			.orderBy("count", "desc")
			.execute();

		return groupCountRows(rows);
	}

	async getLeadLangStats(): Promise<Record<string, number>> {
		const rows = await this.visible("leads")
			.select(({ fn }: any) => [
				sql<string>`coalesce(nullif(leads.lang, ''), 'unknown')`.as("key"),
				fn.count<number>("leads.id").as("count"),
			])
			.groupBy(sql`coalesce(nullif(leads.lang, ''), 'unknown')`)
			.orderBy("count", "desc")
			.execute();

		return groupCountRows(rows);
	}

	async getContactTypeStats(): Promise<Record<string, number>> {
		const rows = await this.visibleContacts()
			.select(({ fn }: any) => [
				sql<string>`coalesce(nullif(contacts.contactType, ''), 'unknown')`.as(
					"key",
				),
				fn.count<number>("contacts.id").as("count"),
			])
			.groupBy(sql`coalesce(nullif(contacts.contactType, ''), 'unknown')`)
			.orderBy("count", "desc")
			.execute();

		return groupCountRows(rows);
	}

	async getTouchCompanyNameStats(): Promise<Record<string, number>> {
		const rows = await this.visibleTouches()
			.select(({ fn }: any) => [
				sql<string>`coalesce(nullif(touches.companyName, ''), 'unknown')`.as(
					"key",
				),
				fn.count<number>("touches.id").as("count"),
			])
			.groupBy(sql`coalesce(nullif(touches.companyName, ''), 'unknown')`)
			.orderBy("count", "desc")
			.execute();

		return groupCountRows(rows);
	}

	/**
	 * Contacts of the leads the caller may see. A contact carries no tags of its
	 * own: it is a way of reaching a lead, and reaching the lead is what the
	 * decision was about.
	 */
	private visibleContacts() {
		return this.store.db
			.selectFrom("contacts")
			.where("contacts.leadId", "in", this.visibleIds("leads"));
	}

	/** Touches of those contacts, one step further out. */
	private visibleTouches() {
		return this.store.db
			.selectFrom("touches")
			.where(
				"touches.contactId",
				"in",
				this.store.db
					.selectFrom("contacts")
					.select("contacts.id")
					.where("contacts.leadId", "in", this.visibleIds("leads")),
			);
	}

	async getOutreachProgressStats(): Promise<
		Array<{
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
		}>
	> {
		const campaignNameExpression = sql<string>`coalesce(nullif(outreach.name, ''), nullif(json_extract(target.payload, '$.outreach.companyName'), ''), target.outreachId)`;
		const rows = (await this.store.db
			.selectFrom("outreach_targets as target")
			.leftJoin("outreaches as outreach", "outreach.id", "target.outreachId")
			.where("target.outreachId", "in", this.visibleIds("outreaches"))
			.select([
				"target.outreachId as outreachId",
				campaignNameExpression.as("name"),
				sql<number>`count(target.id)`.as("total"),
				sql<number>`sum(case when target.status = 'planned' then 1 else 0 end)`.as(
					"planned",
				),
				sql<number>`sum(case when target.status = 'claimed' then 1 else 0 end)`.as(
					"claimed",
				),
				sql<number>`sum(case when target.status = 'sent' then 1 else 0 end)`.as(
					"sent",
				),
				sql<number>`sum(case when target.status = 'completed' then 1 else 0 end)`.as(
					"completedStatus",
				),
				sql<number>`sum(case when target.status = 'failed' then 1 else 0 end)`.as(
					"failed",
				),
				sql<number>`sum(case when target.status = 'skipped' then 1 else 0 end)`.as(
					"skipped",
				),
			])
			.groupBy("target.outreachId")
			.groupBy(campaignNameExpression)
			.orderBy("total", "desc")
			.execute()) as OutreachProgressRow[];

		return rows.map((row) => {
			const total = Number(row.total ?? 0);
			const planned = Number(row.planned ?? 0);
			const claimed = Number(row.claimed ?? 0);
			const sent = Number(row.sent ?? 0);
			const completedStatus = Number(row.completedStatus ?? 0);
			const failed = Number(row.failed ?? 0);
			const skipped = Number(row.skipped ?? 0);
			const completed = sent + completedStatus + failed + skipped;
			return {
				outreachId: row.outreachId ?? "",
				name: row.name ?? row.outreachId ?? "unknown",
				total,
				planned,
				claimed,
				sent,
				completedStatus,
				failed,
				skipped,
				completed,
				completionPercent:
					total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
			};
		});
	}

	async assignLeadTag(leadId: string, tagName: string): Promise<void> {
		const tag = await this.ensureTagByName(tagName);
		await this.addTagLeads(tag.id, [leadId]);
	}

	async removeLeadTag(leadId: string, tagName: string): Promise<boolean> {
		const tag = await this.findTagByName(tagName);
		if (!tag) return false;
		return (await this.removeTagLeads(tag.id, [leadId])) > 0;
	}

	/** The tags on one lead — those of them the caller may see. */
	async listLeadTags(leadId: string): Promise<LeadTagEntity[]> {
		return this.visible("lead_tags")
			.innerJoin("lead_tag_links as link", "link.tagId", "lead_tags.id")
			.selectAll("lead_tags")
			.where("link.leadId", "=", leadId)
			.where("link.leadId", "in", this.visibleIds("leads"))
			.orderBy("lead_tags.name", "asc")
			.execute() as Promise<LeadTagEntity[]>;
	}

	/**
	 * Hydrates one page of leads in one query. Keeping this beside the relation
	 * avoids a list view issuing a query per lead to render its tags.
	 */
	async listLeadTagsByLeadIds(
		leadIds: readonly string[],
	): Promise<Map<string, LeadTagEntity[]>> {
		const uniqueIds = [...new Set(leadIds.filter(Boolean))];
		const tagsByLeadId = new Map<string, LeadTagEntity[]>();
		if (uniqueIds.length === 0) return tagsByLeadId;

		const rows = (await this.visible("lead_tags")
			.innerJoin("lead_tag_links as link", "link.tagId", "lead_tags.id")
			.selectAll("lead_tags")
			.select("link.leadId as leadId")
			.where("link.leadId", "in", uniqueIds)
			.where("link.leadId", "in", this.visibleIds("leads"))
			.orderBy("lead_tags.name", "asc")
			.execute()) as Array<LeadTagEntity & { leadId: string }>;

		for (const row of rows) {
			const tags = tagsByLeadId.get(row.leadId) ?? [];
			tags.push({
				id: row.id,
				name: row.name,
				description: row.description,
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
			});
			tagsByLeadId.set(row.leadId, tags);
		}

		return tagsByLeadId;
	}

	async listLeadTagLinks(params: {
		offset?: number;
		limit?: number;
	}): Promise<{ items: LeadTagLinkEntity[]; totalCount: number }> {
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;
		// A link is only meaningful where both ends are: a tag the caller may see,
		// on a lead the caller may see.
		const visibleLinks = () =>
			this.store.db
				.selectFrom("lead_tag_links")
				.where("lead_tag_links.tagId", "in", this.visibleIds("lead_tags"))
				.where("lead_tag_links.leadId", "in", this.visibleIds("leads"));
		const [items, countRows] = await Promise.all([
			visibleLinks()
				.selectAll()
				.orderBy("createdAt", "desc")
				.limit(limit)
				.offset(offset)
				.execute() as Promise<LeadTagLinkEntity[]>,
			visibleLinks()
				.select(({ fn }) => [fn.count<number>("leadId").as("count")])
				.execute(),
		]);

		return {
			items,
			totalCount: readCount(countRows[0]),
		};
	}

	/** Rewriting an offer is the offer's people's; a new one is the caller's. */
	async saveOffer(offer: OfferEntity): Promise<void> {
		const known = Boolean(await this.offerRepo.findById({ id: offer.id }));
		if (known) await this.access.requireWrite(offer.id);
		else await this.claimId(offer.id);
		await this.store.db
			.insertInto("offers")
			.values(offer)
			.onConflict((oc) =>
				oc.column("id").doUpdateSet({
					name: offer.name,
					description: offer.description,
					template_path: offer.template_path,
					subjectTemplate: offer.subjectTemplate,
					bodyTemplate: offer.bodyTemplate,
				}),
			)
			.execute();
		if (!known) {
			await this.access.tagNew(offer.id, { visibility: "authenticated" });
		}
	}

	async saveTag(tag: LeadTagEntity): Promise<void> {
		const known = Boolean(await this.leadTagRepo.findById({ id: tag.id }));
		if (known) await this.access.requireWrite(tag.id);
		else await this.claimId(tag.id);
		await this.store.db
			.insertInto("lead_tags")
			.values(tag)
			.onConflict((oc) =>
				oc.column("id").doUpdateSet({
					name: tag.name,
					description: tag.description,
					updatedAt: tag.updatedAt,
				}),
			)
			.execute();
		if (!known) {
			await this.access.tagNew(tag.id, { visibility: "authenticated" });
		}
	}

	async findTagByName(name: string): Promise<LeadTagEntity | undefined> {
		return this.visible("lead_tags")
			.selectAll("lead_tags")
			.where("lead_tags.name", "=", name)
			.executeTakeFirst() as Promise<LeadTagEntity | undefined>;
	}

	/** Used by the import flow, which knows a tag by name and nothing else. */
	async ensureTagByName(name: string): Promise<LeadTagEntity> {
		const existing = await this.findTagByName(name);
		if (existing) return existing;
		const now = Math.floor(Date.now() / 1000);
		const tag: LeadTagEntity = {
			id: crypto.randomUUID(),
			name,
			description: "",
			createdAt: now,
			updatedAt: now,
		};
		await this.saveTag(tag);
		return (await this.findTagByName(name)) ?? tag;
	}

	async listTags(params: {
		offset?: number;
		limit?: number;
	}): Promise<{ items: LeadTagEntity[]; totalCount: number }> {
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;
		const [items, countRows] = await Promise.all([
			this.visible("lead_tags")
				.selectAll("lead_tags")
				.orderBy("lead_tags.updatedAt", "desc")
				.limit(limit)
				.offset(offset)
				.execute() as Promise<LeadTagEntity[]>,
			this.visible("lead_tags")
				.select(({ fn }: any) => [fn.count<number>("lead_tags.id").as("count")])
				.execute(),
		]);
		return { items, totalCount: readCount(countRows[0]) };
	}

	/** How many of the tag's leads the caller may see, which is the only count
	 *  that can honestly be shown beside a tag. */
	async countTagLeads(tagId: string): Promise<number> {
		const rows = await this.store.db
			.selectFrom("lead_tag_links")
			.select(({ fn }) => [fn.count<number>("leadId").as("count")])
			.where("tagId", "=", tagId)
			.where("leadId", "in", this.visibleIds("leads"))
			.execute();
		return readCount(rows[0]);
	}

	async deleteTag(tagId: string): Promise<boolean> {
		await this.access.requireWrite(tagId);
		await this.store.db
			.deleteFrom("lead_tag_links")
			.where("tagId", "=", tagId)
			.execute();
		const result = await this.store.db
			.deleteFrom("lead_tags")
			.where("id", "=", tagId)
			.executeTakeFirst();
		// The tags go with the row: a leftover link would later match a reused id.
		await this.access.dropObject(tagId);
		return Number(result.numDeletedRows ?? 0) > 0;
	}

	/**
	 * Labelling is a write on the tag and a read of the leads: a caller may only
	 * put their tag on leads they can see, and only a tag that is theirs.
	 */
	async addTagLeads(tagId: string, leadIds: string[]): Promise<number> {
		if (leadIds.length === 0) return 0;
		await this.access.requireWrite(tagId);
		leadIds = await this.narrowToVisibleLeads(leadIds);
		if (leadIds.length === 0) return 0;
		const createdAt = Math.floor(Date.now() / 1000);
		let inserted = 0;
		// SQLite caps the number of bound parameters, and a selection can cover
		// the whole table, so the write is paged rather than one statement.
		for (let index = 0; index < leadIds.length; index += 500) {
			const result = await this.store.db
				.insertInto("lead_tag_links")
				.values(
					leadIds
						.slice(index, index + 500)
						.map((leadId) => ({ tagId, leadId, createdAt })),
				)
				.onConflict((oc) => oc.columns(["tagId", "leadId"]).doNothing())
				.executeTakeFirst();
			inserted += Number(result.numInsertedOrUpdatedRows ?? 0);
		}
		return inserted;
	}

	async removeTagLeads(tagId: string, leadIds: string[]): Promise<number> {
		if (leadIds.length === 0) return 0;
		await this.access.requireWrite(tagId);
		leadIds = await this.narrowToVisibleLeads(leadIds);
		if (leadIds.length === 0) return 0;
		let deleted = 0;
		for (let index = 0; index < leadIds.length; index += 500) {
			const result = await this.store.db
				.deleteFrom("lead_tag_links")
				.where("tagId", "=", tagId)
				.where("leadId", "in", leadIds.slice(index, index + 500))
				.executeTakeFirst();
			deleted += Number(result.numDeletedRows ?? 0);
		}
		return deleted;
	}

	/** The leads under a tag, narrowed to the ones the caller may see. */
	private narrowToVisibleLeads(leadIds: string[]): Promise<string[]> {
		return (async () => {
			const visible: string[] = [];
			for (let index = 0; index < leadIds.length; index += 500) {
				const rows = (await this.visible("leads")
					.select("leads.id")
					.where("leads.id", "in", leadIds.slice(index, index + 500))
					.execute()) as Array<{ id: string }>;
				visible.push(...rows.map((row) => row.id));
			}
			return visible;
		})();
	}

	async listTagLeads(
		tagId: string,
		params: { offset?: number; limit?: number },
	): Promise<{ items: LeadEntity[]; totalCount: number }> {
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;
		const base = () =>
			this.visible("leads")
				.innerJoin("lead_tag_links as link", "link.leadId", "leads.id")
				.where("link.tagId", "=", tagId);
		const [items, countRows] = await Promise.all([
			base()
				.selectAll("leads")
				.orderBy("link.createdAt", "desc")
				.limit(limit)
				.offset(offset)
				.execute() as Promise<LeadEntity[]>,
			base()
				.select(({ fn }: any) => [fn.count<number>("leads.id").as("count")])
				.execute(),
		]);
		return { items, totalCount: readCount(countRows[0]) };
	}

	async saveOutreach(outreach: OutreachEntity): Promise<void> {
		const known = Boolean(
			await this.outreachRepo.findById({ id: outreach.id }),
		);
		if (known) await this.access.requireWrite(outreach.id);
		else await this.claimId(outreach.id);
		await this.store.db
			.insertInto("outreaches")
			.values(outreach)
			.onConflict((oc) =>
				oc.column("id").doUpdateSet({
					name: outreach.name,
					status: outreach.status,
					lang: outreach.lang,
					description: outreach.description,
					templateId: outreach.templateId,
					audience: outreach.audience,
					enrichWorkflow: outreach.enrichWorkflow,
					enrichParams: outreach.enrichParams,
					sendWorkflow: outreach.sendWorkflow,
					sendParams: outreach.sendParams,
					updatedAt: outreach.updatedAt,
				}),
			)
			.execute();
		if (!known) {
			await this.access.tagNew(outreach.id, { visibility: "authenticated" });
		}
	}

	async listOutreaches(params: {
		offset?: number;
		limit?: number;
	}): Promise<{ items: OutreachEntity[]; totalCount: number }> {
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;
		const [items, countRows] = await Promise.all([
			this.visible("outreaches")
				.selectAll("outreaches")
				.orderBy("outreaches.createdAt", "desc")
				.limit(limit)
				.offset(offset)
				.execute() as Promise<OutreachEntity[]>,
			this.visible("outreaches")
				.select(({ fn }: any) => [
					fn.count<number>("outreaches.id").as("count"),
				])
				.execute(),
		]);

		return {
			items,
			totalCount: readCount(countRows[0]),
		};
	}

	/**
	 * Loading a campaign's queue is a write on the campaign. The targets carry no
	 * tags themselves — they are the campaign's work list and are read through
	 * it.
	 */
	async addOutreachTargets(targets: OutreachTargetEntity[]): Promise<number> {
		if (targets.length === 0) return 0;
		for (const outreachId of new Set(targets.map((t) => t.outreachId))) {
			await this.access.requireWrite(outreachId);
		}

		const result = await this.store.db
			.insertInto("outreach_targets")
			.values(targets)
			.onConflict((oc) =>
				oc.column("id").doUpdateSet((eb) => ({
					status: sql`
						case
							when outreach_targets.status = 'planned' then excluded.status
							else outreach_targets.status
						end
					`,
					position: eb.ref("excluded.position"),
					payload: eb.ref("excluded.payload"),
					updatedAt: eb.ref("excluded.updatedAt"),
				})),
			)
			.executeTakeFirst();

		return Number(result.numInsertedOrUpdatedRows ?? targets.length);
	}

	async listOutreachTargets(params: {
		offset?: number;
		limit?: number;
		outreachId?: string;
		status?: string;
	}): Promise<{ items: OutreachTargetEntity[]; totalCount: number }> {
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;
		let itemsQuery = this.store.db
			.selectFrom("outreach_targets")
			.where("outreach_targets.outreachId", "in", this.visibleIds("outreaches"))
			.selectAll()
			.orderBy("position", "asc")
			.orderBy("createdAt", "asc")
			.limit(limit)
			.offset(offset);
		let countQuery = this.store.db
			.selectFrom("outreach_targets")
			.where("outreach_targets.outreachId", "in", this.visibleIds("outreaches"))
			.select(({ fn }) => [fn.count<number>("id").as("count")]);

		if (params.outreachId) {
			itemsQuery = itemsQuery.where("outreachId", "=", params.outreachId);
			countQuery = countQuery.where("outreachId", "=", params.outreachId);
		}
		if (params.status) {
			itemsQuery = itemsQuery.where("status", "=", params.status);
			countQuery = countQuery.where("status", "=", params.status);
		}

		const [items, countRows] = await Promise.all([
			itemsQuery.execute() as Promise<OutreachTargetEntity[]>,
			countQuery.execute(),
		]);

		return {
			items,
			totalCount: readCount(countRows[0]),
		};
	}

	/** Taking work off a campaign's queue is a write on that campaign. */
	async claimNextOutreachTarget(
		outreachId: string,
	): Promise<OutreachTargetEntity | null> {
		await this.access.requireWrite(outreachId);
		const now = Math.floor(Date.now() / 1000);
		const result = await sql<OutreachTargetEntity>`
			update outreach_targets
			set
				status = 'claimed',
				updatedAt = ${now}
			where id = (
				select id
				from outreach_targets
				where outreachId = ${outreachId}
					and status = 'planned'
				order by position asc, createdAt asc
				limit 1
			)
			returning *
		`.execute(this.store.db);

		return (result.rows?.[0] as OutreachTargetEntity | undefined) ?? null;
	}

	async updateOutreachTargetStatus(data: {
		id: string;
		status: string;
	}): Promise<OutreachTargetEntity | null> {
		const existing = await this.outreachTargetRepo.findById({ id: data.id });
		if (!existing) return null;
		await this.access.requireWrite(existing.outreachId);
		const now = Math.floor(Date.now() / 1000);
		const patch: Partial<OutreachTargetEntity> = {
			status: data.status,
			updatedAt: now,
		};

		return (
			(await this.outreachTargetRepo.update({ id: data.id }, patch)) ?? null
		);
	}

	async listLeadsAfter(
		after: string,
		limit: number,
	): Promise<{ items: LeadEntity[]; totalCount: number }> {
		const base = this.visible("leads")
			.selectAll("leads")
			.orderBy("leads.id", "asc")
			.limit(limit);
		const query = after.length > 0 ? base.where("leads.id", ">", after) : base;

		const [items, countRows] = await Promise.all([
			query.execute() as Promise<LeadEntity[]>,
			this.visible("leads")
				.select(({ fn }: any) => [fn.count<number>("leads.id").as("count")])
				.execute(),
		]);
		const totalCount = readCount(countRows[0] as CountRow);

		return { items, totalCount };
	}

	async listLeadsFiltered(
		filters: {
			tags?: string[];
			contact?: string;
			query?: string;
			filter?: FilterInput;
		},
		params: { offset?: number; limit?: number },
	): Promise<{ items: LeadEntity[]; totalCount: number }> {
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;
		const conditions = this.leadConditions(filters);

		let itemsQuery = this.visible("leads")
			.selectAll("leads")
			.orderBy("leads.createdAt", "desc")
			.limit(limit)
			.offset(offset);
		let countQuery = this.visible("leads").select(({ fn }: any) => [
			fn.count<number>("leads.id").as("count"),
		]);

		for (const condition of conditions) {
			itemsQuery = itemsQuery.where(condition);
			countQuery = countQuery.where(condition);
		}

		const [items, countRows] = await Promise.all([
			applyKyselyFilter(
				itemsQuery as any,
				filters.filter,
				leadFilterSchema,
			).execute() as Promise<LeadEntity[]>,
			applyKyselyFilter(
				countQuery as any,
				filters.filter,
				leadFilterSchema,
			).execute(),
		]);

		return {
			items,
			totalCount: readCount(countRows[0] as CountRow),
		};
	}

	async listContactsFiltered(
		filter: FilterInput,
		params: { offset?: number; limit?: number },
	): Promise<{ items: ContactEntity[]; totalCount: number }> {
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;
		const itemsQuery = this.visibleContacts()
			.selectAll()
			.orderBy("createdAt", "desc")
			.limit(limit)
			.offset(offset);
		const countQuery = this.visibleContacts().select(({ fn }) => [
			fn.count<number>("id").as("count"),
		]);
		const [items, countRows] = await Promise.all([
			applyKyselyFilter(
				itemsQuery as any,
				filter,
				contactFilterSchema,
			).execute() as Promise<ContactEntity[]>,
			applyKyselyFilter(
				countQuery as any,
				filter,
				contactFilterSchema,
			).execute(),
		]);
		return {
			items,
			totalCount: readCount(countRows[0] as CountRow),
		};
	}

	async listLeadLangs(): Promise<string[]> {
		const rows = (await this.visible("leads")
			.select("leads.lang as lang")
			.distinct()
			.orderBy("lang", "asc")
			.execute()) as Array<{ lang: string | null }>;
		return rows.map((row) => row.lang ?? "").filter(Boolean);
	}

	async countLeadsFiltered(filter?: FilterInput): Promise<number> {
		const rows = await applyKyselyFilter(
			this.visible("leads").select(({ fn }: any) => [
				fn.count<number>("leads.id").as("count"),
			]) as any,
			filter,
			leadFilterSchema,
		).execute();
		return readCount(rows[0] as CountRow);
	}

	/**
	 * Every lead identifier a filter matches. A group operation runs over the
	 * whole selection, not over the rows that happen to be on screen, so the
	 * server resolves it here instead of trusting a list from the client.
	 */
	async listLeadIdsFiltered(filter?: FilterInput): Promise<string[]> {
		const rows = (await applyKyselyFilter(
			this.visible("leads").select(["leads.id"]) as any,
			filter,
			leadFilterSchema,
		).execute()) as Array<{ id: string }>;
		return rows.map((row) => row.id);
	}

	private leadConditions(filters: {
		tags?: string[];
		contact?: string;
		query?: string;
	}): Array<ReturnType<typeof sql<boolean>>> {
		const tags = this.normalizeTagNames(filters.tags ?? []);
		const contact = filters.contact?.trim().toLowerCase() ?? "";
		const query = filters.query?.trim().toLowerCase() ?? "";
		const conditions: Array<ReturnType<typeof sql<boolean>>> = [];

		if (tags.length > 0) {
			conditions.push(sql<boolean>`
      leads.id in (
        select link.leadId
        from lead_tag_links link
        join lead_tags tag on tag.id = link.tagId
        where tag.name in (${sql.join(tags)})
        group by link.leadId
        having count(distinct tag.name) = ${tags.length}
      )
    `);
		}

		if (contact) {
			conditions.push(sql<boolean>`
      leads.id in (
        select leadId
        from contacts
        where lower(value) like ${`%${contact}%`}
      )
    `);
		}

		if (query) {
			conditions.push(sql<boolean>`(
        lower(leads.id) like ${`%${query}%`}
        or lower(leads.description) like ${`%${query}%`}
        or leads.id in (
          select leadId
          from contacts
          where lower(value) like ${`%${query}%`}
        )
      )`);
		}

		return conditions;
	}

	async listLeadContacts(leadId: string): Promise<ContactEntity[]> {
		const itemsQuery = this.visibleContacts()
			.selectAll()
			.where("contacts.leadId", "=", leadId);

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
			.where("c.leadId", "in", this.visibleIds("leads"))
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
				"l.disabled as leadDisabled",
			])
			.where("c.contactType", "=", "EMAIL")
			.where("l.lang", "=", normalizedLang)
			.where(sql<boolean>`coalesce(l.disabled, false) = false`)
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
				disabled: Boolean(row.leadDisabled),
			} satisfies LeadEntity,
		};
	}

	async findRandomLeadByLang(lang: string): Promise<LeadEntity | null> {
		const normalizedLang = lang.trim();
		if (!normalizedLang) return null;

		const row = await this.visible("leads")
			.selectAll("leads")
			.where("leads.lang", "=", normalizedLang)
			.where(sql<boolean>`coalesce(leads.disabled, false) = false`)
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
			.where("c.leadId", "in", this.visibleIds("leads"))
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
			.where("c.leadId", "in", this.visibleIds("leads"))
			.where("t.companyName", "=", companyName)
			.executeTakeFirst();

		return readCount(row) > 0;
	}

	async leadHasOutreachTouch(
		leadId: string,
		outreachId: string,
	): Promise<boolean> {
		const row = await this.store.db
			.selectFrom("contacts as c")
			.innerJoin("touches as t", "t.contactId", "c.id")
			.select(({ fn }) => [fn.count<number>("t.id").as("count")])
			.where("c.leadId", "=", leadId)
			.where("c.leadId", "in", this.visibleIds("leads"))
			.where("t.outreachId", "=", outreachId)
			.executeTakeFirst();

		return readCount(row) > 0;
	}

	private normalizeTagNames(tagNames: string[] = []): string[] {
		return [...new Set(tagNames.map((tag) => tag.trim()).filter(Boolean))];
	}

	/**
	 * Which contact a tracking code belongs to.
	 *
	 * Not narrowed, and cannot be: it runs for an anonymous click on a link in a
	 * sent email, where there is no actor at all. The code is the credential —
	 * it is minted per send and returns nothing but the ids the click is
	 * attributed to.
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

	/**
	 * The events of the leads the caller may see.
	 *
	 * An event that was never attributed to a lead — a click on a code nobody
	 * recognised — belongs to nobody and is left out of the listing rather than
	 * shown to everybody.
	 */
	async listLeadEvents(params: {
		offset?: number;
		limit?: number;
	}): Promise<{ items: LeadEventEntity[]; totalCount: number }> {
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;
		const visibleEvents = () =>
			this.store.db
				.selectFrom("lead_events")
				.where("lead_events.leadId", "in", this.visibleIds("leads"));
		const [items, countRows] = await Promise.all([
			visibleEvents()
				.selectAll()
				.orderBy("createdAt", "desc")
				.limit(limit)
				.offset(offset)
				.execute() as Promise<LeadEventEntity[]>,
			visibleEvents()
				.select(({ fn }) => [fn.count<number>("id").as("count")])
				.execute(),
		]);

		return {
			items,
			totalCount: readCount(countRows[0]),
		};
	}

	async getEventFunnel(): Promise<Record<string, number>> {
		const rows = await this.store.db
			.selectFrom("lead_events")
			.where("lead_events.leadId", "in", this.visibleIds("leads"))
			.select(({ fn }) => ["type as key", fn.count<number>("id").as("count")])
			.groupBy("type")
			.execute();

		return groupCountRows(rows);
	}
}
