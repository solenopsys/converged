import { SqlStore, generateULID } from "back-core";
import { EquipmentRepository } from "./entities";
import type {
  Equipment,
  EquipmentInput,
  EquipmentId,
  EquipmentListParams,
  EquipmentStateInput,
  EquipmentPatch,
  EquipmentDashboard,
  EquipmentStatusCount,
  PaginatedResult,
} from "../../types";
import type { EquipmentEntity } from "./entities";

const DEFAULT_STATUS = "idle";

const ALL_STATUSES = ["idle", "running", "maintenance", "error", "offline"] as const;

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
    const now = new Date().toISOString();
    const entity: EquipmentEntity = {
      id,
      kind: input.kind,
      name: input.name ?? "",
      serialNumber: input.serialNumber ?? null,
      location: input.location ?? null,
      description: input.description ?? null,
      maintenanceIntervalDays: input.maintenanceIntervalDays ?? null,
      lastMaintenanceAt: null,
      status: input.status ?? DEFAULT_STATUS,
      jobId: input.jobId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await this.repo.create(entity as any);
    return id;
  }

  async getEquipment(id: EquipmentId): Promise<Equipment | undefined> {
    const entity = await this.repo.findById({ id });
    return entity ? this.toEquipment(entity) : undefined;
  }

  async listEquipment(params: EquipmentListParams): Promise<PaginatedResult<Equipment>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let query = this.store.db.selectFrom("equipment").selectAll();
    if (params.kind) query = query.where("kind", "=", params.kind);
    if (params.status) query = query.where("status", "=", params.status);
    if (params.jobId) query = query.where("jobId", "=", params.jobId);

    const items = await query.orderBy("updatedAt", "desc").limit(limit).offset(offset).execute();

    let countQuery = this.store.db
      .selectFrom("equipment")
      .select(({ fn }) => fn.countAll().as("count"));
    if (params.kind) countQuery = countQuery.where("kind", "=", params.kind);
    if (params.status) countQuery = countQuery.where("status", "=", params.status);
    const countResult = await countQuery.executeTakeFirst();

    return {
      items: (items as EquipmentEntity[]).map((e) => this.toEquipment(e)),
      totalCount: Number(countResult?.count ?? 0),
    };
  }

  async patchEquipment(id: EquipmentId, patch: EquipmentPatch): Promise<void> {
    const existing = await this.repo.findById({ id });
    if (!existing) throw new Error(`Equipment not found: ${id}`);

    const next: Partial<EquipmentEntity> = { updatedAt: new Date().toISOString() };
    if (patch.name !== undefined) next.name = patch.name;
    if (patch.serialNumber !== undefined) next.serialNumber = patch.serialNumber ?? null;
    if (patch.location !== undefined) next.location = patch.location ?? null;
    if (patch.description !== undefined) next.description = patch.description ?? null;
    if (patch.maintenanceIntervalDays !== undefined) next.maintenanceIntervalDays = patch.maintenanceIntervalDays ?? null;
    if (patch.lastMaintenanceAt !== undefined) next.lastMaintenanceAt = patch.lastMaintenanceAt ?? null;

    await this.repo.update({ id }, next as any);
  }

  async deleteEquipment(id: EquipmentId): Promise<boolean> {
    const existing = await this.repo.findById({ id });
    if (!existing) return false;
    await this.repo.delete({ id });
    return true;
  }

  async updateState(id: EquipmentId, state: EquipmentStateInput): Promise<void> {
    const existing = await this.repo.findById({ id });
    if (!existing) throw new Error(`Equipment not found: ${id}`);

    const nextJob =
      state.jobId !== undefined
        ? state.jobId.length > 0 ? state.jobId : null
        : existing.jobId ?? null;

    await this.repo.update({ id }, {
      status: state.status,
      jobId: nextJob,
      updatedAt: new Date().toISOString(),
    });
  }

  async getEquipmentDashboard(): Promise<EquipmentDashboard> {
    const all = (await this.store.db
      .selectFrom("equipment")
      .selectAll()
      .execute()) as EquipmentEntity[];

    const statusCounts: EquipmentStatusCount[] = ALL_STATUSES.map((status) => ({
      status,
      count: all.filter((e) => e.status === status).length,
    }));

    const running = all.filter((e) => e.status === "running").length;
    const utilizationPercent = all.length > 0
      ? Math.round((running / all.length) * 100)
      : 0;

    return { total: all.length, statusCounts, utilizationPercent };
  }

  private toEquipment(entity: EquipmentEntity): Equipment {
    return {
      id: entity.id,
      kind: entity.kind,
      name: entity.name?.length ? entity.name : undefined,
      serialNumber: entity.serialNumber ?? undefined,
      location: entity.location ?? undefined,
      description: entity.description ?? undefined,
      maintenanceIntervalDays: entity.maintenanceIntervalDays ?? undefined,
      lastMaintenanceAt: entity.lastMaintenanceAt ?? undefined,
      status: entity.status as any,
      jobId: entity.jobId ?? undefined,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
