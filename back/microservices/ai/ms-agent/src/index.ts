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
import { StoresController } from "./store";
import { SessionManager } from "./session/manager";

export default class AgentServiceImpl {
  private stores!: StoresController;
  private sessionManager!: SessionManager;
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
      session: {
        maxHistoryMessages: 50,
        ...config?.session,
      },
    };
    this.initPromise = this.init();
  }

  private async init() {
    this.stores = await StoresController.getInstance();
    this.sessionManager = new SessionManager(this.stores);
  }

  private async ensureInit() {
    await this.initPromise;
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
    void content;
    yield {
      type: AgentStreamEventType.ERROR,
      message: `Agent runtime is stateless and is mounted at /runtime/agents. Session data service cannot execute messages: ${sessionId}`,
    };
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
    return [];
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
}
