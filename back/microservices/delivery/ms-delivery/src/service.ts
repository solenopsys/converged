import type {
  DeliveryService,
  Delivery,
  DeliveryInput,
  DeliveryUpdate,
  DeliveryId,
  DeliveryStatus,
  DeliveryStatusEntry,
  StatusSourceInput,
  DeliveryListParams,
  PaginatedResult,
} from "./types";
import { StoresController } from "./stores";

const MS_ID = "delivery-ms";

export class DeliveryServiceImpl implements DeliveryService {
  stores: StoresController;

  constructor() {
    this.init();
  }

  async init() {
    this.stores = new StoresController(MS_ID);
    await this.stores.init();
  }

  createDelivery(input: DeliveryInput): Promise<DeliveryId> {
    return this.stores.delivery.createDelivery(input);
  }

  getDelivery(id: DeliveryId): Promise<Delivery | undefined> {
    return this.stores.delivery.getDelivery(id);
  }

  updateDelivery(id: DeliveryId, patch: DeliveryUpdate): Promise<void> {
    return this.stores.delivery.updateDelivery(id, patch);
  }

  deleteDelivery(id: DeliveryId): Promise<boolean> {
    return this.stores.delivery.deleteDelivery(id);
  }

  listDeliveries(
    params: DeliveryListParams,
  ): Promise<PaginatedResult<Delivery>> {
    return this.stores.delivery.listDeliveries(params);
  }

  setStatus(
    id: DeliveryId,
    status: DeliveryStatus,
    source: StatusSourceInput,
  ): Promise<void> {
    return this.stores.delivery.setStatus(id, status, source);
  }

  listStatusLog(deliveryId: DeliveryId): Promise<DeliveryStatusEntry[]> {
    return this.stores.delivery.listStatusLog(deliveryId);
  }
}
