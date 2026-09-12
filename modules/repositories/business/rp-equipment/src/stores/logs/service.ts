import {
  AccessTags,
  generateULID,
  type SqlStore,
  visibleFrom,
} from "back-core";
import { EquipmentLogRepository } from "./entities";
import type { EquipmentLog, EquipmentLogId, EquipmentLogInput, EquipmentLogListParams, PaginatedResult } from "../../types";
import type { EquipmentLogEntity } from "./entities";

export class EquipmentLogsStoreService {
  private readonly repo: EquipmentLogRepository;
  /**
   * Who may see which log line.
   *
   * A log belongs to a machine, and this store is not the machine's, so it
   * cannot join to its tags: the caller hands them over at write time (see
   * `service.ts`, which reads them from the equipment store and refuses a
   * machine it cannot see). Narrowing a machine therefore narrows the log lines
   * written after it — the earlier ones keep the audience they were written
   * with, which is the same rule the scheme applies to existing rows
   * everywhere.
   */
  readonly access: AccessTags;

  constructor(
    private store: SqlStore,
    /**
     * The equipment store's relation. Passed in rather than joined to, because
     * a tag table belongs to one store and the machines live in another; this
     * is the one place the two are brought together.
     */
    private readonly equipmentAccess?: AccessTags,
  ) {
    this.access = new AccessTags(store);
    this.repo = new EquipmentLogRepository(store, "equipment_logs", {
      primaryKey: "id",
      extractKey: (entry) => ({ id: entry.id }),
      buildWhereCondition: (key) => ({ id: key.id }),
    });
  }

  /**
   * A machine the caller cannot see cannot be logged against: otherwise the
   * refusal itself would say whether it exists.
   */
  async addLog(input: EquipmentLogInput): Promise<EquipmentLogId> {
    const tags = await this.tagsOfMachine(input.equipmentId);
    const id = generateULID();
    const entity: EquipmentLogEntity = {
      id,
      equipmentId: input.equipmentId,
      eventType: input.eventType,
      severity: input.severity ?? "info",
      description: input.description,
      jobId: input.jobId ?? null,
      createdAt: new Date().toISOString(),
    };
    await this.repo.create(entity as any);
    await this.access.setTags(id, tags);
    return id;
  }

  async listLogs(params: EquipmentLogListParams): Promise<PaginatedResult<EquipmentLog>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    const items = await this.applyFilters(this.visible(), params)
      .selectAll("obj")
      .orderBy("obj.createdAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    const countResult = await this.applyFilters(this.visible(), params)
      .select((eb: any) => eb.fn.countAll().as("count"))
      .executeTakeFirst();

    return {
      items: (items as EquipmentLogEntity[]).map(this.toLog),
      totalCount: Number(countResult?.count ?? 0),
    };
  }

  private async tagsOfMachine(equipmentId: string): Promise<string[]> {
    if (!this.equipmentAccess) return [];
    await this.equipmentAccess.requireRead(equipmentId);
    return this.equipmentAccess.tagsOf(equipmentId);
  }

  /** Log lines the caller may see, as the base of the listing and its count. */
  private visible() {
    return visibleFrom(this.store.db, "equipment_logs");
  }

  private applyFilters(query: any, params: EquipmentLogListParams) {
    let next = query;
    if (params.equipmentId)
      next = next.where("obj.equipmentId", "=", params.equipmentId);
    if (params.eventType)
      next = next.where("obj.eventType", "=", params.eventType);
    if (params.severity) next = next.where("obj.severity", "=", params.severity);
    if (params.from) next = next.where("obj.createdAt", ">=", params.from);
    if (params.to) next = next.where("obj.createdAt", "<=", params.to);
    return next;
  }

  private toLog(entity: EquipmentLogEntity): EquipmentLog {
    return {
      id: entity.id,
      equipmentId: entity.equipmentId,
      eventType: entity.eventType as any,
      severity: entity.severity as any,
      description: entity.description,
      jobId: entity.jobId ?? undefined,
      createdAt: entity.createdAt,
    };
  }
}
