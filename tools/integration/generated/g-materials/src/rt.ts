// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export type MaterialId = string;

export type MovementId = string;

export type ISODateString = string;

export type MovementType = "in" | "out" | "reserve" | "release" | "writeoff" | "adjustment";

export type Material = {
  id: MaterialId;
  name: string;
  sku?: string;
  category: string;
  unit: string;
  description?: string;
  stockQuantity: number;
  minStockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type MaterialInput = {
  name: string;
  sku?: string;
  category: string;
  unit: string;
  description?: string;
  minStockQuantity?: number;
};

export type MaterialPatch = {
  name?: string;
  sku?: string;
  category?: string;
  unit?: string;
  description?: string;
  minStockQuantity?: number;
};

export type StockMovement = {
  id: MovementId;
  materialId: MaterialId;
  type: MovementType;
  quantity: number;
  reason?: string;
  orderId?: string;
  equipmentId?: string;
  createdAt: ISODateString;
};

export type StockMovementInput = {
  materialId: MaterialId;
  type: MovementType;
  quantity: number;
  reason?: string;
  orderId?: string;
  equipmentId?: string;
};

export type MaterialListParams = {
  offset: number;
  limit: number;
  category?: string;
  lowStock?: boolean;
  query?: string;
};

export type MovementListParams = {
  offset: number;
  limit: number;
  materialId?: MaterialId;
  type?: MovementType;
  orderId?: string;
  from?: ISODateString;
  to?: ISODateString;
};

export type LowStockAlert = {
  materialId: MaterialId;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
  deficit: number;
};

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
};

const metadata: ServiceMetadata = {
  "interfaceName": "MaterialsService",
  "serviceName": "materials",
  "filePath": "services/business/materials.ts",
  "methods": [
    {
      "name": "createMaterial",
      "parameters": [
        {
          "name": "input",
          "type": "MaterialInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "MaterialId",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getMaterial",
      "parameters": [
        {
          "name": "id",
          "type": "MaterialId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Material | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listMaterials",
      "parameters": [
        {
          "name": "params",
          "type": "MaterialListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<Material>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "patchMaterial",
      "parameters": [
        {
          "name": "id",
          "type": "MaterialId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "patch",
          "type": "MaterialPatch",
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
      "name": "deleteMaterial",
      "parameters": [
        {
          "name": "id",
          "type": "MaterialId",
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
      "name": "addMovement",
      "parameters": [
        {
          "name": "input",
          "type": "StockMovementInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "MovementId",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listMovements",
      "parameters": [
        {
          "name": "params",
          "type": "MovementListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<StockMovement>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getLowStockAlerts",
      "parameters": [],
      "returnType": "LowStockAlert",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "MaterialId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "MovementId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "MovementType",
      "kind": "type",
      "definition": "\"in\" | \"out\" | \"reserve\" | \"release\" | \"writeoff\" | \"adjustment\""
    },
    {
      "name": "Material",
      "kind": "type",
      "definition": "{\n  id: MaterialId;\n  name: string;\n  sku?: string;\n  category: string;\n  unit: string;\n  description?: string;\n  stockQuantity: number;\n  minStockQuantity: number;\n  reservedQuantity: number;\n  availableQuantity: number;\n  createdAt: ISODateString;\n  updatedAt: ISODateString;\n}"
    },
    {
      "name": "MaterialInput",
      "kind": "type",
      "definition": "{\n  name: string;\n  sku?: string;\n  category: string;\n  unit: string;\n  description?: string;\n  minStockQuantity?: number;\n}"
    },
    {
      "name": "MaterialPatch",
      "kind": "type",
      "definition": "{\n  name?: string;\n  sku?: string;\n  category?: string;\n  unit?: string;\n  description?: string;\n  minStockQuantity?: number;\n}"
    },
    {
      "name": "StockMovement",
      "kind": "type",
      "definition": "{\n  id: MovementId;\n  materialId: MaterialId;\n  type: MovementType;\n  quantity: number;\n  reason?: string;\n  orderId?: string;\n  equipmentId?: string;\n  createdAt: ISODateString;\n}"
    },
    {
      "name": "StockMovementInput",
      "kind": "type",
      "definition": "{\n  materialId: MaterialId;\n  type: MovementType;\n  quantity: number;\n  reason?: string;\n  orderId?: string;\n  equipmentId?: string;\n}"
    },
    {
      "name": "MaterialListParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n  category?: string;\n  lowStock?: boolean;\n  query?: string;\n}"
    },
    {
      "name": "MovementListParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n  materialId?: MaterialId;\n  type?: MovementType;\n  orderId?: string;\n  from?: ISODateString;\n  to?: ISODateString;\n}"
    },
    {
      "name": "LowStockAlert",
      "kind": "type",
      "definition": "{\n  materialId: MaterialId;\n  name: string;\n  unit: string;\n  currentStock: number;\n  minStock: number;\n  deficit: number;\n}"
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
export interface MaterialsServiceRtClient {
  createMaterial(input: MaterialInput): MaterialId;
  getMaterial(id: MaterialId): Material | any;
  listMaterials(params: MaterialListParams): PaginatedResult<Material>;
  patchMaterial(id: MaterialId, patch: MaterialPatch): void;
  deleteMaterial(id: MaterialId): boolean;
  addMovement(input: StockMovementInput): MovementId;
  listMovements(params: MovementListParams): PaginatedResult<StockMovement>;
  getLowStockAlerts(): LowStockAlert[];
}

export function createMaterialsServiceRtClient(): MaterialsServiceRtClient {
  return createRtClient<MaterialsServiceRtClient>(metadata);
}
