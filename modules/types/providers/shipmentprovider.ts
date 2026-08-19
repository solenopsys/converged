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

export interface ShipmentProviderService {
  quote(input: QuoteRequest): Promise<QuoteResult>;
  createShipment(input: CreateShipmentRequest): Promise<CreateShipmentResult>;
  label(input: LabelRequest): Promise<LabelResult>;
  tracking(input: TrackingRequest): Promise<TrackingResult>;
  webhook(input: WebhookRequest): Promise<void>;
  validateAddress(input: AddressValidationRequest): Promise<AddressValidationResult>;
  customsLookup(input: CustomsLookupRequest): Promise<CustomsLookupResult>;
}
