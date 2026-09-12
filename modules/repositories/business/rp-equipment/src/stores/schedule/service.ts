import {
  AccessTags,
  generateULID,
  type SqlStore,
  visibleFrom,
} from "back-core";
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
  /**
   * Who may see which slot. Like logs, slots sit in their own store and are
   * written with the tags of the machine they occupy, handed over by
   * `service.ts`.
   */
  readonly access: AccessTags;

  constructor(
    private store: SqlStore,
    /** The equipment store's relation; see the logs store for why. */
    private readonly equipmentAccess?: AccessTags,
  ) {
    this.access = new AccessTags(store);
    this.repo = new ScheduleSlotRepository(store, "schedule_slots", {
      primaryKey: "id",
      extractKey: (entry) => ({ id: entry.id }),
      buildWhereCondition: (key) => ({ id: key.id }),
    });
  }

  /** Booking a machine the caller cannot see is refused for the same reason. */
  async createSlot(input: ScheduleSlotInput): Promise<ScheduleSlotId> {
    const tags = await this.tagsOfMachine(input.equipmentId);
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
    await this.access.setTags(id, tags);
    return id;
  }

  async listSlots(params: ScheduleListParams): Promise<PaginatedResult<ScheduleSlot>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    const items = await this.applyFilters(this.visible(), params)
      .selectAll("obj")
      .orderBy("obj.startAt", "asc")
      .limit(limit)
      .offset(offset)
      .execute();

    const countResult = await this.applyFilters(this.visible(), params)
      .select((eb: any) => eb.fn.countAll().as("count"))
      .executeTakeFirst();

    return {
      items: (items as ScheduleSlotEntity[]).map(this.toSlot),
      totalCount: Number(countResult?.count ?? 0),
    };
  }

  private async tagsOfMachine(equipmentId: string): Promise<string[]> {
    if (!this.equipmentAccess) return [];
    await this.equipmentAccess.requireRead(equipmentId);
    return this.equipmentAccess.tagsOf(equipmentId);
  }

  /** Slots the caller may see, as the base of the listing and its count. */
  private visible() {
    return visibleFrom(this.store.db, "schedule_slots");
  }

  private applyFilters(query: any, params: ScheduleListParams) {
    let next = query;
    if (params.equipmentId)
      next = next.where("obj.equipmentId", "=", params.equipmentId);
    if (params.status) next = next.where("obj.status", "=", params.status);
    if (params.from) next = next.where("obj.endAt", ">=", params.from);
    if (params.to) next = next.where("obj.startAt", "<=", params.to);
    return next;
  }

  async patchSlot(id: ScheduleSlotId, patch: ScheduleSlotPatch): Promise<void> {
    // Moving somebody else's booking is a write on the machine's slot, not a
    // read of the calendar.
    await this.access.requireWrite(id);
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
