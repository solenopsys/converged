import { StoresController } from "./stores";
import type {
  Equipment,
  EquipmentDashboard,
  EquipmentId,
  EquipmentInput,
  EquipmentListParams,
  EquipmentLog,
  EquipmentLogId,
  EquipmentLogInput,
  EquipmentLogListParams,
  EquipmentPatch,
  EquipmentService,
  EquipmentStateInput,
  PaginatedResult,
  ScheduleListParams,
  ScheduleSlot,
  ScheduleSlotId,
  ScheduleSlotInput,
  ScheduleSlotPatch,
} from "./types";

const MS_ID = "equipment-ms";

export class EquipmentServiceImpl implements EquipmentService {
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

  registerEquipment(input: EquipmentInput): Promise<EquipmentId> {
    return this.stores.equipment.registerEquipment(input);
  }

  getEquipment(id: EquipmentId): Promise<Equipment | undefined> {
    return this.stores.equipment.getEquipment(id);
  }

  listEquipment(params: EquipmentListParams): Promise<PaginatedResult<Equipment>> {
    return this.stores.equipment.listEquipment(params);
  }

  patchEquipment(id: EquipmentId, patch: EquipmentPatch): Promise<void> {
    return this.stores.equipment.patchEquipment(id, patch);
  }

  deleteEquipment(id: EquipmentId): Promise<boolean> {
    return this.stores.equipment.deleteEquipment(id);
  }

  updateState(id: EquipmentId, state: EquipmentStateInput): Promise<void> {
    return this.stores.equipment.updateState(id, state);
  }

  getEquipmentDashboard(): Promise<EquipmentDashboard> {
    return this.stores.equipment.getEquipmentDashboard();
  }

  addLog(input: EquipmentLogInput): Promise<EquipmentLogId> {
    return this.stores.logs.addLog(input);
  }

  listLogs(params: EquipmentLogListParams): Promise<PaginatedResult<EquipmentLog>> {
    return this.stores.logs.listLogs(params);
  }

  createScheduleSlot(input: ScheduleSlotInput): Promise<ScheduleSlotId> {
    return this.stores.schedule.createSlot(input);
  }

  listSchedule(params: ScheduleListParams): Promise<PaginatedResult<ScheduleSlot>> {
    return this.stores.schedule.listSlots(params);
  }

  patchScheduleSlot(id: ScheduleSlotId, patch: ScheduleSlotPatch): Promise<void> {
    return this.stores.schedule.patchSlot(id, patch);
  }
}
