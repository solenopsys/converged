import type { Kysely } from "kysely";
import { ACCESS_TAGS_TABLE } from "./migration";
import { actorTags } from "./tags";

export type VisibleOptions = {
	/** Primary key column of the object table, if it is not `id`. */
	idColumn?: string;
	/** Overrides the acting subject's tags. For admin tools and tests only. */
	tags?: readonly string[];
	/**
	 * The alias the object table is given, `obj` by default.
	 *
	 * Pass the table's own name where the query being narrowed already refers to
	 * its columns by it — a filter schema written as `leads.lang`, a raw `sql`
	 * fragment, a join. Renaming those to `obj` is a change with no upside and
	 * one failure mode: a fragment that still says `leads` keeps compiling
	 * against the unnarrowed table.
	 */
	alias?: string;
};

/** The distinct ids the given tags open, as a subquery to join against. */
function visibleIds(eb: any, tags: readonly string[]) {
	return eb
		.selectFrom(ACCESS_TAGS_TABLE)
		.select("objectId")
		.distinct()
		.where("tag", "in", tags as string[]);
}

/**
 * A selection narrowed to the objects the acting subject may see.
 *
 * The tags are resolved into a subquery that the object table is joined *to*,
 * which is what keeps this proportional to what the subject can see rather than
 * to how much the table holds. Written flat — `access_tags JOIN objects ... WHERE
 * tag IN (...) ORDER BY objects.id` — SQLite prefers to scan the object table in
 * primary-key order to satisfy the sort, and a store of a million rows spends
 * roughly a third of a second on a page of fifty. Via the subquery the same page
 * costs under a millisecond, because the planner runs it as a co-routine over
 * the tag index and probes the objects by id.
 *
 * The caller finishes the query: `.select(...)` or `.selectAll("obj")`,
 * `.where(...)` on its own columns, `.orderBy(...)`, `.limit(...)`. Their
 * conditions apply after the access narrowing, so a page is never short.
 */
export function visibleFrom(
	db: Kysely<any>,
	table: string,
	options: VisibleOptions = {},
) {
	const { idColumn = "id", tags = actorTags(), alias = "obj" } = options;
	return (db.selectFrom(`${table} as ${alias}`) as any).innerJoin(
		(eb: any) => visibleIds(eb, tags).as("ids"),
		(join: any) => join.onRef("ids.objectId", "=", `${alias}.${idColumn}`),
	);
}

/**
 * How many objects of `table` the subject can see.
 *
 * The subquery is already distinct and the join is on a primary key, so a plain
 * count is exact — an object carrying several of the subject's tags is still
 * counted once.
 */
export async function visibleCount(
	db: Kysely<any>,
	table: string,
	options: VisibleOptions = {},
): Promise<number> {
	const row = await visibleFrom(db, table, options)
		.select((eb: any) => eb.fn.countAll().as("count"))
		.executeTakeFirst();
	return Number(row?.count ?? 0);
}

export type VisiblePage<T> = {
	items: T[];
	totalCount: number;
};

/**
 * One page of what the subject can see, plus the honest total.
 *
 * The total is taken with the same narrowing as the page. Counting without it
 * would publish how many objects are being hidden, which is usually the one
 * thing the hiding was for.
 *
 * Ordering defaults to the object id: where ids come from a shared sequence or
 * are UUIDv7 that is creation order. With unordered ids (UUIDv4) pass `orderBy`
 * explicitly, or the page order is arbitrary.
 */
export async function listVisible<T>(
	db: Kysely<any>,
	table: string,
	options: VisibleOptions & {
		limit?: number;
		offset?: number;
		orderBy?: { column: string; direction?: "asc" | "desc" };
	} = {},
): Promise<VisiblePage<T>> {
	const { limit = 50, offset = 0, orderBy, ...visible } = options;
	const idColumn = visible.idColumn ?? "id";
	const alias = visible.alias ?? "obj";
	const order = orderBy ?? {
		column: `${alias}.${idColumn}`,
		direction: "asc" as const,
	};

	const items = await visibleFrom(db, table, visible)
		.selectAll(alias)
		.orderBy(order.column as any, order.direction ?? "asc")
		.limit(limit)
		.offset(offset)
		.execute();

	return {
		items: items as T[],
		totalCount: await visibleCount(db, table, visible),
	};
}
