import { beforeEach, describe, expect, mock, test } from "bun:test";

type ProcessRow = {
  id: string;
  workflow_id: string | null;
  workflowId?: string;
  status: "running" | "done" | "failed";
  started_at: number;
  updated_at: number;
  created_at: number;
};

type NodeRow = {
  id: number;
  processId: string;
  nodeId: string;
  state: "queued" | "processing" | "done" | "failed";
  startedAt: number | null;
  completedAt: number | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: number;
  updatedAt: number;
  recordId?: string;
};

class FakeProcessingStoreService {
  private readonly steps = new Map<string, string>();
  private readonly records = new Map<string, { data: any; result: any }>();
  private readonly contexts = new Map<string, { createdAt: string; meta?: any }>();
  private readonly vars = new Map<string, any>();

  getStep(workflowId: string, nodeName: string): string | undefined {
    return this.steps.get(`${workflowId}:${nodeName}`);
  }

  setStep(workflowId: string, nodeName: string, nodeRecordId: string): void {
    this.steps.set(`${workflowId}:${nodeName}`, nodeRecordId);
  }

  setRecord(recordId: string, value: { data: any; result: any }): void {
    this.records.set(recordId, value);
  }

  getRecord(recordId: string): { data: any; result: any } | undefined {
    return this.records.get(recordId);
  }

  saveExecutionContext(workflowId: string, executionId: string, meta?: any): string {
    const key = `${workflowId}:${executionId}`;
    this.contexts.set(key, { createdAt: new Date().toISOString(), meta });
    return key;
  }

  getExecutionContext(workflowId: string, executionId: string): { createdAt: string; meta?: any } | undefined {
    return this.contexts.get(`${workflowId}:${executionId}`);
  }

  setStatus(workflowId: string, status: string): void {
    this.vars.set(`__status__:${workflowId}`, status);
  }

  set(key: string, value: any): void {
    this.vars.set(key, value);
  }

  delete(key: string): void {
    this.vars.delete(key);
  }

  listVars(): { key: string; value: any }[] {
    return Array.from(this.vars.entries())
      .filter(([key]) => !key.startsWith("__status__:"))
      .map(([key, value]) => ({ key, value }));
  }
}

class FakeStatsStoreService {
  private readonly processes = new Map<string, ProcessRow>();
  private readonly nodes: NodeRow[] = [];
  private nextNodeId = 1;

  async ensureProcess(input: { id: string; workflowId?: string | null; status?: ProcessRow["status"] }): Promise<ProcessRow> {
    const existing = this.processes.get(input.id);
    if (existing) {
      return existing;
    }

    const now = Date.now();
    const row: ProcessRow = {
      id: input.id,
      workflow_id: input.workflowId ?? null,
      workflowId: input.workflowId ?? undefined,
      status: input.status ?? "running",
      started_at: now,
      updated_at: now,
      created_at: now,
    };
    this.processes.set(input.id, row);
    return row;
  }

  async updateProcess(id: string, patch: any): Promise<ProcessRow | undefined> {
    const existing = this.processes.get(id);
    if (!existing) {
      return undefined;
    }
    if (patch.status !== undefined) {
      existing.status = patch.status;
    }
    if (patch.workflowId !== undefined) {
      existing.workflow_id = patch.workflowId;
      existing.workflowId = patch.workflowId ?? undefined;
    }
    if (patch.updated_at !== undefined) {
      existing.updated_at = patch.updated_at;
    }
    return existing;
  }

  async getProcess(id: string): Promise<ProcessRow | undefined> {
    return this.processes.get(id);
  }

  async createNode(input: any): Promise<{ id: number; created_at: number }> {
    const now = Date.now();
    const row: NodeRow = {
      id: this.nextNodeId++,
      processId: input.processId,
      nodeId: input.nodeId,
      state: input.state ?? "queued",
      startedAt: input.startedAt ?? null,
      completedAt: input.completedAt ?? null,
      errorMessage: input.errorMessage ?? null,
      retryCount: input.retryCount ?? 0,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
      recordId: input.recordId,
    };
    this.nodes.push(row);
    return { id: row.id, created_at: row.createdAt };
  }

  async updateNode(id: number, patch: any): Promise<NodeRow | undefined> {
    const row = this.nodes.find((node) => node.id === id);
    if (!row) {
      return undefined;
    }
    if (patch.state !== undefined) row.state = patch.state;
    if (patch.started_at !== undefined) row.startedAt = patch.started_at;
    if (patch.completed_at !== undefined) row.completedAt = patch.completed_at;
    if (patch.error_message !== undefined) row.errorMessage = patch.error_message;
    if (patch.retry_count !== undefined) row.retryCount = patch.retry_count;
    if (patch.updated_at !== undefined) row.updatedAt = patch.updated_at;
    if (patch.record_id !== undefined) row.recordId = patch.record_id;
    return row;
  }

  async listProcesses(params: any): Promise<{ items: any[]; totalCount: number }> {
    const offset = params?.offset ?? 0;
    const limit = params?.limit ?? 50;
    const status = params?.status;

    let rows = Array.from(this.processes.values());
    if (status) {
      rows = rows.filter((row) => row.status === status);
    }

    rows.sort((a, b) => b.created_at - a.created_at);
    const paged = limit === 0 ? [] : rows.slice(offset, offset + limit);

    return {
      items: paged.map((row) => ({
        id: row.id,
        workflowId: row.workflow_id ?? undefined,
        status: row.status,
        startedAt: row.started_at,
        updatedAt: row.updated_at,
        createdAt: row.created_at,
      })),
      totalCount: rows.length,
    };
  }

  async listNodes(params: any): Promise<{ items: any[]; totalCount: number }> {
    const offset = params?.offset ?? 0;
    const limit = params?.limit ?? 50;
    const processId = params?.processId;

    let rows = this.nodes.slice();
    if (processId) {
      rows = rows.filter((row) => row.processId === processId);
    }
    rows.sort((a, b) => b.createdAt - a.createdAt);

    const paged = limit === 0 ? [] : rows.slice(offset, offset + limit);
    return {
      items: paged.map((row) => ({ ...row })),
      totalCount: rows.length,
    };
  }

  async getProcessStats() {
    const rows = Array.from(this.processes.values());
    return {
      total: rows.length,
      running: rows.filter((row) => row.status === "running").length,
      done: rows.filter((row) => row.status === "done").length,
      failed: rows.filter((row) => row.status === "failed").length,
    };
  }

  async getNodeStats() {
    const rows = this.nodes;
    return {
      total: rows.length,
      queued: rows.filter((row) => row.state === "queued").length,
      processing: rows.filter((row) => row.state === "processing").length,
      done: rows.filter((row) => row.state === "done").length,
      failed: rows.filter((row) => row.state === "failed").length,
    };
  }

  async getProcessDailyStats() {
    return [];
  }

  async getProcessTypeStats() {
    return {};
  }

  async getNodeDailyStats() {
    return [];
  }
}

let latestStores: FakeStoresController | null = null;

class FakeStoresController {
  public processingStoreService = new FakeProcessingStoreService();
  public statsStoreService = new FakeStatsStoreService();

  constructor(_msName: string) {
    latestStores = this;
  }

  async init(): Promise<void> {}
}

mock.module("./store", () => ({
  StoresController: FakeStoresController,
}));

import DagServiceImpl from "./service";

function createService(): DagServiceImpl {
  latestStores = null;
  return new DagServiceImpl({});
}

describe("DagServiceImpl storage API with mocked stores", () => {
  beforeEach(() => {
    latestStores = null;
  });

  test("should persist node result and expose it through statusExecution/getCachedNodeResult", async () => {
    const service = createService();
    const executionId = "exec-1";

    await service.openExecution(executionId, "wf.mock", { value: 42 });
    const ticket = await service.createTask(executionId, "node.mock");
    await service.setTaskProcessing(ticket.id, 1000);
    await service.setTaskDone(ticket.id, executionId, "node.mock", 2000, { value: 42 });
    await service.setExecutionStatus(executionId, "done");

    const cached = await service.getCachedNodeResult(executionId, "node.mock");
    expect(cached).toEqual({ hit: true, result: { value: 42 } });

    const status = await service.statusExecution(executionId);
    expect(status.execution.status).toBe("done");
    expect(status.tasks.length).toBe(1);
    expect(status.tasks[0].result).toEqual({ value: 42 });
  });

  test("should list resumable executions only when params are present in execution context", async () => {
    const service = createService();
    await service.openExecution("exec-r1", "wf.resume", { x: 1 });
    await service.openExecution("exec-r2", "wf.resume", {} as any);
    await latestStores!.statsStoreService.updateProcess("exec-r2", { workflowId: null, status: "running" });

    const resumable = await service.listResumableExecutions(20);
    expect(resumable.items).toEqual([
      { id: "exec-r1", workflowName: "wf.resume", params: { x: 1 } },
    ]);
  });
});
