export interface SmtpService {
  sendEmail(payload: EmailPayload, credentials: SmtpCredentials): Promise<EmailResult>;
}

export interface SmtpCredentials {
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
};

export type EmailResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};
