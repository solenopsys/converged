import {
  AccessTags,
  SqlStore,
  generateULID,
  personalTag,
  visibleFrom,
} from "back-core";
import {
  StaffMemberRepository,
  ShiftRepository,
  AbsenceRepository,
} from "./entities";
import type {
  StaffMember,
  StaffInput,
  StaffUpdate,
  StaffId,
  Shift,
  ShiftInput,
  ShiftUpdate,
  ShiftId,
  Absence,
  AbsenceInput,
  AbsenceId,
  StaffListParams,
  ShiftListParams,
  AbsenceListParams,
  PaginatedResult,
} from "../../types";
import type {
  StaffMemberEntity,
  ShiftEntity,
  AbsenceEntity,
} from "./entities";

export class StaffStoreService {
  private readonly staffRepo: StaffMemberRepository;
  private readonly shiftRepo: ShiftRepository;
  private readonly absenceRepo: AbsenceRepository;
  /**
   * Who may see which staff record, shift and absence.
   *
   * All three tables share one relation — ULIDs are unique across the store, so
   * the join back to the owning table is what keeps a shift's tag from opening
   * an absence.
   *
   * A staff record is the shop's roster and is created `authenticated`, which
   * is the directory the screens showed before; on top of that it carries the
   * tag of the person it describes, when `userId` says who that is, so the
   * employee is not a stranger to their own record. Shifts and absences declare
   * no audience of their own: they inherit the member's tags literally, which
   * means narrowing one person — dropping the open tag and granting `team-hr` —
   * narrows their roster and their leave with it, in one place.
   */
  readonly access: AccessTags;

  constructor(private store: SqlStore) {
    this.access = new AccessTags(store);
    this.staffRepo = new StaffMemberRepository(store, "staff_members", {
      primaryKey: "id",
      extractKey: (entry) => ({ id: entry.id }),
      buildWhereCondition: (key) => ({ id: key.id }),
    });

    this.shiftRepo = new ShiftRepository(store, "staff_shifts", {
      primaryKey: "id",
      extractKey: (entry) => ({ id: entry.id }),
      buildWhereCondition: (key) => ({ id: key.id }),
    });

    this.absenceRepo = new AbsenceRepository(store, "staff_absences", {
      primaryKey: "id",
      extractKey: (entry) => ({ id: entry.id }),
      buildWhereCondition: (key) => ({ id: key.id }),
    });
  }

  async createStaff(input: StaffInput): Promise<StaffId> {
    const id = generateULID();
    const now = new Date().toISOString();

    const entity: StaffMemberEntity = {
      id,
      userId: input.userId ?? null,
      name: input.name,
      contact: input.contact ?? null,
      role: input.role ?? null,
      active: input.active === false ? 0 : 1,
      createdAt: now,
      updatedAt: now,
    };

    await this.staffRepo.create(entity as any);
    // `userId` is the link to an identity, so it is also the tag that lets that
    // person see themselves. The creator (HR, or the service running the
    // import) is added by `tagNew` as the owner.
    await this.access.tagNew(id, {
      visibility: "authenticated",
      tags: input.userId?.trim() ? [personalTag(input.userId.trim())] : [],
    });
    return id;
  }

  /** A record the caller holds no tag for reads as absent. */
  async getStaff(id: StaffId): Promise<StaffMember | undefined> {
    if (!(await this.access.canRead(id))) return undefined;
    const entity = await this.staffRepo.findById({ id });
    if (!entity) return undefined;
    return this.toStaff(entity);
  }

  async updateStaff(id: StaffId, patch: StaffUpdate): Promise<void> {
    // Editing is not reading: a record everyone can see is still edited by the
    // person it describes, whoever filed it, or HR through a group tag.
    await this.access.requireWrite(id);
    const existing = await this.staffRepo.findById({ id });
    if (!existing) {
      throw new Error(`Staff not found: ${id}`);
    }

    const update: Partial<StaffMemberEntity> = {
      updatedAt: new Date().toISOString(),
    };

    if (patch.userId !== undefined) {
      update.userId = patch.userId ?? null;
    }
    if (patch.name !== undefined) {
      update.name = patch.name;
    }
    if (patch.contact !== undefined) {
      update.contact = patch.contact ?? null;
    }
    if (patch.role !== undefined) {
      update.role = patch.role ?? null;
    }
    if (patch.active !== undefined) {
      update.active = patch.active ? 1 : 0;
    }

    await this.staffRepo.update({ id }, update);
    // A record re-pointed at another identity takes that person's tag with it,
    // or the previous holder would keep reading a record that is no longer
    // theirs.
    if (patch.userId !== undefined) {
      if (existing.userId) {
        await this.access.revoke(id, personalTag(existing.userId));
      }
      if (patch.userId?.trim()) {
        await this.access.grant(id, personalTag(patch.userId.trim()));
      }
    }
  }

  async deleteStaff(id: StaffId): Promise<boolean> {
    await this.access.requireWrite(id);
    const deleted = await this.staffRepo.delete({ id });
    // The tags go with the row: a leftover link would later match a reused id.
    if (deleted) await this.access.dropObject(id);
    return deleted;
  }

  async listStaff(
    params: StaffListParams,
  ): Promise<PaginatedResult<StaffMember>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    const items = await this.filterStaff(this.visible("staff_members"), params)
      .selectAll("obj")
      .orderBy("obj.updatedAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    const countResult = await this.filterStaff(
      this.visible("staff_members"),
      params,
    )
      .select((eb: any) => eb.fn.countAll().as("count"))
      .executeTakeFirst();
    const totalCount = Number(countResult?.count ?? 0);

    return {
      items: (items as StaffMemberEntity[]).map((item) => this.toStaff(item)),
      totalCount,
    };
  }

  /** Objects of `table` the caller may see, as the base of every listing. */
  private visible(table: string) {
    return visibleFrom(this.store.db, table);
  }

  private filterStaff(query: any, params: StaffListParams) {
    let next = query;
    if (params.active !== undefined) {
      next = next.where("obj.active", "=", params.active ? 1 : 0);
    }
    const textQuery = params.query?.trim();
    if (textQuery) {
      const pattern = `%${textQuery}%`;
      // The search runs inside the narrowing, so it never reaches a colleague
      // the caller is not shown — before the tags it was a way to probe for one
      // by contact fragment.
      next = next.where((eb: any) =>
        eb.or([
          eb("obj.name", "like", pattern),
          eb("obj.contact", "like", pattern),
          eb("obj.role", "like", pattern),
        ]),
      );
    }
    return next;
  }

  async createShift(input: ShiftInput): Promise<ShiftId> {
    // A shift is scheduled on a member, so it is the member that decides who
    // may schedule it, and the member's tags the shift is written with.
    await this.access.requireRead(input.staffId);
    const id = generateULID();
    const now = new Date().toISOString();

    const entity: ShiftEntity = {
      id,
      staffId: input.staffId,
      workId: input.workId ?? null,
      startAt: input.startAt,
      endAt: input.endAt,
      note: input.note ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await this.shiftRepo.create(entity as any);
    await this.access.setTags(id, await this.access.tagsOf(input.staffId));
    return id;
  }

  async getShift(id: ShiftId): Promise<Shift | undefined> {
    if (!(await this.access.canRead(id))) return undefined;
    const entity = await this.shiftRepo.findById({ id });
    if (!entity) return undefined;
    return this.toShift(entity);
  }

  async updateShift(id: ShiftId, patch: ShiftUpdate): Promise<void> {
    await this.access.requireWrite(id);
    const existing = await this.shiftRepo.findById({ id });
    if (!existing) {
      throw new Error(`Shift not found: ${id}`);
    }

    const update: Partial<ShiftEntity> = {
      updatedAt: new Date().toISOString(),
    };

    if (patch.staffId !== undefined) {
      update.staffId = patch.staffId;
    }
    if (patch.workId !== undefined) {
      update.workId = patch.workId ?? null;
    }
    if (patch.startAt !== undefined) {
      update.startAt = patch.startAt;
    }
    if (patch.endAt !== undefined) {
      update.endAt = patch.endAt;
    }
    if (patch.note !== undefined) {
      update.note = patch.note ?? null;
    }

    await this.shiftRepo.update({ id }, update);
    // Moved to another member, the shift follows that member's audience.
    if (patch.staffId !== undefined && patch.staffId !== existing.staffId) {
      await this.access.setTags(id, await this.access.tagsOf(patch.staffId));
    }
  }

  async deleteShift(id: ShiftId): Promise<boolean> {
    await this.access.requireWrite(id);
    const deleted = await this.shiftRepo.delete({ id });
    if (deleted) await this.access.dropObject(id);
    return deleted;
  }

  async listShifts(
    params: ShiftListParams,
  ): Promise<PaginatedResult<Shift>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    const items = await this.filterShifts(this.visible("staff_shifts"), params)
      .selectAll("obj")
      .orderBy("obj.startAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    const countResult = await this.filterShifts(
      this.visible("staff_shifts"),
      params,
    )
      .select((eb: any) => eb.fn.countAll().as("count"))
      .executeTakeFirst();
    const totalCount = Number(countResult?.count ?? 0);

    return {
      items: (items as ShiftEntity[]).map((item) => this.toShift(item)),
      totalCount,
    };
  }

  private filterShifts(query: any, params: ShiftListParams) {
    let next = query;
    if (params.staffId) next = next.where("obj.staffId", "=", params.staffId);
    if (params.workId) next = next.where("obj.workId", "=", params.workId);
    if (params.from) next = next.where("obj.startAt", ">=", params.from);
    if (params.to) next = next.where("obj.endAt", "<=", params.to);
    return next;
  }

  async createAbsence(input: AbsenceInput): Promise<AbsenceId> {
    // Leave is recorded on a member and answers to that member's tags, so who
    // may see the person is who may see when they are away.
    await this.access.requireRead(input.staffId);
    const id = generateULID();
    const now = new Date().toISOString();

    const entity: AbsenceEntity = {
      id,
      staffId: input.staffId,
      startAt: input.startAt,
      endAt: input.endAt,
      note: input.note ?? null,
      createdAt: now,
    };

    await this.absenceRepo.create(entity as any);
    await this.access.setTags(id, await this.access.tagsOf(input.staffId));
    return id;
  }

  async deleteAbsence(id: AbsenceId): Promise<boolean> {
    await this.access.requireWrite(id);
    const deleted = await this.absenceRepo.delete({ id });
    if (deleted) await this.access.dropObject(id);
    return deleted;
  }

  async listAbsences(
    params: AbsenceListParams,
  ): Promise<PaginatedResult<Absence>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    const items = await this.filterAbsences(
      this.visible("staff_absences"),
      params,
    )
      .selectAll("obj")
      .orderBy("obj.startAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    const countResult = await this.filterAbsences(
      this.visible("staff_absences"),
      params,
    )
      .select((eb: any) => eb.fn.countAll().as("count"))
      .executeTakeFirst();
    const totalCount = Number(countResult?.count ?? 0);

    return {
      items: (items as AbsenceEntity[]).map((item) => this.toAbsence(item)),
      totalCount,
    };
  }

  private filterAbsences(query: any, params: AbsenceListParams) {
    let next = query;
    if (params.staffId) next = next.where("obj.staffId", "=", params.staffId);
    if (params.from) next = next.where("obj.startAt", ">=", params.from);
    if (params.to) next = next.where("obj.endAt", "<=", params.to);
    return next;
  }

  private toStaff(entity: StaffMemberEntity): StaffMember {
    return {
      id: entity.id,
      userId: entity.userId ?? undefined,
      name: entity.name,
      contact: entity.contact ?? undefined,
      role: entity.role ?? undefined,
      active: entity.active === 1,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private toShift(entity: ShiftEntity): Shift {
    return {
      id: entity.id,
      staffId: entity.staffId,
      workId: entity.workId ?? undefined,
      startAt: entity.startAt,
      endAt: entity.endAt,
      note: entity.note ?? undefined,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private toAbsence(entity: AbsenceEntity): Absence {
    return {
      id: entity.id,
      staffId: entity.staffId,
      startAt: entity.startAt,
      endAt: entity.endAt,
      note: entity.note ?? undefined,
      createdAt: entity.createdAt,
    };
  }
}
