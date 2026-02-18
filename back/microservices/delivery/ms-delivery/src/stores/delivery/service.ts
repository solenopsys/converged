import { SqlStore, generateULID } from "back-core";
import {
  DeliveryRepository,
  DeliveryStatusRepository,
} from "./entities";
import type {
  Delivery,
  DeliveryInput,
  DeliveryUpdate,
  DeliveryId,
  DeliveryStatus,
  DeliveryStatusEntry,
  StatusSourceInput,
  DeliveryListParams,
  PaginatedResult,
  Shipment,
} from "../../types";
import type { DeliveryEntity, DeliveryStatusEntity } from "./entities";

export class DeliveryStoreService {
  private readonly deliveryRepo: DeliveryRepository;
  private readonly statusRepo: DeliveryStatusRepository;

  constructor(private store: SqlStore) {
    this.deliveryRepo = new DeliveryRepository(store, "deliveries", {
      primaryKey: "id",
      extractKey: (entry) => ({ id: entry.id }),
      buildWhereCondition: (key) => ({ id: key.id }),
    });

    this.statusRepo = new DeliveryStatusRepository(store, "delivery_status_log", {
      primaryKey: "id",
      extractKey: (entry) => ({ id: entry.id }),
      buildWhereCondition: (key) => ({ id: key.id }),
    });
  }

  async createDelivery(input: DeliveryInput): Promise<DeliveryId> {
    const id = generateULID();
    const now = new Date().toISOString();
    const status: DeliveryStatus = input.status ?? "ready";

    const entity: DeliveryEntity = {
      id,
      orderId: input.orderId,
      customerId: input.customerId,
      providerId: input.providerId ?? null,
      status,
      tracking: input.tracking ?? null,
      shipment: this.serializeShipment(input.shipment),
      shipDate: input.shipDate ?? null,
      deliveredAt: null,
      note: input.note ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await this.deliveryRepo.create(entity as any);

    await this.addStatusLog(id, status, {
      type: "system",
      note: "created",
    });

    return id;
  }

  async getDelivery(id: DeliveryId): Promise<Delivery | undefined> {
    const entity = await this.deliveryRepo.findById({ id });
    if (!entity) return undefined;
    return this.toDelivery(entity);
  }

  async updateDelivery(id: DeliveryId, patch: DeliveryUpdate): Promise<void> {
    const existing = await this.deliveryRepo.findById({ id });
    if (!existing) {
      throw new Error(`Delivery not found: ${id}`);
    }

    const update: Partial<DeliveryEntity> = {
      updatedAt: new Date().toISOString(),
    };

    if (patch.orderId !== undefined) {
      update.orderId = patch.orderId;
    }
    if (patch.customerId !== undefined) {
      update.customerId = patch.customerId;
    }
    if (patch.providerId !== undefined) {
      update.providerId = patch.providerId ?? null;
    }
    if (patch.tracking !== undefined) {
      update.tracking = patch.tracking ?? null;
    }
    if (patch.shipment !== undefined) {
      update.shipment = this.serializeShipment(patch.shipment);
    }
    if (patch.shipDate !== undefined) {
      update.shipDate = patch.shipDate ?? null;
    }
    if (patch.deliveredAt !== undefined) {
      update.deliveredAt = patch.deliveredAt ?? null;
    }
    if (patch.note !== undefined) {
      update.note = patch.note ?? null;
    }

    await this.deliveryRepo.update({ id }, update);
  }

  async deleteDelivery(id: DeliveryId): Promise<boolean> {
    return this.deliveryRepo.delete({ id });
  }

  async listDeliveries(
    params: DeliveryListParams,
  ): Promise<PaginatedResult<Delivery>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let query = this.store.db.selectFrom("deliveries").selectAll();

    if (params.orderId) {
      query = query.where("orderId", "=", params.orderId);
    }
    if (params.customerId) {
      query = query.where("customerId", "=", params.customerId);
    }
    if (params.providerId) {
      query = query.where("providerId", "=", params.providerId);
    }
    if (params.status) {
      query = query.where("status", "=", params.status);
    }
    if (params.tracking) {
      query = query.where("tracking", "=", params.tracking);
    }
    if (params.shipDate) {
      query = query.where("shipDate", "=", params.shipDate);
    }
    if (params.from) {
      query = query.where("shipDate", ">=", params.from);
    }
    if (params.to) {
      query = query.where("shipDate", "<=", params.to);
    }

    const items = await query
      .orderBy("updatedAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    let countQuery = this.store.db
      .selectFrom("deliveries")
      .select(({ fn }) => fn.countAll().as("count"));

    if (params.orderId) {
      countQuery = countQuery.where("orderId", "=", params.orderId);
    }
    if (params.customerId) {
      countQuery = countQuery.where("customerId", "=", params.customerId);
    }
    if (params.providerId) {
      countQuery = countQuery.where("providerId", "=", params.providerId);
    }
    if (params.status) {
      countQuery = countQuery.where("status", "=", params.status);
    }
    if (params.tracking) {
      countQuery = countQuery.where("tracking", "=", params.tracking);
    }
    if (params.shipDate) {
      countQuery = countQuery.where("shipDate", "=", params.shipDate);
    }
    if (params.from) {
      countQuery = countQuery.where("shipDate", ">=", params.from);
    }
    if (params.to) {
      countQuery = countQuery.where("shipDate", "<=", params.to);
    }

    const countResult = await countQuery.executeTakeFirst();
    const totalCount = Number(countResult?.count ?? 0);

    return {
      items: (items as DeliveryEntity[]).map((item) => this.toDelivery(item)),
      totalCount,
    };
  }

  async setStatus(
    id: DeliveryId,
    status: DeliveryStatus,
    source: StatusSourceInput,
  ): Promise<void> {
    const existing = await this.deliveryRepo.findById({ id });
    if (!existing) {
      throw new Error(`Delivery not found: ${id}`);
    }

    const update: Partial<DeliveryEntity> = {
      status,
      updatedAt: new Date().toISOString(),
    };

    if (status === "delivered" && !existing.deliveredAt) {
      update.deliveredAt = new Date().toISOString();
    }

    await this.deliveryRepo.update({ id }, update);
    await this.addStatusLog(id, status, source);
  }

  async listStatusLog(deliveryId: DeliveryId): Promise<DeliveryStatusEntry[]> {
    const items = await this.store.db
      .selectFrom("delivery_status_log")
      .selectAll()
      .where("deliveryId", "=", deliveryId)
      .orderBy("createdAt", "asc")
      .execute();

    return (items as DeliveryStatusEntity[]).map((item) => this.toStatusEntry(item));
  }

  private async addStatusLog(
    deliveryId: DeliveryId,
    status: DeliveryStatus,
    source: StatusSourceInput,
  ) {
    const entry: DeliveryStatusEntity = {
      id: generateULID(),
      deliveryId,
      status,
      sourceType: source.type,
      sourceId: source.id ?? null,
      note: source.note ?? null,
      createdAt: new Date().toISOString(),
    };
    await this.statusRepo.create(entry as any);
  }

  private serializeShipment(value: Shipment): string {
    return JSON.stringify(value ?? {});
  }

  private parseShipment(value?: string | null): Shipment {
    if (!value) return {} as Shipment;
    try {
      return JSON.parse(value) as Shipment;
    } catch {
      return {} as Shipment;
    }
  }

  private toDelivery(entity: DeliveryEntity): Delivery {
    return {
      id: entity.id,
      orderId: entity.orderId,
      customerId: entity.customerId,
      providerId: entity.providerId ?? undefined,
      status: entity.status as DeliveryStatus,
      tracking: entity.tracking ?? undefined,
      shipment: this.parseShipment(entity.shipment),
      shipDate: entity.shipDate ?? undefined,
      deliveredAt: entity.deliveredAt ?? undefined,
      note: entity.note ?? undefined,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private toStatusEntry(entity: DeliveryStatusEntity): DeliveryStatusEntry {
    return {
      id: entity.id,
      deliveryId: entity.deliveryId,
      status: entity.status as DeliveryStatus,
      sourceType: entity.sourceType as any,
      sourceId: entity.sourceId ?? undefined,
      note: entity.note ?? undefined,
      createdAt: entity.createdAt,
    };
  }
}
