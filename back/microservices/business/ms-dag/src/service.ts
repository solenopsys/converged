import type { DagService, Execution, Task, PaginationParams, PaginatedResult, ExecutionEvent } from "g-dag";
import { StoresController } from "./store";
import { NodeProcessor } from "./node-processor";

export default class DagServiceImpl implements DagService {
  private stores: StoresController;
  private nodeProcessor: NodeProcessor;
  private workflows: string[];
  private workflowCtors: Map<string, new (ctx: any, id?: string) => any>;

  constructor(config?: any) {
    this.stores = new StoresController("ms-dag");
    this.stores.init().catch((e) => console.error("[ms-dag] store init error", e));
    this.nodeProcessor = new NodeProcessor();
    this.nodeProcessor.resetStale();
    const wf = config?.workflows ?? {};
    const list: any[] = wf.WORKFLOWS ?? [];
    this.workflows = list.map((w: any) => w.name ?? w).filter(Boolean);
    this.workflowCtors = new Map(
      list
        .filter((w: any) => w.name && w.ctor)
        .map((w: any) => [w.name, w.ctor]),
    );
  }

  async *startExecution(workflowName: string, params: Record<string, any>): AsyncIterable<ExecutionEvent> {
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
        // Идемпотентность: уже выполнялось — достаём результат из NodeProcessor
        const cachedRecordId = kv.getStep(workflowId, nodeName);
        if (cachedRecordId !== undefined) {
          return this.nodeProcessor.getRecord(cachedRecordId)?.result;
        }

        const nodeRow = await stats.createNode({ processId: id, nodeId: nodeName, state: "queued", startedAt: null });
        push({ type: "task_update", executionId: id, task: { id: nodeRow.id, executionId: id, nodeId: nodeName, state: "queued", startedAt: null, completedAt: null, errorMessage: null, retryCount: 0, createdAt: Date.now() } });

        const startedAt = Date.now();
        await stats.updateNode(nodeRow.id, { state: "processing", started_at: startedAt } as any);
        push({ type: "task_update", executionId: id, task: { id: nodeRow.id, executionId: id, nodeId: nodeName, state: "processing", startedAt, completedAt: null, errorMessage: null, retryCount: 0, createdAt: Date.now() } });

        const event = await this.nodeProcessor.exec(`${workflowName}:${nodeName}`, fn);

        if (event.type === "done") {
          const completedAt = Date.now();
          await stats.updateNode(nodeRow.id, { state: "done", completed_at: completedAt } as any);
          push({ type: "task_update", executionId: id, task: { id: nodeRow.id, executionId: id, nodeId: nodeName, state: "done", startedAt, completedAt, errorMessage: null, retryCount: 0, createdAt: Date.now() } });
          kv.setStep(workflowId, nodeName, event.id);
          return event.result;
        } else {
          const completedAt = Date.now();
          await stats.updateNode(nodeRow.id, { state: "failed", error_message: event.error, completed_at: completedAt } as any);
          push({ type: "task_update", executionId: id, task: { id: nodeRow.id, executionId: id, nodeId: nodeName, state: "failed", startedAt, completedAt, errorMessage: event.error, retryCount: 0, createdAt: Date.now() } });
          throw new Error(event.error);
        }
      },

      setStatus: (wfId: string, status: string) => {
        kv.setStatus(wfId, status);
      },
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
    const id = crypto.randomUUID();
    await this.stores.statsStoreService.ensureProcess({ id, workflowId: workflowName, status: "running" });
    return { id };
  }

  async statusExecution(id: string): Promise<{ execution: Execution; tasks: Task[] }> {
    const p = await this.stores.statsStoreService.getProcess(id);
    if (!p) throw Object.assign(new Error("Execution not found"), { statusCode: 404 });

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
      tasks: tasksResult.items.map((t) => ({
        id: t.id,
        executionId: t.processId,
        nodeId: t.nodeId,
        state: t.state as any,
        startedAt: t.startedAt ?? null,
        completedAt: t.completedAt ?? null,
        errorMessage: t.errorMessage ?? null,
        retryCount: t.retryCount,
        createdAt: t.createdAt ?? 0,
      })),
    };
  }

  async listExecutions(params: PaginationParams): Promise<PaginatedResult<Execution>> {
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
    const filter = executionId ? { ...params, processId: executionId } : params;
    const result = await this.stores.statsStoreService.listNodes(filter as any);
    return {
      items: result.items.map((t) => ({
        id: t.id,
        executionId: t.processId,
        nodeId: t.nodeId,
        state: t.state as any,
        startedAt: t.startedAt ?? null,
        completedAt: t.completedAt ?? null,
        errorMessage: t.errorMessage ?? null,
        retryCount: t.retryCount,
        createdAt: t.createdAt ?? 0,
      })),
      totalCount: result.totalCount,
    };
  }

  async stats() {
    const [executions, tasks] = await Promise.all([
      this.stores.statsStoreService.getProcessStats(),
      this.stores.statsStoreService.getNodeStats(),
    ]);
    return { executions, tasks };
  }

  async listWorkflows(): Promise<{ names: string[] }> {
    return { names: this.workflows };
  }
}
