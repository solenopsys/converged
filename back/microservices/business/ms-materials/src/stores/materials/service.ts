import { generateULID, type SqlStore } from "back-core";
import { MaterialRepository, MovementRepository } from "./entities";
import type {
  Material,
  MaterialId,
  MaterialInput,
  MaterialPatch,
  MaterialListParams,
  MovementId,
  MovementType,
  StockMovement,
  StockMovementInput,
  MovementListParams,
  LowStockAlert,
  PaginatedResult,
} from "../../types";
import type { MaterialEntity, MovementEntity } from "./entities";

export class MaterialsStoreService {
  private readonly materials: MaterialRepository;
  private readonly movements: MovementRepository;

  constructor(private store: SqlStore) {
    this.materials = new MaterialRepository(store, "materials", {
      primaryKey: "id",
      extractKey: (e) => ({ id: e.id }),
      buildWhereCondition: (k) => ({ id: k.id }),
    });
    this.movements = new MovementRepository(store, "stock_movements", {
      primaryKey: "id",
      extractKey: (e) => ({ id: e.id }),
      buildWhereCondition: (k) => ({ id: k.id }),
    });
  }

  async createMaterial(input: MaterialInput): Promise<MaterialId> {
    const id = generateULID();
    const now = new Date().toISOString();
    const entity: MaterialEntity = {
      id,
      name: input.name,
      sku: input.sku ?? null,
      category: input.category,
      unit: input.unit,
      description: input.description ?? null,
      stockQuantity: 0,
      minStockQuantity: input.minStockQuantity ?? 0,
      reservedQuantity: 0,
      createdAt: now,
      updatedAt: now,
    };
    await this.materials.create(entity as any);
    return id;
  }

  async getMaterial(id: MaterialId): Promise<Material | undefined> {
    const entity = await this.materials.findById({ id });
    return entity ? this.toMaterial(entity) : undefined;
  }

  async listMaterials(params: MaterialListParams): Promise<PaginatedResult<Material>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let query = this.store.db.selectFrom("materials").selectAll();
    if (params.category) query = query.where("category", "=", params.category);
    if (params.query) query = query.where("name", "like", `%${params.query}%`);
    if (params.lowStock) {
      query = query.where(
        this.store.db.dynamic.ref("stockQuantity"),
        "<",
        this.store.db.dynamic.ref("minStockQuantity"),
      );
    }

    const items = await query.orderBy("name", "asc").limit(limit).offset(offset).execute();

    let countQuery = this.store.db
      .selectFrom("materials")
      .select(({ fn }) => fn.countAll().as("count"));
    if (params.category) countQuery = countQuery.where("category", "=", params.category);
    const countResult = await countQuery.executeTakeFirst();

    return {
      items: (items as MaterialEntity[]).map((e) => this.toMaterial(e)),
      totalCount: Number(countResult?.count ?? 0),
    };
  }

  async patchMaterial(id: MaterialId, patch: MaterialPatch): Promise<void> {
    const existing = await this.materials.findById({ id });
    if (!existing) throw new Error(`Material not found: ${id}`);

    const next: Partial<MaterialEntity> = { updatedAt: new Date().toISOString() };
    if (patch.name !== undefined) next.name = patch.name;
    if (patch.sku !== undefined) next.sku = patch.sku ?? null;
    if (patch.category !== undefined) next.category = patch.category;
    if (patch.unit !== undefined) next.unit = patch.unit;
    if (patch.description !== undefined) next.description = patch.description ?? null;
    if (patch.minStockQuantity !== undefined) next.minStockQuantity = patch.minStockQuantity;

    await this.materials.update({ id }, next as any);
  }

  async deleteMaterial(id: MaterialId): Promise<boolean> {
    const existing = await this.materials.findById({ id });
    if (!existing) return false;
    await this.materials.delete({ id });
    return true;
  }

  async addMovement(input: StockMovementInput): Promise<MovementId> {
    const existing = await this.materials.findById({ id: input.materialId });
    if (!existing) throw new Error(`Material not found: ${input.materialId}`);

    const id = generateULID();
    const entity: MovementEntity = {
      id,
      materialId: input.materialId,
      type: input.type,
      quantity: input.quantity,
      reason: input.reason ?? null,
      orderId: input.orderId ?? null,
      equipmentId: input.equipmentId ?? null,
      createdAt: new Date().toISOString(),
    };
    await this.movements.create(entity as any);

    // Обновляем остатки в зависимости от типа движения
    const delta = this.stockDelta(input.type, input.quantity);
    const reservedDelta = this.reservedDelta(input.type, input.quantity);

    await this.materials.update({ id: input.materialId }, {
      stockQuantity: Math.max(0, existing.stockQuantity + delta),
      reservedQuantity: Math.max(0, existing.reservedQuantity + reservedDelta),
      updatedAt: new Date().toISOString(),
    } as any);

    return id;
  }

  async listMovements(params: MovementListParams): Promise<PaginatedResult<StockMovement>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let query = this.store.db.selectFrom("stock_movements").selectAll();
    if (params.materialId) query = query.where("materialId", "=", params.materialId);
    if (params.type) query = query.where("type", "=", params.type);
    if (params.orderId) query = query.where("orderId", "=", params.orderId);
    if (params.from) query = query.where("createdAt", ">=", params.from);
    if (params.to) query = query.where("createdAt", "<=", params.to);

    const items = await query.orderBy("createdAt", "desc").limit(limit).offset(offset).execute();

    let countQuery = this.store.db
      .selectFrom("stock_movements")
      .select(({ fn }) => fn.countAll().as("count"));
    if (params.materialId) countQuery = countQuery.where("materialId", "=", params.materialId);
    const countResult = await countQuery.executeTakeFirst();

    return {
      items: (items as MovementEntity[]).map(this.toMovement),
      totalCount: Number(countResult?.count ?? 0),
    };
  }

  async getLowStockAlerts(): Promise<LowStockAlert[]> {
    const all = (await this.store.db
      .selectFrom("materials")
      .selectAll()
      .execute()) as MaterialEntity[];

    return all
      .filter((e) => e.stockQuantity < e.minStockQuantity)
      .map((e) => ({
        materialId: e.id,
        name: e.name,
        unit: e.unit,
        currentStock: e.stockQuantity,
        minStock: e.minStockQuantity,
        deficit: e.minStockQuantity - e.stockQuantity,
      }));
  }

  private stockDelta(type: MovementType, qty: number): number {
    if (type === "in" || type === "release") return qty;
    if (type === "out" || type === "writeoff") return -qty;
    if (type === "adjustment") return qty; // qty может быть отрицательным
    return 0; // reserve не меняет stock, только reserved
  }

  private reservedDelta(type: MovementType, qty: number): number {
    if (type === "reserve") return qty;
    if (type === "release" || type === "out") return -qty;
    return 0;
  }

  private toMaterial(entity: MaterialEntity): Material {
    return {
      id: entity.id,
      name: entity.name,
      sku: entity.sku ?? undefined,
      category: entity.category,
      unit: entity.unit,
      description: entity.description ?? undefined,
      stockQuantity: entity.stockQuantity,
      minStockQuantity: entity.minStockQuantity,
      reservedQuantity: entity.reservedQuantity,
      availableQuantity: Math.max(0, entity.stockQuantity - entity.reservedQuantity),
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private toMovement(entity: MovementEntity): StockMovement {
    return {
      id: entity.id,
      materialId: entity.materialId,
      type: entity.type as MovementType,
      quantity: entity.quantity,
      reason: entity.reason ?? undefined,
      orderId: entity.orderId ?? undefined,
      equipmentId: entity.equipmentId ?? undefined,
      createdAt: entity.createdAt,
    };
  }
}
