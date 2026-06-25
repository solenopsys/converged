// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

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

export type CachedImageRef = {
  key: string;
  contentType: string;
  size: number;
};

export type PaginationParams = {
  offset: number;
  limit: number;
};

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
};

const metadata: ServiceMetadata = {
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
    },
    {
      "name": "ensureStaticCached",
      "parameters": [
        {
          "name": "path",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "CachedImageRef | any",
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
      "name": "CachedImageRef",
      "kind": "type",
      "definition": "{\n  key: string;\n  contentType: string;\n  size: number;\n}"
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

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface GaleryServiceRtClient {
  createGalery(input: GaleryInput): GaleryId;
  getGalery(id: GaleryId): Galery | any;
  listGaleries(params: PaginationParams): PaginatedResult<Galery>;
  deleteGalery(id: GaleryId): boolean;
  saveImage(input: GaleryImageInput): GaleryImage;
  getImage(id: GaleryImageId): GaleryImage | any;
  listImages(galeryId: GaleryId, params: PaginationParams): PaginatedResult<GaleryImage>;
  deleteImage(id: GaleryImageId): boolean;
  ensureStaticCached(path: string): CachedImageRef | any;
}

export function createGaleryServiceRtClient(): GaleryServiceRtClient {
  return createRtClient<GaleryServiceRtClient>(metadata);
}
