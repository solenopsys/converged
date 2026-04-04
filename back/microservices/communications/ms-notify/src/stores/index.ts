import {
  StoreControllerAbstract,
  StoreType,
  SqlStore,
  FileStore,
} from "back-core";
import { NotifyTemplateStoreService } from "./templates/service";
import { NotifySendsStoreService } from "./sends/service";
import sendsMigrations from "./sends/migrations";

export class StoresController extends StoreControllerAbstract {
  public templates: NotifyTemplateStoreService;
  public sends: NotifySendsStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const templatesStore = await this.addStore(
      "templates",
      StoreType.FILES,
      [],
    );
    const sendsStore = await this.addStore(
      "sends",
      StoreType.SQL,
      sendsMigrations,
    );

    this.templates = new NotifyTemplateStoreService(templatesStore as FileStore);
    this.sends = new NotifySendsStoreService(sendsStore as SqlStore);

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
