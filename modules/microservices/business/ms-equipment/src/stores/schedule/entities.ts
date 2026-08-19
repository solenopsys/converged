import { BaseRepositorySQL, type KeySQL } from "back-core";

export interface ScheduleSlotKey extends KeySQL {
  id: string;
}

export interface ScheduleSlotEntity {
  id: string;
  equipmentId: string;
  jobId?: string | null;
  orderId?: string | null;
  startAt: string;
  endAt: string;
  status: string;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export class ScheduleSlotRepository extends BaseRepositorySQL<ScheduleSlotKey, ScheduleSlotEntity> {}
