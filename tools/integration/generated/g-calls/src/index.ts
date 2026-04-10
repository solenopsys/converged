// Auto-generated package
import { createHttpClient } from "nrpc";

export type CallId = string;

export type CallRecordId = string;

export type CallDialogueItem = {
  text: string;
  timestamp: number;
  who: string;
};

export type Call = {
  id: CallId;
  startedAt: number;
  phone: string;
  threadId?: string;
  recordId: CallRecordId;
};

export type CallRecordingInput = {
  startedAt?: number;
  phone: string;
  data: Uint8Array;
};

export type CallRecordingResult = {
  callId: CallId;
  recordId: CallRecordId;
};

export type CallDialogueInput = {
  callId: CallId;
  threadId?: string;
  dialogue: CallDialogueItem[];
};

export type CallsListParams = {
  offset: number;
  limit: number;
  phone?: string;
  fromTime?: number;
  toTime?: number;
};

export type PaginatedResult = {
  items: T[];
  totalCount?: number;
};

export const metadata = {
  "interfaceName": "CallsService",
  "serviceName": "calls",
  "filePath": "../types/calls.ts",
  "methods": [
    {
      "name": "saveRecording",
      "parameters": [
        {
          "name": "input",
          "type": "CallRecordingInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "CallRecordingResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "saveDialogue",
      "parameters": [
        {
          "name": "input",
          "type": "CallDialogueInput",
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
      "name": "getCall",
      "parameters": [
        {
          "name": "id",
          "type": "CallId",
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
      "name": "listCalls",
      "parameters": [
        {
          "name": "params",
          "type": "CallsListParams",
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
      "name": "getRecording",
      "parameters": [
        {
          "name": "recordId",
          "type": "CallRecordId",
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
      "name": "CallId",
      "definition": "string"
    },
    {
      "name": "CallRecordId",
      "definition": "string"
    },
    {
      "name": "CallDialogueItem",
      "definition": "{\n  text: string;\n  timestamp: number;\n  who: string;\n}"
    },
    {
      "name": "Call",
      "definition": "{\n  id: CallId;\n  startedAt: number;\n  phone: string;\n  threadId?: string;\n  recordId: CallRecordId;\n}"
    },
    {
      "name": "CallRecordingInput",
      "definition": "{\n  startedAt?: number;\n  phone: string;\n  data: Uint8Array;\n}"
    },
    {
      "name": "CallRecordingResult",
      "definition": "{\n  callId: CallId;\n  recordId: CallRecordId;\n}"
    },
    {
      "name": "CallDialogueInput",
      "definition": "{\n  callId: CallId;\n  threadId?: string;\n  dialogue: CallDialogueItem[];\n}"
    },
    {
      "name": "CallsListParams",
      "definition": "{\n  offset: number;\n  limit: number;\n  phone?: string;\n  fromTime?: number;\n  toTime?: number;\n}"
    },
    {
      "name": "PaginatedResult",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface CallsService {
  saveRecording(input: CallRecordingInput): Promise<CallRecordingResult>;
  saveDialogue(input: CallDialogueInput): Promise<void>;
  getCall(id: CallId): Promise<any>;
  listCalls(params: CallsListParams): Promise<PaginatedResult>;
  getRecording(recordId: CallRecordId): Promise<any>;
}

// Client interface
export interface CallsServiceClient {
  saveRecording(input: CallRecordingInput): Promise<CallRecordingResult>;
  saveDialogue(input: CallDialogueInput): Promise<void>;
  getCall(id: CallId): Promise<any>;
  listCalls(params: CallsListParams): Promise<PaginatedResult>;
  getRecording(recordId: CallRecordId): Promise<any>;
}

// Factory function
export function createCallsServiceClient(
  config?: { baseUrl?: string },
): CallsServiceClient {
  return createHttpClient<CallsServiceClient>(metadata, config);
}

// Ready-to-use client
export const callsClient = createCallsServiceClient();
