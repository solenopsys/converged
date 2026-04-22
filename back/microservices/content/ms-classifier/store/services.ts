import { SqlStore } from "back-core";

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
	private db: SqlStore["db"];

	constructor(store: SqlStore) {
		this.db = store.db;
	}

	async addNode(node: NodeEntity): Promise<void> {
		await this.db.insertInto("nodes").values(node).execute();
	}

	async getNode(id: string): Promise<NodeEntity | undefined> {
		return this.db
			.selectFrom("nodes")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst() as Promise<NodeEntity | undefined>;
	}

	async getChildren(parentId: string): Promise<NodeEntity[]> {
		return this.db
			.selectFrom("nodes")
			.selectAll()
			.where("parentId", "=", parentId)
			.execute() as Promise<NodeEntity[]>;
	}

	async listRoots(): Promise<NodeEntity[]> {
		return this.db
			.selectFrom("nodes")
			.selectAll()
			.where("parentId", "is", null)
			.execute() as Promise<NodeEntity[]>;
	}

	async listNodes(
		params: PaginationParams,
	): Promise<{ items: NodeEntity[]; totalCount: number }> {
		const offset = params?.offset ?? 0;
		const limit = params?.limit ?? 100;
		const [items, countRow] = await Promise.all([
			this.db
				.selectFrom("nodes")
				.selectAll()
				.orderBy("name", "asc")
				.offset(offset)
				.limit(limit)
				.execute(),
			this.db
				.selectFrom("nodes")
				.select(({ fn }) => fn.countAll<number>().as("totalCount"))
				.executeTakeFirst(),
		]);

		return {
			items: items as NodeEntity[],
			totalCount: Number(countRow?.totalCount ?? 0),
		};
	}

	async listTreeChildren(parentId?: string | null): Promise<TreeNodeEntity[]> {
		let query = this.db.selectFrom("nodes as n");
		query =
			parentId === null || parentId === undefined
				? query.where("n.parentId", "is", null)
				: query.where("n.parentId", "=", parentId);

		return query
			.select((eb) => [
				"n.id",
				"n.parentId",
				"n.name",
				"n.slug",
				eb
					.selectFrom("nodes as child")
					.select(({ fn }) => fn.countAll<number>().as("count"))
					.whereRef("child.parentId", "=", "n.id")
					.as("childrenCount"),
			])
			.orderBy("n.name", "asc")
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
		return mapping.id;
	}

	async getMapping(
		groupId: string,
		key: string,
	): Promise<MappingEntity | undefined> {
		return this.db
			.selectFrom("mappings")
			.selectAll()
			.where("groupId", "=", groupId)
			.where("key", "=", key)
			.executeTakeFirst() as Promise<MappingEntity | undefined>;
	}

	async listMappings(groupId: string): Promise<MappingEntity[]> {
		return this.db
			.selectFrom("mappings")
			.selectAll()
			.where("groupId", "=", groupId)
			.orderBy("priority", "desc")
			.orderBy("key", "asc")
			.execute() as Promise<MappingEntity[]>;
	}

	async listMappingGroups(): Promise<MappingGroupEntity[]> {
		return this.db
			.selectFrom("mappings")
			.select(({ fn }) => ["groupId", fn.countAll<number>().as("count")])
			.groupBy("groupId")
			.orderBy("groupId", "asc")
			.execute() as Promise<MappingGroupEntity[]>;
	}

	async deleteMapping(groupId: string, key: string): Promise<boolean> {
		const result = await this.db
			.deleteFrom("mappings")
			.where("groupId", "=", groupId)
			.where("key", "=", key)
			.executeTakeFirst();
		return Number(result.numDeletedRows ?? 0) > 0;
	}
}
