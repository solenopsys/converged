import {
  AgentStreamEventType,
  type AgentStreamEvent,
  type AgentServiceConfig,
  type SessionInfo,
  type PaginationParams,
  type PaginatedResult,
  type ToolDefinition,
  type TokenUsage,
} from "./types";
import type { LoopStreamEvent } from "./core/types";
import { StoresController } from "./store";
import { ProviderRegistry } from "./providers/registry";
import { ToolRegistry } from "./tools/registry";
import { BootstrapLoader } from "./bootstrap/loader";
import { SessionManager } from "./session/manager";
import { ContextBuilder } from "./core/context";
import { AgentLoop } from "./core/loop";
import type { Tool } from "./tools/base";

export default class AgentServiceImpl {
  private stores!: StoresController;
  private providerRegistry!: ProviderRegistry;
  private toolRegistry!: ToolRegistry;
  private bootstrapLoader!: BootstrapLoader;
  private sessionManager!: SessionManager;
  private contextBuilder!: ContextBuilder;
  private agentLoop!: AgentLoop;
  private initPromise: Promise<void>;
  private config: AgentServiceConfig;

  constructor(config?: Partial<AgentServiceConfig>) {
    this.config = {
      defaults: {
        model: process.env.AGENT_MODEL || "claude-sonnet-4-20250514",
        maxTokens: 4096,
        temperature: 0.7,
        maxIterations: 20,
        ...config?.defaults,
      },
      providers: {
        anthropic: config?.providers?.anthropic || {
          apiKey:
            process.env.ANTHROPIC_API_KEY ||
            process.env.CLAUDE_API_KEY ||
            "",
        },
        openai: config?.providers?.openai || {
          apiKey: process.env.OPENAI_API_KEY || "",
        },
      },
      bootstrap: config?.bootstrap || {},
      session: {
        maxHistoryMessages: 50,
        ...config?.session,
      },
    };
    this.initPromise = this.init();
  }

  private async init() {
    this.stores = await StoresController.getInstance();

    this.providerRegistry = new ProviderRegistry({
      anthropic: this.config.providers.anthropic?.apiKey,
      openai: this.config.providers.openai?.apiKey,
    });

    this.toolRegistry = new ToolRegistry();

    this.bootstrapLoader = new BootstrapLoader(this.config.bootstrap.dir);
    this.sessionManager = new SessionManager(this.stores);

    this.contextBuilder = new ContextBuilder(
      this.bootstrapLoader,
      this.sessionManager,
      this.config.session.maxHistoryMessages,
    );

    this.agentLoop = new AgentLoop(
      this.contextBuilder,
      this.providerRegistry,
      this.toolRegistry,
      this.sessionManager,
      this.stores.processing,
    );
  }

  private async ensureInit() {
    await this.initPromise;
  }

  registerTool(tool: Tool): void {
    this.toolRegistry.register(tool);
  }

  async createSession(model?: string): Promise<SessionInfo> {
    await this.ensureInit();
    return this.sessionManager.createSession(
      model || this.config.defaults.model,
    );
  }

  async *sendMessage(
    sessionId: string,
    content: string,
  ): AsyncIterable<AgentStreamEvent> {
    await this.ensureInit();

    const session = await this.sessionManager.getSession(sessionId);
    if (!session) {
      yield {
        type: AgentStreamEventType.ERROR,
        message: `Session not found: ${sessionId}`,
      };
      return;
    }

    const loopConfig = {
      model: session.model,
      maxTokens: this.config.defaults.maxTokens,
      temperature: this.config.defaults.temperature,
      maxIterations: this.config.defaults.maxIterations,
    };

    for await (const event of this.agentLoop.run(
      sessionId,
      content,
      loopConfig,
    )) {
      yield this.mapEvent(event);
    }
  }

  async getSession(sessionId: string): Promise<SessionInfo> {
    await this.ensureInit();
    const session = await this.sessionManager.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    return session;
  }

  async listSessions(
    params: PaginationParams,
  ): Promise<PaginatedResult<SessionInfo>> {
    await this.ensureInit();
    return this.sessionManager.listSessions(params.offset, params.limit);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.ensureInit();
    await this.sessionManager.deleteSession(sessionId);
  }

  async listTools(): Promise<ToolDefinition[]> {
    await this.ensureInit();
    return this.toolRegistry.getFunctionDefinitions();
  }

  async getStats(): Promise<{
    sessions: number;
    messages: number;
    tokens: TokenUsage;
  }> {
    await this.ensureInit();
    const sessions = await this.stores.history.sessions.count();
    const messages = await this.stores.history.messages.count();
    return {
      sessions,
      messages,
      tokens: { total: 0, input: 0, output: 0 },
    };
  }

  private mapEvent(event: LoopStreamEvent): AgentStreamEvent {
    switch (event.type) {
      case "text_delta":
        return {
          type: AgentStreamEventType.TEXT_DELTA,
          content: event.content,
          tokens: event.tokens,
        };
      case "tool_call_start":
        return {
          type: AgentStreamEventType.TOOL_CALL_START,
          id: event.id,
          name: event.name,
          args: event.args,
        };
      case "tool_call_result":
        return {
          type: AgentStreamEventType.TOOL_CALL_RESULT,
          id: event.id,
          name: event.name,
          result: event.result,
        };
      case "iteration":
        return {
          type: AgentStreamEventType.ITERATION,
          iteration: event.iteration,
          maxIterations: event.maxIterations,
        };
      case "completed":
        return {
          type: AgentStreamEventType.COMPLETED,
          finishReason: event.finishReason,
          totalIterations: event.totalIterations,
          tokens: event.totalTokens.input + event.totalTokens.output,
        };
      case "error":
        return {
          type: AgentStreamEventType.ERROR,
          message: event.message,
        };
    }
  }
}
