// Auto-generated package
import { createHttpClient } from "nrpc";

export type RequestId = string;

export type ISODateString = string;

export type RequestStatus = string;

export type RequestFields = Record<string, string | number | boolean | null>;

export type RequestFiles = Record<string, string>;

export type Request = {
  id: RequestId;
  source?: string;
  status: RequestStatus;
  fields: RequestFields;
  files: RequestFiles;
  createdAt: ISODateString;
};

export type RequestInput = {
  source?: string;
  status?: RequestStatus;
  fields: RequestFields;
  files?: RequestFiles;
};

export type RequestListParams = {
  offset: number;
  limit: number;
  source?: string;
};

export type RequestProcessingEntry = {
  id: string;
  requestId: RequestId;
  status: RequestStatus;
  actor: string;
  comment: string;
  createdAt: ISODateString;
};

export interface PaginatedResult {
  items: T[];
  totalCount?: number;
}

export const metadata = {
  "interfaceName": "RequestsService",
  "serviceName": "requests",
  "filePath": "../types/requests.ts",
  "methods": [
    {
      "name": "createRequest",
      "parameters": [
        {
          "name": "input",
          "type": "RequestInput",
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
      "name": "getRequest",
      "parameters": [
        {
          "name": "id",
          "type": "RequestId",
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
      "name": "listRequests",
      "parameters": [
        {
          "name": "params",
          "type": "RequestListParams",
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
      "name": "updateStatus",
      "parameters": [
        {
          "name": "id",
          "type": "RequestId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "status",
          "type": "RequestStatus",
          "optional": false,
          "isArray": false
        },
        {
          "name": "actor",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "comment",
          "type": "string",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listProcessing",
      "parameters": [
        {
          "name": "requestId",
          "type": "RequestId",
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
      "name": "RequestId",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "definition": "string"
    },
    {
      "name": "RequestStatus",
      "definition": "string"
    },
    {
      "name": "RequestFields",
      "definition": "Record<string, string | number | boolean | null>"
    },
    {
      "name": "RequestFiles",
      "definition": "Record<string, string>"
    },
    {
      "name": "Request",
      "definition": "{\n  id: RequestId;\n  source?: string;\n  status: RequestStatus;\n  fields: RequestFields;\n  files: RequestFiles;\n  createdAt: ISODateString;\n}"
    },
    {
      "name": "RequestInput",
      "definition": "{\n  source?: string;\n  status?: RequestStatus;\n  fields: RequestFields;\n  files?: RequestFiles;\n}"
    },
    {
      "name": "RequestListParams",
      "definition": "{\n  offset: number;\n  limit: number;\n  source?: string;\n}"
    },
    {
      "name": "RequestProcessingEntry",
      "definition": "{\n  id: string;\n  requestId: RequestId;\n  status: RequestStatus;\n  actor: string;\n  comment: string;\n  createdAt: ISODateString;\n}"
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
export interface RequestsService {
  createRequest(input: RequestInput): Promise<any>;
  getRequest(id: RequestId): Promise<any>;
  listRequests(params: RequestListParams): Promise<any>;
  updateStatus(id: RequestId, status: RequestStatus, actor: string, comment?: string): Promise<any>;
  listProcessing(requestId: RequestId): Promise<any>;
}

// Client interface
export interface RequestsServiceClient {
  createRequest(input: RequestInput): Promise<any>;
  getRequest(id: RequestId): Promise<any>;
  listRequests(params: RequestListParams): Promise<any>;
  updateStatus(id: RequestId, status: RequestStatus, actor: string, comment?: string): Promise<any>;
  listProcessing(requestId: RequestId): Promise<any>;
}

// Factory function
export function createRequestsServiceClient(
  config?: { baseUrl?: string },
): RequestsServiceClient {
  return createHttpClient<RequestsServiceClient>(metadata, config);
}

// Ready-to-use client
export const requestsClient = createRequestsServiceClient();
