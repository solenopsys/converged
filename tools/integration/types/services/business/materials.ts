export type MaterialId = string;
export type MovementId = string;
export type ISODateString = string;

export type MovementType = "in" | "out" | "reserve" | "release" | "writeoff" | "adjustment";

export type Material = {
  id: MaterialId;
  name: string;
  sku?: string;
  category: string;
  unit: string;
  description?: string;
  stockQuantity: number;
  minStockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type MaterialInput = {
  name: string;
  sku?: string;
  category: string;
  unit: string;
  description?: string;
  minStockQuantity?: number;
};

export type MaterialPatch = {
  name?: string;
  sku?: string;
  category?: string;
  unit?: string;
  description?: string;
  minStockQuantity?: number;
};

export type StockMovement = {
  id: MovementId;
  materialId: MaterialId;
  type: MovementType;
  quantity: number;
  reason?: string;
  orderId?: string;
  equipmentId?: string;
  createdAt: ISODateString;
};

export type StockMovementInput = {
  materialId: MaterialId;
  type: MovementType;
  quantity: number;
  reason?: string;
  orderId?: string;
  equipmentId?: string;
};

export type MaterialListParams = {
  offset: number;
  limit: number;
  category?: string;
  lowStock?: boolean;
  query?: string;
};

export type MovementListParams = {
  offset: number;
  limit: number;
  materialId?: MaterialId;
  type?: MovementType;
  orderId?: string;
  from?: ISODateString;
  to?: ISODateString;
};

export type LowStockAlert = {
  materialId: MaterialId;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
  deficit: number;
};

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
};

export interface MaterialsService {
  createMaterial(input: MaterialInput): Promise<MaterialId>;
  getMaterial(id: MaterialId): Promise<Material | undefined>;
  listMaterials(params: MaterialListParams): Promise<PaginatedResult<Material>>;
  patchMaterial(id: MaterialId, patch: MaterialPatch): Promise<void>;
  deleteMaterial(id: MaterialId): Promise<boolean>;

  addMovement(input: StockMovementInput): Promise<MovementId>;
  listMovements(params: MovementListParams): Promise<PaginatedResult<StockMovement>>;

  getLowStockAlerts(): Promise<LowStockAlert[]>;
}
