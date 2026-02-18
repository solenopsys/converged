import type {
  StaffService,
  StaffMember,
  StaffInput,
  StaffUpdate,
  StaffId,
  Shift,
  ShiftInput,
  ShiftUpdate,
  ShiftId,
  Absence,
  AbsenceInput,
  AbsenceId,
  StaffListParams,
  ShiftListParams,
  AbsenceListParams,
  PaginatedResult,
} from "./types";
import { StoresController } from "./stores";

const MS_ID = "staff-ms";

export class StaffServiceImpl implements StaffService {
  stores: StoresController;

  constructor() {
    this.init();
  }

  async init() {
    this.stores = new StoresController(MS_ID);
    await this.stores.init();
  }

  createStaff(input: StaffInput): Promise<StaffId> {
    return this.stores.staff.createStaff(input);
  }

  getStaff(id: StaffId): Promise<StaffMember | undefined> {
    return this.stores.staff.getStaff(id);
  }

  updateStaff(id: StaffId, patch: StaffUpdate): Promise<void> {
    return this.stores.staff.updateStaff(id, patch);
  }

  deleteStaff(id: StaffId): Promise<boolean> {
    return this.stores.staff.deleteStaff(id);
  }

  listStaff(params: StaffListParams): Promise<PaginatedResult<StaffMember>> {
    return this.stores.staff.listStaff(params);
  }

  createShift(input: ShiftInput): Promise<ShiftId> {
    return this.stores.staff.createShift(input);
  }

  getShift(id: ShiftId): Promise<Shift | undefined> {
    return this.stores.staff.getShift(id);
  }

  updateShift(id: ShiftId, patch: ShiftUpdate): Promise<void> {
    return this.stores.staff.updateShift(id, patch);
  }

  deleteShift(id: ShiftId): Promise<boolean> {
    return this.stores.staff.deleteShift(id);
  }

  listShifts(params: ShiftListParams): Promise<PaginatedResult<Shift>> {
    return this.stores.staff.listShifts(params);
  }

  createAbsence(input: AbsenceInput): Promise<AbsenceId> {
    return this.stores.staff.createAbsence(input);
  }

  deleteAbsence(id: AbsenceId): Promise<boolean> {
    return this.stores.staff.deleteAbsence(id);
  }

  listAbsences(
    params: AbsenceListParams,
  ): Promise<PaginatedResult<Absence>> {
    return this.stores.staff.listAbsences(params);
  }
}
