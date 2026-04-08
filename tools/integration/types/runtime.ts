import type { ExecutionEvent } from "./dag";

export interface RuntimeService {
  startExecution(
    workflowName: string,
    params: Record<string, any>,
  ): AsyncIterable<ExecutionEvent>;

  createExecution(
    workflowName: string,
    params: Record<string, any>,
  ): Promise<{ id: string }>;

  refreshCrons(): Promise<void>;
}
