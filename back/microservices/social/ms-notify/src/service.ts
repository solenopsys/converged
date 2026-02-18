import type {
  NotifyService,
  NotifyTemplate,
  NotifyTemplateId,
  NotifyTemplateInput,
  NotifySend,
  NotifySendId,
  NotifySendInput,
} from "./types";
import { StoresController } from "./stores";

const MS_ID = "notify-ms";

export class NotifyServiceImpl implements NotifyService {
  private stores: StoresController;
  private initPromise?: Promise<void>;

  constructor() {
    this.init();
  }

  private async init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      this.stores = new StoresController(MS_ID);
      await this.stores.init();
    })();

    return this.initPromise;
  }

  private async ready(): Promise<void> {
    await this.init();
  }

  async saveTemplate(template: NotifyTemplateInput): Promise<NotifyTemplateId> {
    await this.ready();
    return this.stores.templates.save(template);
  }

  async getTemplate(id: NotifyTemplateId): Promise<NotifyTemplate | undefined> {
    await this.ready();
    return this.stores.templates.get(id);
  }

  async listTemplates(): Promise<NotifyTemplate[]> {
    await this.ready();
    return this.stores.templates.list();
  }

  async deleteTemplate(id: NotifyTemplateId): Promise<boolean> {
    await this.ready();
    return this.stores.templates.delete(id);
  }

  async recordSend(input: NotifySendInput): Promise<NotifySendId> {
    await this.ready();
    return this.stores.sends.recordSend(input);
  }

  async getSend(id: NotifySendId): Promise<NotifySend | undefined> {
    await this.ready();
    return this.stores.sends.getSend(id);
  }

  async listSends(): Promise<NotifySend[]> {
    await this.ready();
    return this.stores.sends.listSends();
  }
}

export default NotifyServiceImpl;
