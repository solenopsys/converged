// Auto-generated package
import { createHttpClient } from "nrpc";

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

export type PaginatedResult = {
  items: T[];
  totalCount?: number;
};

export const metadata = {
  "interfaceName": "EquipmentService",
  "serviceName": "equipment",
  "filePath": "../types/equipment.ts",
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
      "returnType": "any",
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
      "returnType": "PaginatedResult",
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
    }
  ],
  "types": [
    {
      "name": "EquipmentId",
      "definition": "string"
    },
    {
      "name": "JobId",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "definition": "string"
    },
    {
      "name": "EquipmentStatus",
      "definition": "string"
    },
    {
      "name": "Equipment",
      "definition": "{\n  id: EquipmentId;\n  kind: string;\n  name?: string;\n  status: EquipmentStatus;\n  jobId?: JobId;\n  createdAt: ISODateString;\n  updatedAt: ISODateString;\n}"
    },
    {
      "name": "EquipmentInput",
      "definition": "{\n  kind: string;\n  name?: string;\n  status?: EquipmentStatus;\n  jobId?: JobId;\n}"
    },
    {
      "name": "EquipmentStateInput",
      "definition": "{\n  status: EquipmentStatus;\n  jobId?: JobId;\n}"
    },
    {
      "name": "EquipmentListParams",
      "definition": "{\n  offset: number;\n  limit: number;\n  kind?: string;\n  status?: EquipmentStatus;\n  jobId?: JobId;\n}"
    },
    {
      "name": "PaginatedResult",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface EquipmentService {
  registerEquipment(input: EquipmentInput): Promise<EquipmentId>;
  getEquipment(id: EquipmentId): Promise<any>;
  listEquipment(params: EquipmentListParams): Promise<PaginatedResult>;
  updateState(id: EquipmentId, state: EquipmentStateInput): Promise<void>;
}

// Client interface
export interface EquipmentServiceClient {
  registerEquipment(input: EquipmentInput): Promise<EquipmentId>;
  getEquipment(id: EquipmentId): Promise<any>;
  listEquipment(params: EquipmentListParams): Promise<PaginatedResult>;
  updateState(id: EquipmentId, state: EquipmentStateInput): Promise<void>;
}

// Factory function
export function createEquipmentServiceClient(
  config?: { baseUrl?: string },
): EquipmentServiceClient {
  return createHttpClient<EquipmentServiceClient>(metadata, config);
}

// Ready-to-use client
export const equipmentClient = createEquipmentServiceClient();
