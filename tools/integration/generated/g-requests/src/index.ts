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

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
};

export const metadata = {
  "interfaceName": "RequestsService",
  "serviceName": "requests",
  "filePath": "services/business/requests.ts",
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
      "returnType": "RequestId",
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
      "returnType": "Request | any",
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
      "returnType": "PaginatedResult<Request>",
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
      "returnType": "void",
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
      "returnType": "RequestProcessingEntry",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "RequestId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "RequestStatus",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "RequestFields",
      "kind": "type",
      "definition": "Record<string, string | number | boolean | null>"
    },
    {
      "name": "RequestFiles",
      "kind": "type",
      "definition": "Record<string, string>"
    },
    {
      "name": "Request",
      "kind": "type",
      "definition": "{\n  id: RequestId;\n  source?: string;\n  status: RequestStatus;\n  fields: RequestFields;\n  files: RequestFiles;\n  createdAt: ISODateString;\n}"
    },
    {
      "name": "RequestInput",
      "kind": "type",
      "definition": "{\n  source?: string;\n  status?: RequestStatus;\n  fields: RequestFields;\n  files?: RequestFiles;\n}"
    },
    {
      "name": "RequestListParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n  source?: string;\n}"
    },
    {
      "name": "RequestProcessingEntry",
      "kind": "type",
      "definition": "{\n  id: string;\n  requestId: RequestId;\n  status: RequestStatus;\n  actor: string;\n  comment: string;\n  createdAt: ISODateString;\n}"
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
export interface RequestsService {
  createRequest(input: RequestInput): Promise<RequestId>;
  getRequest(id: RequestId): Promise<Request | any>;
  listRequests(params: RequestListParams): Promise<PaginatedResult<Request>>;
  updateStatus(id: RequestId, status: RequestStatus, actor: string, comment?: string): Promise<void>;
  listProcessing(requestId: RequestId): Promise<RequestProcessingEntry[]>;
}

// Client interface
export interface RequestsServiceClient {
  createRequest(input: RequestInput): Promise<RequestId>;
  getRequest(id: RequestId): Promise<Request | any>;
  listRequests(params: RequestListParams): Promise<PaginatedResult<Request>>;
  updateStatus(id: RequestId, status: RequestStatus, actor: string, comment?: string): Promise<void>;
  listProcessing(requestId: RequestId): Promise<RequestProcessingEntry[]>;
}

// Factory function
export function createRequestsServiceClient(
  config?: { baseUrl?: string },
): RequestsServiceClient {
  return createHttpClient<RequestsServiceClient>(metadata, config);
}

// Ready-to-use client
export const requestsClient = createRequestsServiceClient();
