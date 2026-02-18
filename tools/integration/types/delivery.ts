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

export interface PaginatedResult<T> {
  items: T[];
  totalCount?: number;
}

export interface DeliveryService {
  createDelivery(input: DeliveryInput): Promise<DeliveryId>;
  getDelivery(id: DeliveryId): Promise<Delivery | undefined>;
  updateDelivery(id: DeliveryId, patch: DeliveryUpdate): Promise<void>;
  deleteDelivery(id: DeliveryId): Promise<boolean>;
  listDeliveries(params: DeliveryListParams): Promise<PaginatedResult<Delivery>>;

  setStatus(
    id: DeliveryId,
    status: DeliveryStatus,
    source: StatusSourceInput,
  ): Promise<void>;
  listStatusLog(deliveryId: DeliveryId): Promise<DeliveryStatusEntry[]>;
}
