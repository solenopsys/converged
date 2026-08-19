import { generateULID, type SqlStore } from "back-core";
import { EquipmentLogRepository } from "./entities";
import type { EquipmentLog, EquipmentLogId, EquipmentLogInput, EquipmentLogListParams, PaginatedResult } from "../../types";
import type { EquipmentLogEntity } from "./entities";

export class EquipmentLogsStoreService {
  private readonly repo: EquipmentLogRepository;

  constructor(private store: SqlStore) {
    this.repo = new EquipmentLogRepository(store, "equipment_logs", {
      primaryKey: "id",
      extractKey: (entry) => ({ id: entry.id }),
      buildWhereCondition: (key) => ({ id: key.id }),
    });
  }

  async addLog(input: EquipmentLogInput): Promise<EquipmentLogId> {
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
    return id;
  }

  async listLogs(params: EquipmentLogListParams): Promise<PaginatedResult<EquipmentLog>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let query = this.store.db.selectFrom("equipment_logs").selectAll();
    if (params.equipmentId) query = query.where("equipmentId", "=", params.equipmentId);
    if (params.eventType) query = query.where("eventType", "=", params.eventType);
    if (params.severity) query = query.where("severity", "=", params.severity);
    if (params.from) query = query.where("createdAt", ">=", params.from);
    if (params.to) query = query.where("createdAt", "<=", params.to);

    const items = await query.orderBy("createdAt", "desc").limit(limit).offset(offset).execute();

    let countQuery = this.store.db
      .selectFrom("equipment_logs")
      .select(({ fn }) => fn.countAll().as("count"));
    if (params.equipmentId) countQuery = countQuery.where("equipmentId", "=", params.equipmentId);
    if (params.eventType) countQuery = countQuery.where("eventType", "=", params.eventType);
    if (params.severity) countQuery = countQuery.where("severity", "=", params.severity);
    const countResult = await countQuery.executeTakeFirst();

    return {
      items: (items as EquipmentLogEntity[]).map(this.toLog),
      totalCount: Number(countResult?.count ?? 0),
    };
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
