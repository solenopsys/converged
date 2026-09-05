import {
	applyKyselyFilter,
	type FilterInput,
	type KyselyFilterSchema,
	type SqlStore,
	sql,
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

	async getRecentDailyStatistics(
		days = 12,
	): Promise<Record<string, { leads: number; touches: number }>> {
		const dateExpression = sql<string>`DATE(datetime(createdAt, 'unixepoch'))`;
		const currentDayStart = new Date();
		currentDayStart.setUTCHours(0, 0, 0, 0);
		const since =
			Math.floor(currentDayStart.getTime() / 1000) - (days - 1) * 24 * 60 * 60;
		const [leadsStats, touchesStats] = await Promise.all([
			this.store.db
				.selectFrom("leads")
				.select(({ fn }) => [
					dateExpression.as("date"),
					fn.count<number>("id").as("count"),
				])
				.where("createdAt", ">=", since)
				.groupBy(dateExpression)
				.execute(),
			this.store.db
				.selectFrom("touches")
				.select(({ fn }) => [
					dateExpression.as("date"),
					fn.count<number>("id").as("count"),
				])
				.where("createdAt", ">=", since)
				.groupBy(dateExpression)
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

	async listLeadTags(leadId: string): Promise<LeadTagEntity[]> {
		return this.store.db
			.selectFrom("lead_tags as tag")
			.innerJoin("lead_tag_links as link", "link.tagId", "tag.id")
			.selectAll("tag")
			.where("link.leadId", "=", leadId)
			.orderBy("tag.name", "asc")
			.execute() as Promise<LeadTagEntity[]>;
	}

	async listLeadTagLinks(params: {
		offset?: number;
		limit?: number;
	}): Promise<{ items: LeadTagLinkEntity[]; totalCount: number }> {
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;
		const [items, countRows] = await Promise.all([
			this.store.db
				.selectFrom("lead_tag_links")
				.selectAll()
				.orderBy("createdAt", "desc")
				.limit(limit)
				.offset(offset)
				.execute() as Promise<LeadTagLinkEntity[]>,
			this.store.db
				.selectFrom("lead_tag_links")
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
					name: offer.name,
					description: offer.description,
					template_path: offer.template_path,
					subjectTemplate: offer.subjectTemplate,
					bodyTemplate: offer.bodyTemplate,
				}),
			)
			.execute();
	}

	async saveTag(tag: LeadTagEntity): Promise<void> {
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
	}

	async findTagByName(name: string): Promise<LeadTagEntity | undefined> {
		return this.store.db
			.selectFrom("lead_tags")
			.selectAll()
			.where("name", "=", name)
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
			this.store.db
				.selectFrom("lead_tags")
				.selectAll()
				.orderBy("updatedAt", "desc")
				.limit(limit)
				.offset(offset)
				.execute() as Promise<LeadTagEntity[]>,
			this.store.db
				.selectFrom("lead_tags")
				.select(({ fn }) => [fn.count<number>("id").as("count")])
				.execute(),
		]);
		return { items, totalCount: readCount(countRows[0]) };
	}

	async countTagLeads(tagId: string): Promise<number> {
		const rows = await this.store.db
			.selectFrom("lead_tag_links")
			.select(({ fn }) => [fn.count<number>("leadId").as("count")])
			.where("tagId", "=", tagId)
			.execute();
		return readCount(rows[0]);
	}

	async deleteTag(tagId: string): Promise<boolean> {
		await this.store.db
			.deleteFrom("lead_tag_links")
			.where("tagId", "=", tagId)
			.execute();
		const result = await this.store.db
			.deleteFrom("lead_tags")
			.where("id", "=", tagId)
			.executeTakeFirst();
		return Number(result.numDeletedRows ?? 0) > 0;
	}

	async addTagLeads(tagId: string, leadIds: string[]): Promise<number> {
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

	async listTagLeads(
		tagId: string,
		params: { offset?: number; limit?: number },
	): Promise<{ items: LeadEntity[]; totalCount: number }> {
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;
		const base = this.store.db
			.selectFrom("leads as lead")
			.innerJoin("lead_tag_links as link", "link.leadId", "lead.id")
			.where("link.tagId", "=", tagId);
		const [items, countRows] = await Promise.all([
			base
				.selectAll("lead")
				.orderBy("link.createdAt", "desc")
				.limit(limit)
				.offset(offset)
				.execute() as Promise<LeadEntity[]>,
			base
				.select(({ fn }) => [fn.count<number>("lead.id").as("count")])
				.execute(),
		]);
		return { items, totalCount: readCount(countRows[0]) };
	}

	async saveOutreach(outreach: OutreachEntity): Promise<void> {
		await this.store.db
			.insertInto("outreaches")
			.values(outreach)
			.onConflict((oc) =>
				oc.column("id").doUpdateSet({
					name: outreach.name,
					status: outreach.status,
					lang: outreach.lang,
					description: outreach.description,
					tagId: outreach.tagId,
					templateId: outreach.templateId,
					planWorkflow: outreach.planWorkflow,
					sendWorkflow: outreach.sendWorkflow,
					sendCronId: outreach.sendCronId,
					baseUrl: outreach.baseUrl,
					demoUrl: outreach.demoUrl,
					senders: outreach.senders,
					jitterMaxSeconds: outreach.jitterMaxSeconds,
					updatedAt: outreach.updatedAt,
				}),
			)
			.execute();
	}

	async listOutreaches(params: {
		offset?: number;
		limit?: number;
	}): Promise<{ items: OutreachEntity[]; totalCount: number }> {
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;
		const [items, countRows] = await Promise.all([
			this.store.db
				.selectFrom("outreaches")
				.selectAll()
				.orderBy("createdAt", "desc")
				.limit(limit)
				.offset(offset)
				.execute() as Promise<OutreachEntity[]>,
			this.store.db
				.selectFrom("outreaches")
				.select(({ fn }) => [fn.count<number>("id").as("count")])
				.execute(),
		]);

		return {
			items,
			totalCount: readCount(countRows[0]),
		};
	}

	async addOutreachTargets(targets: OutreachTargetEntity[]): Promise<number> {
		if (targets.length === 0) return 0;

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
			.selectAll()
			.orderBy("position", "asc")
			.orderBy("createdAt", "asc")
			.limit(limit)
			.offset(offset);
		let countQuery = this.store.db
			.selectFrom("outreach_targets")
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

	async claimNextOutreachTarget(
		outreachId: string,
	): Promise<OutreachTargetEntity | null> {
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

		if (conditions.length === 0 && !filters.filter) {
			const [items, totalCount] = await Promise.all([
				this.leadRepo.findAll({ limit, offset }),
				this.leadRepo.count(),
			]);
			return { items, totalCount };
		}

		let itemsQuery = this.store.db
			.selectFrom("leads")
			.selectAll()
			.orderBy("createdAt", "desc")
			.limit(limit)
			.offset(offset);
		let countQuery = this.store.db
			.selectFrom("leads")
			.select(({ fn }) => [fn.count<number>("id").as("count")]);

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
		const itemsQuery = this.store.db
			.selectFrom("contacts")
			.selectAll()
			.orderBy("createdAt", "desc")
			.limit(limit)
			.offset(offset);
		const countQuery = this.store.db
			.selectFrom("contacts")
			.select(({ fn }) => [fn.count<number>("id").as("count")]);
		const [items, countRows] = await Promise.all([
			applyKyselyFilter(itemsQuery as any, filter, contactFilterSchema)
				.execute() as Promise<ContactEntity[]>,
			applyKyselyFilter(countQuery as any, filter, contactFilterSchema).execute(),
		]);
		return {
			items,
			totalCount: readCount(countRows[0] as CountRow),
		};
	}

	async listLeadLangs(): Promise<string[]> {
		const rows = (await this.store.db
			.selectFrom("leads")
			.select("lang")
			.distinct()
			.orderBy("lang", "asc")
			.execute()) as Array<{ lang: string | null }>;
		return rows.map((row) => row.lang ?? "").filter(Boolean);
	}

	async countLeadsFiltered(filter?: FilterInput): Promise<number> {
		const rows = await applyKyselyFilter(
			this.store.db
				.selectFrom("leads")
				.select(({ fn }) => [fn.count<number>("id").as("count")]) as any,
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
			this.store.db.selectFrom("leads").select(["id"]) as any,
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

		const row = await this.store.db
			.selectFrom("leads")
			.selectAll()
			.where("lang", "=", normalizedLang)
			.where(sql<boolean>`coalesce(disabled, false) = false`)
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

	async leadHasOutreachTouch(
		leadId: string,
		outreachId: string,
	): Promise<boolean> {
		const row = await this.store.db
			.selectFrom("contacts as c")
			.innerJoin("touches as t", "t.contactId", "c.id")
			.select(({ fn }) => [fn.count<number>("t.id").as("count")])
			.where("c.leadId", "=", leadId)
			.where("t.outreachId", "=", outreachId)
			.executeTakeFirst();

		return readCount(row) > 0;
	}

	private normalizeTagNames(tagNames: string[] = []): string[] {
		return [...new Set(tagNames.map((tag) => tag.trim()).filter(Boolean))];
	}

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

	async getEventFunnel(): Promise<Record<string, number>> {
		const rows = await this.store.db
			.selectFrom("lead_events")
			.select(({ fn }) => ["type as key", fn.count<number>("id").as("count")])
			.groupBy("type")
			.execute();

		return groupCountRows(rows);
	}
}
