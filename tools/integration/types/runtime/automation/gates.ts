/**
 * @nrpc-service gates
 * @nrpc-package g-rt-gates
 */

export type MagicLinkParams = {
  email: string;
  returnTo?: string;
  locale?: string;
  channel?: string;
  templateId?: string;
};

export type MagicLinkResult = {
  success: boolean;
};

export interface RuntimeGatesService {
  /** @public */
  sendMagicLink(params: MagicLinkParams): Promise<MagicLinkResult>;
}
