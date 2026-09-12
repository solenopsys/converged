import {
	AccessTags,
	applyKyselyFilter,
	type KyselyFilterSchema,
	type SqlStore,
	visibleFrom,
} from "back-core";
import type {
	FilterObject,
	PaginatedResult,
	ThreadInfo,
	ThreadKind,
	ThreadListParams,
	ThreadStats,
	ThreadVisibility as Visibility,
} from "g-threads";
import { ThreadIndexRepository } from "./entities";

const ALL_KINDS: ThreadKind[] = ["chat", "audio", "forum", "comment"];

const threadFilterSchema: KyselyFilterSchema = {
	threadId: {
		valueType: "string",
		operators: ["eq", "in", "contains", "startsWith"],
		column: "obj.threadId",
	},
	kind: {
		valueType: "string",
		operators: ["eq", "in", "notEq", "notIn"],
		column: "obj.kind",
	},
	messageCount: {
		valueType: "number",
		operators: ["eq", "notEq", "gt", "gte", "lt", "lte", "between"],
		column: "obj.messageCount",
	},
	updatedAt: {
		valueType: "number",
		operators: ["gt", "gte", "lt", "lte", "between"],
		column: "obj.updatedAt",
	},
	createdAt: {
		valueType: "number",
		operators: ["gt", "gte", "lt", "lte", "between"],
		column: "obj.createdAt",
	},
};

function toInfo(row: any): ThreadInfo {
	return {
		threadId: row.threadId,
		kind: row.kind as ThreadKind,
		messageCount: Number(row.messageCount ?? 0),
		createdAt: Number(row.createdAt ?? 0),
		updatedAt: Number(row.updatedAt ?? 0),
	};
}

export class ThreadIndexStoreService {
	private readonly repo: ThreadIndexRepository;
	/**
	 * Who may read which thread, decided here and nowhere else.
	 *
	 * `rp-threads` deliberately knows nothing about rooms, topics or tickets —
	 * that is the price of one shared message store — so it cannot ask anybody
	 * whether a caller belongs to the conversation. It answers that itself, from
	 * the tags on the thread and the tags on the token.
	 */
	readonly access: AccessTags;

	constructor(private store: SqlStore) {
		this.access = new AccessTags(store);
		this.repo = new ThreadIndexRepository(store, "thread_index", {
			primaryKey: "threadId",
			extractKey: (e) => ({ threadId: e.threadId }),
			buildWhereCondition: (k) => ({ threadId: k.threadId }),
		});
	}

	/**
	 * Sets a thread's kind and, on first registration, its access. Idempotent.
	 *
	 * Re-registering an existing thread is a write on it, checked by the caller
	 * (`service.ts`) before this runs: otherwise a stranger who guessed a thread
	 * id could re-tag somebody else's conversation into their own reach.
	 */
	async register(
		threadId: string,
		kind: ThreadKind,
		access: {
			visibility?: Visibility;
			owner?: string;
			tags?: readonly string[];
		} = {},
	): Promise<void> {
		const now = Date.now();
		const existing = await this.repo.findById({ threadId });
		const db = this.store.db as any;
		if (existing) {
			await db
				.updateTable("thread_index")
				.set({ kind, updatedAt: now })
				.where("threadId", "=", threadId)
				.execute();
			if (access.visibility) {
				await this.access.setVisibility(threadId, access.visibility);
			}
			await this.access.grantMany(threadId, access.tags ?? []);
		} else {
			await db
				.insertInto("thread_index")
				.values({
					threadId,
					kind,
					messageCount: 0,
					createdAt: now,
					updatedAt: now,
				})
				.execute();
			await this.access.tagNew(threadId, {
				visibility: access.visibility ?? "private",
				owner: access.owner,
				tags: access.tags,
			});
		}
	}

	// Count one new message; create the row (default kind "chat") on first sight.
	//
	// A thread first seen here — written to without ever being registered —
	// belongs to whoever wrote it, so it is not left tagless and therefore
	// unreadable by anyone including its author.
	async touch(threadId: string, owner?: string): Promise<void> {
		const now = Date.now();
		const existing = await this.repo.findById({ threadId });
		const db = this.store.db as any;
		if (existing) {
			await db
				.updateTable("thread_index")
				.set({
					messageCount: Number(existing.messageCount ?? 0) + 1,
					updatedAt: now,
				})
				.where("threadId", "=", threadId)
				.execute();
		} else {
			await db
				.insertInto("thread_index")
				.values({
					threadId,
					kind: "chat",
					messageCount: 1,
					createdAt: now,
					updatedAt: now,
				})
				.execute();
			await this.access.tagNew(threadId, { visibility: "private", owner });
		}
	}

	/** Threads the caller is matched by, with their own conditions on top. */
	private visible(params: { kind?: ThreadKind; filter?: FilterObject }) {
		let query = visibleFrom(this.store.db, "thread_index", {
			idColumn: "threadId",
		});
		if (params.kind) query = query.where("obj.kind", "=", params.kind);
		return applyKyselyFilter(query, params.filter, threadFilterSchema);
	}

	async list(params: ThreadListParams): Promise<PaginatedResult<ThreadInfo>> {
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;

		const rows = await this.visible(params)
			.selectAll("obj")
			.orderBy("obj.updatedAt", "desc")
			.limit(limit)
			.offset(offset)
			.execute();
		const counted = await this.visible(params)
			.select((eb: any) => eb.fn.countAll().as("count"))
			.executeTakeFirst();

		return {
			items: rows.map(toInfo),
			totalCount: Number(counted?.count ?? 0),
		};
	}

	async count(filter?: FilterObject): Promise<number> {
		const result = await this.visible({ filter })
			.select((eb: any) => eb.fn.countAll().as("count"))
			.executeTakeFirst();
		return Number(result?.count ?? 0);
	}

	/**
	 * Totals over the caller's own threads. Two people get different numbers, and
	 * each is the right answer for them: a global total would be a headcount of
	 * every private conversation in the deployment.
	 */
	async stats(): Promise<ThreadStats> {
		const rows = await this.visible({})
			.select((eb: any) => [
				"obj.kind as kind",
				eb.fn.countAll().as("count"),
				eb.fn.sum("obj.messageCount").as("messages"),
			])
			.groupBy("obj.kind")
			.execute();

		const byKind = Object.fromEntries(ALL_KINDS.map((k) => [k, 0])) as Record<
			ThreadKind,
			number
		>;
		let total = 0;
		let totalMessages = 0;

		for (const row of rows) {
			const kind = row.kind as ThreadKind;
			const count = Number(row.count ?? 0);
			if (kind in byKind) byKind[kind] = count;
			total += count;
			totalMessages += Number(row.messages ?? 0);
		}

		return { total, totalMessages, byKind };
	}

	/** Whether the thread is known here — and so whether it already has tags. */
	async exists(threadId: string): Promise<boolean> {
		return (await this.repo.findById({ threadId })) !== undefined;
	}

	async delete(threadId: string): Promise<void> {
		await (this.store.db as any)
			.deleteFrom("thread_index")
			.where("threadId", "=", threadId)
			.execute();
		await this.access.dropObject(threadId);
	}
}
