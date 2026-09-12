import {
	AccessTags,
	generateULID,
	type SqlStore,
	visibleFrom,
} from "back-core";
import type {
	Galery,
	GaleryId,
	GaleryInput,
	PaginatedResult,
	PaginationParams,
} from "../../types";
import { type GaleryEntity, GaleryRepository } from "./galeries.entities";

export class GaleryStoreService {
	private readonly repo: GaleryRepository;
	/**
	 * Who may see which gallery. Shared with the images of the same store: an
	 * image inherits its gallery's tags at creation, so a closed gallery has no
	 * visible contents.
	 */
	readonly access: AccessTags;

	constructor(private store: SqlStore) {
		this.access = new AccessTags(store);
		this.repo = new GaleryRepository(store, "galeries", {
			primaryKey: "id",
			extractKey: (entry) => ({ id: entry.id }),
			buildWhereCondition: (key) => ({ id: key.id }),
		});
	}

	async create(input: GaleryInput, actor?: string): Promise<GaleryId> {
		const id = generateULID();
		const createdAt = new Date().toISOString();
		const entity: GaleryEntity = {
			id,
			name: input.name,
			description: input.description ?? null,
			createdAt,
		};

		await this.repo.create(entity as any);
		await this.access.tagNew(id, {
			visibility: "authenticated",
			owner: actor,
		});
		return id;
	}

	/** A gallery the caller holds no tag for reads as absent. */
	async get(id: GaleryId): Promise<Galery | null> {
		if (!(await this.access.canRead(id))) return null;
		const entity = await this.repo.findById({ id });
		return entity ? this.toGalery(entity) : null;
	}

	async list(params: PaginationParams): Promise<PaginatedResult<Galery>> {
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;

		const items = await visibleFrom(this.store.db, "galeries")
			.selectAll("obj")
			.orderBy("obj.createdAt", "desc")
			.limit(limit)
			.offset(offset)
			.execute();

		const count = await visibleFrom(this.store.db, "galeries")
			.select((eb: any) => eb.fn.countAll().as("count"))
			.executeTakeFirst();

		return {
			items: (items as GaleryEntity[]).map((item) => this.toGalery(item)),
			totalCount: Number(count?.count ?? 0),
		};
	}

	async delete(id: GaleryId): Promise<boolean> {
		await this.access.requireWrite(id);
		const deleted = await this.repo.delete({ id });
		if (deleted) await this.access.dropObject(id);
		return deleted;
	}

	private toGalery(entity: GaleryEntity): Galery {
		return {
			id: entity.id,
			name: entity.name,
			description: entity.description ?? undefined,
			createdAt: entity.createdAt,
		};
	}
}
