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

export type ExecutionResult = {
  id: string;
}

export type ResumeExecutionsResult = {
  resumed: number;
  skipped: number;
  failed: number;
  ids: string[];
}

export type ResumableExecution = {
  id: string;
  workflowName: string;
  params: Record<string, any>;
}

export type CachedNodeResult = {
  hit: boolean;
  result?: any;
}

export type TaskTicket = {
  id: number;
  createdAt: number;
}

export interface DagService {
  openExecution(id: string, workflowName: string, params: Record<string, any>): Promise<void>;
  setExecutionStatus(id: string, status: ExecutionStatus): Promise<void>;
  listResumableExecutions(limit?: number): Promise<{ items: ResumableExecution[] }>;

  getCachedNodeResult(executionId: string, nodeId: string): Promise<CachedNodeResult>;
  createTask(executionId: string, nodeId: string): Promise<TaskTicket>;
  setTaskProcessing(taskId: number, startedAt: number): Promise<void>;
  setTaskDone(taskId: number, executionId: string, nodeId: string, completedAt: number, result: any): Promise<void>;
  setTaskFailed(taskId: number, completedAt: number, errorMessage: string): Promise<void>;

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

  listVars(): Promise<{ items: { key: string; value: any }[] }>;
  setVar(key: string, value: any): Promise<void>;
  deleteVar(key: string): Promise<void>;
}
