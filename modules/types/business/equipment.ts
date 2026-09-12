export type EquipmentId = string;
export type JobId = string;
export type ISODateString = string;
export type EquipmentLogId = string;
export type ScheduleSlotId = string;

export type EquipmentStatus = "idle" | "running" | "maintenance" | "error" | "offline";
export type EquipmentLogSeverity = "info" | "warning" | "error" | "critical";
export type EquipmentLogType = "status_change" | "maintenance" | "incident" | "note" | "job_start" | "job_end";
export type ScheduleSlotStatus = "planned" | "in_progress" | "completed" | "cancelled";

export type Equipment = {
  id: EquipmentId;
  kind: string;
  name?: string;
  /**
   * The model this machine is, as a node of the shared classifier
   * (`rp-classifier`). It is the machine's link to reference data: build
   * volume, materials, which adapter speaks to it, which parameters it
   * reports. None of that is copied onto the record — an operator types the
   * brand and the model, and everything else is read back from the classifier
   * whenever it is needed, so a corrected catalogue corrects every shop at once.
   */
  classifierNodeId?: string;
  serialNumber?: string;
  location?: string;
  description?: string;
  maintenanceIntervalDays?: number;
  lastMaintenanceAt?: ISODateString;
  status: EquipmentStatus;
  jobId?: JobId;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type EquipmentInput = {
  kind: string;
  name?: string;
  classifierNodeId?: string;
  serialNumber?: string;
  location?: string;
  description?: string;
  maintenanceIntervalDays?: number;
  status?: EquipmentStatus;
  jobId?: JobId;
};

export type EquipmentPatch = {
  name?: string;
  classifierNodeId?: string;
  serialNumber?: string;
  location?: string;
  description?: string;
  maintenanceIntervalDays?: number;
  lastMaintenanceAt?: ISODateString;
};

export type EquipmentStateInput = {
  status: EquipmentStatus;
  jobId?: JobId;
};

export type EquipmentListParams = {
  offset: number;
  limit: number;
  kind?: string;
  classifierNodeId?: string;
  status?: EquipmentStatus;
  jobId?: JobId;
};

export type EquipmentLog = {
  id: EquipmentLogId;
  equipmentId: EquipmentId;
  eventType: EquipmentLogType;
  severity: EquipmentLogSeverity;
  description: string;
  jobId?: JobId;
  createdAt: ISODateString;
};

export type EquipmentLogInput = {
  equipmentId: EquipmentId;
  eventType: EquipmentLogType;
  severity?: EquipmentLogSeverity;
  description: string;
  jobId?: JobId;
};

export type EquipmentLogListParams = {
  offset: number;
  limit: number;
  equipmentId?: EquipmentId;
  eventType?: EquipmentLogType;
  severity?: EquipmentLogSeverity;
  from?: ISODateString;
  to?: ISODateString;
};

export type ScheduleSlot = {
  id: ScheduleSlotId;
  equipmentId: EquipmentId;
  jobId?: JobId;
  orderId?: string;
  startAt: ISODateString;
  endAt: ISODateString;
  status: ScheduleSlotStatus;
  note?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type ScheduleSlotInput = {
  equipmentId: EquipmentId;
  jobId?: JobId;
  orderId?: string;
  startAt: ISODateString;
  endAt: ISODateString;
  note?: string;
};

export type ScheduleSlotPatch = {
  status?: ScheduleSlotStatus;
  jobId?: JobId;
  startAt?: ISODateString;
  endAt?: ISODateString;
  note?: string;
};

export type ScheduleListParams = {
  offset: number;
  limit: number;
  equipmentId?: EquipmentId;
  from?: ISODateString;
  to?: ISODateString;
  status?: ScheduleSlotStatus;
};

export type EquipmentStatusCount = {
  status: EquipmentStatus;
  count: number;
};

export type EquipmentDashboard = {
  total: number;
  statusCounts: EquipmentStatusCount[];
  utilizationPercent: number;
};

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
};

export interface EquipmentService {
  registerEquipment(input: EquipmentInput): Promise<EquipmentId>;
  getEquipment(id: EquipmentId): Promise<Equipment | undefined>;
  listEquipment(params: EquipmentListParams): Promise<PaginatedResult<Equipment>>;
  patchEquipment(id: EquipmentId, patch: EquipmentPatch): Promise<void>;
  deleteEquipment(id: EquipmentId): Promise<boolean>;
  updateState(id: EquipmentId, state: EquipmentStateInput): Promise<void>;

  addLog(input: EquipmentLogInput): Promise<EquipmentLogId>;
  listLogs(params: EquipmentLogListParams): Promise<PaginatedResult<EquipmentLog>>;

  createScheduleSlot(input: ScheduleSlotInput): Promise<ScheduleSlotId>;
  listSchedule(params: ScheduleListParams): Promise<PaginatedResult<ScheduleSlot>>;
  patchScheduleSlot(id: ScheduleSlotId, patch: ScheduleSlotPatch): Promise<void>;

  getEquipmentDashboard(): Promise<EquipmentDashboard>;
}
