import { SqlStore, generateULID } from "back-core";
import { GaleryImageRepository, GaleryImageEntity } from "./images.entities";
import type {
  GaleryImage,
  GaleryImageId,
  GaleryImageInput,
  GaleryId,
  PaginationParams,
  PaginatedResult,
} from "../../types";

export class GaleryImagesStoreService {
  private readonly repo: GaleryImageRepository;

  constructor(private store: SqlStore) {
    this.repo = new GaleryImageRepository(store, "galery_images", {
      primaryKey: "id",
      extractKey: (entry) => ({ id: entry.id }),
      buildWhereCondition: (key) => ({ id: key.id }),
    });
  }

  async create(
    input: GaleryImageInput,
    filePath: string,
    thumbPath: string,
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
    return this.toImage(entity);
  }

  async get(id: GaleryImageId): Promise<GaleryImage | null> {
    const entity = await this.repo.findById({ id });
    return entity ? this.toImage(entity) : null;
  }

  async listByGalery(
    galeryId: GaleryId,
    params: PaginationParams,
  ): Promise<PaginatedResult<GaleryImage>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    const items = await this.store.db
      .selectFrom("galery_images")
      .selectAll()
      .where("galeryId", "=", galeryId)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    const count = await this.store.db
      .selectFrom("galery_images")
      .select(({ fn }) => fn.countAll().as("count"))
      .where("galeryId", "=", galeryId)
      .executeTakeFirst();

    return {
      items: (items as GaleryImageEntity[]).map((item) => this.toImage(item)),
      totalCount: Number(count?.count ?? 0),
    };
  }

  async delete(id: GaleryImageId): Promise<boolean> {
    return this.repo.delete({ id });
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
