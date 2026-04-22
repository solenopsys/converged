/**
 * @nrpc-service dag
 * @nrpc-package g-rt-dag
 */

export type ExecutionStatus = "running" | "done" | "failed";
export type TaskState = "queued" | "processing" | "done" | "failed";

export type Task = {
  id: number;
  executionId: string;
  nodeId: string;
  state: TaskState;
  startedAt: number | null;
  completedAt: number | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: number;
  data?: any;
  result?: any;
};

export type ExecutionEventType = "started" | "task_update" | "completed" | "failed";

export type ExecutionEvent = {
  type: ExecutionEventType;
  executionId: string;
  task?: Task;
  error?: string;
};

export type ExecutionResult = {
  id: string;
};

export type ResumeExecutionsResult = {
  resumed: number;
  skipped: number;
  failed: number;
  ids: string[];
};

export interface RuntimeDagService {
  startExecution(workflowName: string, params: Record<string, any>): AsyncIterable<ExecutionEvent>;
  createExecution(workflowName: string, params: Record<string, any>): Promise<ExecutionResult>;
  resumeActiveExecutions(limit?: number): Promise<ResumeExecutionsResult>;
  listWorkflows(): Promise<{ names: string[] }>;
}
