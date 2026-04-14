import type {
  DagService,
  Execution,
  Task,
  PaginationParams,
  PaginatedResult,
  ExecutionEvent,
  ResumeExecutionsResult,
} from "g-dag";
import { StoresController } from "./store";

class ExecutionEventChannel implements AsyncIterable<ExecutionEvent> {
  private queue: ExecutionEvent[] = [];
  private waiters: Array<() => void> = [];
  private closed = false;

  push(event: ExecutionEvent): void {
    this.queue.push(event);
    const waiter = this.waiters.shift();
    waiter?.();
  }

  close(): void {
    this.closed = true;
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      waiter?.();
    }
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<ExecutionEvent> {
    while (true) {
      if (this.queue.length > 0) {
        yield this.queue.shift()!;
        continue;
      }

      if (this.closed) {
        return;
      }

      await new Promise<void>((resolve) => {
        this.waiters.push(resolve);
      });
    }
  }
}

type RunExecutionOptions = {
  emit?: (event: ExecutionEvent) => void;
};

export default class DagServiceImpl implements DagService {
  private stores: StoresController;
  private readonly storesReady: Promise<void>;
  private readonly workflowCtors: Map<string, new (ctx: any, id?: string) => any>;
  private readonly activeExecutionIds = new Set<string>();

  constructor(config?: any) {
    this.stores = new StoresController("dag-ms");
    this.storesReady = this.stores.init()
      .catch((error) => {
        console.error("[dag-ms] store init error", error);
        throw error;
      });

    const wf = config?.workflows ?? {};
    const list: any[] = wf.WORKFLOWS ?? [];
    this.workflowCtors = new Map(
      list
        .filter((w: any) => w.name && w.ctor)
        .map((w: any) => [w.name, w.ctor]),
    );

    if (typeof wf.initProvidersPool === "function") {
      const openai = config?.openai;
      const gemini = config?.gemini;
      wf.initProvidersPool({
        async getProvider(name: string) {
          if (name === "openai" && openai?.key) {
            return {
              codeName: "openai",
              config: { token: openai.key, model: openai.model ?? "gpt-4o-mini" },
            };
          }
          if (name === "gemini" && gemini?.key) {
            return {
              codeName: "gemini",
              config: { token: gemini.key, model: gemini.model ?? "gemini-3.1-flash-lite" },
            };
          }
          throw new Error(`Provider "${name}" not configured`);
        },
      });
    }

    void this.resumeActiveExecutions()
      .then((summary) => {
        if (summary.resumed || summary.skipped || summary.failed) {
          console.info(
            `[dag-ms] resumeActiveExecutions resumed=${summary.resumed} skipped=${summary.skipped} failed=${summary.failed}`,
          );
        }
      })
      .catch((error) => {
        console.error("[dag-ms] resumeActiveExecutions failed", error);
      });
  }

  private async ensureStoresReady(): Promise<void> {
    await this.storesReady;
  }

  private async runExecution(
    executionId: string,
    workflowName: string,
    params: Record<string, any>,
    options: RunExecutionOptions = {},
  ): Promise<void> {
    await this.ensureStoresReady();
    if (this.activeExecutionIds.has(executionId)) {
      return;
    }

    this.activeExecutionIds.add(executionId);
    const emit = options.emit ?? (() => {});
    const stats = this.stores.statsStoreService;
    const kv = this.stores.processingStoreService;

    try {
      await stats.ensureProcess({ id: executionId, workflowId: workflowName, status: "running" });
      kv.saveExecutionContext(workflowName, executionId, { workflowName, params });
      emit({ type: "started", executionId });

      const Ctor = this.workflowCtors.get(workflowName);
      if (!Ctor) {
        await stats.updateProcess(executionId, { status: "failed", updated_at: Date.now() } as any);
        emit({ type: "failed", executionId, error: `Workflow "${workflowName}" not found` });
        return;
      }

      const ctx = {
        runNode: async (workflowId: string, nodeName: string, fn: () => Promise<any>) => {
          const cachedRecordId = kv.getStep(workflowId, nodeName);
          if (cachedRecordId !== undefined) {
            const cached = kv.getRecord(cachedRecordId);
            if (cached !== undefined) {
              return cached.result;
            }
          }

          const nodeRow = await stats.createNode({
            processId: executionId,
            nodeId: nodeName,
            state: "queued",
            startedAt: null,
          });
          emit({
            type: "task_update",
            executionId,
            task: {
              id: nodeRow.id,
              executionId,
              nodeId: nodeName,
              state: "queued",
              startedAt: null,
              completedAt: null,
              errorMessage: null,
              retryCount: 0,
              createdAt: Date.now(),
            },
          });

          const startedAt = Date.now();
          await stats.updateNode(nodeRow.id, { state: "processing", started_at: startedAt } as any);
          emit({
            type: "task_update",
            executionId,
            task: {
              id: nodeRow.id,
              executionId,
              nodeId: nodeName,
              state: "processing",
              startedAt,
              completedAt: null,
              errorMessage: null,
              retryCount: 0,
              createdAt: Date.now(),
            },
          });

          try {
            const result = await fn();
            const completedAt = Date.now();
            const recordId = `${workflowId}:${nodeName}`;
            kv.setRecord(recordId, { data: null, result });
            kv.setStep(workflowId, nodeName, recordId);
            await stats.updateNode(
              nodeRow.id,
              { state: "done", completed_at: completedAt, record_id: recordId } as any,
            );
            emit({
              type: "task_update",
              executionId,
              task: {
                id: nodeRow.id,
                executionId,
                nodeId: nodeName,
                state: "done",
                startedAt,
                completedAt,
                errorMessage: null,
                retryCount: 0,
                createdAt: Date.now(),
                result,
              },
            });
            return result;
          } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const completedAt = Date.now();
            await stats.updateNode(
              nodeRow.id,
              { state: "failed", error_message: errorMessage, completed_at: completedAt } as any,
            );
            emit({
              type: "task_update",
              executionId,
              task: {
                id: nodeRow.id,
                executionId,
                nodeId: nodeName,
                state: "failed",
                startedAt,
                completedAt,
                errorMessage,
                retryCount: 0,
                createdAt: Date.now(),
              },
            });
            throw error;
          }
        },
        setStatus: (workflowId: string, status: string) => {
          kv.setStatus(workflowId, status);
          void stats.updateProcess(workflowId, { status: status as any, updated_at: Date.now() } as any);
        },
        getVar: (key: string) => kv.get(key),
        setVar: (key: string, value: any) => kv.set(key, value),
      };

      const workflow = new Ctor(ctx, executionId);
      try {
        await workflow.start(params);
        await stats.updateProcess(executionId, { status: "done", updated_at: Date.now() } as any);
        emit({ type: "completed", executionId });
      } catch (error: any) {
        await stats.updateProcess(executionId, { status: "failed", updated_at: Date.now() } as any);
        emit({ type: "failed", executionId, error: error?.message ?? String(error) });
      }
    } finally {
      this.activeExecutionIds.delete(executionId);
    }
  }

  async *startExecution(workflowName: string, params: Record<string, any>): AsyncIterable<ExecutionEvent> {
    const executionId = crypto.randomUUID();
    const channel = new ExecutionEventChannel();

    void this.runExecution(executionId, workflowName, params, {
      emit: (event) => channel.push(event),
    })
      .catch((error) => {
        console.error(`[dag-ms] startExecution failed for workflow "${workflowName}"`, error);
      })
      .finally(() => {
        channel.close();
      });

    for await (const event of channel) {
      yield event;
    }
  }

  async createExecution(workflowName: string, params: Record<string, any>): Promise<{ id: string }> {
    const executionId = crypto.randomUUID();
    void this.runExecution(executionId, workflowName, params)
      .catch((error) => {
        console.error(
          `[dag-ms] createExecution failed for workflow "${workflowName}" id=${executionId}`,
          error,
        );
      });
    return { id: executionId };
  }

  async resumeActiveExecutions(limit = 200): Promise<ResumeExecutionsResult> {
    await this.ensureStoresReady();

    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 200;
    const stats = this.stores.statsStoreService;
    const kv = this.stores.processingStoreService;
    const running = await stats.listProcesses({ offset: 0, limit: safeLimit, status: "running" } as any);

    let resumed = 0;
    let skipped = 0;
    let failed = 0;
    const ids: string[] = [];

    for (const process of running.items) {
      const executionId = process.id;
      const workflowName = process.workflowId ?? "";

      if (!workflowName) {
        failed += 1;
        await stats.updateProcess(executionId, { status: "failed", updated_at: Date.now() } as any);
        continue;
      }

      if (this.activeExecutionIds.has(executionId)) {
        skipped += 1;
        continue;
      }

      const context = kv.getExecutionContext(workflowName, executionId);
      const params =
        context && context.meta && typeof context.meta === "object"
          ? (context.meta as any).params
          : undefined;

      if (!params || typeof params !== "object") {
        failed += 1;
        await stats.updateProcess(executionId, { status: "failed", updated_at: Date.now() } as any);
        console.warn(
          `[dag-ms] skip resume execution=${executionId} workflow=${workflowName}: missing params in execution context`,
        );
        continue;
      }

      resumed += 1;
      ids.push(executionId);
      void this.runExecution(executionId, workflowName, params as Record<string, any>)
        .catch((error) => {
          console.error(
            `[dag-ms] resume failed execution=${executionId} workflow=${workflowName}`,
            error,
          );
        });
    }

    return { resumed, skipped, failed, ids };
  }

  async statusExecution(id: string): Promise<{ execution: Execution; tasks: Task[] }> {
    await this.ensureStoresReady();
    const process = await this.stores.statsStoreService.getProcess(id);
    if (!process) {
      throw Object.assign(new Error("Execution not found"), { statusCode: 404 });
    }

    const kv = this.stores.processingStoreService;
    const tasksResult = await this.stores.statsStoreService.listNodes({
      offset: 0,
      limit: 100,
      processId: id,
    } as any);

    return {
      execution: {
        id: process.id,
        workflowName: (process as any).workflow_id ?? (process as any).workflowId ?? "",
        status: process.status as any,
        startedAt: (process as any).started_at ?? (process as any).startedAt ?? 0,
        updatedAt: (process as any).updated_at ?? (process as any).updatedAt ?? 0,
        createdAt: (process as any).created_at ?? (process as any).createdAt ?? 0,
      },
      tasks: tasksResult.items.map((task) => {
        const record = task.recordId ? kv.getRecord(task.recordId) : undefined;
        return {
          id: task.id,
          executionId: task.processId,
          nodeId: task.nodeId,
          state: task.state as any,
          startedAt: task.startedAt ?? null,
          completedAt: task.completedAt ?? null,
          errorMessage: task.errorMessage ?? null,
          retryCount: task.retryCount,
          createdAt: task.createdAt ?? 0,
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
      items: result.items.map((process) => ({
        id: process.id,
        workflowName: process.workflowId ?? "",
        status: process.status as any,
        startedAt: process.startedAt ?? 0,
        updatedAt: process.updatedAt ?? 0,
        createdAt: process.createdAt ?? 0,
      })),
      totalCount: result.totalCount,
    };
  }

  async listTasks(executionId: string | null, params: PaginationParams): Promise<PaginatedResult<Task>> {
    await this.ensureStoresReady();
    const filter = executionId ? { ...params, processId: executionId } : params;
    const result = await this.stores.statsStoreService.listNodes(filter as any);
    return {
      items: result.items.map((task) => ({
        id: task.id,
        executionId: task.processId,
        nodeId: task.nodeId,
        state: task.state as any,
        startedAt: task.startedAt ?? null,
        completedAt: task.completedAt ?? null,
        errorMessage: task.errorMessage ?? null,
        retryCount: task.retryCount,
        createdAt: task.createdAt ?? 0,
      })),
      totalCount: result.totalCount,
    };
  }

  async stats() {
    await this.ensureStoresReady();
    const [executions, tasks, executionsDaily, executionsTypes, nodesDaily] = await Promise.all([
      this.stores.statsStoreService.getProcessStats(),
      this.stores.statsStoreService.getNodeStats(),
      this.stores.statsStoreService.getProcessDailyStats({ days: 30 }),
      this.stores.statsStoreService.getProcessTypeStats(),
      this.stores.statsStoreService.getNodeDailyStats({ days: 30 }),
    ]);
    return { executions, tasks, executionsDaily, executionsTypes, nodesDaily };
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
