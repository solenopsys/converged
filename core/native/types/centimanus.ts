export type CentimanusWorkflowResult = {
  executionId: string;
  ok: boolean;
  result?: unknown;
  error?: string;
};

export interface RuntimeCentimanusService {
  runWorkflow(scriptPath: string, params: Record<string, unknown>): Promise<CentimanusWorkflowResult>;
}
