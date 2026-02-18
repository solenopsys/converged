import type { StoreController } from "../controller";
import type { MessageStatus } from "../store/processing";
import type { NodeState } from "../store/stats";
import { StoreExecutionContext } from "./context";
import { runAspects } from "./aspects";
import { createNodeFromCall } from "./node-factory";
import type { WorkflowDefinition, WorkflowNode, NODE_START, NODE_END } from "./types";

const MAX_PROCESS_LOOPS = 1000;

/**
 * Strategic contour - Workflow Router
 * Only routes messages between nodes based on edges.
 * Does NOT execute node logic.
 */
export class WorkflowRuntime {
  private workflows = new Map<string, WorkflowDefinition>();
  private nodeStatsIds = new Map<string, number>();

  public readonly persistent: {
    get: <T = any>(key: string) => T | undefined;
    set: <T = any>(key: string, value: T) => void;
    delete: (key: string) => void;
    has: (key: string) => boolean;
  };

  constructor(private store: StoreController) {
    this.persistent = {
      get: <T = any>(key: string) => this.store.processing.get<T>(key),
      set: <T = any>(key: string, value: T) => this.store.processing.set<T>(key, value),
      delete: (key: string) => this.store.processing.delete(key),
      has: (key: string) => this.store.processing.has(key),
    };
  }

  register(definition: WorkflowDefinition) {
    this.workflows.set(definition.name, definition);
  }

  registerAll(definitions: WorkflowDefinition[]) {
    for (const definition of definitions) {
      this.register(definition);
    }
  }

  getWorkflowNameFromContext(contextKey: string): string {
    const parts = contextKey.split(":");
    return parts.length >= 2 ? parts[1] : contextKey;
  }

  // Get outgoing edges from a node
  private getOutgoingEdges(workflow: WorkflowDefinition, fromNode: string): string[] {
    return workflow.edges
      .filter(edge => edge.from === fromNode)
      .map(edge => edge.to);
  }

  async emit(contextKey: string, nodeName: string, payload?: any, meta?: any) {
    this.store.processing.messages.emit(contextKey, nodeName, payload, meta);
  }

  private async ensureProcessStats(
    contextKey: string,
    workflowName?: string,
  ): Promise<void> {
    if (!this.store.stats) return;
    try {
      const meta = this.store.processing.contexts.getContextMeta(contextKey);
      await this.store.stats.ensureProcess({
        id: contextKey,
        workflowId: workflowName ?? this.getWorkflowNameFromContext(contextKey),
        status: "running",
        startedAt: Date.now(),
        updatedAt: Date.now(),
        meta,
      });
    } catch (error) {
      console.warn("Failed to ensure process stats:", error);
    }
  }

  private async createNodeStats(
    nodeContextKey: string,
    workflowContextKey: string,
    nodeName: string,
  ): Promise<void> {
    if (!this.store.stats) return;
    try {
      const now = Date.now();
      const node = await this.store.stats.createNode({
        processId: workflowContextKey,
        nodeId: nodeName,
        state: "queued",
        createdAt: now,
        updatedAt: now,
      });
      this.nodeStatsIds.set(nodeContextKey, node.id);
    } catch (error) {
      console.warn("Failed to create node stats:", error);
    }
  }

  private async updateNodeStats(
    nodeContextKey: string,
    patch: {
      state?: NodeState;
      started_at?: number | null;
      completed_at?: number | null;
      updated_at?: number | null;
      errorMessage?: string | null;
    },
  ): Promise<void> {
    if (!this.store.stats) return;
    const nodeId = this.nodeStatsIds.get(nodeContextKey);
    if (!nodeId) return;
    try {
      await this.store.stats.updateNode(nodeId, {
        state: patch.state,
        started_at: patch.started_at ?? undefined,
        completed_at: patch.completed_at ?? undefined,
        updated_at: patch.updated_at ?? undefined,
        errorMessage: patch.errorMessage,
      });
    } catch (error) {
      console.warn("Failed to update node stats:", error);
    }
  }

  logAspectStart(contextKey: string, aspect: string, data?: any): string {
    return this.store.processing.aspects.start(contextKey, aspect, data);
  }

  logAspectEnd(contextKey: string, id: string, aspect: string, data?: any) {
    this.store.processing.aspects.end(contextKey, id, aspect, data);
  }

  logAspectError(contextKey: string, id: string, aspect: string, error: string) {
    this.store.processing.aspects.error(contextKey, id, aspect, error);
  }

  private setMessageStatus(contextKey: string, messageId: string, status: MessageStatus) {
    this.store.processing.messages.setStatus(contextKey, messageId, status);
  }

  /**
   * Strategic contour: process workflow context
   * Routes messages to nodes based on edges
   */
  async processWorkflowContext(contextKey: string): Promise<string[]> {
    const workflowName = this.getWorkflowNameFromContext(contextKey);
    const workflow = this.workflows.get(workflowName);
    const createdNodeContexts: string[] = [];

    console.log(`[dag] Processing workflow context: ${contextKey}, workflow: ${workflowName}`);

    if (!workflow) {
      console.error(`[dag] Workflow not registered: ${workflowName}`);
      return createdNodeContexts;
    }

    let loops = 0;
    while (loops < MAX_PROCESS_LOOPS) {
      loops += 1;
      const messages = this.store.processing.messages.listByStatus(contextKey, "queued");
      if (!messages.length) {
        break;
      }

      for (const message of messages) {
        const nodeName = message.type;
        this.setMessageStatus(contextKey, message.id, "processing");

        console.log(`[dag] Routing message to node: ${nodeName} in ${workflowName}`);

        // END node - workflow complete
        if (nodeName === "END") {
          console.log(`[dag] Workflow ${workflowName} reached END`);
          this.setMessageStatus(contextKey, message.id, "done");
          continue;
        }

        // START node - route to first nodes
        if (nodeName === "START") {
          const nextNodes = this.getOutgoingEdges(workflow, "START");
          console.log(`[dag] START -> routing to: ${nextNodes.join(", ")}`);
          for (const nextNode of nextNodes) {
            await this.emit(contextKey, nextNode);
          }
          this.setMessageStatus(contextKey, message.id, "done");
          continue;
        }

        // Regular node - dispatch to node processor
        const nodeDefinition = workflow.nodes[nodeName];
        if (!nodeDefinition) {
          console.error(`[dag] Node not found in workflow: ${nodeName}`);
          this.setMessageStatus(contextKey, message.id, "failed");
          continue;
        }

        const nodeContextKey = await this.dispatchNode(
          contextKey,
          message.id,
          nodeName,
          nodeDefinition,
        );
        createdNodeContexts.push(nodeContextKey);
        this.setMessageStatus(contextKey, message.id, "done");
      }
    }

    return createdNodeContexts;
  }

  private getRootContextId(contextKey: string): string | undefined {
    const contextValue = this.store.processing.contexts.getContextMeta(contextKey);
    const meta = contextValue?.meta;
    return meta?.rootContextId ?? meta?.parentContextId;
  }

  private async dispatchNode(
    workflowContextKey: string,
    parentMessageId: string,
    nodeName: string,
    nodeDefinition: WorkflowNode,
  ): Promise<string> {
    const meta = {
      workflowContextKey,
      parentMessageId,
      nodeName,
      nodeType: nodeDefinition.type,
      rootContextId: this.getRootContextId(workflowContextKey),
    };
    const nodeContextKey = this.store.processing.contexts.createContext(nodeName, meta);

    // Сообщение только для сигнала запуска, без payload
    this.store.processing.messages.emit(nodeContextKey, "node.exec");

    await this.createNodeStats(nodeContextKey, workflowContextKey, nodeName);

    return nodeContextKey;
  }

  /**
   * Tactical contour: process node context
   * Executes node with aspects, returns result to workflow
   */
  async processNodeContext(nodeContextKey: string): Promise<void> {
    const contextValue = this.store.processing.contexts.getContextMeta(nodeContextKey);
    const meta = contextValue?.meta;
    const workflowContextKey = meta?.workflowContextKey as string | undefined;
    const nodeName = meta?.nodeName as string | undefined;
    const nodeType = meta?.nodeType as string | undefined;

    console.log(`[dag] Processing node context: ${nodeContextKey}, node: ${nodeName}`);

    if (!workflowContextKey || !nodeName || !nodeType) {
      console.error(`[dag] Node context missing required meta: ${nodeContextKey}`);
      return;
    }

    const workflowName = this.getWorkflowNameFromContext(workflowContextKey);
    const workflow = this.workflows.get(workflowName);
    if (!workflow) {
      console.error(`[dag] Workflow not found: ${workflowName}`);
      return;
    }

    // Берём config и aspects из workflow definition, не из сообщения
    const nodeDefinition = workflow.nodes[nodeName];
    if (!nodeDefinition) {
      console.error(`[dag] Node definition not found: ${nodeName}`);
      return;
    }

    const messages = this.store.processing.messages.listByStatus(nodeContextKey, "queued");
    for (const message of messages) {
      this.setMessageStatus(nodeContextKey, message.id, "processing");
      await this.updateNodeStats(nodeContextKey, {
        state: "processing",
        started_at: Date.now(),
        updated_at: Date.now(),
      });

      try {
        console.log(`[dag] Executing node: ${nodeName} (type: ${nodeType})`);

        const workflowCtx = new StoreExecutionContext(
          this.store.processing.contexts,
          workflowContextKey,
        );
        const nodeCtx = new StoreExecutionContext(
          this.store.processing.contexts,
          nodeContextKey,
        );

        // Execute node with aspects - input данные берутся из контекста через аспекты
        const result = await this.executeNode(
          {
            nodeName,
            nodeType,
            config: nodeDefinition.config ?? {},
            aspects: nodeDefinition.aspects ?? [],
          },
          nodeCtx,
          workflowCtx,
        );
        console.log(`[dag] Node ${nodeName} completed, skipped: ${result.skipped}`);

        // Store output in workflow context
        if (!result.skipped) {
          workflowCtx.setToPath(nodeName, result.output);
        }

        this.setMessageStatus(nodeContextKey, message.id, "done");
        await this.updateNodeStats(nodeContextKey, {
          state: "done",
          completed_at: Date.now(),
          updated_at: Date.now(),
        });

        // Route to next nodes (if not skipped)
        if (!result.skipped) {
          const nextNodes = this.getOutgoingEdges(workflow, nodeName);
          console.log(`[dag] Node ${nodeName} -> routing to: ${nextNodes.join(", ") || "none"}`);
          for (const nextNode of nextNodes) {
            // Не передаём payload - данные уже в контексте, аспекты их достанут по пути
            await this.emit(workflowContextKey, nextNode);
          }
        }

      } catch (error) {
        this.setMessageStatus(nodeContextKey, message.id, "failed");
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        console.error(`[dag] Node execution failed:`, errorMessage);
        if (errorStack) {
          console.error(`[dag] Stack:`, errorStack);
        }

        this.store.processing.contexts.addDataToContext(nodeContextKey, "error", {
          message: errorMessage,
        });
        await this.updateNodeStats(nodeContextKey, {
          state: "failed",
          completed_at: Date.now(),
          updated_at: Date.now(),
          errorMessage,
        });
      }
    }
  }

  private async executeNode(
    nodeCall: {
      nodeName: string;
      nodeType: string;
      config: Record<string, any>;
      aspects: any[];
    },
    nodeCtx: StoreExecutionContext,
    workflowCtx: StoreExecutionContext,
  ) {
    // Ensure provider if configured
    if (nodeCall.config?.provider) {
      const providerName = nodeCall.config.provider;
      if (nodeCall.config.providerConfig) {
        await this.ensureProvider(providerName, nodeCall.config.providerConfig.codeName, {
          name: providerName,
          connection: nodeCall.config.providerConfig.connection,
        });
      }
    }

    const execute = async (input: any) => {
      const node = createNodeFromCall(
        {
          nodeType: nodeCall.nodeType,
          nodeName: nodeCall.nodeName,
          config: nodeCall.config,
        },
        this.store.registry,
        { persistent: this.persistent },
      );
      return node.execute(input);
    };

    // Input данные берутся из workflowCtx через аспекты (inputs aspect)
    return runAspects(
      nodeCtx,
      this,
      nodeCall.aspects ?? [],
      execute,
      {},
      {
        dataContext: workflowCtx.context,
        logContextKey: nodeCtx.contextKey,
      },
    );
  }

  async startWorkflow(
    name: string,
    options: {
      parentContextId?: string;
      rootContextId?: string;
      meta?: any;
      payload?: any;
    } = {},
  ): Promise<string> {
    const parentContextId = options.parentContextId;
    const rootContextId = options.rootContextId ?? parentContextId;
    const meta = {
      workflow: name,
      parentContextId,
      rootContextId,
      ...(options.meta ?? {}),
    };
    const contextKey = this.store.processing.contexts.createContext(name, meta);

    // Always start with START node
    await this.emit(contextKey, "START", options.payload);
    await this.ensureProcessStats(contextKey, name);

    return contextKey;
  }

  async ensureProvider(name: string, codeName: string, config: Record<string, any>) {
    const exists = await this.store.registry.providerExists(name);
    if (!exists) {
      this.store.registry.createProvider(name, codeName, config);
    }
  }

  getRegistry() {
    return this.store.registry;
  }
}
