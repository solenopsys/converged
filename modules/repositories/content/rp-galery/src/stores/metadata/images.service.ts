import {
	AccessTags,
	generateULID,
	type SqlStore,
	visibleFrom,
} from "back-core";
import type {
	GaleryId,
	GaleryImage,
	GaleryImageId,
	GaleryImageInput,
	PaginatedResult,
	PaginationParams,
} from "../../types";
import {
	type GaleryImageEntity,
	GaleryImageRepository,
} from "./images.entities";

export class GaleryImagesStoreService {
	private readonly repo: GaleryImageRepository;
	/** The same relation the galleries use — one table serves the whole store. */
	readonly access: AccessTags;

	constructor(private store: SqlStore) {
		this.access = new AccessTags(store);
		this.repo = new GaleryImageRepository(store, "galery_images", {
			primaryKey: "id",
			extractKey: (entry) => ({ id: entry.id }),
			buildWhereCondition: (key) => ({ id: key.id }),
		});
	}

	/**
	 * Adds an image and gives it the gallery's audience.
	 *
	 * The tags are copied here, by the server, from the gallery's own row — not
	 * passed in. A caller that names an image's tags names who may see it.
	 */
	async create(
		input: GaleryImageInput,
		filePath: string,
		thumbPath: string,
		actor?: string,
	): Promise<GaleryImage> {
		const id = generateULID();
		const createdAt = new Date().toISOString();
		const entity: GaleryImageEntity = {
			id,
			galeryId: input.galeryId,
			title: input.title ?? null,
			description: input.description ?? null,
			originalName: input.originalName ?? null,
			mimeType: input.mimeType ?? null,
			filePath,
			thumbPath,
			createdAt,
		};

		await this.repo.create(entity as any);
		// No visibility of its own: an image is as open as the gallery holding it,
		// so it takes that gallery's tags verbatim and adds its uploader. Declaring
		// `authenticated` here would quietly re-open images in a closed gallery.
		await this.access.tagNew(id, {
			owner: actor,
			tags: await this.access.tagsOf(input.galeryId),
		});
		return this.toImage(entity);
	}

	async get(id: GaleryImageId): Promise<GaleryImage | null> {
		if (!(await this.access.canRead(id))) return null;
		const entity = await this.repo.findById({ id });
		return entity ? this.toImage(entity) : null;
	}

	async listByGalery(
		galeryId: GaleryId,
		params: PaginationParams,
	): Promise<PaginatedResult<GaleryImage>> {
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;

		// The gallery has to be open before its contents are listed, and then only
		// the images that are open come back — an image can be revoked on its own.
		await this.access.requireRead(galeryId);

		const items = await visibleFrom(this.store.db, "galery_images")
			.selectAll("obj")
			.where("obj.galeryId", "=", galeryId)
			.orderBy("obj.createdAt", "desc")
			.limit(limit)
			.offset(offset)
			.execute();

		const count = await visibleFrom(this.store.db, "galery_images")
			.select((eb: any) => eb.fn.countAll().as("count"))
			.where("obj.galeryId", "=", galeryId)
			.executeTakeFirst();

		return {
			items: (items as GaleryImageEntity[]).map((item) => this.toImage(item)),
			totalCount: Number(count?.count ?? 0),
		};
	}

	async delete(id: GaleryImageId): Promise<boolean> {
		await this.access.requireWrite(id);
		const deleted = await this.repo.delete({ id });
		if (deleted) await this.access.dropObject(id);
		return deleted;
	}

	private toImage(entity: GaleryImageEntity): GaleryImage {
		return {
			id: entity.id,
			galeryId: entity.galeryId,
			title: entity.title ?? undefined,
			description: entity.description ?? undefined,
			originalName: entity.originalName ?? undefined,
			mimeType: entity.mimeType ?? undefined,
			filePath: entity.filePath,
			thumbPath: entity.thumbPath,
			createdAt: entity.createdAt,
		};
	}
}
