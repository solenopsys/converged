export type EquipmentId = string;
export type JobId = string;
export type ISODateString = string;

export type EquipmentStatus = string;

export type Equipment = {
  id: EquipmentId;
  kind: string;
  name?: string;
  status: EquipmentStatus;
  jobId?: JobId;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type EquipmentInput = {
  kind: string;
  name?: string;
  status?: EquipmentStatus;
  jobId?: JobId;
};

export type EquipmentStateInput = {
  status: EquipmentStatus;
  jobId?: JobId;
};

export type EquipmentListParams = {
  offset: number;
  limit: number;
  kind?: string;
  status?: EquipmentStatus;
  jobId?: JobId;
};

export interface PaginatedResult<T> {
  items: T[];
  totalCount?: number;
}

export interface EquipmentService {
  registerEquipment(input: EquipmentInput): Promise<EquipmentId>;
  getEquipment(id: EquipmentId): Promise<Equipment | undefined>;
  listEquipment(
    params: EquipmentListParams,
  ): Promise<PaginatedResult<Equipment>>;
  updateState(id: EquipmentId, state: EquipmentStateInput): Promise<void>;
}
