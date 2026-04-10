export type ExecutionStatus = "running" | "done" | "failed";
export type TaskState = "queued" | "processing" | "done" | "failed";

export type PaginationParams = {
  offset: number;
  limit: number;
}

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
}

export type Execution = {
  id: string;
  workflowName: string;
  status: ExecutionStatus;
  startedAt: number;
  updatedAt: number;
  createdAt: number;
}

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
}

export type ExecutionEventType = "started" | "task_update" | "completed" | "failed";

export type ExecutionEvent = {
  type: ExecutionEventType;
  executionId: string;
  task?: Task;
  error?: string;
}

export interface DagService {
  statusExecution(id: string): Promise<{
    execution: Execution;
    tasks: Task[];
  }>;

  listExecutions(params: PaginationParams): Promise<PaginatedResult<Execution>>;

  listTasks(executionId: string | null, params: PaginationParams): Promise<PaginatedResult<Task>>;

  stats(): Promise<{
    executions: { total: number; running: number; done: number; failed: number };
    tasks: { total: number; queued: number; processing: number; done: number; failed: number };
  }>;

  listWorkflows(): Promise<{ names: string[] }>;

  listVars(): Promise<{ items: { key: string; value: any }[] }>;
  setVar(key: string, value: any): Promise<void>;
  deleteVar(key: string): Promise<void>;
}
