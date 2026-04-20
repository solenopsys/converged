import type { RuntimeService, ExecutionEvent, MagicLinkParams, MagicLinkResult } from "g-runtime";
import { createDagServiceClient, type ResumeExecutionsResult } from "g-dag";
import { createShedullerServiceClient } from "g-sheduller";
import { CronEngine } from "./engines/cron";
import { sendMagicLink } from "./gates/send-magic-link";
import { Access } from "nrpc";
import { initProvidersPool } from "./workflows/providers";
import { RuntimeScriptResolver, type WorkflowCtor } from "./script-resolver";

type RunExecutionOptions = {
  emit?: (event: ExecutionEvent) => void;
  skipOpen?: boolean;
};

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

export class RuntimeServiceImpl implements RuntimeService {
  private dagClient: ReturnType<typeof createDagServiceClient>;
  private shedullerClient: ReturnType<typeof createShedullerServiceClient>;
  private cronEngine: CronEngine;
  private cronRefreshTimer?: ReturnType<typeof setInterval>;
  private startupSyncTimer?: ReturnType<typeof setTimeout>;
  private scheduledCronIds = new Set<string>();
  private workflowNames: string[] = [];
  private workflowCtors: Map<string, WorkflowCtor> = new Map();
  private activeExecutionIds = new Set<string>();
  private scriptResolver: RuntimeScriptResolver;

  constructor(config?: any) {
    const baseUrl = process.env.SERVICES_BASE ?? "http://localhost:3000/services";
    this.dagClient = createDagServiceClient({ baseUrl });
    this.shedullerClient = createShedullerServiceClient({ baseUrl });

    const workflows = config?.workflows ?? {};
    const workflowList: any[] = Array.isArray(workflows.WORKFLOWS) ? workflows.WORKFLOWS : [];
    this.workflowNames = this.resolveWorkflowNames(workflowList);
    this.workflowCtors = new Map(
      workflowList
        .filter((entry: any) => entry?.name && entry?.ctor)
        .map((entry: any) => [entry.name, entry.ctor]),
    );

    const openai = config?.openai;
    const gemini = config?.gemini;
    const providerStore = {
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
    };
    initProvidersPool(providerStore);
    if (typeof workflows.initProvidersPool === "function") {
      workflows.initProvidersPool(providerStore);
    }

    this.scriptResolver = new RuntimeScriptResolver({
      baseUrl,
      checkIntervalMs: Number(process.env.RUNTIME_SCRIPT_HASH_CHECK_INTERVAL_MS || 0),
      refreshIntervalMs: Number(process.env.RUNTIME_SCRIPT_HASH_REFRESH_INTERVAL_MS || 0),
      registerShutdownTask: config?.registerShutdownTask,
    });

    this.cronEngine = new CronEngine((record) => {
      console.log(`[runtime] cron fired: ${record.cronName} success=${record.success}`);
      void this.recordCronHistory(record);
    });

    const refreshIntervalMs = Number(process.env.CRON_REFRESH_INTERVAL_MS || 30000);
    this.cronRefreshTimer = setInterval(() => {
      void this.refreshCrons().catch((error) => {
        this.logRefreshCronsFailure("periodic", error);
      });
    }, Number.isFinite(refreshIntervalMs) && refreshIntervalMs > 0 ? refreshIntervalMs : 30000);

    this.scheduleStartupSync();

    if (typeof config?.registerShutdownTask === "function") {
      config.registerShutdownTask("runtime:cron-refresh", async () => {
        if (this.cronRefreshTimer) {
          clearInterval(this.cronRefreshTimer);
        }
        if (this.startupSyncTimer) {
          clearTimeout(this.startupSyncTimer);
        }
      });
    }
  }

  private scheduleStartupSync(): void {
    const configuredDelay = Number(process.env.RUNTIME_STARTUP_SYNC_DELAY_MS ?? 1000);
    const delayMs = Number.isFinite(configuredDelay) && configuredDelay > 0 ? configuredDelay : 0;

    this.startupSyncTimer = setTimeout(() => {
      this.startupSyncTimer = undefined;
      void this.refreshCrons().catch((error) => {
        this.logRefreshCronsFailure("initial", error);
      });

      void this.resumeActiveExecutions(200)
        .then((summary) => {
          if (summary.resumed || summary.skipped || summary.failed) {
            console.info(
              `[runtime] resumeActiveExecutions resumed=${summary.resumed} skipped=${summary.skipped} failed=${summary.failed}`,
            );
          }
        })
        .catch((error) => {
          this.logResumeDagFailure(error);
        });
    }, delayMs);

    (this.startupSyncTimer as any)?.unref?.();
  }

  private resolveWorkflowNames(workflowList: any[]): string[] {
    const names = workflowList
      .map((entry: any) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry.name === "string") return entry.name;
        return "";
      })
      .filter((name: string) => name.length > 0);
    return Array.from(new Set(names));
  }

  private isTemporaryHostUnavailable(error: unknown): boolean {
    const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
    if (message.includes("storage error: storenotfound") || message === "storenotfound") {
      return true;
    }

    return (
      message.includes("unable to connect") ||
      message.includes("connectionrefused") ||
      message.includes("connection refused") ||
      message.includes("econnrefused") ||
      /(^|[^a-z])enotfound([^a-z]|$)/.test(message) ||
      message.includes("eai_again") ||
      message.includes("etimedout") ||
      message.includes("request timeout")
    );
  }

  private requireDagMethod<T extends (...args: any[]) => any>(name: string): T {
    const fn = (this.dagClient as any)[name];
    if (typeof fn !== "function") {
      throw new Error(`dag service does not expose ${name}`);
    }
    return fn.bind(this.dagClient) as T;
  }

  private logRefreshCronsFailure(stage: "initial" | "periodic", error: unknown): void {
    if (this.isTemporaryHostUnavailable(error)) {
      const details = error instanceof Error ? error.message : String(error ?? "unknown error");
      console.info(`[runtime] refreshCrons ${stage}: sheduller host temporarily unavailable (${details})`);
      return;
    }

    console.error(`[runtime] refreshCrons ${stage} failed`, error);
  }

  private logResumeDagFailure(error: unknown): void {
    if (this.isTemporaryHostUnavailable(error)) {
      const details = error instanceof Error ? error.message : String(error ?? "unknown error");
      console.info(`[runtime] resumeActiveExecutions skipped: dag host temporarily unavailable (${details})`);
      return;
    }
    console.error("[runtime] resumeActiveExecutions failed", error);
  }

  private async recordCronHistory(entry: {
    cronId: string;
    cronName: string;
    provider: string;
    action: string;
    success: boolean;
    message?: string;
  }): Promise<void> {
    const recordHistory = (this.shedullerClient as any).recordHistory;
    if (typeof recordHistory !== "function") {
      return;
    }

    try {
      await recordHistory.call(this.shedullerClient, entry);
    } catch (error) {
      if (this.isTemporaryHostUnavailable(error)) {
        const details = error instanceof Error ? error.message : String(error ?? "unknown error");
        console.info(`[runtime] recordCronHistory skipped: sheduller host temporarily unavailable (${details})`);
        return;
      }
      console.error("[runtime] recordCronHistory failed", error);
    }
  }

  private async getCachedNodeResult(executionId: string, nodeId: string): Promise<{ hit: boolean; result?: any }> {
    const fn = this.requireDagMethod<
      (executionId: string, nodeId: string) => Promise<{ hit: boolean; result?: any }>
    >("getCachedNodeResult");
    return fn(executionId, nodeId);
  }

  private async loadVarsCache(): Promise<Map<string, any>> {
    const response = await this.dagClient.listVars();
    const items = Array.isArray((response as any)?.items) ? (response as any).items : [];
    const map = new Map<string, any>();
    for (const item of items) {
      if (item && typeof item.key === "string") {
        map.set(item.key, item.value);
      }
    }
    return map;
  }

  private async runExecution(
    executionId: string,
    workflowName: string,
    params: Record<string, any>,
    options: RunExecutionOptions = {},
  ): Promise<void> {
    if (this.activeExecutionIds.has(executionId)) {
      return;
    }
    this.activeExecutionIds.add(executionId);
    const emit = options.emit ?? (() => {});

    const openExecution = this.requireDagMethod<
      (id: string, workflowName: string, params: Record<string, any>) => Promise<void>
    >("openExecution");
    const setExecutionStatus = this.requireDagMethod<
      (id: string, status: "running" | "done" | "failed") => Promise<void>
    >("setExecutionStatus");
    const createTask = this.requireDagMethod<
      (executionId: string, nodeId: string) => Promise<{ id: number; createdAt: number }>
    >("createTask");
    const setTaskProcessing = this.requireDagMethod<
      (taskId: number, startedAt: number) => Promise<void>
    >("setTaskProcessing");
    const setTaskDone = this.requireDagMethod<
      (taskId: number, executionId: string, nodeId: string, completedAt: number, result: any) => Promise<void>
    >("setTaskDone");
    const setTaskFailed = this.requireDagMethod<
      (taskId: number, completedAt: number, errorMessage: string) => Promise<void>
    >("setTaskFailed");

    try {
      if (!options.skipOpen) {
        await openExecution(executionId, workflowName, params);
      }
      emit({ type: "started", executionId });

      const Ctor = await this.resolveWorkflowCtor(workflowName);
      if (!Ctor) {
        await setExecutionStatus(executionId, "failed");
        emit({ type: "failed", executionId, error: `Workflow "${workflowName}" not found` });
        return;
      }

      const vars = await this.loadVarsCache();
      const ctx = {
        runNode: async (workflowId: string, nodeName: string, fn: () => Promise<any>) => {
          const cached = await this.getCachedNodeResult(workflowId, nodeName);
          if (cached.hit) {
            return cached.result;
          }

          const taskTicket = await createTask(workflowId, nodeName);
          const createdAt = Number(taskTicket?.createdAt ?? Date.now());
          emit({
            type: "task_update",
            executionId,
            task: {
              id: taskTicket.id,
              executionId,
              nodeId: nodeName,
              state: "queued",
              startedAt: null,
              completedAt: null,
              errorMessage: null,
              retryCount: 0,
              createdAt,
            },
          });

          const startedAt = Date.now();
          await setTaskProcessing(taskTicket.id, startedAt);
          emit({
            type: "task_update",
            executionId,
            task: {
              id: taskTicket.id,
              executionId,
              nodeId: nodeName,
              state: "processing",
              startedAt,
              completedAt: null,
              errorMessage: null,
              retryCount: 0,
              createdAt,
            },
          });

          try {
            const result = await fn();
            const persistedResult = result === undefined ? null : result;
            const completedAt = Date.now();
            await setTaskDone(taskTicket.id, workflowId, nodeName, completedAt, persistedResult);
            emit({
              type: "task_update",
              executionId,
              task: {
                id: taskTicket.id,
                executionId,
                nodeId: nodeName,
                state: "done",
                startedAt,
                completedAt,
                errorMessage: null,
                retryCount: 0,
                createdAt,
                result: persistedResult,
              },
            });
            return result;
          } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const completedAt = Date.now();
            await setTaskFailed(taskTicket.id, completedAt, errorMessage);
            emit({
              type: "task_update",
              executionId,
              task: {
                id: taskTicket.id,
                executionId,
                nodeId: nodeName,
                state: "failed",
                startedAt,
                completedAt,
                errorMessage,
                retryCount: 0,
                createdAt,
              },
            });
            throw error;
          }
        },
        setStatus: (_workflowId: string, status: "running" | "done" | "failed") => {
          void setExecutionStatus(executionId, status).catch((error) => {
            console.error(`[runtime] setExecutionStatus failed id=${executionId} status=${status}`, error);
          });
        },
        getVar: (key: string) => vars.get(key),
        setVar: (key: string, value: any) => {
          vars.set(key, value);
          void this.dagClient.setVar(key, value).catch((error) => {
            console.error(`[runtime] setVar failed key=${key}`, error);
          });
        },
        scripts: this.scriptResolver,
        importScript: (path: string) => this.scriptResolver.import(path),
      };

      const workflow = new Ctor(ctx, executionId);
      try {
        await workflow.start(params);
        await setExecutionStatus(executionId, "done");
        emit({ type: "completed", executionId });
      } catch (error: any) {
        await setExecutionStatus(executionId, "failed");
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
        console.error(`[runtime] startExecution failed id=${executionId} workflow=${workflowName}`, error);
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
    void this.runExecution(executionId, workflowName, params).catch((error) => {
      console.error(`[runtime] createExecution failed id=${executionId} workflow=${workflowName}`, error);
    });
    return { id: executionId };
  }

  async resumeActiveExecutions(limit = 200): Promise<ResumeExecutionsResult> {
    const listResumable = this.requireDagMethod<
      (limit?: number) => Promise<{ items: Array<{ id: string; workflowName: string; params: Record<string, any> }> }>
    >("listResumableExecutions");

    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 200;
    const result = await listResumable(safeLimit);
    const items = Array.isArray(result?.items) ? result.items : [];

    let resumed = 0;
    let skipped = 0;
    let failed = 0;
    const ids: string[] = [];

    for (const item of items) {
      if (!item?.id || !item?.workflowName || !item?.params || typeof item.params !== "object") {
        failed += 1;
        continue;
      }

      if (this.activeExecutionIds.has(item.id)) {
        skipped += 1;
        continue;
      }

      resumed += 1;
      ids.push(item.id);
      void this.runExecution(item.id, item.workflowName, item.params, { skipOpen: true })
        .catch((error) => {
          console.error(`[runtime] resume execution failed id=${item.id} workflow=${item.workflowName}`, error);
        });
    }

    return { resumed, skipped, failed, ids };
  }

  async listWorkflows(): Promise<{ names: string[] }> {
    try {
      const dynamicNames = await this.scriptResolver.listWorkflowNames();
      return { names: Array.from(new Set([...dynamicNames, ...this.workflowNames])).sort() };
    } catch (error) {
      if (!this.isTemporaryHostUnavailable(error)) {
        console.error("[runtime] listWorkflows from ms-scripts failed", error);
      }
      return { names: this.workflowNames };
    }
  }

  private async resolveWorkflowCtor(workflowName: string): Promise<WorkflowCtor | undefined> {
    const staticCtor = this.workflowCtors.get(workflowName);
    if (staticCtor) return staticCtor;

    try {
      return await this.scriptResolver.resolveWorkflowCtor(workflowName);
    } catch (error) {
      if (this.isTemporaryHostUnavailable(error)) {
        console.error(`[runtime] resolve workflow from ms-scripts temporarily unavailable workflow=${workflowName}`, error);
        return undefined;
      }
      throw error;
    }
  }

  async refreshCrons(): Promise<void> {
    const list = await this.shedullerClient.listCrons({
      offset: 0,
      limit: 10000,
      status: "active" as any,
    } as any);
    const active = Array.isArray((list as any)?.items) ? (list as any).items as Array<any> : [];
    const activeIds = new Set(active.map((entry) => String(entry.id)));

    for (const id of this.scheduledCronIds) {
      if (!activeIds.has(id)) {
        this.cronEngine.unschedule(id);
      }
    }

    for (const entry of active) {
      if (!entry?.id || !entry?.expression || !entry?.provider || !entry?.action) continue;
      this.cronEngine.schedule(entry);
    }

    this.scheduledCronIds = activeIds;
    console.log(`[runtime] refreshCrons: active=${active.length}`);
  }

  @Access("public")
  async sendMagicLink(params: MagicLinkParams): Promise<MagicLinkResult> {
    await sendMagicLink(params);
    return { success: true };
  }
}

export default RuntimeServiceImpl;
