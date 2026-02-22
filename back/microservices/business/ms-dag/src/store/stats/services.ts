import { SqlStore, sql } from "back-core";
import {
  ProcessRepository,
  NodeRepository,
  type ProcessEntity,
  type NodeEntity,
} from "./entities";
import type {
  DagProcess,
  DagNodeExecution,
  DagProcessListParams,
  DagNodeListParams,
  DagProcessStatsParams,
  DagNodeStatsParams,
  DagProcessStats,
  DagNodeStats,
  DagProcessStatus,
  DagNodeState,
  PaginatedResult,
} from "../../types";

export type ProcessStatus = DagProcessStatus;
export type NodeState = DagNodeState;

type ProcessInput = {
  id: string;
  workflowId?: string | null;
  status?: ProcessStatus;
  startedAt?: number;
  updatedAt?: number;
  createdAt?: number;
  meta?: any;
};

type ProcessPatch = Partial<Omit<ProcessEntity, "meta" | "workflow_id">> & {
  workflowId?: string | null;
  meta?: any;
};

type NodeInput = {
  processId: string;
  nodeId: string;
  state?: NodeState;
  startedAt?: number | null;
  completedAt?: number | null;
  errorMessage?: string | null;
  retryCount?: number;
  createdAt?: number | null;
  updatedAt?: number | null;
};

type NodePatch = Partial<Omit<NodeEntity, "error_message">> & {
  errorMessage?: string | null;
};

export class StatsStoreService {
  public readonly processRepo: ProcessRepository;
  public readonly nodeRepo: NodeRepository;

  constructor(private store: SqlStore) {
    this.processRepo = new ProcessRepository(store, "process", {
      primaryKey: "id",
      extractKey: (process) => ({ id: process.id }),
      buildWhereCondition: (key) => ({ id: key.id }),
    });

    this.nodeRepo = new NodeRepository(store, "nodes", {
      primaryKey: "id",
      extractKey: (node) => ({ id: node.id }),
      buildWhereCondition: (key) => ({ id: key.id }),
    });
  }

  async ensureProcess(input: ProcessInput): Promise<ProcessEntity> {
    const existing = await this.processRepo.findById({ id: input.id });
    if (existing) {
      return existing;
    }

    const now = Date.now();
    return this.processRepo.create({
      id: input.id,
      workflow_id: input.workflowId ?? null,
      status: input.status ?? "running",
      started_at: input.startedAt ?? now,
      updated_at: input.updatedAt ?? now,
      created_at: input.createdAt ?? now,
      meta: this.serializeMeta(input.meta),
    });
  }

  async getProcess(id: string): Promise<ProcessEntity | undefined> {
    return this.processRepo.findById({ id });
  }

  async updateProcess(id: string, patch: ProcessPatch): Promise<ProcessEntity | undefined> {
    const next: Partial<ProcessEntity> = {
      ...(patch as Partial<ProcessEntity>),
    };
    if (patch.workflowId !== undefined) {
      next.workflow_id = patch.workflowId;
    }
    if ("meta" in patch) {
      next.meta = this.serializeMeta(patch.meta);
    }
    return this.processRepo.update({ id }, next);
  }

  async createNode(input: NodeInput): Promise<NodeEntity> {
    const now = Date.now();
    return this.nodeRepo.create({
      process_id: input.processId,
      node_id: input.nodeId,
      state: input.state ?? "queued",
      started_at: input.startedAt ?? null,
      completed_at: input.completedAt ?? null,
      error_message: input.errorMessage ?? null,
      retry_count: input.retryCount ?? 0,
      created_at: input.createdAt ?? now,
      updated_at: input.updatedAt ?? now,
    });
  }

  async updateNode(id: number, patch: NodePatch): Promise<NodeEntity | undefined> {
    const { errorMessage, ...rest } = patch as any;
    const next: Partial<NodeEntity> = { ...rest };
    if (errorMessage !== undefined) {
      next.error_message = errorMessage;
    }
    return this.nodeRepo.update({ id }, next);
  }

  async listProcesses(params: DagProcessListParams): Promise<PaginatedResult<DagProcess>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let query = this.store.db
      .selectFrom("process")
      .selectAll()
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset);

    query = this.applyProcessFilters(query, params);

    const items = (await query.execute()) as ProcessEntity[];

    let countQuery = this.store.db
      .selectFrom("process")
      .select(({ fn }) => fn.countAll().as("count"));
    countQuery = this.applyProcessFilters(countQuery, params);

    const countResult = await countQuery.executeTakeFirst();
    const totalCount = Number((countResult as any)?.count ?? 0);

    return {
      items: items.map((row) => this.mapProcess(row)),
      totalCount,
    };
  }

  async listNodes(params: DagNodeListParams): Promise<PaginatedResult<DagNodeExecution>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let query = this.store.db
      .selectFrom("nodes")
      .selectAll()
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset);

    query = this.applyNodeFilters(query, params);

    const items = (await query.execute()) as NodeEntity[];

    let countQuery = this.store.db
      .selectFrom("nodes")
      .select(({ fn }) => fn.countAll().as("count"));
    countQuery = this.applyNodeFilters(countQuery, params);

    const countResult = await countQuery.executeTakeFirst();
    const totalCount = Number((countResult as any)?.count ?? 0);

    return {
      items: items.map((row) => this.mapNode(row)),
      totalCount,
    };
  }

  async getProcessStats(params: DagProcessStatsParams = {}): Promise<DagProcessStats> {
    let query = this.store.db.selectFrom("process").select([
      sql<number>`count(*)`.as("total"),
      sql<number>`sum(case when status = 'running' then 1 else 0 end)`.as("running"),
      sql<number>`sum(case when status = 'done' then 1 else 0 end)`.as("done"),
      sql<number>`sum(case when status = 'failed' then 1 else 0 end)`.as("failed"),
    ]);

    query = this.applyProcessFilters(query, params);

    const row = await query.executeTakeFirst();
    const result: any = row ?? {};

    return {
      total: Number(result.total ?? 0),
      running: Number(result.running ?? 0),
      done: Number(result.done ?? 0),
      failed: Number(result.failed ?? 0),
    };
  }

  async getNodeStats(params: DagNodeStatsParams = {}): Promise<DagNodeStats> {
    let query = this.store.db.selectFrom("nodes").select([
      sql<number>`count(*)`.as("total"),
      sql<number>`sum(case when state = 'queued' then 1 else 0 end)`.as("queued"),
      sql<number>`sum(case when state = 'processing' then 1 else 0 end)`.as(
        "processing",
      ),
      sql<number>`sum(case when state = 'done' then 1 else 0 end)`.as("done"),
      sql<number>`sum(case when state = 'failed' then 1 else 0 end)`.as("failed"),
    ]);

    query = this.applyNodeFilters(query, params);

    const row = await query.executeTakeFirst();
    const result: any = row ?? {};

    return {
      total: Number(result.total ?? 0),
      queued: Number(result.queued ?? 0),
      processing: Number(result.processing ?? 0),
      done: Number(result.done ?? 0),
      failed: Number(result.failed ?? 0),
    };
  }

  private applyProcessFilters(query: any, params: DagProcessStatsParams) {
    let next = query;
    if (params.workflowId) {
      next = next.where("workflow_id", "=", params.workflowId);
    }
    if (params.status) {
      next = next.where("status", "=", params.status);
    }
    if (params.createdFrom !== undefined) {
      next = next.where("created_at", ">=", params.createdFrom);
    }
    if (params.createdTo !== undefined) {
      next = next.where("created_at", "<=", params.createdTo);
    }
    return next;
  }

  private applyNodeFilters(query: any, params: DagNodeStatsParams) {
    let next = query;
    if (params.processId) {
      next = next.where("process_id", "=", params.processId);
    }
    if (params.nodeId) {
      next = next.where("node_id", "=", params.nodeId);
    }
    if (params.state) {
      next = next.where("state", "=", params.state);
    }
    if (params.createdFrom !== undefined) {
      next = next.where("created_at", ">=", params.createdFrom);
    }
    if (params.createdTo !== undefined) {
      next = next.where("created_at", "<=", params.createdTo);
    }
    return next;
  }

  private mapProcess(row: ProcessEntity): DagProcess {
    return {
      id: row.id,
      workflowId: row.workflow_id ?? undefined,
      status: row.status as DagProcessStatus,
      startedAt: row.started_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
      createdAt: row.created_at ?? undefined,
      meta: this.deserializeMeta(row.meta),
    };
  }

  private mapNode(row: NodeEntity): DagNodeExecution {
    return {
      id: row.id,
      processId: row.process_id,
      nodeId: row.node_id,
      state: row.state as DagNodeState,
      startedAt: row.started_at ?? undefined,
      completedAt: row.completed_at ?? undefined,
      errorMessage: row.error_message ?? undefined,
      retryCount: row.retry_count ?? 0,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
    };
  }

  private serializeMeta(meta: any): string | null {
    if (meta === undefined) return null;
    if (meta === null) return null;
    if (typeof meta === "string") return meta;
    try {
      return JSON.stringify(meta);
    } catch {
      return String(meta);
    }
  }

  private deserializeMeta(meta: string | null): any {
    if (!meta) return undefined;
    try {
      return JSON.parse(meta);
    } catch {
      return meta;
    }
  }
}
