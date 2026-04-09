export type NotifyTemplateId = string;
export type NotifySendId = string;
export type ISODateString = string;

export type NotifyTemplate = {
  id: NotifyTemplateId;
  content: Record<string, string>;
};

export type NotifyTemplateInput = {
  id: NotifyTemplateId;
  content: Record<string, string>;
};

export type NotifySend = {
  id: NotifySendId;
  templateId: NotifyTemplateId;
  channel: string;
  recipient: string;
  params: Record<string, string | number | boolean | null>;
  status: string;
  createdAt: ISODateString;
};

export type NotifySendInput = {
  templateId: NotifyTemplateId;
  channel: string;
  recipient: string;
  params?: Record<string, string | number | boolean | null>;
  status?: string;
};

export type NotifyChannelId = string;

export type NotifyChannel = {
  id: NotifyChannelId;
  type: string;
  config: Record<string, any>;
};

export type NotifyChannelInput = {
  id: NotifyChannelId;
  type: string;
  config: Record<string, any>;
};

export interface NotifyService {
  saveTemplate(template: NotifyTemplateInput): Promise<NotifyTemplateId>;
  getTemplate(id: NotifyTemplateId): Promise<NotifyTemplate | undefined>;
  listTemplates(): Promise<NotifyTemplate[]>;
  deleteTemplate(id: NotifyTemplateId): Promise<boolean>;
  saveChannel(channel: NotifyChannelInput): Promise<NotifyChannelId>;
  getChannel(id: NotifyChannelId): Promise<NotifyChannel | undefined>;
  listChannels(): Promise<NotifyChannel[]>;
  deleteChannel(id: NotifyChannelId): Promise<boolean>;
  recordSend(input: NotifySendInput): Promise<NotifySendId>;
  getSend(id: NotifySendId): Promise<NotifySend | undefined>;
  listSends(): Promise<NotifySend[]>;
}
