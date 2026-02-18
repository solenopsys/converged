import { BaseRepositorySQL, KeySQL } from "back-core";
import type { ISODateString, ProviderId } from "../../types";

export interface DeliveryKey extends KeySQL {
  id: string;
}

export interface DeliveryEntity {
  id: string;
  orderId: string;
  customerId: string;
  providerId?: ProviderId | null;
  status: string;
  tracking?: string | null;
  shipment: string;
  shipDate?: ISODateString | null;
  deliveredAt?: ISODateString | null;
  note?: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export class DeliveryRepository extends BaseRepositorySQL<
  DeliveryKey,
  DeliveryEntity
> {}

export interface DeliveryStatusKey extends KeySQL {
  id: string;
}

export interface DeliveryStatusEntity {
  id: string;
  deliveryId: string;
  status: string;
  sourceType: string;
  sourceId?: string | null;
  note?: string | null;
  createdAt: ISODateString;
}

export class DeliveryStatusRepository extends BaseRepositorySQL<
  DeliveryStatusKey,
  DeliveryStatusEntity
> {}
