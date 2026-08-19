import { generateULID, type SqlStore } from "back-core";
import { ScheduleSlotRepository } from "./entities";
import type {
  ScheduleSlot,
  ScheduleSlotId,
  ScheduleSlotInput,
  ScheduleSlotPatch,
  ScheduleListParams,
  PaginatedResult,
} from "../../types";
import type { ScheduleSlotEntity } from "./entities";

export class ScheduleStoreService {
  private readonly repo: ScheduleSlotRepository;

  constructor(private store: SqlStore) {
    this.repo = new ScheduleSlotRepository(store, "schedule_slots", {
      primaryKey: "id",
      extractKey: (entry) => ({ id: entry.id }),
      buildWhereCondition: (key) => ({ id: key.id }),
    });
  }

  async createSlot(input: ScheduleSlotInput): Promise<ScheduleSlotId> {
    const id = generateULID();
    const now = new Date().toISOString();
    const entity: ScheduleSlotEntity = {
      id,
      equipmentId: input.equipmentId,
      jobId: input.jobId ?? null,
      orderId: input.orderId ?? null,
      startAt: input.startAt,
      endAt: input.endAt,
      status: "planned",
      note: input.note ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await this.repo.create(entity as any);
    return id;
  }

  async listSlots(params: ScheduleListParams): Promise<PaginatedResult<ScheduleSlot>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let query = this.store.db.selectFrom("schedule_slots").selectAll();
    if (params.equipmentId) query = query.where("equipmentId", "=", params.equipmentId);
    if (params.status) query = query.where("status", "=", params.status);
    if (params.from) query = query.where("endAt", ">=", params.from);
    if (params.to) query = query.where("startAt", "<=", params.to);

    const items = await query.orderBy("startAt", "asc").limit(limit).offset(offset).execute();

    let countQuery = this.store.db
      .selectFrom("schedule_slots")
      .select(({ fn }) => fn.countAll().as("count"));
    if (params.equipmentId) countQuery = countQuery.where("equipmentId", "=", params.equipmentId);
    if (params.status) countQuery = countQuery.where("status", "=", params.status);
    const countResult = await countQuery.executeTakeFirst();

    return {
      items: (items as ScheduleSlotEntity[]).map(this.toSlot),
      totalCount: Number(countResult?.count ?? 0),
    };
  }

  async patchSlot(id: ScheduleSlotId, patch: ScheduleSlotPatch): Promise<void> {
    const existing = await this.repo.findById({ id });
    if (!existing) throw new Error(`ScheduleSlot not found: ${id}`);

    const next: Partial<ScheduleSlotEntity> = { updatedAt: new Date().toISOString() };
    if (patch.status !== undefined) next.status = patch.status;
    if (patch.jobId !== undefined) next.jobId = patch.jobId ?? null;
    if (patch.startAt !== undefined) next.startAt = patch.startAt;
    if (patch.endAt !== undefined) next.endAt = patch.endAt;
    if (patch.note !== undefined) next.note = patch.note ?? null;

    await this.repo.update({ id }, next as any);
  }

  private toSlot(entity: ScheduleSlotEntity): ScheduleSlot {
    return {
      id: entity.id,
      equipmentId: entity.equipmentId,
      jobId: entity.jobId ?? undefined,
      orderId: entity.orderId ?? undefined,
      startAt: entity.startAt,
      endAt: entity.endAt,
      status: entity.status as any,
      note: entity.note ?? undefined,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
