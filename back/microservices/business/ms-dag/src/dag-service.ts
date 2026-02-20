import type {
  DagService,
  ContextStatus,
  MessageStatus,
  ContextInfo,
  NodeExecution,
  NodeState,
} from "./types";
import type { WorkflowDefinition, NodeCallDefinition } from "./core/types";
import type { INode, Provider } from "./dag-api";
import { StoreController } from "./controller";
import { WorkflowRuntime } from "./core/runtime";

export type NodeDefinition = {
  ctor: new (...args: any[]) => INode;
  params: { name: string; type: string }[];
};

export interface DagServiceConfig {
  workflows: WorkflowDefinition[];
  nodes: Record<string, NodeDefinition>;
  providers: Record<string, Provider>;
}

export default class DagServiceImpl implements DagService {
  private store!: StoreController;
  private initPromise: Promise<void>;
  private runtime!: WorkflowRuntime;

  private workflows: WorkflowDefinition[];
  private nodes: Record<string, NodeDefinition>;
  private providers: Record<string, Provider>;

  constructor(config: DagServiceConfig) {
    this.workflows = config.workflows ?? [];
    this.nodes = config.nodes ?? {};
    this.providers = config.providers ?? {};
    this.initPromise = this.init();
  }

  private async init() {
    this.store = await StoreController.getInstance();

    // Регистрируем nodes в registry
    for (const [name, definition] of Object.entries(this.nodes)) {
      this.store.registry.registerNodeDefinition({
        name,
        ctor: definition.ctor,
        params: definition.params,
      });
    }

    // Регистрируем providers в registry
    for (const [name, provider] of Object.entries(this.providers)) {
      this.store.registry.registerProvider(name, provider);
    }

    this.runtime = new WorkflowRuntime(this.store);
    this.runtime.registerAll(this.workflows);
  }

  private async ensureInit() {
    await this.initPromise;
  }

  async status(): Promise<{
    status: string;
    workflows: string[];
    nodes: string[];
    providers: string[];
  }> {
    await this.ensureInit();
    return {
      status: "ok",
      workflows: this.workflows.map(w => w.name),
      nodes: Object.keys(this.nodes),
      providers: Object.keys(this.providers),
    };
  }

  async createContext(
    workflowName: string,
    params: Record<string, any>
  ): Promise<{ contextId: string }> {
    await this.ensureInit();
    const contextId = this.store.processing.contexts.createContext(workflowName, {
      workflow: workflowName,
    });
    this.store.processing.contexts.addDataToContext(contextId, "params", params);
    return { contextId };
  }

  async emit(contextId: string, event: string): Promise<void> {
    await this.ensureInit();
    const now = Date.now();
    const workflowName = this.runtime.getWorkflowNameFromContext(contextId);
    const meta = this.store.processing.contexts.getContextMeta(contextId);

    await this.store.stats?.ensureProcess({
      id: contextId,
      workflowId: workflowName,
      status: "running",
      startedAt: now,
      updatedAt: now,
      meta,
    });

    await this.runtime.emit(contextId, event, { cascade: true });

    const maxLoops = 1000;
    let loops = 0;

    while (loops < maxLoops) {
      loops++;
      const nodeContexts = await this.runtime.processWorkflowContext(contextId);
      for (const nodeContextKey of nodeContexts) {
        await this.runtime.processNodeContext(nodeContextKey);
      }

      const pending = this.store.processing.messages.listByStatus(contextId, "queued");
      if (!pending.length) {
        break;
      }
    }

    const failed = this.store.processing.messages.listByStatus(contextId, "failed");
    await this.store.stats?.updateProcess(contextId, {
      status: failed.length ? "failed" : "done",
      updated_at: Date.now(),
    });
  }

  async getContext(contextId: string): Promise<{
    status: ContextStatus;
    params: Record<string, any>;
    data: Record<string, any>;
    messages: { event: string; status: MessageStatus }[];
  }> {
    await this.ensureInit();
    const context = this.store.processing.contexts.getContext(contextId);
    const messages = this.store.processing.messages.list(contextId);
    const process = await this.store.stats?.processRepo.findById({ id: contextId });

    return {
      status: (process?.status as ContextStatus) || "running",
      params: context?.params || {},
      data: context || {},
      messages: messages.map((m: any) => ({
        event: m.type,
        status: m.status as MessageStatus,
      })),
    };
  }

  async listContexts(params: {
    offset: number;
    limit: number;
  }): Promise<{ items: ContextInfo[]; totalCount?: number }> {
    await this.ensureInit();
    const result = await this.store.stats.listProcesses({
      limit: params.limit,
      offset: params.offset,
    });

    return {
      items: result.items.map((p: any) => ({
        id: p.id,
        workflowName: p.workflowId || "",
        status: p.status as ContextStatus,
        startedAt: p.startedAt ? new Date(p.startedAt).toISOString() : "",
        updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : "",
      })),
      totalCount: result.totalCount || 0,
    };
  }

  async getStats(workflowName?: string): Promise<{
    total: number;
    running: number;
    done: number;
    failed: number;
  }> {
    await this.ensureInit();
    return this.store.stats.getProcessStats({
      workflowId: typeof workflowName === "string" ? workflowName : undefined,
    });
  }

  async getNodeProcessorStats(): Promise<{
    totalCalls: number;
    byNode: Record<string, { calls: number; avgDuration: number; errors: number }>;
  }> {
    await this.ensureInit();
    const nodeStats = await this.store.stats.getNodeStats({});

    return {
      totalCalls: nodeStats.total,
      byNode: {},
    };
  }

  async listNodes(params: {
    offset: number;
    limit: number;
  }): Promise<{ items: NodeExecution[]; totalCount?: number }> {
    await this.ensureInit();
    const result = await this.store.stats.listNodes({
      limit: params.limit,
      offset: params.offset,
    });

    return {
      items: result.items.map((n: any) => ({
        id: n.id,
        processId: n.processId || "",
        nodeId: n.nodeId || "",
        state: n.state as NodeState,
        startedAt: n.startedAt ? new Date(n.startedAt).toISOString() : "",
        completedAt: n.completedAt ? new Date(n.completedAt).toISOString() : "",
        errorMessage: n.errorMessage || "",
        retryCount: n.retryCount || 0,
        createdAt: n.createdAt ? new Date(n.createdAt).toISOString() : "",
      })),
      totalCount: result.totalCount || 0,
    };
  }
}
