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

export interface PaginatedResult {
  items: T[];
  totalCount?: number;
}

export const metadata = {
  "interfaceName": "StaffService",
  "serviceName": "staff",
  "filePath": "../types/staff.ts",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "StaffId",
      "definition": "string"
    },
    {
      "name": "ShiftId",
      "definition": "string"
    },
    {
      "name": "AbsenceId",
      "definition": "string"
    },
    {
      "name": "WorkId",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "definition": "string"
    },
    {
      "name": "StaffMember",
      "definition": "{\n  id: StaffId;\n  userId?: string;\n  name: string;\n  contact?: string;\n  role?: string;\n  active: boolean;\n  createdAt: ISODateString;\n  updatedAt: ISODateString;\n}"
    },
    {
      "name": "StaffInput",
      "definition": "{\n  userId?: string;\n  name: string;\n  contact?: string;\n  role?: string;\n  active?: boolean;\n}"
    },
    {
      "name": "StaffUpdate",
      "definition": "Partial<StaffInput>"
    },
    {
      "name": "Shift",
      "definition": "{\n  id: ShiftId;\n  staffId: StaffId;\n  workId?: WorkId;\n  startAt: ISODateString;\n  endAt: ISODateString;\n  note?: string;\n  createdAt: ISODateString;\n  updatedAt: ISODateString;\n}"
    },
    {
      "name": "ShiftInput",
      "definition": "{\n  staffId: StaffId;\n  workId?: WorkId;\n  startAt: ISODateString;\n  endAt: ISODateString;\n  note?: string;\n}"
    },
    {
      "name": "ShiftUpdate",
      "definition": "Partial<ShiftInput>"
    },
    {
      "name": "Absence",
      "definition": "{\n  id: AbsenceId;\n  staffId: StaffId;\n  startAt: ISODateString;\n  endAt: ISODateString;\n  note?: string;\n  createdAt: ISODateString;\n}"
    },
    {
      "name": "AbsenceInput",
      "definition": "{\n  staffId: StaffId;\n  startAt: ISODateString;\n  endAt: ISODateString;\n  note?: string;\n}"
    },
    {
      "name": "StaffListParams",
      "definition": "{\n  offset: number;\n  limit: number;\n  active?: boolean;\n  query?: string;\n}"
    },
    {
      "name": "ShiftListParams",
      "definition": "{\n  offset: number;\n  limit: number;\n  staffId?: StaffId;\n  workId?: WorkId;\n  from?: ISODateString;\n  to?: ISODateString;\n}"
    },
    {
      "name": "AbsenceListParams",
      "definition": "{\n  offset: number;\n  limit: number;\n  staffId?: StaffId;\n  from?: ISODateString;\n  to?: ISODateString;\n}"
    },
    {
      "name": "PaginatedResult",
      "definition": "",
      "properties": [
        {
          "name": "items",
          "type": "T",
          "optional": false,
          "isArray": true
        },
        {
          "name": "totalCount",
          "type": "number",
          "optional": true,
          "isArray": false
        }
      ]
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface StaffService {
  createStaff(input: StaffInput): Promise<any>;
  getStaff(id: StaffId): Promise<any>;
  updateStaff(id: StaffId, patch: StaffUpdate): Promise<any>;
  deleteStaff(id: StaffId): Promise<any>;
  listStaff(params: StaffListParams): Promise<any>;
  createShift(input: ShiftInput): Promise<any>;
  getShift(id: ShiftId): Promise<any>;
  updateShift(id: ShiftId, patch: ShiftUpdate): Promise<any>;
  deleteShift(id: ShiftId): Promise<any>;
  listShifts(params: ShiftListParams): Promise<any>;
  createAbsence(input: AbsenceInput): Promise<any>;
  deleteAbsence(id: AbsenceId): Promise<any>;
  listAbsences(params: AbsenceListParams): Promise<any>;
}

// Client interface
export interface StaffServiceClient {
  createStaff(input: StaffInput): Promise<any>;
  getStaff(id: StaffId): Promise<any>;
  updateStaff(id: StaffId, patch: StaffUpdate): Promise<any>;
  deleteStaff(id: StaffId): Promise<any>;
  listStaff(params: StaffListParams): Promise<any>;
  createShift(input: ShiftInput): Promise<any>;
  getShift(id: ShiftId): Promise<any>;
  updateShift(id: ShiftId, patch: ShiftUpdate): Promise<any>;
  deleteShift(id: ShiftId): Promise<any>;
  listShifts(params: ShiftListParams): Promise<any>;
  createAbsence(input: AbsenceInput): Promise<any>;
  deleteAbsence(id: AbsenceId): Promise<any>;
  listAbsences(params: AbsenceListParams): Promise<any>;
}

// Factory function
export function createStaffServiceClient(
  config?: { baseUrl?: string },
): StaffServiceClient {
  return createHttpClient<StaffServiceClient>(metadata, config);
}

// Ready-to-use client
export const staffClient = createStaffServiceClient();
