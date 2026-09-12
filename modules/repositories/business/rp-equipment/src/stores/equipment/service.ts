import { AccessTags, SqlStore, generateULID, visibleFrom } from "back-core";
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
  /**
   * Who may see which machine.
   *
   * A machine is shop-wide by meaning, so it is registered `authenticated` and
   * carries the tag of whoever registered it — usually the agent's service
   * account. Reading it stays what it was; changing its state or its record is
   * now the owner's or a `team-*` holder's, so a token that can merely reach
   * the port can no longer park a printer in maintenance.
   */
  readonly access: AccessTags;

  constructor(private store: SqlStore) {
    this.access = new AccessTags(store);
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
    await this.access.tagNew(id, { visibility: "authenticated" });
    return id;
  }

  /** A machine the caller holds no tag for reads as absent. */
  async getEquipment(id: EquipmentId): Promise<Equipment | undefined> {
    if (!(await this.access.canRead(id))) return undefined;
    const entity = await this.repo.findById({ id });
    return entity ? this.toEquipment(entity) : undefined;
  }

  async listEquipment(params: EquipmentListParams): Promise<PaginatedResult<Equipment>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    const items = await this.applyFilters(this.visible(), params)
      .selectAll("obj")
      .orderBy("obj.updatedAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    // The total is taken with the page's own conditions — `jobId` included,
    // which the count used to ignore.
    const countResult = await this.applyFilters(this.visible(), params)
      .select((eb: any) => eb.fn.countAll().as("count"))
      .executeTakeFirst();

    return {
      items: (items as EquipmentEntity[]).map((e) => this.toEquipment(e)),
      totalCount: Number(countResult?.count ?? 0),
    };
  }

  /** Machines the caller may see, as the base of every listing and total. */
  private visible() {
    return visibleFrom(this.store.db, "equipment");
  }

  private applyFilters(query: any, params: EquipmentListParams) {
    let next = query;
    if (params.kind) next = next.where("obj.kind", "=", params.kind);
    if (params.status) next = next.where("obj.status", "=", params.status);
    if (params.jobId) next = next.where("obj.jobId", "=", params.jobId);
    return next;
  }

  async patchEquipment(id: EquipmentId, patch: EquipmentPatch): Promise<void> {
    await this.access.requireWrite(id);
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
    await this.access.requireWrite(id);
    const existing = await this.repo.findById({ id });
    if (!existing) return false;
    await this.repo.delete({ id });
    // The tags go with the row: a leftover link would later match a reused id.
    await this.access.dropObject(id);
    return true;
  }

  /**
   * Reporting a machine's state is writing to it, not reading it: the agent
   * doing the reporting holds the machine's tag, everyone else only sees it.
   */
  async updateState(id: EquipmentId, state: EquipmentStateInput): Promise<void> {
    await this.access.requireWrite(id);
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

  /** Utilisation over the machines the caller may see, and no others. */
  async getEquipmentDashboard(): Promise<EquipmentDashboard> {
    const all = (await this.visible()
      .selectAll("obj")
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
