// Auto-generated package
import { createHttpClient, type ServiceMetadata } from "nrpc";

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
  serialNumber?: string;
  location?: string;
  description?: string;
  maintenanceIntervalDays?: number;
  status?: EquipmentStatus;
  jobId?: JobId;
};

export type EquipmentPatch = {
  name?: string;
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

export const metadata: ServiceMetadata = {
  "interfaceName": "EquipmentService",
  "serviceName": "equipment",
  "filePath": "services/business/equipment.ts",
  "methods": [
    {
      "name": "registerEquipment",
      "parameters": [
        {
          "name": "input",
          "type": "EquipmentInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "EquipmentId",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getEquipment",
      "parameters": [
        {
          "name": "id",
          "type": "EquipmentId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Equipment | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listEquipment",
      "parameters": [
        {
          "name": "params",
          "type": "EquipmentListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<Equipment>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "patchEquipment",
      "parameters": [
        {
          "name": "id",
          "type": "EquipmentId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "patch",
          "type": "EquipmentPatch",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "deleteEquipment",
      "parameters": [
        {
          "name": "id",
          "type": "EquipmentId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "boolean",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "updateState",
      "parameters": [
        {
          "name": "id",
          "type": "EquipmentId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "state",
          "type": "EquipmentStateInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "addLog",
      "parameters": [
        {
          "name": "input",
          "type": "EquipmentLogInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "EquipmentLogId",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listLogs",
      "parameters": [
        {
          "name": "params",
          "type": "EquipmentLogListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<EquipmentLog>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "createScheduleSlot",
      "parameters": [
        {
          "name": "input",
          "type": "ScheduleSlotInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ScheduleSlotId",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listSchedule",
      "parameters": [
        {
          "name": "params",
          "type": "ScheduleListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<ScheduleSlot>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "patchScheduleSlot",
      "parameters": [
        {
          "name": "id",
          "type": "ScheduleSlotId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "patch",
          "type": "ScheduleSlotPatch",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getEquipmentDashboard",
      "parameters": [],
      "returnType": "EquipmentDashboard",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "EquipmentId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "JobId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "EquipmentLogId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ScheduleSlotId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "EquipmentStatus",
      "kind": "type",
      "definition": "\"idle\" | \"running\" | \"maintenance\" | \"error\" | \"offline\""
    },
    {
      "name": "EquipmentLogSeverity",
      "kind": "type",
      "definition": "\"info\" | \"warning\" | \"error\" | \"critical\""
    },
    {
      "name": "EquipmentLogType",
      "kind": "type",
      "definition": "\"status_change\" | \"maintenance\" | \"incident\" | \"note\" | \"job_start\" | \"job_end\""
    },
    {
      "name": "ScheduleSlotStatus",
      "kind": "type",
      "definition": "\"planned\" | \"in_progress\" | \"completed\" | \"cancelled\""
    },
    {
      "name": "Equipment",
      "kind": "type",
      "definition": "{\n  id: EquipmentId;\n  kind: string;\n  name?: string;\n  serialNumber?: string;\n  location?: string;\n  description?: string;\n  maintenanceIntervalDays?: number;\n  lastMaintenanceAt?: ISODateString;\n  status: EquipmentStatus;\n  jobId?: JobId;\n  createdAt: ISODateString;\n  updatedAt: ISODateString;\n}"
    },
    {
      "name": "EquipmentInput",
      "kind": "type",
      "definition": "{\n  kind: string;\n  name?: string;\n  serialNumber?: string;\n  location?: string;\n  description?: string;\n  maintenanceIntervalDays?: number;\n  status?: EquipmentStatus;\n  jobId?: JobId;\n}"
    },
    {
      "name": "EquipmentPatch",
      "kind": "type",
      "definition": "{\n  name?: string;\n  serialNumber?: string;\n  location?: string;\n  description?: string;\n  maintenanceIntervalDays?: number;\n  lastMaintenanceAt?: ISODateString;\n}"
    },
    {
      "name": "EquipmentStateInput",
      "kind": "type",
      "definition": "{\n  status: EquipmentStatus;\n  jobId?: JobId;\n}"
    },
    {
      "name": "EquipmentListParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n  kind?: string;\n  status?: EquipmentStatus;\n  jobId?: JobId;\n}"
    },
    {
      "name": "EquipmentLog",
      "kind": "type",
      "definition": "{\n  id: EquipmentLogId;\n  equipmentId: EquipmentId;\n  eventType: EquipmentLogType;\n  severity: EquipmentLogSeverity;\n  description: string;\n  jobId?: JobId;\n  createdAt: ISODateString;\n}"
    },
    {
      "name": "EquipmentLogInput",
      "kind": "type",
      "definition": "{\n  equipmentId: EquipmentId;\n  eventType: EquipmentLogType;\n  severity?: EquipmentLogSeverity;\n  description: string;\n  jobId?: JobId;\n}"
    },
    {
      "name": "EquipmentLogListParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n  equipmentId?: EquipmentId;\n  eventType?: EquipmentLogType;\n  severity?: EquipmentLogSeverity;\n  from?: ISODateString;\n  to?: ISODateString;\n}"
    },
    {
      "name": "ScheduleSlot",
      "kind": "type",
      "definition": "{\n  id: ScheduleSlotId;\n  equipmentId: EquipmentId;\n  jobId?: JobId;\n  orderId?: string;\n  startAt: ISODateString;\n  endAt: ISODateString;\n  status: ScheduleSlotStatus;\n  note?: string;\n  createdAt: ISODateString;\n  updatedAt: ISODateString;\n}"
    },
    {
      "name": "ScheduleSlotInput",
      "kind": "type",
      "definition": "{\n  equipmentId: EquipmentId;\n  jobId?: JobId;\n  orderId?: string;\n  startAt: ISODateString;\n  endAt: ISODateString;\n  note?: string;\n}"
    },
    {
      "name": "ScheduleSlotPatch",
      "kind": "type",
      "definition": "{\n  status?: ScheduleSlotStatus;\n  jobId?: JobId;\n  startAt?: ISODateString;\n  endAt?: ISODateString;\n  note?: string;\n}"
    },
    {
      "name": "ScheduleListParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n  equipmentId?: EquipmentId;\n  from?: ISODateString;\n  to?: ISODateString;\n  status?: ScheduleSlotStatus;\n}"
    },
    {
      "name": "EquipmentStatusCount",
      "kind": "type",
      "definition": "{\n  status: EquipmentStatus;\n  count: number;\n}"
    },
    {
      "name": "EquipmentDashboard",
      "kind": "type",
      "definition": "{\n  total: number;\n  statusCounts: EquipmentStatusCount[];\n  utilizationPercent: number;\n}"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface EquipmentService {
  registerEquipment(input: EquipmentInput): Promise<EquipmentId>;
  getEquipment(id: EquipmentId): Promise<Equipment | any>;
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

// Client interface
export interface EquipmentServiceClient {
  registerEquipment(input: EquipmentInput): Promise<EquipmentId>;
  getEquipment(id: EquipmentId): Promise<Equipment | any>;
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

// Factory function
export function createEquipmentServiceClient(
  config?: { baseUrl?: string },
): EquipmentServiceClient {
  return createHttpClient<EquipmentServiceClient>(metadata, config);
}

// Ready-to-use client
export const equipmentClient = createEquipmentServiceClient();
