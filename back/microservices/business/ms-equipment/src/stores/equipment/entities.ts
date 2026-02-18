import { BaseRepositorySQL, KeySQL } from "back-core";
import type { ISODateString } from "g-equipment";

export interface EquipmentKey extends KeySQL {
  id: string;
}

export interface EquipmentEntity {
  id: string;
  kind: string;
  name: string;
  status: string;
  jobId?: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export class EquipmentRepository extends BaseRepositorySQL<
  EquipmentKey,
  EquipmentEntity
> {}
