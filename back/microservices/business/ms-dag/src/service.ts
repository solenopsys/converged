import type { DagService, Execution, Task, PaginationParams, PaginatedResult, ExecutionEvent } from "g-dag";
import { StoresController } from "./store";

export default class DagServiceImpl implements DagService {
  private stores: StoresController;
  private readonly storesReady: Promise<void>;
  private workflows: string[];
  private workflowCtors: Map<string, new (ctx: any, id?: string) => any>;

  constructor(config?: any) {
    this.stores = new StoresController("ms-dag");
    this.storesReady = this.stores.init().catch((e) => {
      console.error("[ms-dag] store init error", e);
      throw e;
    });
    const wf = config?.workflows ?? {};
    const list: any[] = wf.WORKFLOWS ?? [];
    this.workflows = list.map((w: any) => w.name ?? w).filter(Boolean);
    this.workflowCtors = new Map(
      list
        .filter((w: any) => w.name && w.ctor)
        .map((w: any) => [w.name, w.ctor]),
    );
  }

  private async ensureStoresReady(): Promise<void> {
    await this.storesReady;
  }

  async *startExecution(workflowName: string, params: Record<string, any>): AsyncIterable<ExecutionEvent> {
    await this.ensureStoresReady();
    const id = crypto.randomUUID();
    const stats = this.stores.statsStoreService;
    const kv = this.stores.processingStoreService;

    await stats.ensureProcess({ id, workflowId: workflowName, status: "running" });
    yield { type: "started", executionId: id };

    const Ctor = this.workflowCtors.get(workflowName);
    if (!Ctor) {
      await stats.updateProcess(id, { status: "failed" });
      yield { type: "failed", executionId: id, error: `Workflow "${workflowName}" not found` };
      return;
    }

    const events: ExecutionEvent[] = [];
    let resolve: (() => void) | null = null;
    let done = false;
    const push = (e: ExecutionEvent) => { events.push(e); resolve?.(); resolve = null; };

    const ctx = {
      runNode: async (workflowId: string, nodeName: string, fn: () => Promise<any>) => {
        // Идемпотентность: уже выполнялось — достаём result из KVS
        const cachedRecordId = kv.getStep(workflowId, nodeName);
        if (cachedRecordId !== undefined) {
          return kv.getRecord(cachedRecordId)?.result;
        }

        const nodeRow = await stats.createNode({ processId: id, nodeId: nodeName, state: "queued", startedAt: null });
        push({ type: "task_update", executionId: id, task: { id: nodeRow.id, executionId: id, nodeId: nodeName, state: "queued", startedAt: null, completedAt: null, errorMessage: null, retryCount: 0, createdAt: Date.now() } });

        const startedAt = Date.now();
        await stats.updateNode(nodeRow.id, { state: "processing", started_at: startedAt } as any);
        push({ type: "task_update", executionId: id, task: { id: nodeRow.id, executionId: id, nodeId: nodeName, state: "processing", startedAt, completedAt: null, errorMessage: null, retryCount: 0, createdAt: Date.now() } });

        try {
          const result = await fn();
          const completedAt = Date.now();
          const recordId = `${workflowId}:${nodeName}`;
          kv.setRecord(recordId, { data: null, result });
          kv.setStep(workflowId, nodeName, recordId);
          await stats.updateNode(nodeRow.id, { state: "done", completed_at: completedAt, record_id: recordId } as any);
          push({ type: "task_update", executionId: id, task: { id: nodeRow.id, executionId: id, nodeId: nodeName, state: "done", startedAt, completedAt, errorMessage: null, retryCount: 0, createdAt: Date.now(), result } });
          return result;
        } catch (e: any) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          const completedAt = Date.now();
          await stats.updateNode(nodeRow.id, { state: "failed", error_message: errorMsg, completed_at: completedAt } as any);
          push({ type: "task_update", executionId: id, task: { id: nodeRow.id, executionId: id, nodeId: nodeName, state: "failed", startedAt, completedAt, errorMessage: errorMsg, retryCount: 0, createdAt: Date.now() } });
          throw e;
        }
      },

      setStatus: (wfId: string, status: string) => {
        kv.setStatus(wfId, status);
      },

      getVar: (key: string) => kv.get(key),
      setVar: (key: string, value: any) => kv.set(key, value),
    };

    const wf = new Ctor(ctx, id);

    wf.start(params)
      .then(async () => {
        await stats.updateProcess(id, { status: "done" });
        push({ type: "completed", executionId: id });
      })
      .catch(async (e: any) => {
        await stats.updateProcess(id, { status: "failed" });
        push({ type: "failed", executionId: id, error: e?.message ?? String(e) });
      })
      .finally(() => { done = true; resolve?.(); resolve = null; });

    while (true) {
      while (events.length > 0) {
        const e = events.shift()!;
        yield e;
        if (e.type === "completed" || e.type === "failed") return;
      }
      if (done) break;
      await new Promise<void>((r) => { resolve = r; });
    }
    for (const e of events) yield e;
  }

  async createExecution(workflowName: string, params: Record<string, any>): Promise<{ id: string }> {
    await this.ensureStoresReady();
    const id = crypto.randomUUID();
    await this.stores.statsStoreService.ensureProcess({ id, workflowId: workflowName, status: "running" });
    return { id };
  }

  async statusExecution(id: string): Promise<{ execution: Execution; tasks: Task[] }> {
    await this.ensureStoresReady();
    const p = await this.stores.statsStoreService.getProcess(id);
    if (!p) throw Object.assign(new Error("Execution not found"), { statusCode: 404 });

    const kv = this.stores.processingStoreService;
    const tasksResult = await this.stores.statsStoreService.listNodes({ offset: 0, limit: 100, processId: id } as any);

    return {
      execution: {
        id: p.id,
        workflowName: (p as any).workflow_id ?? (p as any).workflowId ?? "",
        status: p.status as any,
        startedAt: (p as any).started_at ?? (p as any).startedAt ?? 0,
        updatedAt: (p as any).updated_at ?? (p as any).updatedAt ?? 0,
        createdAt: (p as any).created_at ?? (p as any).createdAt ?? 0,
      },
      tasks: tasksResult.items.map((t) => {
        const record = t.recordId ? kv.getRecord(t.recordId) : undefined;
        return {
          id: t.id,
          executionId: t.processId,
          nodeId: t.nodeId,
          state: t.state as any,
          startedAt: t.startedAt ?? null,
          completedAt: t.completedAt ?? null,
          errorMessage: t.errorMessage ?? null,
          retryCount: t.retryCount,
          createdAt: t.createdAt ?? 0,
          data: record?.data,
          result: record?.result,
        };
      }),
    };
  }

  async listExecutions(params: PaginationParams): Promise<PaginatedResult<Execution>> {
    await this.ensureStoresReady();
    const result = await this.stores.statsStoreService.listProcesses(params as any);
    return {
      items: result.items.map((p) => ({
        id: p.id,
        workflowName: p.workflowId ?? "",
        status: p.status as any,
        startedAt: p.startedAt ?? 0,
        updatedAt: p.updatedAt ?? 0,
        createdAt: p.createdAt ?? 0,
      })),
      totalCount: result.totalCount,
    };
  }

  async listTasks(executionId: string | null, params: PaginationParams): Promise<PaginatedResult<Task>> {
    await this.ensureStoresReady();
    const filter = executionId ? { ...params, processId: executionId } : params;
    const result = await this.stores.statsStoreService.listNodes(filter as any);
    const kv = this.stores.processingStoreService;
    return {
      items: result.items.map((t) => {
        const record = t.recordId ? kv.getRecord(t.recordId) : undefined;
        return {
          id: t.id,
          executionId: t.processId,
          nodeId: t.nodeId,
          state: t.state as any,
          startedAt: t.startedAt ?? null,
          completedAt: t.completedAt ?? null,
          errorMessage: t.errorMessage ?? null,
          retryCount: t.retryCount,
          createdAt: t.createdAt ?? 0,
          data: record?.data,
          result: record?.result,
        };
      }),
      totalCount: result.totalCount,
    };
  }

  async stats() {
    await this.ensureStoresReady();
    const [executions, tasks] = await Promise.all([
      this.stores.statsStoreService.getProcessStats(),
      this.stores.statsStoreService.getNodeStats(),
    ]);
    return { executions, tasks };
  }

  async listWorkflows(): Promise<{ names: string[] }> {
    await this.ensureStoresReady();
    return { names: this.workflows };
  }

  async listVars(): Promise<{ items: { key: string; value: any }[] }> {
    await this.ensureStoresReady();
    const items = this.stores.processingStoreService.listVars();
    return { items };
  }

  async setVar(key: string, value: any): Promise<void> {
    await this.ensureStoresReady();
    this.stores.processingStoreService.set(key, value);
  }

  async deleteVar(key: string): Promise<void> {
    await this.ensureStoresReady();
    this.stores.processingStoreService.delete(key);
  }
}
