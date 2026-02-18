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

  constructor() {
    this.init();
  }

  async init() {
    this.stores = new StoresController(MS_ID);
    await this.stores.init();
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
