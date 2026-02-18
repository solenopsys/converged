import { SqlStore, generateULID } from "back-core";
import { GaleryRepository, GaleryEntity } from "./galeries.entities";
import type {
  Galery,
  GaleryId,
  GaleryInput,
  PaginationParams,
  PaginatedResult,
} from "../../types";

export class GaleryStoreService {
  private readonly repo: GaleryRepository;

  constructor(private store: SqlStore) {
    this.repo = new GaleryRepository(store, "galeries", {
      primaryKey: "id",
      extractKey: (entry) => ({ id: entry.id }),
      buildWhereCondition: (key) => ({ id: key.id }),
    });
  }

  async create(input: GaleryInput): Promise<GaleryId> {
    const id = generateULID();
    const createdAt = new Date().toISOString();
    const entity: GaleryEntity = {
      id,
      name: input.name,
      description: input.description ?? null,
      createdAt,
    };

    await this.repo.create(entity as any);
    return id;
  }

  async get(id: GaleryId): Promise<Galery | null> {
    const entity = await this.repo.findById({ id });
    return entity ? this.toGalery(entity) : null;
  }

  async list(params: PaginationParams): Promise<PaginatedResult<Galery>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;
    const items = await this.store.db
      .selectFrom("galeries")
      .selectAll()
      .orderBy("createdAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    const count = await this.store.db
      .selectFrom("galeries")
      .select(({ fn }) => fn.countAll().as("count"))
      .executeTakeFirst();

    return {
      items: (items as GaleryEntity[]).map((item) => this.toGalery(item)),
      totalCount: Number(count?.count ?? 0),
    };
  }

  async delete(id: GaleryId): Promise<boolean> {
    return this.repo.delete({ id });
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
