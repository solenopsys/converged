// Auto-generated package
import { createHttpClient, type ServiceMetadata } from "nrpc";

export type PhoneNumberId = string;

export type ISODateString = string;

export type PhoneNumberKind = "ip-telephony" | "external";

export type IpTelephonyGateway = {
  provider?: string;
  sipUri?: string;
  username?: string;
  realm?: string;
  registrar?: string;
  // Call context (CallContextName) resonus must load for inbound
  // calls on this number. The context carries the language. No contextId (or no
  // such context) => the gate refuses the call rather than answering blind.
  contextId?: string;
  // Human transfer: inbound calls on this number are bridged to another human
  // over the provider SIP trunk instead of the LLM. Takes precedence over
  // contextId. The gate records both legs and transcribes each channel
  // separately (OpenAI transcription sessions, Opus kept end to end).
  transfer?: IpTelephonyTransfer;
};

export type IpTelephonyTransfer = {
  // Leg B target, e.g. sip:+15551234567@sip.telnyx.com
  sipUri: string;
  // Optional transcription language hint (ISO 639-1); omitted => auto-detect.
  language?: string;
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

export type LlmGateConfigId = string;

export type LlmGateConfig = {
  id: LlmGateConfigId;
  config: Record<string, any>;
};

export type LlmGateConfigInput = {
  id: LlmGateConfigId;
  config: Record<string, any>;
};

export const metadata: ServiceMetadata = {
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
    },
    {
      "name": "saveLlmGateConfig",
      "parameters": [
        {
          "name": "input",
          "type": "LlmGateConfigInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "LlmGateConfigId",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getLlmGateConfig",
      "parameters": [
        {
          "name": "id",
          "type": "LlmGateConfigId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "LlmGateConfig | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listLlmGateConfigs",
      "parameters": [],
      "returnType": "LlmGateConfig",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "deleteLlmGateConfig",
      "parameters": [
        {
          "name": "id",
          "type": "LlmGateConfigId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "boolean",
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
      "definition": "{\n  provider?: string;\n  sipUri?: string;\n  username?: string;\n  realm?: string;\n  registrar?: string;\n  // Call context (CallContextName) resonus must load for inbound\n  // calls on this number. The context carries the language. No contextId (or no\n  // such context) => the gate refuses the call rather than answering blind.\n  contextId?: string;\n  // Human transfer: inbound calls on this number are bridged to another human\n  // over the provider SIP trunk instead of the LLM. Takes precedence over\n  // contextId. The gate records both legs and transcribes each channel\n  // separately (OpenAI transcription sessions, Opus kept end to end).\n  transfer?: IpTelephonyTransfer;\n}"
    },
    {
      "name": "IpTelephonyTransfer",
      "kind": "type",
      "definition": "{\n  // Leg B target, e.g. sip:+15551234567@sip.telnyx.com\n  sipUri: string;\n  // Optional transcription language hint (ISO 639-1); omitted => auto-detect.\n  language?: string;\n}"
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
    },
    {
      "name": "LlmGateConfigId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "LlmGateConfig",
      "kind": "type",
      "definition": "{\n  id: LlmGateConfigId;\n  config: Record<string, any>;\n}"
    },
    {
      "name": "LlmGateConfigInput",
      "kind": "type",
      "definition": "{\n  id: LlmGateConfigId;\n  config: Record<string, any>;\n}"
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
  saveLlmGateConfig(input: LlmGateConfigInput): Promise<LlmGateConfigId>;
  getLlmGateConfig(id: LlmGateConfigId): Promise<LlmGateConfig | any>;
  listLlmGateConfigs(): Promise<LlmGateConfig[]>;
  deleteLlmGateConfig(id: LlmGateConfigId): Promise<boolean>;
}

// Client interface
export interface AudioGateServiceClient {
  savePhoneNumber(input: PhoneNumberInput): Promise<PhoneNumberId>;
  updatePhoneNumber(id: PhoneNumberId, patch: PhoneNumberUpdate): Promise<void>;
  getPhoneNumber(id: PhoneNumberId): Promise<PhoneNumber | any>;
  deletePhoneNumber(id: PhoneNumberId): Promise<boolean>;
  listPhoneNumbers(params: PhoneNumberListParams): Promise<PaginatedResult<PhoneNumber>>;
  getPrimaryPhoneNumber(): Promise<PhoneNumber | any>;
  saveLlmGateConfig(input: LlmGateConfigInput): Promise<LlmGateConfigId>;
  getLlmGateConfig(id: LlmGateConfigId): Promise<LlmGateConfig | any>;
  listLlmGateConfigs(): Promise<LlmGateConfig[]>;
  deleteLlmGateConfig(id: LlmGateConfigId): Promise<boolean>;
}

// Factory function
export function createAudioGateServiceClient(
  config?: { baseUrl?: string },
): AudioGateServiceClient {
  return createHttpClient<AudioGateServiceClient>(metadata, config);
}

// Ready-to-use client
export const audiogateClient = createAudioGateServiceClient();
