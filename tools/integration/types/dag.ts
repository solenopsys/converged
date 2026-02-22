export type ExecutionStatus = "running" | "done" | "failed";
export type TaskState = "queued" | "processing" | "done" | "failed";

export interface PaginationParams {
  offset: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount?: number;
}

export interface Execution {
  id: string;
  workflowName: string;
  status: ExecutionStatus;
  startedAt: number;
  updatedAt: number;
  createdAt: number;
}

export interface Task {
  id: number;
  executionId: string;
  nodeId: string;
  state: TaskState;
  startedAt: number | null;
  completedAt: number | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: number;
}

export interface DagService {
  createExecution(
    workflowName: string,
    params: Record<string, any>,
  ): Promise<{ id: string }>;

  statusExecution(id: string): Promise<{
    execution: Execution;
    tasks: Task[];
  }>;

  listExecutions(params: PaginationParams): Promise<PaginatedResult<Execution>>;

  listTasks(executionId: string, params: PaginationParams): Promise<PaginatedResult<Task>>;

  stats(): Promise<{
    executions: { total: number; running: number; done: number; failed: number };
    tasks: { total: number; queued: number; processing: number; done: number; failed: number };
  }>;

  listWorkflows(): Promise<{ names: string[] }>;
}
