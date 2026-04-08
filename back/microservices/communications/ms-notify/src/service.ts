import type {
  NotifyService,
  NotifyTemplate,
  NotifyTemplateId,
  NotifyTemplateInput,
  NotifyChannel,
  NotifyChannelId,
  NotifyChannelInput,
  NotifySend,
  NotifySendId,
  NotifySendInput,
} from "./types";
import { StoresController } from "./stores";
import { createSmtpServiceClient } from "g-smtp";

const MS_ID = "notify-ms";

export class NotifyServiceImpl implements NotifyService {
  private stores: StoresController;
  private initPromise?: Promise<void>;

  constructor() {
    this.init();
  }

  private async init() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      this.stores = new StoresController(MS_ID);
      await this.stores.init();
    })();
    return this.initPromise;
  }

  private async ready(): Promise<void> {
    await this.init();
  }

  // Templates

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

  // Channels

  async saveChannel(channel: NotifyChannelInput): Promise<NotifyChannelId> {
    await this.ready();
    return this.stores.channels.save(channel);
  }

  async getChannel(id: NotifyChannelId): Promise<NotifyChannel | undefined> {
    await this.ready();
    return this.stores.channels.get(id);
  }

  async listChannels(): Promise<NotifyChannel[]> {
    await this.ready();
    return this.stores.channels.list();
  }

  async deleteChannel(id: NotifyChannelId): Promise<boolean> {
    await this.ready();
    return this.stores.channels.delete(id);
  }

  // Send

  async send(input: NotifySendInput): Promise<NotifySendId> {
    await this.ready();

    const channel = await this.stores.channels.get(input.channel);
    if (!channel) throw new Error(`Channel "${input.channel}" not configured`);

    const template = await this.stores.templates.get(input.templateId);
    if (!template) throw new Error(`Template "${input.templateId}" not found`);

    const params = input.params ?? {};
    const rendered = this.renderTemplate(template.content, params);

    let status = "sent";
    try {
      await this.dispatch(channel, input.recipient, rendered);
    } catch (err: any) {
      status = "failed";
      console.error(`[ms-notify] send failed via channel "${input.channel}":`, err.message);
    }

    return this.stores.sends.recordSend({ ...input, status });
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

  // Internals

  private renderTemplate(
    content: Record<string, string>,
    params: Record<string, string | number | boolean | null>,
  ): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(content)) {
      result[key] = value.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ""));
    }
    return result;
  }

  private async dispatch(
    channel: NotifyChannel,
    recipient: string,
    content: Record<string, string>,
  ): Promise<void> {
    if (channel.type === "smtp") {
      const { serviceUrl, host, port, secure, user, pass, from } = channel.config;
      const client = createSmtpServiceClient({ baseUrl: serviceUrl });
      await client.sendEmail(
        {
          from: from ?? user,
          to: recipient,
          subject: content.subject ?? "",
          body: content.body ?? "",
          type: "text",
        },
        { host, port: Number(port), secure: Boolean(secure), auth: user ? { user, pass } : undefined },
      );
      return;
    }
    throw new Error(`Unsupported channel type "${channel.type}"`);
  }
}

export default NotifyServiceImpl;
