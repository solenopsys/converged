export type ContextStatus = "running" | "done" | "failed";
export type MessageStatus = "queued" | "processing" | "done" | "failed";

export interface PaginationParams {
  offset: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount?: number;
}

export interface DagService {
  status(): Promise<{
    status: string;
    workflows: string[];
    nodes: string[];
    providers: string[];
  }>;

  createContext(
    workflowName: string,
    params: Record<string, any>,
  ): Promise<{ contextId: string }>;

  emit(contextId: string, event: string): Promise<void>;

  getContext(contextId: string): Promise<{
    status: ContextStatus;
    params: Record<string, any>;
    data: Record<string, any>;
    messages: { event: string; status: MessageStatus }[];
  }>;

  listContexts(params: PaginationParams): Promise<PaginatedResult<ContextInfo>>;

  getStats(workflowName?: string): Promise<{
    total: number;
    running: number;
    done: number;
    failed: number;
  }>;

  getNodeProcessorStats(): Promise<{
    totalCalls: number;
    byNode: Record<
      string,
      { calls: number; avgDuration: number; errors: number }
    >;
  }>;

  listNodes(params: PaginationParams): Promise<PaginatedResult<NodeExecution>>;
}

export type ContextInfo = {
  id: string;
  workflowName: string;
  status: ContextStatus;
  startedAt: string;
  updatedAt: string;
};

export type NodeState = "queued" | "processing" | "done" | "failed";

export type NodeExecution = {
  id: number;
  processId: string;
  nodeId: string;
  state: NodeState;
  startedAt: string;
  completedAt: string;
  errorMessage: string;
  retryCount: number;
  createdAt: string;
};
