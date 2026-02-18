// Auto-generated package
import { createHttpClient } from "nrpc";

export type ISODateString = string;

export type ProviderId = string;

export type ShipmentStatus = "ready" | "in_transit" | "delivered" | "problem";

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

export type QuoteRequest = {
  shipment: Shipment;
};

export type QuoteResult = {
  price: number;
  currency: string;
  etaDays?: number;
  serviceCode?: string;
  raw?: any;
};

export type CreateShipmentRequest = {
  shipment: Shipment;
  serviceCode?: string;
};

export type CreateShipmentResult = {
  tracking: string;
  providerRef?: string;
  raw?: any;
};

export type LabelRequest = {
  tracking: string;
};

export type LabelResult = {
  pdfBase64: string;
  raw?: any;
};

export type TrackingRequest = {
  tracking: string;
};

export type TrackingResult = {
  status: ShipmentStatus;
  lastUpdate?: ISODateString;
  raw?: any;
};

export type WebhookRequest = {
  payload: any;
};

export type AddressValidationRequest = {
  address: Address;
};

export type AddressValidationResult = {
  valid: boolean;
  normalized?: Address;
  raw?: any;
};

export type CustomsLookupRequest = {
  items: CustomsItem[];
};

export type CustomsLookupResult = {
  items: CustomsItem[];
  raw?: any;
};

export const metadata = {
  "interfaceName": "ShipmentProviderService",
  "serviceName": "shipmentprovider",
  "filePath": "../types/shipmentprovider.ts",
  "methods": [
    {
      "name": "quote",
      "parameters": [
        {
          "name": "input",
          "type": "QuoteRequest",
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
      "name": "createShipment",
      "parameters": [
        {
          "name": "input",
          "type": "CreateShipmentRequest",
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
      "name": "label",
      "parameters": [
        {
          "name": "input",
          "type": "LabelRequest",
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
      "name": "tracking",
      "parameters": [
        {
          "name": "input",
          "type": "TrackingRequest",
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
      "name": "webhook",
      "parameters": [
        {
          "name": "input",
          "type": "WebhookRequest",
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
      "name": "validateAddress",
      "parameters": [
        {
          "name": "input",
          "type": "AddressValidationRequest",
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
      "name": "customsLookup",
      "parameters": [
        {
          "name": "input",
          "type": "CustomsLookupRequest",
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
      "name": "ISODateString",
      "definition": "string"
    },
    {
      "name": "ProviderId",
      "definition": "string"
    },
    {
      "name": "ShipmentStatus",
      "definition": "\"ready\" | \"in_transit\" | \"delivered\" | \"problem\""
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
      "name": "QuoteRequest",
      "definition": "{\n  shipment: Shipment;\n}"
    },
    {
      "name": "QuoteResult",
      "definition": "{\n  price: number;\n  currency: string;\n  etaDays?: number;\n  serviceCode?: string;\n  raw?: any;\n}"
    },
    {
      "name": "CreateShipmentRequest",
      "definition": "{\n  shipment: Shipment;\n  serviceCode?: string;\n}"
    },
    {
      "name": "CreateShipmentResult",
      "definition": "{\n  tracking: string;\n  providerRef?: string;\n  raw?: any;\n}"
    },
    {
      "name": "LabelRequest",
      "definition": "{\n  tracking: string;\n}"
    },
    {
      "name": "LabelResult",
      "definition": "{\n  pdfBase64: string;\n  raw?: any;\n}"
    },
    {
      "name": "TrackingRequest",
      "definition": "{\n  tracking: string;\n}"
    },
    {
      "name": "TrackingResult",
      "definition": "{\n  status: ShipmentStatus;\n  lastUpdate?: ISODateString;\n  raw?: any;\n}"
    },
    {
      "name": "WebhookRequest",
      "definition": "{\n  payload: any;\n}"
    },
    {
      "name": "AddressValidationRequest",
      "definition": "{\n  address: Address;\n}"
    },
    {
      "name": "AddressValidationResult",
      "definition": "{\n  valid: boolean;\n  normalized?: Address;\n  raw?: any;\n}"
    },
    {
      "name": "CustomsLookupRequest",
      "definition": "{\n  items: CustomsItem[];\n}"
    },
    {
      "name": "CustomsLookupResult",
      "definition": "{\n  items: CustomsItem[];\n  raw?: any;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface ShipmentProviderService {
  quote(input: QuoteRequest): Promise<any>;
  createShipment(input: CreateShipmentRequest): Promise<any>;
  label(input: LabelRequest): Promise<any>;
  tracking(input: TrackingRequest): Promise<any>;
  webhook(input: WebhookRequest): Promise<any>;
  validateAddress(input: AddressValidationRequest): Promise<any>;
  customsLookup(input: CustomsLookupRequest): Promise<any>;
}

// Client interface
export interface ShipmentProviderServiceClient {
  quote(input: QuoteRequest): Promise<any>;
  createShipment(input: CreateShipmentRequest): Promise<any>;
  label(input: LabelRequest): Promise<any>;
  tracking(input: TrackingRequest): Promise<any>;
  webhook(input: WebhookRequest): Promise<any>;
  validateAddress(input: AddressValidationRequest): Promise<any>;
  customsLookup(input: CustomsLookupRequest): Promise<any>;
}

// Factory function
export function createShipmentProviderServiceClient(
  config?: { baseUrl?: string },
): ShipmentProviderServiceClient {
  return createHttpClient<ShipmentProviderServiceClient>(metadata, config);
}

// Ready-to-use client
export const shipmentproviderClient = createShipmentProviderServiceClient();
