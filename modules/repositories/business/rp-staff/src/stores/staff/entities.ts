import { BaseRepositorySQL, KeySQL } from "back-core";
import type { ISODateString, WorkId } from "../../types";

export interface StaffMemberKey extends KeySQL {
  id: string;
}

export interface StaffMemberEntity {
  id: string;
  userId?: string | null;
  name: string;
  contact?: string | null;
  role?: string | null;
  active: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export class StaffMemberRepository extends BaseRepositorySQL<
  StaffMemberKey,
  StaffMemberEntity
> {}

export interface ShiftKey extends KeySQL {
  id: string;
}

export interface ShiftEntity {
  id: string;
  staffId: string;
  workId?: WorkId | null;
  startAt: ISODateString;
  endAt: ISODateString;
  note?: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export class ShiftRepository extends BaseRepositorySQL<ShiftKey, ShiftEntity> {}

export interface AbsenceKey extends KeySQL {
  id: string;
}

export interface AbsenceEntity {
  id: string;
  staffId: string;
  startAt: ISODateString;
  endAt: ISODateString;
  note?: string | null;
  createdAt: ISODateString;
}

export class AbsenceRepository extends BaseRepositorySQL<
  AbsenceKey,
  AbsenceEntity
> {}
