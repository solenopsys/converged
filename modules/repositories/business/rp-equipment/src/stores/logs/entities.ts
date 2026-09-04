import { BaseRepositorySQL, type KeySQL } from "back-core";

export interface EquipmentLogKey extends KeySQL {
  id: string;
}

export interface EquipmentLogEntity {
  id: string;
  equipmentId: string;
  eventType: string;
  severity: string;
  description: string;
  jobId?: string | null;
  createdAt: string;
}

export class EquipmentLogRepository extends BaseRepositorySQL<EquipmentLogKey, EquipmentLogEntity> {}
