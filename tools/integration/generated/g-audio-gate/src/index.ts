// Auto-generated package
import { createHttpClient } from "nrpc";

export type PhoneNumberId = string;

export type ISODateString = string;

export type PhoneNumberKind = "ip-telephony" | "external";

export type IpTelephonyGateway = {
  provider?: string;
  sipUri?: string;
  username?: string;
  realm?: string;
  registrar?: string;
};

export type PhoneNumber = {
  id: PhoneNumberId;
  kind: PhoneNumberKind;
  phone: string;
  label?: string;
  enabled: boolean;
  // Number surfaced publicly (e.g. landing header). At most one stays primary.
  primary?: boolean;
  // Only meaningful for kind === "ip-telephony".
  gateway?: IpTelephonyGateway;
  note?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type PhoneNumberInput = {
  kind: PhoneNumberKind;
  phone: string;
  label?: string;
  enabled?: boolean;
  primary?: boolean;
  gateway?: IpTelephonyGateway;
  note?: string;
};

export type PhoneNumberUpdate = Partial<PhoneNumberInput>;

export type PhoneNumberListParams = {
  offset?: number;
  limit?: number;
  kind?: PhoneNumberKind;
  enabledOnly?: boolean;
};

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
};

export const metadata = {
  "interfaceName": "AudioGateService",
  "serviceName": "audiogate",
  "filePath": "services/communications/audio-gate.ts",
  "methods": [
    {
      "name": "savePhoneNumber",
      "parameters": [
        {
          "name": "input",
          "type": "PhoneNumberInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PhoneNumberId",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "updatePhoneNumber",
      "parameters": [
        {
          "name": "id",
          "type": "PhoneNumberId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "patch",
          "type": "PhoneNumberUpdate",
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
      "name": "getPhoneNumber",
      "parameters": [
        {
          "name": "id",
          "type": "PhoneNumberId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PhoneNumber | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "deletePhoneNumber",
      "parameters": [
        {
          "name": "id",
          "type": "PhoneNumberId",
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
      "name": "listPhoneNumbers",
      "parameters": [
        {
          "name": "params",
          "type": "PhoneNumberListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<PhoneNumber>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getPrimaryPhoneNumber",
      "parameters": [],
      "returnType": "PhoneNumber | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "PhoneNumberId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "PhoneNumberKind",
      "kind": "type",
      "definition": "\"ip-telephony\" | \"external\""
    },
    {
      "name": "IpTelephonyGateway",
      "kind": "type",
      "definition": "{\n  provider?: string;\n  sipUri?: string;\n  username?: string;\n  realm?: string;\n  registrar?: string;\n}"
    },
    {
      "name": "PhoneNumber",
      "kind": "type",
      "definition": "{\n  id: PhoneNumberId;\n  kind: PhoneNumberKind;\n  phone: string;\n  label?: string;\n  enabled: boolean;\n  // Number surfaced publicly (e.g. landing header). At most one stays primary.\n  primary?: boolean;\n  // Only meaningful for kind === \"ip-telephony\".\n  gateway?: IpTelephonyGateway;\n  note?: string;\n  createdAt: ISODateString;\n  updatedAt: ISODateString;\n}"
    },
    {
      "name": "PhoneNumberInput",
      "kind": "type",
      "definition": "{\n  kind: PhoneNumberKind;\n  phone: string;\n  label?: string;\n  enabled?: boolean;\n  primary?: boolean;\n  gateway?: IpTelephonyGateway;\n  note?: string;\n}"
    },
    {
      "name": "PhoneNumberUpdate",
      "kind": "type",
      "definition": "Partial<PhoneNumberInput>"
    },
    {
      "name": "PhoneNumberListParams",
      "kind": "type",
      "definition": "{\n  offset?: number;\n  limit?: number;\n  kind?: PhoneNumberKind;\n  enabledOnly?: boolean;\n}"
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
export interface AudioGateService {
  savePhoneNumber(input: PhoneNumberInput): Promise<PhoneNumberId>;
  updatePhoneNumber(id: PhoneNumberId, patch: PhoneNumberUpdate): Promise<void>;
  getPhoneNumber(id: PhoneNumberId): Promise<PhoneNumber | any>;
  deletePhoneNumber(id: PhoneNumberId): Promise<boolean>;
  listPhoneNumbers(params: PhoneNumberListParams): Promise<PaginatedResult<PhoneNumber>>;
  getPrimaryPhoneNumber(): Promise<PhoneNumber | any>;
}

// Client interface
export interface AudioGateServiceClient {
  savePhoneNumber(input: PhoneNumberInput): Promise<PhoneNumberId>;
  updatePhoneNumber(id: PhoneNumberId, patch: PhoneNumberUpdate): Promise<void>;
  getPhoneNumber(id: PhoneNumberId): Promise<PhoneNumber | any>;
  deletePhoneNumber(id: PhoneNumberId): Promise<boolean>;
  listPhoneNumbers(params: PhoneNumberListParams): Promise<PaginatedResult<PhoneNumber>>;
  getPrimaryPhoneNumber(): Promise<PhoneNumber | any>;
}

// Factory function
export function createAudioGateServiceClient(
  config?: { baseUrl?: string },
): AudioGateServiceClient {
  return createHttpClient<AudioGateServiceClient>(metadata, config);
}

// Ready-to-use client
export const audiogateClient = createAudioGateServiceClient();
