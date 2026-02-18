export type StaffId = string;
export type ShiftId = string;
export type AbsenceId = string;
export type WorkId = string;
export type ISODateString = string;

export type StaffMember = {
  id: StaffId;
  userId?: string;
  name: string;
  contact?: string;
  role?: string;
  active: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type StaffInput = {
  userId?: string;
  name: string;
  contact?: string;
  role?: string;
  active?: boolean;
};

export type StaffUpdate = Partial<StaffInput>;

export type Shift = {
  id: ShiftId;
  staffId: StaffId;
  workId?: WorkId;
  startAt: ISODateString;
  endAt: ISODateString;
  note?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type ShiftInput = {
  staffId: StaffId;
  workId?: WorkId;
  startAt: ISODateString;
  endAt: ISODateString;
  note?: string;
};

export type ShiftUpdate = Partial<ShiftInput>;

export type Absence = {
  id: AbsenceId;
  staffId: StaffId;
  startAt: ISODateString;
  endAt: ISODateString;
  note?: string;
  createdAt: ISODateString;
};

export type AbsenceInput = {
  staffId: StaffId;
  startAt: ISODateString;
  endAt: ISODateString;
  note?: string;
};

export type StaffListParams = {
  offset: number;
  limit: number;
  active?: boolean;
  query?: string;
};

export type ShiftListParams = {
  offset: number;
  limit: number;
  staffId?: StaffId;
  workId?: WorkId;
  from?: ISODateString;
  to?: ISODateString;
};

export type AbsenceListParams = {
  offset: number;
  limit: number;
  staffId?: StaffId;
  from?: ISODateString;
  to?: ISODateString;
};

export interface PaginatedResult<T> {
  items: T[];
  totalCount?: number;
}

export interface StaffService {
  createStaff(input: StaffInput): Promise<StaffId>;
  getStaff(id: StaffId): Promise<StaffMember | undefined>;
  updateStaff(id: StaffId, patch: StaffUpdate): Promise<void>;
  deleteStaff(id: StaffId): Promise<boolean>;
  listStaff(params: StaffListParams): Promise<PaginatedResult<StaffMember>>;

  createShift(input: ShiftInput): Promise<ShiftId>;
  getShift(id: ShiftId): Promise<Shift | undefined>;
  updateShift(id: ShiftId, patch: ShiftUpdate): Promise<void>;
  deleteShift(id: ShiftId): Promise<boolean>;
  listShifts(params: ShiftListParams): Promise<PaginatedResult<Shift>>;

  createAbsence(input: AbsenceInput): Promise<AbsenceId>;
  deleteAbsence(id: AbsenceId): Promise<boolean>;
  listAbsences(params: AbsenceListParams): Promise<PaginatedResult<Absence>>;
}
