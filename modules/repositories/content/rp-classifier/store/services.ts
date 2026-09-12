import { AccessTags, SqlStore, visibleFrom } from "back-core";

export interface PaginationParams {
	offset: number;
	limit: number;
}

export interface NodeEntity {
	id: string;
	parentId: string | null;
	name: string;
	slug: string;
}

export interface MappingEntity {
	id: string;
	groupId: string;
	key: string;
	value: string;
	priority: number;
	createdAt: number;
	updatedAt: number;
}

export interface TreeNodeEntity extends NodeEntity {
	childrenCount: number;
}

export interface MappingGroupEntity {
	groupId: string;
	count: number;
}

export class SqlStoreService {
	private readonly store: SqlStore;
	/**
	 * Who may see which node and which mapping.
	 *
	 * A classifier is reference data for the installation — every service that
	 * resolves a key needs it — so both are written `authenticated`, which is
	 * the reach they had, plus the tag of whoever wrote them. What that buys is
	 * the two things the taxonomy never had: a caller without a token no longer
	 * reads the tree, and rewriting a branch or a mapping group is the owner's
	 * or a `team-*` holder's rather than anyone's who can call the method.
	 *
	 * A child node inherits its parent's tags, so narrowing a branch narrows
	 * everything under it — the same inheritance `rp-community` uses for a topic
	 * inside a section.
	 */
	readonly access: AccessTags;

	constructor(store: SqlStore) {
		this.store = store;
		this.access = new AccessTags(store);
	}

	private get db(): SqlStore["db"] {
		return this.store.db;
	}

	/** Hanging a node under a branch starts by being able to see the branch. */
	async addNode(node: NodeEntity): Promise<void> {
		if (node.parentId) await this.access.requireRead(node.parentId);
		await this.db.insertInto("nodes").values(node).execute();
		if (node.parentId) {
			await this.access.setTags(
				node.id,
				await this.access.tagsOf(node.parentId),
			);
		} else {
			await this.access.tagNew(node.id, { visibility: "authenticated" });
		}
	}

	/** A node the caller holds no tag for reads as absent. */
	async getNode(id: string): Promise<NodeEntity | undefined> {
		if (!(await this.access.canRead(id))) return undefined;
		return this.db
			.selectFrom("nodes")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst() as Promise<NodeEntity | undefined>;
	}

	async getChildren(parentId: string): Promise<NodeEntity[]> {
		return this.visible("nodes")
			.selectAll("obj")
			.where("obj.parentId", "=", parentId)
			.execute() as Promise<NodeEntity[]>;
	}

	async listRoots(): Promise<NodeEntity[]> {
		return this.visible("nodes")
			.selectAll("obj")
			.where("obj.parentId", "is", null)
			.execute() as Promise<NodeEntity[]>;
	}

	/** Objects of `table` the caller may see, as the base of every listing. */
	private visible(table: string) {
		return visibleFrom(this.db, table);
	}

	/** The same set as ids, for narrowing a subquery that cannot be joined. */
	private visibleIds(table: string) {
		return this.visible(table).select("obj.id");
	}

	async listNodes(
		params: PaginationParams,
	): Promise<{ items: NodeEntity[]; totalCount: number }> {
		const offset = params?.offset ?? 0;
		const limit = params?.limit ?? 100;
		const [items, countRow] = await Promise.all([
			this.visible("nodes")
				.selectAll("obj")
				.orderBy("obj.name", "asc")
				.offset(offset)
				.limit(limit)
				.execute(),
			this.visible("nodes")
				.select((eb: any) => eb.fn.countAll<number>().as("totalCount"))
				.executeTakeFirst(),
		]);

		return {
			items: items as NodeEntity[],
			totalCount: Number(countRow?.totalCount ?? 0),
		};
	}

	/**
	 * The tree a level at a time. `childrenCount` counts only children the caller
	 * may see, or the number beside a branch would report how much of it is
	 * hidden from them.
	 */
	async listTreeChildren(parentId?: string | null): Promise<TreeNodeEntity[]> {
		let query = this.visible("nodes");
		query =
			parentId === null || parentId === undefined
				? query.where("obj.parentId", "is", null)
				: query.where("obj.parentId", "=", parentId);

		return query
			.select((eb: any) => [
				"obj.id",
				"obj.parentId",
				"obj.name",
				"obj.slug",
				eb
					.selectFrom("nodes as child")
					.select(({ fn }: any) => fn.countAll<number>().as("count"))
					.whereRef("child.parentId", "=", "obj.id")
					.where("child.id", "in", this.visibleIds("nodes"))
					.as("childrenCount"),
			])
			.orderBy("obj.name", "asc")
			.execute() as Promise<TreeNodeEntity[]>;
	}

	async setMapping(
		mapping: Omit<MappingEntity, "createdAt" | "updatedAt" | "priority"> & {
			priority?: number;
		},
	): Promise<string> {
		const existing = await this.getMapping(mapping.groupId, mapping.key);
		const now = Math.floor(Date.now() / 1000);
		const priority = mapping.priority ?? 0;

		if (existing) {
			// Overwriting an existing mapping is a write on that mapping: a key
			// that resolves to a URL or an account number is worth overwriting.
			await this.access.requireWrite(existing.id);
			await this.db
				.updateTable("mappings")
				.set({
					value: mapping.value,
					priority,
					updatedAt: now,
				})
				.where("id", "=", existing.id)
				.execute();
			return existing.id;
		}

		await this.db
			.insertInto("mappings")
			.values({
				...mapping,
				priority,
				createdAt: now,
				updatedAt: now,
			})
			.execute();
		await this.access.tagNew(mapping.id, { visibility: "authenticated" });
		return mapping.id;
	}

	async getMapping(
		groupId: string,
		key: string,
	): Promise<MappingEntity | undefined> {
		return this.visible("mappings")
			.selectAll("obj")
			.where("obj.groupId", "=", groupId)
			.where("obj.key", "=", key)
			.executeTakeFirst() as Promise<MappingEntity | undefined>;
	}

	async listMappings(groupId: string): Promise<MappingEntity[]> {
		return this.visible("mappings")
			.selectAll("obj")
			.where("obj.groupId", "=", groupId)
			.orderBy("obj.priority", "desc")
			.orderBy("obj.key", "asc")
			.execute() as Promise<MappingEntity[]>;
	}

	/** Group sizes over the mappings the caller may see. */
	async listMappingGroups(): Promise<MappingGroupEntity[]> {
		return this.visible("mappings")
			.select((eb: any) => [
				"obj.groupId as groupId",
				eb.fn.countAll<number>().as("count"),
			])
			.groupBy("obj.groupId")
			.orderBy("obj.groupId", "asc")
			.execute() as Promise<MappingGroupEntity[]>;
	}

	async deleteMapping(groupId: string, key: string): Promise<boolean> {
		const existing = await this.getMapping(groupId, key);
		if (!existing) return false;
		await this.access.requireWrite(existing.id);

		const result = await this.db
			.deleteFrom("mappings")
			.where("id", "=", existing.id)
			.executeTakeFirst();
		// The tags go with the row: a leftover link would later match a reused id.
		await this.access.dropObject(existing.id);
		return Number(result.numDeletedRows ?? 0) > 0;
	}
}
