import { StoreControllerAbstract, StoreType, SqlStore } from "back-core";
import { WebhooksStoreService } from "./webhooks/service";
import webhooksMigrations from "./webhooks/migrations";

export class StoresController extends StoreControllerAbstract {
  public webhooks!: WebhooksStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init(): Promise<void> {
    const webhooksStore = await this.addStore(
      "webhooks",
      StoreType.SQL,
      webhooksMigrations,
    );
    this.webhooks = new WebhooksStoreService(webhooksStore as SqlStore);
    await this.startAll();
    await this.migrateAll();
  }

  async destroy(): Promise<void> {
    await this.closeAll();
  }
}
