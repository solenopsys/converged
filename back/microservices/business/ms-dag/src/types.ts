export type DagProcessStatus = "running" | "done" | "failed";
export type DagNodeState = "queued" | "processing" | "done" | "failed";

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
}

export interface DagProcess {
  id: string;
  workflowId?: string;
  status: DagProcessStatus;
  startedAt?: number;
  updatedAt?: number;
  createdAt?: number;
  meta?: any;
}

export interface DagNodeExecution {
  id: number;
  processId: string;
  nodeId: string;
  state: DagNodeState;
  startedAt?: number;
  completedAt?: number;
  errorMessage?: string;
  retryCount: number;
  createdAt?: number;
  updatedAt?: number;
  recordId?: string;
}

export interface DagProcessListParams {
  offset?: number;
  limit?: number;
  workflowId?: string;
  status?: DagProcessStatus;
  createdFrom?: number;
  createdTo?: number;
}

export interface DagNodeListParams {
  offset?: number;
  limit?: number;
  processId?: string;
  nodeId?: string;
  state?: DagNodeState;
  createdFrom?: number;
  createdTo?: number;
}

export type DagProcessStatsParams = Pick<DagProcessListParams, "workflowId" | "status" | "createdFrom" | "createdTo">;
export type DagNodeStatsParams = Pick<DagNodeListParams, "processId" | "nodeId" | "state" | "createdFrom" | "createdTo">;

export interface DagProcessStats {
  total: number;
  running: number;
  done: number;
  failed: number;
}

export interface DagNodeStats {
  total: number;
  queued: number;
  processing: number;
  done: number;
  failed: number;
}
