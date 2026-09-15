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

/**
 * Who the letters come from — one per installation.
 *
 * `lang` is the company language: the middle link of the chain every letter
 * resolves its language through, recipient (`User.lang`, `StaffMember.lang`,
 * `Order.customerLang`) → this → `en`. The rest is what the mail layout used to
 * have written in as literals: the name above the card, the support address
 * and the postal line in the footer.
 *
 * Kept next to the templates rather than in a store of its own because nothing
 * but a letter reads it, and a letter already asks rp-notify for its template.
 */
export type NotifyProfile = {
  lang: string;
  brand: string;
  supportEmail?: string;
  address?: string;
  updatedAt?: ISODateString;
};

export type NotifyProfilePatch = {
  lang?: string;
  brand?: string;
  supportEmail?: string;
  address?: string;
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
  /**
   * A template is one letter in every language: `content[lang]` holds the JSON
   * of a `dag-mail` `MailContent` (subject, preheader, cta, blocks). The files in
   * `modules/commands/mail/` are the source; `notify template seed` puts them here.
   */
  saveTemplate(template: NotifyTemplateInput): Promise<NotifyTemplateId>;
  getTemplate(id: NotifyTemplateId): Promise<NotifyTemplate | undefined>;
  listTemplates(): Promise<NotifyTemplate[]>;
  deleteTemplate(id: NotifyTemplateId): Promise<boolean>;
  saveChannel(channel: NotifyChannelInput): Promise<NotifyChannelId>;
  getChannel(id: NotifyChannelId): Promise<NotifyChannel | undefined>;
  listChannels(): Promise<NotifyChannel[]>;
  deleteChannel(id: NotifyChannelId): Promise<boolean>;
  /** Never absent: an installation that never set it writes in English as "Converge". */
  getProfile(): Promise<NotifyProfile>;
  saveProfile(patch: NotifyProfilePatch): Promise<NotifyProfile>;
  recordSend(input: NotifySendInput): Promise<NotifySendId>;
  getSend(id: NotifySendId): Promise<NotifySend | undefined>;
  listSends(): Promise<NotifySend[]>;
}
