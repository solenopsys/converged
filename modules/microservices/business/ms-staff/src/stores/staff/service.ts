import { SqlStore, generateULID } from "back-core";
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

  constructor(private store: SqlStore) {
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
    return id;
  }

  async getStaff(id: StaffId): Promise<StaffMember | undefined> {
    const entity = await this.staffRepo.findById({ id });
    if (!entity) return undefined;
    return this.toStaff(entity);
  }

  async updateStaff(id: StaffId, patch: StaffUpdate): Promise<void> {
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
  }

  async deleteStaff(id: StaffId): Promise<boolean> {
    return this.staffRepo.delete({ id });
  }

  async listStaff(
    params: StaffListParams,
  ): Promise<PaginatedResult<StaffMember>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let query = this.store.db.selectFrom("staff_members").selectAll();

    if (params.active !== undefined) {
      query = query.where("active", "=", params.active ? 1 : 0);
    }

    const textQuery = params.query?.trim();
    if (textQuery) {
      const pattern = `%${textQuery}%`;
      query = query.where((eb) =>
        eb.or([
          eb("name", "like", pattern),
          eb("contact", "like", pattern),
          eb("role", "like", pattern),
        ]),
      );
    }

    const items = await query
      .orderBy("updatedAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    let countQuery = this.store.db
      .selectFrom("staff_members")
      .select(({ fn }) => fn.countAll().as("count"));

    if (params.active !== undefined) {
      countQuery = countQuery.where("active", "=", params.active ? 1 : 0);
    }

    if (textQuery) {
      const pattern = `%${textQuery}%`;
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb("name", "like", pattern),
          eb("contact", "like", pattern),
          eb("role", "like", pattern),
        ]),
      );
    }

    const countResult = await countQuery.executeTakeFirst();
    const totalCount = Number(countResult?.count ?? 0);

    return {
      items: (items as StaffMemberEntity[]).map((item) => this.toStaff(item)),
      totalCount,
    };
  }

  async createShift(input: ShiftInput): Promise<ShiftId> {
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
    return id;
  }

  async getShift(id: ShiftId): Promise<Shift | undefined> {
    const entity = await this.shiftRepo.findById({ id });
    if (!entity) return undefined;
    return this.toShift(entity);
  }

  async updateShift(id: ShiftId, patch: ShiftUpdate): Promise<void> {
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
  }

  async deleteShift(id: ShiftId): Promise<boolean> {
    return this.shiftRepo.delete({ id });
  }

  async listShifts(
    params: ShiftListParams,
  ): Promise<PaginatedResult<Shift>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let query = this.store.db.selectFrom("staff_shifts").selectAll();

    if (params.staffId) {
      query = query.where("staffId", "=", params.staffId);
    }
    if (params.workId) {
      query = query.where("workId", "=", params.workId);
    }
    if (params.from) {
      query = query.where("startAt", ">=", params.from);
    }
    if (params.to) {
      query = query.where("endAt", "<=", params.to);
    }

    const items = await query
      .orderBy("startAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    let countQuery = this.store.db
      .selectFrom("staff_shifts")
      .select(({ fn }) => fn.countAll().as("count"));

    if (params.staffId) {
      countQuery = countQuery.where("staffId", "=", params.staffId);
    }
    if (params.workId) {
      countQuery = countQuery.where("workId", "=", params.workId);
    }
    if (params.from) {
      countQuery = countQuery.where("startAt", ">=", params.from);
    }
    if (params.to) {
      countQuery = countQuery.where("endAt", "<=", params.to);
    }

    const countResult = await countQuery.executeTakeFirst();
    const totalCount = Number(countResult?.count ?? 0);

    return {
      items: (items as ShiftEntity[]).map((item) => this.toShift(item)),
      totalCount,
    };
  }

  async createAbsence(input: AbsenceInput): Promise<AbsenceId> {
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
    return id;
  }

  async deleteAbsence(id: AbsenceId): Promise<boolean> {
    return this.absenceRepo.delete({ id });
  }

  async listAbsences(
    params: AbsenceListParams,
  ): Promise<PaginatedResult<Absence>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let query = this.store.db.selectFrom("staff_absences").selectAll();

    if (params.staffId) {
      query = query.where("staffId", "=", params.staffId);
    }
    if (params.from) {
      query = query.where("startAt", ">=", params.from);
    }
    if (params.to) {
      query = query.where("endAt", "<=", params.to);
    }

    const items = await query
      .orderBy("startAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    let countQuery = this.store.db
      .selectFrom("staff_absences")
      .select(({ fn }) => fn.countAll().as("count"));

    if (params.staffId) {
      countQuery = countQuery.where("staffId", "=", params.staffId);
    }
    if (params.from) {
      countQuery = countQuery.where("startAt", ">=", params.from);
    }
    if (params.to) {
      countQuery = countQuery.where("endAt", "<=", params.to);
    }

    const countResult = await countQuery.executeTakeFirst();
    const totalCount = Number(countResult?.count ?? 0);

    return {
      items: (items as AbsenceEntity[]).map((item) => this.toAbsence(item)),
      totalCount,
    };
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
