export interface SesService {
  /**
   * `credentials` is an override, not the normal path. Left out, the lambda
   * reads its own environment — the same `<workspace>-secrets` k8s Secret ptah
   * projects into its container. A caller that passes them is a test pinning a
   * fake, or a deployment sending through a second account; a workflow never
   * does, because a credential in a call parameter travels through the browser
   * and through the assistant's tool catalogue to get here.
   */
  sendEmail(payload: EmailPayload, credentials?: SesCredentials): Promise<EmailResult>;
}

export type SesCredentials = {
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
