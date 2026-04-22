// Auto-generated package
import { createHttpClient } from "nrpc";

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

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
};

export const metadata = {
  "interfaceName": "StaffService",
  "serviceName": "staff",
  "filePath": "services/business/staff.ts",
  "methods": [
    {
      "name": "createStaff",
      "parameters": [
        {
          "name": "input",
          "type": "StaffInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "StaffId",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getStaff",
      "parameters": [
        {
          "name": "id",
          "type": "StaffId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "StaffMember | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "updateStaff",
      "parameters": [
        {
          "name": "id",
          "type": "StaffId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "patch",
          "type": "StaffUpdate",
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
      "name": "deleteStaff",
      "parameters": [
        {
          "name": "id",
          "type": "StaffId",
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
      "name": "listStaff",
      "parameters": [
        {
          "name": "params",
          "type": "StaffListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<StaffMember>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "createShift",
      "parameters": [
        {
          "name": "input",
          "type": "ShiftInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ShiftId",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getShift",
      "parameters": [
        {
          "name": "id",
          "type": "ShiftId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Shift | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "updateShift",
      "parameters": [
        {
          "name": "id",
          "type": "ShiftId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "patch",
          "type": "ShiftUpdate",
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
      "name": "deleteShift",
      "parameters": [
        {
          "name": "id",
          "type": "ShiftId",
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
      "name": "listShifts",
      "parameters": [
        {
          "name": "params",
          "type": "ShiftListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<Shift>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "createAbsence",
      "parameters": [
        {
          "name": "input",
          "type": "AbsenceInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "AbsenceId",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "deleteAbsence",
      "parameters": [
        {
          "name": "id",
          "type": "AbsenceId",
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
      "name": "listAbsences",
      "parameters": [
        {
          "name": "params",
          "type": "AbsenceListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<Absence>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "StaffId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ShiftId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "AbsenceId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "WorkId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "StaffMember",
      "kind": "type",
      "definition": "{\n  id: StaffId;\n  userId?: string;\n  name: string;\n  contact?: string;\n  role?: string;\n  active: boolean;\n  createdAt: ISODateString;\n  updatedAt: ISODateString;\n}"
    },
    {
      "name": "StaffInput",
      "kind": "type",
      "definition": "{\n  userId?: string;\n  name: string;\n  contact?: string;\n  role?: string;\n  active?: boolean;\n}"
    },
    {
      "name": "StaffUpdate",
      "kind": "type",
      "definition": "Partial<StaffInput>"
    },
    {
      "name": "Shift",
      "kind": "type",
      "definition": "{\n  id: ShiftId;\n  staffId: StaffId;\n  workId?: WorkId;\n  startAt: ISODateString;\n  endAt: ISODateString;\n  note?: string;\n  createdAt: ISODateString;\n  updatedAt: ISODateString;\n}"
    },
    {
      "name": "ShiftInput",
      "kind": "type",
      "definition": "{\n  staffId: StaffId;\n  workId?: WorkId;\n  startAt: ISODateString;\n  endAt: ISODateString;\n  note?: string;\n}"
    },
    {
      "name": "ShiftUpdate",
      "kind": "type",
      "definition": "Partial<ShiftInput>"
    },
    {
      "name": "Absence",
      "kind": "type",
      "definition": "{\n  id: AbsenceId;\n  staffId: StaffId;\n  startAt: ISODateString;\n  endAt: ISODateString;\n  note?: string;\n  createdAt: ISODateString;\n}"
    },
    {
      "name": "AbsenceInput",
      "kind": "type",
      "definition": "{\n  staffId: StaffId;\n  startAt: ISODateString;\n  endAt: ISODateString;\n  note?: string;\n}"
    },
    {
      "name": "StaffListParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n  active?: boolean;\n  query?: string;\n}"
    },
    {
      "name": "ShiftListParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n  staffId?: StaffId;\n  workId?: WorkId;\n  from?: ISODateString;\n  to?: ISODateString;\n}"
    },
    {
      "name": "AbsenceListParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n  staffId?: StaffId;\n  from?: ISODateString;\n  to?: ISODateString;\n}"
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
export interface StaffService {
  createStaff(input: StaffInput): Promise<StaffId>;
  getStaff(id: StaffId): Promise<StaffMember | any>;
  updateStaff(id: StaffId, patch: StaffUpdate): Promise<void>;
  deleteStaff(id: StaffId): Promise<boolean>;
  listStaff(params: StaffListParams): Promise<PaginatedResult<StaffMember>>;
  createShift(input: ShiftInput): Promise<ShiftId>;
  getShift(id: ShiftId): Promise<Shift | any>;
  updateShift(id: ShiftId, patch: ShiftUpdate): Promise<void>;
  deleteShift(id: ShiftId): Promise<boolean>;
  listShifts(params: ShiftListParams): Promise<PaginatedResult<Shift>>;
  createAbsence(input: AbsenceInput): Promise<AbsenceId>;
  deleteAbsence(id: AbsenceId): Promise<boolean>;
  listAbsences(params: AbsenceListParams): Promise<PaginatedResult<Absence>>;
}

// Client interface
export interface StaffServiceClient {
  createStaff(input: StaffInput): Promise<StaffId>;
  getStaff(id: StaffId): Promise<StaffMember | any>;
  updateStaff(id: StaffId, patch: StaffUpdate): Promise<void>;
  deleteStaff(id: StaffId): Promise<boolean>;
  listStaff(params: StaffListParams): Promise<PaginatedResult<StaffMember>>;
  createShift(input: ShiftInput): Promise<ShiftId>;
  getShift(id: ShiftId): Promise<Shift | any>;
  updateShift(id: ShiftId, patch: ShiftUpdate): Promise<void>;
  deleteShift(id: ShiftId): Promise<boolean>;
  listShifts(params: ShiftListParams): Promise<PaginatedResult<Shift>>;
  createAbsence(input: AbsenceInput): Promise<AbsenceId>;
  deleteAbsence(id: AbsenceId): Promise<boolean>;
  listAbsences(params: AbsenceListParams): Promise<PaginatedResult<Absence>>;
}

// Factory function
export function createStaffServiceClient(
  config?: { baseUrl?: string },
): StaffServiceClient {
  return createHttpClient<StaffServiceClient>(metadata, config);
}

// Ready-to-use client
export const staffClient = createStaffServiceClient();
