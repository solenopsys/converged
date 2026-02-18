import { SqlStore, generateULID } from "back-core";
import { EquipmentRepository } from "./entities";
import type {
  Equipment,
  EquipmentInput,
  EquipmentId,
  EquipmentListParams,
  EquipmentStateInput,
  PaginatedResult,
} from "../../types";
import type { EquipmentEntity } from "./entities";

const DEFAULT_STATUS = "idle";

export class EquipmentStoreService {
  private readonly repo: EquipmentRepository;

  constructor(private store: SqlStore) {
    this.repo = new EquipmentRepository(store, "equipment", {
      primaryKey: "id",
      extractKey: (entry) => ({ id: entry.id }),
      buildWhereCondition: (key) => ({ id: key.id }),
    });
  }

  async registerEquipment(input: EquipmentInput): Promise<EquipmentId> {
    const id = generateULID();
    const createdAt = new Date().toISOString();
    const status = input.status ?? DEFAULT_STATUS;

    const entity: EquipmentEntity = {
      id,
      kind: input.kind,
      name: input.name ?? "",
      status,
      jobId: input.jobId ?? null,
      createdAt,
      updatedAt: createdAt,
    };

    await this.repo.create(entity as any);
    return id;
  }

  async getEquipment(id: EquipmentId): Promise<Equipment | undefined> {
    const entity = await this.repo.findById({ id });
    if (!entity) {
      return undefined;
    }
    return this.toEquipment(entity);
  }

  async listEquipment(
    params: EquipmentListParams,
  ): Promise<PaginatedResult<Equipment>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let query = this.store.db.selectFrom("equipment").selectAll();
    if (params.kind) {
      query = query.where("kind", "=", params.kind);
    }
    if (params.status) {
      query = query.where("status", "=", params.status);
    }
    if (params.jobId) {
      query = query.where("jobId", "=", params.jobId);
    }

    const items = await query
      .orderBy("updatedAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    let countQuery = this.store.db
      .selectFrom("equipment")
      .select(({ fn }) => fn.countAll().as("count"));
    if (params.kind) {
      countQuery = countQuery.where("kind", "=", params.kind);
    }
    if (params.status) {
      countQuery = countQuery.where("status", "=", params.status);
    }
    if (params.jobId) {
      countQuery = countQuery.where("jobId", "=", params.jobId);
    }
    const countResult = await countQuery.executeTakeFirst();
    const totalCount = Number(countResult?.count ?? 0);

    return {
      items: (items as EquipmentEntity[]).map((item) => this.toEquipment(item)),
      totalCount,
    };
  }

  async updateState(id: EquipmentId, state: EquipmentStateInput): Promise<void> {
    const existing = await this.repo.findById({ id });
    if (!existing) {
      throw new Error(`Equipment not found: ${id}`);
    }

    const nextJob =
      state.jobId !== undefined
        ? state.jobId.length > 0
          ? state.jobId
          : null
        : existing.jobId ?? null;

    await this.repo.update(
      { id },
      {
        status: state.status,
        jobId: nextJob,
        updatedAt: new Date().toISOString(),
      },
    );
  }

  private toEquipment(entity: EquipmentEntity): Equipment {
    const name = entity.name?.length ? entity.name : undefined;
    const jobId = entity.jobId ?? undefined;
    return {
      id: entity.id,
      kind: entity.kind,
      name,
      status: entity.status,
      jobId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
