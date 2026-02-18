export interface SesService {
  sendEmail(payload: EmailPayload, credentials: SesCredentials): Promise<EmailResult>;
}

export interface SesCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export type EmailPayload = {
  from?: string;
  to: string | string[];
  subject: string;
  body?: string;
  type?: "html" | "text";
};

export type EmailResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};
