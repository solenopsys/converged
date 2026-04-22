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

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
};

export const metadata = {
  "interfaceName": "GaleryService",
  "serviceName": "galery",
  "filePath": "services/content/galery.ts",
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
      "returnType": "GaleryId",
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
      "returnType": "Galery | any",
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
      "returnType": "PaginatedResult<Galery>",
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
      "returnType": "boolean",
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
      "returnType": "GaleryImage",
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
      "returnType": "GaleryImage | any",
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
      "returnType": "PaginatedResult<GaleryImage>",
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
      "returnType": "boolean",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "GaleryId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "GaleryImageId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "Galery",
      "kind": "type",
      "definition": "{\n  id: GaleryId;\n  name: string;\n  description?: string;\n  createdAt: ISODateString;\n}"
    },
    {
      "name": "GaleryInput",
      "kind": "type",
      "definition": "{\n  name: string;\n  description?: string;\n}"
    },
    {
      "name": "GaleryImage",
      "kind": "type",
      "definition": "{\n  id: GaleryImageId;\n  galeryId: GaleryId;\n  title?: string;\n  description?: string;\n  originalName?: string;\n  mimeType?: string;\n  filePath: string;\n  thumbPath: string;\n  createdAt: ISODateString;\n}"
    },
    {
      "name": "GaleryImageInput",
      "kind": "type",
      "definition": "{\n  galeryId: GaleryId;\n  data: Uint8Array;\n  mimeType?: string;\n  originalName?: string;\n  title?: string;\n  description?: string;\n}"
    },
    {
      "name": "PaginationParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n}"
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
export interface GaleryService {
  createGalery(input: GaleryInput): Promise<GaleryId>;
  getGalery(id: GaleryId): Promise<Galery | any>;
  listGaleries(params: PaginationParams): Promise<PaginatedResult<Galery>>;
  deleteGalery(id: GaleryId): Promise<boolean>;
  saveImage(input: GaleryImageInput): Promise<GaleryImage>;
  getImage(id: GaleryImageId): Promise<GaleryImage | any>;
  listImages(galeryId: GaleryId, params: PaginationParams): Promise<PaginatedResult<GaleryImage>>;
  deleteImage(id: GaleryImageId): Promise<boolean>;
}

// Client interface
export interface GaleryServiceClient {
  createGalery(input: GaleryInput): Promise<GaleryId>;
  getGalery(id: GaleryId): Promise<Galery | any>;
  listGaleries(params: PaginationParams): Promise<PaginatedResult<Galery>>;
  deleteGalery(id: GaleryId): Promise<boolean>;
  saveImage(input: GaleryImageInput): Promise<GaleryImage>;
  getImage(id: GaleryImageId): Promise<GaleryImage | any>;
  listImages(galeryId: GaleryId, params: PaginationParams): Promise<PaginatedResult<GaleryImage>>;
  deleteImage(id: GaleryImageId): Promise<boolean>;
}

// Factory function
export function createGaleryServiceClient(
  config?: { baseUrl?: string },
): GaleryServiceClient {
  return createHttpClient<GaleryServiceClient>(metadata, config);
}

// Ready-to-use client
export const galeryClient = createGaleryServiceClient();
