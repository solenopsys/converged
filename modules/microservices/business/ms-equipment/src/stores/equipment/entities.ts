import { BaseRepositorySQL, type KeySQL } from "back-core";
import type { ISODateString } from "../../types";

export interface EquipmentKey extends KeySQL {
  id: string;
}

export interface EquipmentEntity {
  id: string;
  kind: string;
  name: string;
  serialNumber?: string | null;
  location?: string | null;
  description?: string | null;
  maintenanceIntervalDays?: number | null;
  lastMaintenanceAt?: string | null;
  status: string;
  jobId?: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export class EquipmentRepository extends BaseRepositorySQL<EquipmentKey, EquipmentEntity> {}
