import {
  StoreControllerAbstract,
  StoreType,
  SqlStore,
  FileStore,
  JsonStore,
} from "back-core";
import { NotifyTemplateStoreService } from "./templates/service";
import { NotifySendsStoreService } from "./sends/service";
import { NotifyChannelStoreService } from "./channels/service";
import { NotifyProfileStoreService } from "./profile/service";
import sendsMigrations from "./sends/migrations";

export class StoresController extends StoreControllerAbstract {
  public templates: NotifyTemplateStoreService;
  public sends: NotifySendsStoreService;
  public channels: NotifyChannelStoreService;
  public profile: NotifyProfileStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const templatesStore = await this.addStore("templates", StoreType.FILES, []);
    const sendsStore = await this.addStore("sends", StoreType.SQL, sendsMigrations);
    const channelsStore = await this.addStore("channels", StoreType.JSON, []);
    const profileStore = await this.addStore("profile", StoreType.JSON, []);

    this.templates = new NotifyTemplateStoreService(templatesStore as FileStore);
    this.sends = new NotifySendsStoreService(sendsStore as SqlStore);
    this.channels = new NotifyChannelStoreService(channelsStore as JsonStore);
    this.profile = new NotifyProfileStoreService(profileStore as JsonStore);

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
