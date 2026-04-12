import type { ExecutionEvent } from "./dag";

export type ExecutionId = string;

export type ExecutionResult = {
  id: ExecutionId;
}

export type MagicLinkParams = {
  email: string;
  returnTo?: string;
  locale?: string;
  channel?: string;
  templateId?: string;
}

export type MagicLinkResult = {
  success: boolean;
}

export interface RuntimeService {
  startExecution(workflowName: string, params: Record<string, any>): AsyncIterable<ExecutionEvent>;
  createExecution(workflowName: string, params: Record<string, any>): Promise<ExecutionResult>;
  refreshCrons(): Promise<void>;
  /** @public */
  sendMagicLink(params: MagicLinkParams): Promise<MagicLinkResult>;
}
