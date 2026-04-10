// Auto-generated package
import { createHttpClient } from "nrpc";

export type DeliveryId = string;

export type ISODateString = string;

export type ProviderId = string;

export type DeliveryStatus = "ready" | "in_transit" | "delivered";

export type DeliveryStatusSource = "user" | "provider" | "system";

export type Address = {
  name?: string;
  phone?: string;
  line1: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country: string;
};

export type Parcel = {
  weightKg: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
};

export type CustomsItem = {
  name: string;
  qty: number;
  price?: number;
  currency?: string;
  hsCode?: string;
  originCountry?: string;
};

export type Shipment = {
  from: Address;
  to: Address;
  parcels: Parcel[];
  description?: string;
  value?: number;
  currency?: string;
  items?: CustomsItem[];
};

export type Delivery = {
  id: DeliveryId;
  orderId: string;
  customerId: string;
  providerId?: ProviderId;
  status: DeliveryStatus;
  tracking?: string;
  shipment: Shipment;
  shipDate?: ISODateString;
  deliveredAt?: ISODateString;
  note?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type DeliveryInput = {
  orderId: string;
  customerId: string;
  shipment: Shipment;
  providerId?: ProviderId;
  status?: DeliveryStatus;
  tracking?: string;
  shipDate?: ISODateString;
  note?: string;
};

export type DeliveryUpdate = {
  orderId?: string;
  customerId?: string;
  shipment?: Shipment;
  providerId?: ProviderId;
  tracking?: string;
  shipDate?: ISODateString;
  deliveredAt?: ISODateString;
  note?: string;
};

export type DeliveryStatusEntry = {
  id: string;
  deliveryId: DeliveryId;
  status: DeliveryStatus;
  sourceType: DeliveryStatusSource;
  sourceId?: string;
  note?: string;
  createdAt: ISODateString;
};

export type StatusSourceInput = {
  type: DeliveryStatusSource;
  id?: string;
  note?: string;
};

export type DeliveryListParams = {
  offset: number;
  limit: number;
  orderId?: string;
  customerId?: string;
  providerId?: ProviderId;
  status?: DeliveryStatus;
  tracking?: string;
  shipDate?: ISODateString;
  from?: ISODateString;
  to?: ISODateString;
};

export type PaginatedResult = {
  items: T[];
  totalCount?: number;
};

export const metadata = {
  "interfaceName": "DeliveryService",
  "serviceName": "delivery",
  "filePath": "../types/delivery.ts",
  "methods": [
    {
      "name": "createDelivery",
      "parameters": [
        {
          "name": "input",
          "type": "DeliveryInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "DeliveryId",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getDelivery",
      "parameters": [
        {
          "name": "id",
          "type": "DeliveryId",
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
      "name": "updateDelivery",
      "parameters": [
        {
          "name": "id",
          "type": "DeliveryId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "patch",
          "type": "DeliveryUpdate",
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
      "name": "deleteDelivery",
      "parameters": [
        {
          "name": "id",
          "type": "DeliveryId",
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
      "name": "listDeliveries",
      "parameters": [
        {
          "name": "params",
          "type": "DeliveryListParams",
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
      "name": "setStatus",
      "parameters": [
        {
          "name": "id",
          "type": "DeliveryId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "status",
          "type": "DeliveryStatus",
          "optional": false,
          "isArray": false
        },
        {
          "name": "source",
          "type": "StatusSourceInput",
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
      "name": "listStatusLog",
      "parameters": [
        {
          "name": "deliveryId",
          "type": "DeliveryId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "DeliveryStatusEntry",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "DeliveryId",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "definition": "string"
    },
    {
      "name": "ProviderId",
      "definition": "string"
    },
    {
      "name": "DeliveryStatus",
      "definition": "\"ready\" | \"in_transit\" | \"delivered\""
    },
    {
      "name": "DeliveryStatusSource",
      "definition": "\"user\" | \"provider\" | \"system\""
    },
    {
      "name": "Address",
      "definition": "{\n  name?: string;\n  phone?: string;\n  line1: string;\n  city?: string;\n  region?: string;\n  postalCode?: string;\n  country: string;\n}"
    },
    {
      "name": "Parcel",
      "definition": "{\n  weightKg: number;\n  lengthCm?: number;\n  widthCm?: number;\n  heightCm?: number;\n}"
    },
    {
      "name": "CustomsItem",
      "definition": "{\n  name: string;\n  qty: number;\n  price?: number;\n  currency?: string;\n  hsCode?: string;\n  originCountry?: string;\n}"
    },
    {
      "name": "Shipment",
      "definition": "{\n  from: Address;\n  to: Address;\n  parcels: Parcel[];\n  description?: string;\n  value?: number;\n  currency?: string;\n  items?: CustomsItem[];\n}"
    },
    {
      "name": "Delivery",
      "definition": "{\n  id: DeliveryId;\n  orderId: string;\n  customerId: string;\n  providerId?: ProviderId;\n  status: DeliveryStatus;\n  tracking?: string;\n  shipment: Shipment;\n  shipDate?: ISODateString;\n  deliveredAt?: ISODateString;\n  note?: string;\n  createdAt: ISODateString;\n  updatedAt: ISODateString;\n}"
    },
    {
      "name": "DeliveryInput",
      "definition": "{\n  orderId: string;\n  customerId: string;\n  shipment: Shipment;\n  providerId?: ProviderId;\n  status?: DeliveryStatus;\n  tracking?: string;\n  shipDate?: ISODateString;\n  note?: string;\n}"
    },
    {
      "name": "DeliveryUpdate",
      "definition": "{\n  orderId?: string;\n  customerId?: string;\n  shipment?: Shipment;\n  providerId?: ProviderId;\n  tracking?: string;\n  shipDate?: ISODateString;\n  deliveredAt?: ISODateString;\n  note?: string;\n}"
    },
    {
      "name": "DeliveryStatusEntry",
      "definition": "{\n  id: string;\n  deliveryId: DeliveryId;\n  status: DeliveryStatus;\n  sourceType: DeliveryStatusSource;\n  sourceId?: string;\n  note?: string;\n  createdAt: ISODateString;\n}"
    },
    {
      "name": "StatusSourceInput",
      "definition": "{\n  type: DeliveryStatusSource;\n  id?: string;\n  note?: string;\n}"
    },
    {
      "name": "DeliveryListParams",
      "definition": "{\n  offset: number;\n  limit: number;\n  orderId?: string;\n  customerId?: string;\n  providerId?: ProviderId;\n  status?: DeliveryStatus;\n  tracking?: string;\n  shipDate?: ISODateString;\n  from?: ISODateString;\n  to?: ISODateString;\n}"
    },
    {
      "name": "PaginatedResult",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface DeliveryService {
  createDelivery(input: DeliveryInput): Promise<DeliveryId>;
  getDelivery(id: DeliveryId): Promise<any>;
  updateDelivery(id: DeliveryId, patch: DeliveryUpdate): Promise<void>;
  deleteDelivery(id: DeliveryId): Promise<boolean>;
  listDeliveries(params: DeliveryListParams): Promise<PaginatedResult>;
  setStatus(id: DeliveryId, status: DeliveryStatus, source: StatusSourceInput): Promise<void>;
  listStatusLog(deliveryId: DeliveryId): Promise<DeliveryStatusEntry[]>;
}

// Client interface
export interface DeliveryServiceClient {
  createDelivery(input: DeliveryInput): Promise<DeliveryId>;
  getDelivery(id: DeliveryId): Promise<any>;
  updateDelivery(id: DeliveryId, patch: DeliveryUpdate): Promise<void>;
  deleteDelivery(id: DeliveryId): Promise<boolean>;
  listDeliveries(params: DeliveryListParams): Promise<PaginatedResult>;
  setStatus(id: DeliveryId, status: DeliveryStatus, source: StatusSourceInput): Promise<void>;
  listStatusLog(deliveryId: DeliveryId): Promise<DeliveryStatusEntry[]>;
}

// Factory function
export function createDeliveryServiceClient(
  config?: { baseUrl?: string },
): DeliveryServiceClient {
  return createHttpClient<DeliveryServiceClient>(metadata, config);
}

// Ready-to-use client
export const deliveryClient = createDeliveryServiceClient();
