export interface SmtpService {
  /** An override, not the normal path — see `SesService.sendEmail`. */
  sendEmail(payload: EmailPayload, credentials?: SmtpCredentials): Promise<EmailResult>;
}

export type SmtpCredentials = {
  host: string;
  port: number;
  secure: boolean;
  auth?: {
    user: string;
    pass: string;
  };
}

export type EmailPayload = {
  from?: string;
  to: string | string[];
  subject: string;
  body?: string;
  type?: "html" | "text";
  /**
   * The plain-text alternative of an html `body`, sent alongside it as
   * multipart/alternative. An html letter without one reads as spam to filters
   * and as nothing to a text-only client.
   */
  text?: string;
};

export type EmailResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};
