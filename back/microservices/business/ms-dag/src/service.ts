import type { DagService, Execution, Task, PaginationParams, PaginatedResult } from "g-dag";
import { StoresController } from "./store";

export default class DagServiceImpl implements DagService {
  private stores: StoresController;
  private workflows: string[];

  constructor(config?: any) {
    this.stores = new StoresController("ms-dag");
    this.stores.init().catch((e) => console.error("[ms-dag] store init error", e));
    const wf = config?.workflows ?? {};
    this.workflows = (wf.WORKFLOWS ?? []).map((w: any) => w.name ?? w).filter(Boolean);
  }

  async createExecution(workflowName: string, params: Record<string, any>): Promise<{ id: string }> {
    const id = crypto.randomUUID();
    await this.stores.statsStoreService.ensureProcess({
      id,
      workflowId: workflowName,
      status: "running",
    });
    return { id };
  }

  async statusExecution(id: string): Promise<{ execution: Execution; tasks: Task[] }> {
    const result = await this.stores.statsStoreService.listProcesses({ offset: 0, limit: 1 } as any);
    const p = result.items.find((x) => x.id === id);
    if (!p) throw Object.assign(new Error("Execution not found"), { statusCode: 404 });

    const tasksResult = await this.stores.statsStoreService.listNodes({ offset: 0, limit: 100, processId: id } as any);

    return {
      execution: {
        id: p.id,
        workflowName: p.workflowId ?? "",
        status: p.status as any,
        startedAt: p.startedAt ?? 0,
        updatedAt: p.updatedAt ?? 0,
        createdAt: p.createdAt ?? 0,
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

  async listTasks(executionId: string, params: PaginationParams): Promise<PaginatedResult<Task>> {
    const result = await this.stores.statsStoreService.listNodes({ ...params, processId: executionId } as any);
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
