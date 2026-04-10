// Auto-generated package
import { createHttpClient } from "nrpc";

export type PartnerId = string;

export type ISODateString = string;

export type PartnerKind = "client" | "supplier" | "both";

export type Partner = {
  id: PartnerId;
  kind: PartnerKind;
  name: string;
  contact?: string;
  tags?: string[];
  note?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type PartnerInput = {
  kind: PartnerKind;
  name: string;
  contact?: string;
  tags?: string[];
  note?: string;
};

export type PartnerUpdate = Partial<PartnerInput>;

export type PartnerListParams = {
  offset: number;
  limit: number;
  kind?: PartnerKind;
  query?: string;
};

export type PaginatedResult = {
  items: T[];
  totalCount?: number;
};

export const metadata = {
  "interfaceName": "PartnersService",
  "serviceName": "partners",
  "filePath": "../types/partners.ts",
  "methods": [
    {
      "name": "createPartner",
      "parameters": [
        {
          "name": "input",
          "type": "PartnerInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PartnerId",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getPartner",
      "parameters": [
        {
          "name": "id",
          "type": "PartnerId",
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
      "name": "updatePartner",
      "parameters": [
        {
          "name": "id",
          "type": "PartnerId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "patch",
          "type": "PartnerUpdate",
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
      "name": "deletePartner",
      "parameters": [
        {
          "name": "id",
          "type": "PartnerId",
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
      "name": "listPartners",
      "parameters": [
        {
          "name": "params",
          "type": "PartnerListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "PartnerId",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "definition": "string"
    },
    {
      "name": "PartnerKind",
      "definition": "\"client\" | \"supplier\" | \"both\""
    },
    {
      "name": "Partner",
      "definition": "{\n  id: PartnerId;\n  kind: PartnerKind;\n  name: string;\n  contact?: string;\n  tags?: string[];\n  note?: string;\n  createdAt: ISODateString;\n  updatedAt: ISODateString;\n}"
    },
    {
      "name": "PartnerInput",
      "definition": "{\n  kind: PartnerKind;\n  name: string;\n  contact?: string;\n  tags?: string[];\n  note?: string;\n}"
    },
    {
      "name": "PartnerUpdate",
      "definition": "Partial<PartnerInput>"
    },
    {
      "name": "PartnerListParams",
      "definition": "{\n  offset: number;\n  limit: number;\n  kind?: PartnerKind;\n  query?: string;\n}"
    },
    {
      "name": "PaginatedResult",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface PartnersService {
  createPartner(input: PartnerInput): Promise<PartnerId>;
  getPartner(id: PartnerId): Promise<any>;
  updatePartner(id: PartnerId, patch: PartnerUpdate): Promise<void>;
  deletePartner(id: PartnerId): Promise<boolean>;
  listPartners(params: PartnerListParams): Promise<PaginatedResult>;
}

// Client interface
export interface PartnersServiceClient {
  createPartner(input: PartnerInput): Promise<PartnerId>;
  getPartner(id: PartnerId): Promise<any>;
  updatePartner(id: PartnerId, patch: PartnerUpdate): Promise<void>;
  deletePartner(id: PartnerId): Promise<boolean>;
  listPartners(params: PartnerListParams): Promise<PaginatedResult>;
}

// Factory function
export function createPartnersServiceClient(
  config?: { baseUrl?: string },
): PartnersServiceClient {
  return createHttpClient<PartnersServiceClient>(metadata, config);
}

// Ready-to-use client
export const partnersClient = createPartnersServiceClient();
