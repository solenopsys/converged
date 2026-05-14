import { StoresController } from "./stores";
import type {
  Material,
  MaterialId,
  MaterialInput,
  MaterialPatch,
  MaterialListParams,
  MaterialsService,
  MovementId,
  StockMovement,
  StockMovementInput,
  MovementListParams,
  LowStockAlert,
  PaginatedResult,
} from "./types";

const MS_ID = "materials-ms";

export class MaterialsServiceImpl implements MaterialsService {
  stores: StoresController;
  private initPromise?: Promise<void>;

  constructor() {
    this.init();
  }

  async init() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      this.stores = new StoresController(MS_ID);
      await this.stores.init();
    })();
    return this.initPromise;
  }

  createMaterial(input: MaterialInput): Promise<MaterialId> {
    return this.stores.materials.createMaterial(input);
  }

  getMaterial(id: MaterialId): Promise<Material | undefined> {
    return this.stores.materials.getMaterial(id);
  }

  listMaterials(params: MaterialListParams): Promise<PaginatedResult<Material>> {
    return this.stores.materials.listMaterials(params);
  }

  patchMaterial(id: MaterialId, patch: MaterialPatch): Promise<void> {
    return this.stores.materials.patchMaterial(id, patch);
  }

  deleteMaterial(id: MaterialId): Promise<boolean> {
    return this.stores.materials.deleteMaterial(id);
  }

  addMovement(input: StockMovementInput): Promise<MovementId> {
    return this.stores.materials.addMovement(input);
  }

  listMovements(params: MovementListParams): Promise<PaginatedResult<StockMovement>> {
    return this.stores.materials.listMovements(params);
  }

  getLowStockAlerts(): Promise<LowStockAlert[]> {
    return this.stores.materials.getLowStockAlerts();
  }
}
