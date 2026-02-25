import type {
  EquipmentService,
  Equipment,
  EquipmentInput,
  EquipmentId,
  EquipmentListParams,
  EquipmentStateInput,
  PaginatedResult,
} from "./types";
import { StoresController } from "./stores";

const MS_ID = "equipment-ms";

export class EquipmentServiceImpl implements EquipmentService {
  stores: StoresController;
  private initPromise?: Promise<void>;

  constructor() {
    this.init();
  }

  async init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      this.stores = new StoresController(MS_ID);
      await this.stores.init();
    })();

    return this.initPromise;
  }

  registerEquipment(input: EquipmentInput): Promise<EquipmentId> {
    return this.stores.equipment.registerEquipment(input);
  }

  getEquipment(id: EquipmentId): Promise<Equipment | undefined> {
    return this.stores.equipment.getEquipment(id);
  }

  listEquipment(
    params: EquipmentListParams,
  ): Promise<PaginatedResult<Equipment>> {
    return this.stores.equipment.listEquipment(params);
  }

  updateState(id: EquipmentId, state: EquipmentStateInput): Promise<void> {
    return this.stores.equipment.updateState(id, state);
  }
}
