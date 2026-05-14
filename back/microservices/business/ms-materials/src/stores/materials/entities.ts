import { BaseRepositorySQL, type KeySQL } from "back-core";

export interface MaterialKey extends KeySQL {
  id: string;
}

export interface MaterialEntity {
  id: string;
  name: string;
  sku?: string | null;
  category: string;
  unit: string;
  description?: string | null;
  stockQuantity: number;
  minStockQuantity: number;
  reservedQuantity: number;
  createdAt: string;
  updatedAt: string;
}

export class MaterialRepository extends BaseRepositorySQL<MaterialKey, MaterialEntity> {}

export interface MovementKey extends KeySQL {
  id: string;
}

export interface MovementEntity {
  id: string;
  materialId: string;
  type: string;
  quantity: number;
  reason?: string | null;
  orderId?: string | null;
  equipmentId?: string | null;
  createdAt: string;
}

export class MovementRepository extends BaseRepositorySQL<MovementKey, MovementEntity> {}
