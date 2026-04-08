// Auto-generated package
import { createHttpClient } from "nrpc";

export type GaleryId = string;

export type GaleryImageId = string;

export type ISODateString = string;

export type Galery = {
  id: GaleryId;
  name: string;
  description?: string;
  createdAt: ISODateString;
};

export type GaleryInput = {
  name: string;
  description?: string;
};

export type GaleryImage = {
  id: GaleryImageId;
  galeryId: GaleryId;
  title?: string;
  description?: string;
  originalName?: string;
  mimeType?: string;
  filePath: string;
  thumbPath: string;
  createdAt: ISODateString;
};

export type GaleryImageInput = {
  galeryId: GaleryId;
  data: Uint8Array;
  mimeType?: string;
  originalName?: string;
  title?: string;
  description?: string;
};

export type PaginationParams = {
  offset: number;
  limit: number;
};

export type PaginatedResult = {
  items: T[];
  totalCount?: number;
};

export const metadata = {
  "interfaceName": "GaleryService",
  "serviceName": "galery",
  "filePath": "../types/galery.ts",
  "methods": [
    {
      "name": "createGalery",
      "parameters": [
        {
          "name": "input",
          "type": "GaleryInput",
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
      "name": "getGalery",
      "parameters": [
        {
          "name": "id",
          "type": "GaleryId",
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
      "name": "listGaleries",
      "parameters": [
        {
          "name": "params",
          "type": "PaginationParams",
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
      "name": "deleteGalery",
      "parameters": [
        {
          "name": "id",
          "type": "GaleryId",
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
      "name": "saveImage",
      "parameters": [
        {
          "name": "input",
          "type": "GaleryImageInput",
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
      "name": "getImage",
      "parameters": [
        {
          "name": "id",
          "type": "GaleryImageId",
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
      "name": "listImages",
      "parameters": [
        {
          "name": "galeryId",
          "type": "GaleryId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "params",
          "type": "PaginationParams",
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
      "name": "deleteImage",
      "parameters": [
        {
          "name": "id",
          "type": "GaleryImageId",
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
      "name": "GaleryId",
      "definition": "string"
    },
    {
      "name": "GaleryImageId",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "definition": "string"
    },
    {
      "name": "Galery",
      "definition": "{\n  id: GaleryId;\n  name: string;\n  description?: string;\n  createdAt: ISODateString;\n}"
    },
    {
      "name": "GaleryInput",
      "definition": "{\n  name: string;\n  description?: string;\n}"
    },
    {
      "name": "GaleryImage",
      "definition": "{\n  id: GaleryImageId;\n  galeryId: GaleryId;\n  title?: string;\n  description?: string;\n  originalName?: string;\n  mimeType?: string;\n  filePath: string;\n  thumbPath: string;\n  createdAt: ISODateString;\n}"
    },
    {
      "name": "GaleryImageInput",
      "definition": "{\n  galeryId: GaleryId;\n  data: Uint8Array;\n  mimeType?: string;\n  originalName?: string;\n  title?: string;\n  description?: string;\n}"
    },
    {
      "name": "PaginationParams",
      "definition": "{\n  offset: number;\n  limit: number;\n}"
    },
    {
      "name": "PaginatedResult",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface GaleryService {
  createGalery(input: GaleryInput): Promise<any>;
  getGalery(id: GaleryId): Promise<any>;
  listGaleries(params: PaginationParams): Promise<any>;
  deleteGalery(id: GaleryId): Promise<any>;
  saveImage(input: GaleryImageInput): Promise<any>;
  getImage(id: GaleryImageId): Promise<any>;
  listImages(galeryId: GaleryId, params: PaginationParams): Promise<any>;
  deleteImage(id: GaleryImageId): Promise<any>;
}

// Client interface
export interface GaleryServiceClient {
  createGalery(input: GaleryInput): Promise<any>;
  getGalery(id: GaleryId): Promise<any>;
  listGaleries(params: PaginationParams): Promise<any>;
  deleteGalery(id: GaleryId): Promise<any>;
  saveImage(input: GaleryImageInput): Promise<any>;
  getImage(id: GaleryImageId): Promise<any>;
  listImages(galeryId: GaleryId, params: PaginationParams): Promise<any>;
  deleteImage(id: GaleryImageId): Promise<any>;
}

// Factory function
export function createGaleryServiceClient(
  config?: { baseUrl?: string },
): GaleryServiceClient {
  return createHttpClient<GaleryServiceClient>(metadata, config);
}

// Ready-to-use client
export const galeryClient = createGaleryServiceClient();
